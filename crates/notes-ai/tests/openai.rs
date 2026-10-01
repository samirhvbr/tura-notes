//! The OpenAI-compatible provider against a server on loopback that plays back
//! canned replies. No network and no real key, so nothing spends.

use notes_ai::{
    ApiKey, ChatMessage, ChatRequest, Effort, Error, OpenAiProvider, Provider, Role, StopReason,
    StreamEvent, TokenLimit,
};
use serde_json::{json, Value};
use std::{
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};

mod common;
use common::{serve, Canned};

const KEY: &str = "sk-test-0123456789";

/// A chunk the way OpenAI writes one: `data:` and no `event:` line.
fn chunk(delta: Value, finish: Value) -> String {
    format!(
        "data: {}\n\n",
        json!({"choices":[{"index":0,"delta":delta,"finish_reason":finish}]})
    )
}
fn content(t: &str) -> String {
    chunk(json!({"content": t}), Value::Null)
}
fn finish(reason: &str) -> String {
    chunk(json!({}), json!(reason))
}
const DONE: &str = "data: [DONE]\n\n";

fn stream_of(parts: &[String]) -> Vec<u8> {
    parts.concat().into_bytes()
}

fn provider(base: &str, key: Option<&str>) -> OpenAiProvider {
    OpenAiProvider::new(&format!("{base}/v1"), key.map(|k| ApiKey::new(k).unwrap())).unwrap()
}

fn request() -> ChatRequest {
    ChatRequest {
        model: "llama3.1".into(),
        system: Some("seja breve".into()),
        messages: vec![
            ChatMessage {
                role: Role::User,
                content: "oi".into(),
            },
            ChatMessage {
                role: Role::Assistant,
                content: "olá".into(),
            },
            ChatMessage {
                role: Role::User,
                content: "e agora?".into(),
            },
        ],
        max_tokens: 256,
        effort: Some(Effort::High),
    }
}

fn collect(p: &OpenAiProvider, r: &ChatRequest) -> (Result<StopReason, Error>, String) {
    let mut got = String::new();
    let result = p.stream(r, &AtomicBool::new(false), &mut |StreamEvent::Text(t)| {
        got.push_str(&t)
    });
    (result, got)
}

#[test]
fn text_arrives_in_order_across_cut_events_and_the_role_and_reasoning_chunks_add_nothing() {
    let whole = stream_of(&[
        chunk(json!({"role":"assistant","content":""}), Value::Null),
        chunk(json!({"reasoning_content":"pensando"}), Value::Null),
        content("Olá, "),
        chunk(json!({"content": null}), Value::Null),
        content("mundo é "),
        content("bom"),
        finish("stop"),
        DONE.to_owned(),
    ]);
    let chunks = whole.chunks(7).map(<[u8]>::to_vec).collect();
    let (base, server) = serve(vec![Canned::ok(chunks)]);
    let (result, got) = collect(&provider(&base, Some(KEY)), &request());
    assert_eq!(result.unwrap(), StopReason::EndTurn);
    assert_eq!(got, "Olá, mundo é bom");
    server.join().unwrap();
}

#[test]
fn the_request_has_the_bearer_key_and_the_system_message_first_and_the_key_only_in_its_header() {
    let (base, server) = serve(vec![Canned::ok(vec![stream_of(&[
        finish("stop"),
        DONE.to_owned(),
    ])])]);
    collect(&provider(&base, Some(KEY)), &request()).0.unwrap();
    let seen = &server.join().unwrap()[0];
    assert_eq!(seen.line, "POST /v1/chat/completions HTTP/1.1");
    assert_eq!(seen.headers["authorization"], format!("Bearer {KEY}"));
    assert_eq!(seen.headers["content-type"], "application/json");
    let body: Value = serde_json::from_slice(&seen.body).unwrap();
    assert_eq!(body["model"], "llama3.1");
    assert_eq!(body["stream"], true);
    assert_eq!(
        body["messages"],
        json!([
            {"role":"system","content":"seja breve"},
            {"role":"user","content":"oi"},
            {"role":"assistant","content":"olá"},
            {"role":"user","content":"e agora?"}
        ])
    );
    // A host that is not OpenAI's own is an imitation, and takes `max_tokens`.
    assert_eq!(body["max_tokens"], 256);
    assert!(body.get("max_completion_tokens").is_none());
    assert!(
        body.get("reasoning_effort").is_none() && body.get("output_config").is_none(),
        "effort is not sent"
    );
    assert!(!String::from_utf8_lossy(&seen.body).contains(KEY));
}

