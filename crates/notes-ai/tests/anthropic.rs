//! The Anthropic provider against a server on loopback that plays back canned
//! replies. Nothing here touches the network or a real key, so nothing spends.

use notes_ai::{
    AnthropicProvider, ApiKey, ChatMessage, ChatRequest, Effort, Error, Provider, Role, StopReason,
    StreamEvent,
};
use serde_json::{json, Value};

mod common;
use common::{serve, Canned};
use std::{
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};

const KEY: &str = "sk-ant-test-0123456789";

fn sse(events: &[Value]) -> Vec<u8> {
    let mut out = String::new();
    for event in events {
        out.push_str(&format!(
            "event: {}\ndata: {event}\n\n",
            event["type"].as_str().unwrap()
        ));
    }
    out.into_bytes()
}

fn text(t: &str) -> Value {
    json!({"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":t}})
}
fn stop(reason: &str) -> Value {
    json!({"type":"message_delta","delta":{"stop_reason":reason,"stop_sequence":null},"usage":{"output_tokens":3}})
}
fn start() -> Value {
    json!({"type":"message_start","message":{"id":"msg_1","role":"assistant","content":[]}})
}
fn end() -> Value {
    json!({"type":"message_stop"})
}

fn provider(base: &str) -> AnthropicProvider {
    AnthropicProvider::new(base, ApiKey::new(KEY).unwrap()).unwrap()
}

fn request() -> ChatRequest {
    ChatRequest {
        model: "claude-opus-5-5".into(),
        system: Some("be brief".into()),
        messages: vec![ChatMessage {
            role: Role::User,
            content: "oi".into(),
        }],
        max_tokens: 1024,
        effort: Some(Effort::Medium),
    }
}

fn collect(p: &AnthropicProvider, r: &ChatRequest) -> (Result<StopReason, Error>, String) {
    let mut got = String::new();
    let result = p.stream(r, &AtomicBool::new(false), &mut |StreamEvent::Text(t)| {
        got.push_str(&t)
    });
    (result, got)
}

