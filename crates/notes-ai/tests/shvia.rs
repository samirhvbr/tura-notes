//! The SHVIA provider against a server on loopback that plays back canned
//! replies: the catalogue it reads, the key test it makes of it, and the chat it
//! hands to the OpenAI-compatible client. No network and no real key.

use notes_ai::{
    ApiKey, ChatMessage, ChatRequest, Error, Provider, Role, ShviaProvider, StopReason,
    StreamEvent, ToolSpec,
};
use serde_json::{json, Value};
use std::{sync::atomic::AtomicBool, time::Duration};

mod common;
use common::{serve, Canned};

/// What an error must be, for one canned answer.
type Check = fn(&Error) -> bool;

const KEY: &str = "shvia_usr_7_0123456789abcdef0123456789abcdef";

fn provider(base: &str) -> ShviaProvider {
    ShviaProvider::new(base, ApiKey::new(KEY).unwrap()).unwrap()
}

/// The answer of `GET /api/v1/profiles` as the gateway writes it, with fields
/// this application does not read, a disabled infrastructure, an infrastructure
/// that is down, a local model with no `@`, a name that cannot be sent, and the
/// same profile twice.
fn profiles() -> String {
    json!({
        "profiles": [
            {"name":"zeta@gpu1","model":"zeta","server":"gpu1","server_label":"GPU remota 1","driver":"ollama",
             "data_locality":"on_prem","efforts":["low","high"],"is_default":false,"server_online":true,
             "parameter_size":"7B","quantization":"Q4_K_M","size_bytes":4108927424_u64,"modified_at":"2026-05-10T14:22:11Z"},
            {"name":"anna-blue3@gpu1","model":"anna-blue3","server":"gpu1","server_label":"GPU remota 1","driver":"ollama",
             "is_default":true,"server_online":true,"parameter_size":"7B"},
            {"name":"anna-blue3@gpu1","model":"anna-blue3","server":"gpu1"},
            {"name":"claude-sonnet-5-5@anthropic","model":"claude-sonnet-5-5","server":"anthropic","driver":"anthropic"},
            {"name":"llama3.1:8b","model":"llama3.1:8b","server":"local","server_label":"Este servidor","driver":"ollama"},
            {"name":"gpt 4 mini@openai","model":"gpt 4 mini","server":"openai"},
            {"name":"old-model@retired","model":"old-model","server":"retired"},
            {"name":"slow@cold","model":"slow","server":"cold","server_online":false,"server_label":"Fria"},
            {"model":"no-name","server":"gpu1"}
        ],
        "favorites": [], "recent_models": [],
        "servers": {
            "gpu1": {"key":"gpu1","label":"GPU remota 1","driver":"ollama","online":true,"disabled":false},
            "anthropic": {"key":"anthropic","label":"Anthropic","driver":"anthropic","online":true},
            "retired": {"key":"retired","label":"Aposentada","disabled":true},
            "cold": {"key":"cold","label":"Fria","online":false}
        },
        "default_server": "gpu1",
        "descoberta_falhou": []
    })
    .to_string()
}