#[test]
fn the_length_field_can_be_switched_and_system_is_left_out_when_unset() {
    let (base, server) = serve(vec![Canned::ok(vec![stream_of(&[
        finish("stop"),
        DONE.to_owned(),
    ])])]);
    let p = provider(&base, None).with_token_limit(TokenLimit::MaxCompletionTokens);
    let mut r = request();
    r.system = None;
    collect(&p, &r).0.unwrap();
    let body: Value = serde_json::from_slice(&server.join().unwrap()[0].body).unwrap();
    assert_eq!(body["max_completion_tokens"], 256);
    assert!(body.get("max_tokens").is_none());
    assert_eq!(body["messages"][0]["role"], "user");
}

#[test]
fn a_local_server_with_no_key_gets_no_authorization_header_at_all() {
    let (base, server) = serve(vec![Canned::ok(vec![stream_of(&[
        content("x"),
        finish("stop"),
        DONE.to_owned(),
    ])])]);
    let (result, got) = collect(&provider(&base, None), &request());
    assert_eq!((result.unwrap(), got.as_str()), (StopReason::EndTurn, "x"));
    assert!(!server.join().unwrap()[0]
        .headers
        .contains_key("authorization"));
}

#[test]
fn a_finish_reason_is_a_result_and_a_refusal_in_its_own_field_is_one_too() {
    for (reason, expected) in [
        ("stop", StopReason::EndTurn),
        ("length", StopReason::MaxTokens),
        ("content_filter", StopReason::Refusal),
        ("tool_calls", StopReason::Other("tool_calls".into())),
    ] {
        let (base, server) = serve(vec![Canned::ok(vec![stream_of(&[
            content("x"),
            finish(reason),
            DONE.to_owned(),
        ])])]);
        let (result, got) = collect(&provider(&base, None), &request());
        assert_eq!(result.unwrap(), expected, "{reason}");
        assert_eq!(got, "x", "the text so far is real");
        server.join().unwrap();
    }
    let refusal = stream_of(&[
        chunk(json!({"refusal": "Não posso "}), Value::Null),
        chunk(json!({"refusal": "ajudar."}), Value::Null),
        finish("stop"),
        DONE.to_owned(),
    ]);
    let (base, server) = serve(vec![Canned::ok(vec![refusal])]);
    let (result, got) = collect(&provider(&base, None), &request());
    assert_eq!(result.unwrap(), StopReason::Refusal);
    assert_eq!(got, "Não posso ajudar.", "what the model said is shown");
    server.join().unwrap();
}

#[test]
fn an_error_in_the_middle_of_a_stream_keeps_what_came_before_it() {
    let events = stream_of(&[
        content("par"),
        "data: {\"error\":{\"message\":\"The server had an error\",\"type\":\"server_error\"}}\n\n"
            .into(),
    ]);
    let (base, server) = serve(vec![Canned::ok(vec![events])]);
    let (result, got) = collect(&provider(&base, None), &request());
    assert!(matches!(result, Err(Error::Provider(m)) if m == "The server had an error"));
    assert_eq!(got, "par");
    server.join().unwrap();
}

#[test]
fn a_server_that_closes_after_a_finish_reason_without_done_has_finished_and_one_that_just_stops_has_not(
) {
    let finished = stream_of(&[content("ok"), finish("stop")]);
    let (base, server) = serve(vec![Canned::ok(vec![finished])]);
    let (result, got) = collect(&provider(&base, None), &request());
    assert_eq!((result.unwrap(), got.as_str()), (StopReason::EndTurn, "ok"));
    server.join().unwrap();

    let (base, server) = serve(vec![Canned::ok(vec![stream_of(&[content("meio")])])]);
    let (result, got) = collect(&provider(&base, None), &request());
    assert!(matches!(result, Err(Error::Protocol)), "{result:?}");
    assert_eq!(got, "meio");
    server.join().unwrap();
}