#[test]
fn text_arrives_in_order_even_when_the_reads_cut_events_and_characters() {
    let whole = sse(&[
        start(),
        json!({"type":"ping"}),
        json!({"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}),
        json!({"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"hmm"}}),
        text("Olá, "),
        text("mundo é "),
        text("bom"),
        json!({"type":"content_block_stop","index":0}),
        stop("end_turn"),
        end(),
    ]);
    // Seven bytes at a time: inside every event and inside "á" and "é".
    let chunks = whole.chunks(7).map(<[u8]>::to_vec).collect();
    let (base, server) = serve(vec![Canned::ok(chunks)]);
    let (result, got) = collect(&provider(&base), &request());
    assert_eq!(result.unwrap(), StopReason::EndTurn);
    assert_eq!(got, "Olá, mundo é bom");
    server.join().unwrap();
}

#[test]
fn the_request_has_the_headers_and_body_the_api_expects_and_the_key_only_in_its_header() {
    let (base, server) = serve(vec![Canned::ok(vec![sse(&[
        start(),
        stop("end_turn"),
        end(),
    ])])]);
    collect(&provider(&base), &request()).0.unwrap();
    let seen = &server.join().unwrap()[0];
    assert_eq!(seen.line, "POST /v1/messages HTTP/1.1");
    assert_eq!(seen.headers["x-api-key"], KEY);
    assert_eq!(seen.headers["anthropic-version"], "2023-06-01");
    assert_eq!(seen.headers["content-type"], "application/json");
    let body: Value = serde_json::from_slice(&seen.body).unwrap();
    assert_eq!(body["model"], "claude-opus-5-5");
    assert_eq!(body["stream"], true);
    assert_eq!(body["max_tokens"], 1024);
    assert_eq!(body["system"], "be brief");
    assert_eq!(body["messages"], json!([{"role":"user","content":"oi"}]));
    assert_eq!(body["output_config"], json!({"effort":"medium"}));
    assert!(
        body.get("thinking").is_none(),
        "thinking is left to the model's default"
    );
    assert!(
        !String::from_utf8_lossy(&seen.body).contains(KEY),
        "the key is in the body"
    );
}

#[test]
fn effort_and_system_are_left_out_when_unset() {
    let (base, server) = serve(vec![Canned::ok(vec![sse(&[
        start(),
        stop("end_turn"),
        end(),
    ])])]);
    let mut r = request();
    r.effort = None;
    r.system = None;
    collect(&provider(&base), &r).0.unwrap();
    let body: Value = serde_json::from_slice(&server.join().unwrap()[0].body).unwrap();
    assert!(
        body.get("output_config").is_none() && body.get("system").is_none(),
        "{body}"
    );
}

#[test]
fn a_stop_reason_is_a_result_not_an_error() {
    for (reason, expected) in [
        ("end_turn", StopReason::EndTurn),
        ("max_tokens", StopReason::MaxTokens),
        ("refusal", StopReason::Refusal),
        ("pause_turn", StopReason::Other("pause_turn".into())),
    ] {
        let (base, server) = serve(vec![Canned::ok(vec![sse(&[
            start(),
            text("x"),
            stop(reason),
            end(),
        ])])]);
        let (result, got) = collect(&provider(&base), &request());
        assert_eq!(result.unwrap(), expected, "{reason}");
        assert_eq!(got, "x", "the text so far is real");
        server.join().unwrap();
    }
}

#[test]
fn an_error_in_the_middle_of_a_stream_keeps_what_came_before_it() {
    let events = sse(&[
        start(),
        text("par"),
        json!({"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}),
    ]);
    let (base, server) = serve(vec![Canned::ok(vec![events])]);
    let (result, got) = collect(&provider(&base), &request());
    assert!(matches!(result, Err(Error::Provider(m)) if m == "Overloaded"));
    assert_eq!(got, "par");
    server.join().unwrap();
}

#[test]
fn a_stream_that_ends_without_saying_it_is_done_is_not_a_success() {
    let (base, server) = serve(vec![Canned::ok(vec![sse(&[start(), text("meio")])])]);
    let (result, got) = collect(&provider(&base), &request());
    assert!(matches!(result, Err(Error::Protocol)), "{result:?}");
    assert_eq!(got, "meio");
    server.join().unwrap();
}

type Check = fn(&Error) -> bool;

#[test]
fn statuses_become_the_errors_the_interface_can_name_and_never_carry_the_key() {
    let cases: Vec<(Canned, Check)> = vec![
        (
            Canned::json(
                401,
                r#"{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}"#,
            ),
            |e| matches!(e, Error::Unauthorized),
        ),
        (Canned::json(403, "{}"), |e| {
            matches!(e, Error::Unauthorized)
        }),
        (Canned::json(429, "{}"), |e| matches!(e, Error::RateLimited)),
        (
            Canned::json(
                400,
                r#"{"type":"error","error":{"type":"invalid_request_error","message":"max_tokens: too big"}}"#,
            ),
            |e| matches!(e, Error::Provider(m) if m == "max_tokens: too big"),
        ),
        (
            Canned::json(500, "boom"),
            |e| matches!(e, Error::Provider(m) if m == "HTTP 500"),
        ),
        (
            // A redirect is never followed: a key must not be sent on to another host.
            Canned {
                status: 302,
                headers: vec![("Location", "http://127.0.0.1:1/".into())],
                chunks: vec![],
                gap: Duration::ZERO,
            },
            |e| matches!(e, Error::Provider(m) if m == "HTTP 302"),
        ),
    ];
    for (canned, check) in cases {
        let (base, server) = serve(vec![canned]);
        let error = collect(&provider(&base), &request()).0.unwrap_err();
        assert!(check(&error), "{error:?}");
        assert!(!format!("{error} {error:?}").contains(KEY));
        server.join().unwrap();
    }
}

#[test]
fn the_models_call_lists_what_the_key_can_use_and_is_the_key_test() {
    let body = r#"{"data":[{"id":"claude-opus-5-5","display_name":"Claude Opus 5.5","type":"model"},{"id":"claude-haiku-4-5","type":"model"}],"has_more":false}"#;
    let (base, server) = serve(vec![Canned::json(200, body), Canned::json(401, "{}")]);
    let models = provider(&base).models().unwrap();
    assert_eq!(models.len(), 2);
    assert_eq!(
        (models[0].id.as_str(), models[0].name.as_str()),
        ("claude-opus-5-5", "Claude Opus 5.5")
    );
    assert_eq!(
        models[1].name, "claude-haiku-4-5",
        "no display name falls back to the id"
    );
    assert!(matches!(provider(&base).models(), Err(Error::Unauthorized)));
    let seen = server.join().unwrap();
    assert_eq!(seen[0].line, "GET /v1/models?limit=1000 HTTP/1.1");
    assert_eq!(seen[0].headers["x-api-key"], KEY);
    assert_eq!(seen[0].headers["anthropic-version"], "2023-06-01");
}

#[test]
fn stop_is_prompt_even_while_the_provider_is_quiet() {
    let first = sse(&[start(), text("um")]);
    let second = sse(&[text("dois"), stop("end_turn"), end()]);
    let mut canned = Canned::ok(vec![first, second]);
    canned.gap = Duration::from_millis(2000);
    let (base, server) = serve(vec![canned]);
    let cancel = AtomicBool::new(false);
    let mut got = String::new();
    let started = Instant::now();
    let result = provider(&base).stream(&request(), &cancel, &mut |StreamEvent::Text(t)| {
        got.push_str(&t);
        cancel.store(true, Ordering::Relaxed);
    });
    assert!(matches!(result, Err(Error::Cancelled)), "{result:?}");
    assert_eq!(got, "um", "nothing after the stop is delivered");
    assert!(
        started.elapsed() < Duration::from_millis(1500),
        "waited for the provider: {:?}",
        started.elapsed()
    );
    server.join().unwrap();
}

#[test]
fn a_stop_pressed_before_anything_arrives_ends_the_wait() {
    let mut canned = Canned::ok(vec![sse(&[start(), end()])]);
    canned.gap = Duration::ZERO;
    let (base, server) = serve(vec![canned]);
    let started = Instant::now();
    let result = provider(&base).stream(&request(), &AtomicBool::new(true), &mut |_| {});
    assert!(matches!(result, Err(Error::Cancelled)));
    assert!(started.elapsed() < Duration::from_secs(2));
    let _ = server.join();
}

#[test]
fn a_key_is_never_printable_and_an_endpoint_is_checked_before_any_request() {
    let key = ApiKey::new(KEY).unwrap();
    assert!(!format!("{key:?}").contains(KEY));
    assert!(
        ApiKey::new("").is_none()
            && ApiKey::new("com espaço").is_none()
            && ApiKey::new("a\nb").is_none()
    );
    for bad in [
        "http://example.org",
        "https://u:p@example.org",
        "ftp://example.org",
    ] {
        assert!(
            matches!(
                AnthropicProvider::new(bad, ApiKey::new(KEY).unwrap()),
                Err(Error::Endpoint(_))
            ),
            "{bad}"
        );
    }
    assert!(
        AnthropicProvider::new(AnthropicProvider::DEFAULT_BASE, ApiKey::new(KEY).unwrap()).is_ok()
    );
}