#[test]
fn the_catalogue_groups_models_by_infrastructure_and_orders_both() {
    let (base, server) = serve(vec![Canned::json(200, &profiles())]);
    let catalog = provider(&base).catalog().unwrap();
    assert_eq!(catalog.default_infra.as_deref(), Some("gpu1"));
    let shape: Vec<(&str, &str, Option<bool>, Vec<&str>)> = catalog
        .infras
        .iter()
        .map(|i| {
            (
                i.key.as_str(),
                i.label.as_str(),
                i.online,
                i.models.iter().map(|m| m.name.as_str()).collect(),
            )
        })
        .collect();
    assert_eq!(
        shape,
        vec![
            // The gateway's default first, then by label.
            ("gpu1", "GPU remota 1", Some(true), vec!["anna-blue3@gpu1", "zeta@gpu1"]),
            ("anthropic", "Anthropic", Some(true), vec!["claude-sonnet-5-5@anthropic"]),
            ("local", "Este servidor", None, vec!["llama3.1:8b"]),
            ("cold", "Fria", Some(false), vec!["slow@cold"]),
        ],
        "a disabled infrastructure, a name that cannot be sent, a duplicate and a profile with no name are left out"
    );
    let gpu = &catalog.infras[0];
    assert_eq!(gpu.driver.as_deref(), Some("ollama"));
    assert_eq!(gpu.models[0].model, "anna-blue3");
    assert_eq!(gpu.models[0].parameter_size.as_deref(), Some("7B"));
    assert_eq!(gpu.models[1].parameter_size.as_deref(), Some("7B"));
    let seen = &server.join().unwrap()[0];
    assert_eq!(seen.line, "GET /api/v1/profiles HTTP/1.1");
    assert_eq!(seen.headers["authorization"], format!("Bearer {KEY}"));
}