#[test]
fn statuses_become_the_errors_the_interface_can_name_and_never_carry_the_key() {
    type Check = fn(&Error) -> bool;
    let cases: Vec<(Canned, Check)> = vec![
        (
            Canned::json(
                401,
                r#"{"error":{"message":"Incorrect API key provided: sk-test-0123****6789","type":"invalid_request_error"}}"#,
            ),
            |e| matches!(e, Error::Unauthorized),
        ),
        (Canned::json(429, "{}"), |e| matches!(e, Error::RateLimited)),
        (
            Canned::json(
                404,
                r#"{"error":{"message":"model 'llama9' not found","type":"invalid_request_error"}}"#,
            ),
            |e| matches!(e, Error::Provider(m) if m == "model 'llama9' not found"),
        ),
        (
            Canned::json(502, "<html>bad gateway</html>"),
            |e| matches!(e, Error::Provider(m) if m == "HTTP 502"),
        ),
    ];
    for (canned, check) in cases {
        let (base, server) = serve(vec![canned]);
        let error = collect(&provider(&base, Some(KEY)), &request())
            .0
            .unwrap_err();
        assert!(check(&error), "{error:?}");
        assert!(!format!("{error} {error:?}").contains(KEY));
        server.join().unwrap();
    }
}

#[test]
fn the_models_call_lists_ids_in_order_and_is_the_key_test() {
    let body = r#"{"object":"list","data":[{"id":"llama3.1","object":"model"},{"id":"gpt-4o-mini","object":"model"},{"id":"mistral","object":"model"}]}"#;
    let (base, server) = serve(vec![Canned::json(200, body), Canned::json(401, "{}")]);
    let p = provider(&base, Some(KEY));
    let ids: Vec<_> = p.models().unwrap().into_iter().map(|m| m.id).collect();
    assert_eq!(ids, ["gpt-4o-mini", "llama3.1", "mistral"]);
    assert!(matches!(p.models(), Err(Error::Unauthorized)));
    let seen = server.join().unwrap();
    assert_eq!(seen[0].line, "GET /v1/models HTTP/1.1");
    assert_eq!(seen[0].headers["authorization"], format!("Bearer {KEY}"));
}

#[test]
fn stop_is_prompt_even_while_the_server_is_quiet() {
    let first = stream_of(&[content("um")]);
    let second = stream_of(&[content("dois"), finish("stop"), DONE.to_owned()]);
    let mut canned = Canned::ok(vec![first, second]);
    canned.gap = Duration::from_millis(2000);
    let (base, server) = serve(vec![canned]);
    let cancel = AtomicBool::new(false);
    let mut got = String::new();
    let started = Instant::now();
    let result = provider(&base, None).stream(&request(), &cancel, &mut |StreamEvent::Text(t)| {
        got.push_str(&t);
        cancel.store(true, Ordering::Relaxed);
    });
    assert!(matches!(result, Err(Error::Cancelled)), "{result:?}");
    assert_eq!(got, "um");
    assert!(
        started.elapsed() < Duration::from_millis(1500),
        "{:?}",
        started.elapsed()
    );
    server.join().unwrap();
}

#[test]
fn a_redirect_is_never_followed_and_the_endpoint_is_checked_before_any_request() {
    let (base, server) = serve(vec![Canned {
        status: 307,
        headers: vec![("Location", "http://127.0.0.1:1/v1/chat/completions".into())],
        chunks: vec![],
        gap: Duration::ZERO,
    }]);
    let error = collect(&provider(&base, Some(KEY)), &request())
        .0
        .unwrap_err();
    assert!(matches!(error, Error::Provider(m) if m == "HTTP 307"));
    assert_eq!(server.join().unwrap().len(), 1);
    for bad in [
        "http://example.org/v1",
        "http://192.168.1.10:11434/v1",
        "https://u:p@example.org/v1",
        "ftp://x",
    ] {
        assert!(
            matches!(OpenAiProvider::new(bad, None), Err(Error::Endpoint(_))),
            "{bad}"
        );
    }
    assert!(OpenAiProvider::new(
        OpenAiProvider::DEFAULT_BASE,
        Some(ApiKey::new(KEY).unwrap())
    )
    .is_ok());
    assert!(OpenAiProvider::new("http://localhost:11434/v1", None).is_ok());
}