#[test]
fn models_is_the_flat_list_with_the_name_a_chat_sends_and_it_is_the_key_test() {
    let (base, server) = serve(vec![
        Canned::json(200, &profiles()),
        Canned::json(401, r#"{"message":"Unauthenticated."}"#),
    ]);
    let p = provider(&base);
    let models = p.models().unwrap();
    assert_eq!(models.len(), 5);
    assert_eq!(models[0].id, "anna-blue3@gpu1");
    assert_eq!(models[0].name, "GPU remota 1 · anna-blue3");
    assert!(matches!(p.models(), Err(Error::Unauthorized)));
    server.join().unwrap();
}

#[test]
fn refusals_and_answers_that_are_not_a_catalogue_are_named_and_never_carry_the_key() {
    let cases: Vec<(Canned, Check)> = vec![
        (Canned::json(403, "{}"), |e| {
            matches!(e, Error::Unauthorized)
        }),
        (Canned::json(429, "{}"), |e| matches!(e, Error::RateLimited)),
        (
            Canned::json(500, r#"{"error":{"message":"fora do ar"}}"#),
            |e| matches!(e, Error::Provider(m) if m == "fora do ar"),
        ),
        (Canned::json(200, "not json"), |e| {
            matches!(e, Error::Protocol)
        }),
        (Canned::json(200, r#"{"profiles":"x"}"#), |e| {
            matches!(e, Error::Protocol)
        }),
        (Canned::json(200, r#"{"data":[]}"#), |e| {
            matches!(e, Error::Protocol)
        }),
    ];
    for (canned, check) in cases {
        let (base, server) = serve(vec![canned]);
        let error = provider(&base).catalog().unwrap_err();
        assert!(check(&error), "{error:?}");
        assert!(!format!("{error} {error:?}").contains(KEY));
        server.join().unwrap();
    }
}

#[test]
fn a_catalogue_that_is_far_too_big_is_refused_and_an_empty_one_is_an_empty_catalogue() {
    let huge = format!(
        r#"{{"profiles":[],"pad":"{}"}}"#,
        "x".repeat(5 * 1024 * 1024)
    );
    let (base, server) = serve(vec![
        Canned::json(200, &huge),
        Canned::json(200, r#"{"profiles":[]}"#),
    ]);
    let p = provider(&base);
    assert!(matches!(p.catalog(), Err(Error::Protocol)));
    let empty = p.catalog().unwrap();
    assert!(empty.infras.is_empty() && empty.default_infra.is_none());
    server.join().unwrap();
}

#[test]
fn too_many_infrastructures_or_models_is_a_protocol_error_and_not_an_unbounded_list() {
    let many: Vec<Value> = (0..65)
        .map(|i| json!({"name": format!("m@s{i}"), "model": "m", "server": format!("s{i}")}))
        .collect();
    let (base, server) = serve(vec![Canned::json(
        200,
        &json!({"profiles": many}).to_string(),
    )]);
    assert!(matches!(provider(&base).catalog(), Err(Error::Protocol)));
    server.join().unwrap();
}

#[test]
fn a_redirect_is_never_followed_and_the_address_is_checked_before_any_request() {
    let (base, server) = serve(vec![Canned {
        status: 307,
        headers: vec![("Location", "http://127.0.0.1:1/api/v1/profiles".into())],
        chunks: vec![],
        gap: Duration::ZERO,
    }]);
    let error = provider(&base).catalog().unwrap_err();
    assert!(matches!(error, Error::Provider(m) if m == "HTTP 307"));
    assert_eq!(server.join().unwrap().len(), 1);
    let key = || ApiKey::new(KEY).unwrap();
    for bad in [
        "http://example.org",
        "http://192.168.1.10:8080",
        "https://u:p@ai.shvia.org",
        "https://ai.shvia.org/v1",
        "https://ai.shvia.org/api/v1",
        "https://ai.shvia.org/?k=1",
        "ftp://x",
        "",
    ] {
        assert!(
            matches!(ShviaProvider::new(bad, key()), Err(Error::Endpoint(_))),
            "{bad}"
        );
    }
    assert!(ShviaProvider::new(ShviaProvider::DEFAULT_ORIGIN, key()).is_ok());
    assert!(ShviaProvider::new("https://ai.shvia.org/", key()).is_ok());
    assert!(ShviaProvider::new("http://localhost:8000", key()).is_ok());
}

fn chunk(delta: Value, finish: Value) -> String {
    format!(
        "data: {}\n\n",
        json!({"choices":[{"index":0,"delta":delta,"finish_reason":finish}]})
    )
}

#[test]
fn chat_goes_to_the_openai_route_with_the_catalogue_name_as_the_model_and_hands_back_tool_calls() {
    let whole = [
        chunk(json!({"content": "Vou editar."}), Value::Null),
        chunk(
            json!({"tool_calls":[{"index":0,"id":"c1","type":"function","function":{"name":"edit_note","arguments":"{\"text\":\"olá\"}"}}]}),
            Value::Null,
        ),
        chunk(json!({}), json!("tool_calls")),
        "data: [DONE]\n\n".to_owned(),
    ]
    .concat()
    .into_bytes();
    let (base, server) = serve(vec![Canned::ok(vec![whole])]);
    let request = ChatRequest {
        model: "anna-blue3@gpu1".into(),
        system: Some("seja breve".into()),
        messages: vec![ChatMessage {
            role: Role::User,
            content: "oi".into(),
        }],
        max_tokens: 256,
        effort: Some(notes_ai::Effort::High),
        tools: vec![ToolSpec {
            name: "edit_note".into(),
            description: "Replace the text of the open note".into(),
            schema: json!({"type":"object","properties":{"text":{"type":"string"}},"required":["text"]}),
        }],
    };
    let (mut said, mut calls) = (String::new(), vec![]);
    let result = provider(&base).stream(&request, &AtomicBool::new(false), &mut |e| match e {
        StreamEvent::Text(t) => said.push_str(&t),
        StreamEvent::ToolCall { name, input } => calls.push((name, input)),
    });
    assert_eq!(result.unwrap(), StopReason::ToolUse);
    assert_eq!(said, "Vou editar.");
    assert_eq!(
        calls,
        vec![("edit_note".to_owned(), json!({"text": "olá"}))]
    );
    let seen = &server.join().unwrap()[0];
    assert_eq!(seen.line, "POST /v1/chat/completions HTTP/1.1");
    assert_eq!(seen.headers["authorization"], format!("Bearer {KEY}"));
    let body: Value = serde_json::from_slice(&seen.body).unwrap();
    assert_eq!(body["model"], "anna-blue3@gpu1");
    assert_eq!(body["stream"], true);
    assert!(body.get("effort").is_none(), "no effort is sent");
    assert_eq!(body["tools"][0]["function"]["name"], "edit_note");
}
