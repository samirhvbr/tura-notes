//! The MCP layer over `notes-core`, independent of how a message arrives.
//!
//! Split out of `main.rs` for milestone 0.7 ([`docs/MCP-0.7.md`]). The tool
//! catalogue, the JSON-RPC envelope and the dispatch live here so that stdio and
//! the server answer from **one** description. Two copies of a tool schema drift
//! silently, and the first sign of it is an agent sending an argument the other
//! half rejects.
//!
//! Nothing here opens a transport, reads a file, or keeps state between calls:
//! the caller owns the connection and owns [`Session`].
use notes_core::agent::{AgentArgs, AgentConfig, AgentService};
use notes_model::CoreError;
use serde_json::{json, Value};

/// The MCP revision this server implements. Older revisions a client may ask
/// for are echoed back when we can speak them.
pub const PROTOCOL: &str = "2025-11-25";

/// Revisions accepted verbatim in `initialize`; anything else is answered with
/// [`PROTOCOL`].
const SPOKEN: [&str; 3] = ["2025-03-26", "2025-06-18", PROTOCOL];

/// What the handshake established, for a transport that has a connection to
/// keep it on.
///
/// Stdio is a session: one process, one client, state that outlives a message.
/// HTTP is not — every request carries its own credential and nothing survives
/// between them — so it passes [`Session::stateless`] and the gate never
/// refuses. Making correctness depend on state the transport does not keep is
/// the bug this type exists to make visible rather than accidental.
#[derive(Debug, Clone, Copy)]
pub struct Session {
    pub initialized: bool,
    pub ready: bool,
    /// Whether the transport keeps anything between messages.
    ///
    /// It decides one thing, and it is not cosmetic: on stdio a second
    /// `initialize` is refused, because there is a first one to have already
    /// answered. Over HTTP there is no "again" — every request arrives with its
    /// own credential and no memory of any other — so refusing it would be
    /// refusing a handshake the client is right to send.
    stateful: bool,
}

impl Default for Session {
    /// The stdio shape: nothing established yet, and a connection to establish
    /// it on. Written out rather than derived, because a derived `false` for
    /// `stateful` would silently turn stdio into the other transport.
    fn default() -> Self {
        Self {
            initialized: false,
            ready: false,
            stateful: true,
        }
    }
}

impl Session {
    /// A session that is open before the first message, for a transport that
    /// authenticates every request on its own.
    pub fn stateless() -> Self {
        Self {
            initialized: true,
            ready: true,
            stateful: false,
        }
    }
}

pub fn error(id: Value, code: i32, message: &str) -> Value {
    json!({"jsonrpc":"2.0","id":id,"error":{"code":code,"message":message}})
}

/// The tools this config admits, as MCP tool descriptors.
///
/// Filtered by permission, so a credential without `Delete` is not told
/// `notes_delete` exists — the catalogue is the authorization surface, not just
/// a menu.
pub fn tools(config: &AgentConfig) -> Value {
    // A string, and that is the point of the type (R6-21). `BaseRev.mtime_ns`
    // is an `i128` sent as a decimal string because it is ~1.7e18 and a JSON
    // number past 9.0e15 is rounded by any JavaScript host. This schema is the
    // only published declaration of the type, and it said `number`: an agent
    // that obeyed it had its revision rounded and every write refused as stale,
    // forever; one that copied the string was refused by a host that validates
    // arguments. The server still accepts a number, but no longer asks for one.
    let specs = [
        (
            "notes_list",
            "List Markdown paths in the authorized subtree.",
            vec![],
        ),
        (
            "notes_search",
            "Search saved notes literally within the authorized subtree.",
            vec!["query"],
        ),
        (
            "notes_read",
            "Read a note and the base_rev required for a later write.",
            vec!["path"],
        ),
        (
            "notes_create",
            "Create a new note; refuse an existing destination.",
            vec!["path", "text"],
        ),
        (
            "notes_update",
            "Replace note text only if base_rev still matches. Pass base_rev exactly as notes_read returned it.",
            vec!["path", "text", "base_rev"],
        ),
        (
            "notes_append",
            "Append once per note and base_rev; retrying does not duplicate text. Pass base_rev exactly as notes_read returned it.",
            vec!["path", "text", "base_rev"],
        ),
        (
            "notes_move",
            "Move a note within scope. References are not rewritten. Pass base_rev exactly as notes_read returned it.",
            vec!["path", "to", "base_rev"],
        ),
        (
            "notes_delete",
            "Delete a note if separately permitted and base_rev matches. Pass base_rev exactly as notes_read returned it.",
            vec!["path", "base_rev"],
        ),
    ];
    Value::Array(specs.into_iter().filter(|(name,_,_)|AgentService::permission(name).is_some_and(|p|config.permissions.contains(&p))).map(|(name,description,required)|{
        let mut properties=serde_json::Map::new();
        for field in &required {properties.insert((*field).into(),if *field=="base_rev"{json!({"type":"object","properties":{"size":{"type":"integer","minimum":0},"mtime_ns":{"type":"string","pattern":"^-?[0-9]+$"},"hash":{"type":"string"}},"required":["size","mtime_ns","hash"],"additionalProperties":false})}else{json!({"type":"string"})});}
        if matches!(name,"notes_list"|"notes_search"){properties.insert("limit".into(),json!({"type":"integer","minimum":1,"maximum":200}));properties.insert("offset".into(),json!({"type":"integer","minimum":0,"maximum":1_000_000,"description":"Continue from the next_offset of a truncated answer."}));}
        json!({"name":name,"description":description,"inputSchema":{"type":"object","properties":properties,"required":required,"additionalProperties":false},"annotations":{"readOnlyHint":matches!(name,"notes_list"|"notes_search"|"notes_read"),"destructiveHint":matches!(name,"notes_update"|"notes_move"|"notes_delete"),"openWorldHint":false}})
    }).collect())
}

/// Run one tool for one config, as `tools/call` reports it.
///
/// A fresh [`AgentService`] per call, deliberately: a long-lived one carries
/// identity state across requests, and over a server that state would be shared
/// between credentials that must not see each other's.
fn call(
    config: &AgentConfig,
    name: &str,
    args: AgentArgs,
    data_dir: Option<&std::path::Path>,
) -> Value {
    let built = match data_dir {
        Some(dir) => AgentService::with_data_dir(config.clone(), dir),
        None => AgentService::new(config.clone()),
    };
    let result = built.and_then(|mut service| service.call(name, args));
    let (value, failed) = match result {
        Ok(v) => (v, false),
        Err(e) => (refusal(&e), true),
    };
    json!({"content":[{"type":"text","text":value.to_string()}],"isError":failed})
}

/// What an agent is told when a call fails: the code, and only the fields it
/// can act on (R6-20).
///
/// This used to be the whole `CoreError`, serialised. The REST API has always
/// reduced the same error to a status and one of a few constant codes, so the
/// two envelopes of one catalogue disagreed exactly where server detail lives:
/// a subdirectory losing its read permission sent the agent
/// `{"op":"read_dir","path":"/srv/notes/workspaces/…","kind":"permission_denied"}`
/// -- an absolute server path, into the agent's transcript and whoever hosts it,
/// where REST said `operation_failed`. `docs/security.md` §8 says an error
/// carries no path, stack trace or version.
///
/// Kept: `disk_rev` on a conflict, which is how an agent retries; a path only
/// when it parses as a workspace-relative one, which is what the caller sent;
/// the I/O kind, the read-only reason, and whether a permission was the cause.
/// Everything else -- roots, operations, messages, absolute paths -- stays in
/// the server.
fn refusal(e: &CoreError) -> Value {
    let mut out = json!({ "code": e.code() });
    let relative = |p: &str| {
        notes_model::RelPath::parse(p)
            .ok()
            .filter(|r| !r.is_root())
            .map(|r| r.to_string())
    };
    match e {
        CoreError::Conflict { disk_rev, .. } => {
            out["disk_rev"] = serde_json::to_value(disk_rev).unwrap_or(Value::Null);
        }
        CoreError::NotFound { path }
        | CoreError::AlreadyExists { path }
        | CoreError::InvalidPath { path, .. }
        | CoreError::OutsideRoot { path }
        | CoreError::SymlinkNotFollowed { path } => {
            if let Some(p) = relative(path) {
                out["path"] = p.into();
            }
        }
        CoreError::Io { kind, .. } => {
            out["kind"] = serde_json::to_value(kind).unwrap_or(Value::Null);
        }
        CoreError::ReadOnly { reason, .. } => {
            out["reason"] = serde_json::to_value(reason).unwrap_or(Value::Null);
        }
        CoreError::Unsupported { cap } if cap == "agent permission denied" => {
            out["reason"] = "permission_denied".into();
        }
        _ => {}
    }
    out
}

/// Answer one JSON-RPC message.
///
/// `None` means the message was a notification and carries no reply — the
/// caller writes nothing. `data_dir` overrides where per-workspace state is
/// kept; `None` uses the core's default.
pub fn handle(
    config: &AgentConfig,
    request: &Value,
    session: &mut Session,
    data_dir: Option<&std::path::Path>,
) -> Option<Value> {
    let id = request.get("id").cloned();
    let method = request.get("method").and_then(Value::as_str).unwrap_or("");

    let Some(id) = id else {
        if session.initialized && method == "notifications/initialized" {
            session.ready = true;
        }
        return None;
    };

    if request.get("jsonrpc").and_then(Value::as_str) != Some("2.0")
        || !id.is_string() && !id.is_number()
    {
        return Some(error(id, -32600, "Invalid JSON-RPC request"));
    }

    if method == "initialize" && (!session.stateful || !session.initialized) {
        session.initialized = true;
        let requested = request
            .pointer("/params/protocolVersion")
            .and_then(Value::as_str)
            .unwrap_or(PROTOCOL);
        let version = if SPOKEN.contains(&requested) {
            requested
        } else {
            PROTOCOL
        };
        return Some(
            json!({"jsonrpc":"2.0","id":id,"result":{"protocolVersion":version,"capabilities":{"tools":{}},"serverInfo":{"name":"notes-mcp","version":include_str!("../../../version.md").trim()}}}),
        );
    }
    if method == "ping" {
        return Some(json!({"jsonrpc":"2.0","id":id,"result":{}}));
    }
    if !session.ready {
        return Some(error(id, -32002, "Initialize the session first"));
    }
    if method == "tools/list" {
        return Some(json!({"jsonrpc":"2.0","id":id,"result":{"tools":tools(config)}}));
    }
    if method != "tools/call" {
        return Some(error(id, -32601, "Method not found"));
    }

    let name = request
        .pointer("/params/name")
        .and_then(Value::as_str)
        .unwrap_or("");
    let arguments = request
        .pointer("/params/arguments")
        .cloned()
        .unwrap_or(json!({}));
    let catalogue = tools(config);
    let Some(definition) = catalogue
        .as_array()
        .expect("tools() returns an array")
        .iter()
        .find(|tool| tool["name"] == name)
    else {
        return Some(error(id, -32602, "Unknown or unauthorized tool"));
    };

    let fields = definition["inputSchema"]["properties"]
        .as_object()
        .expect("every descriptor carries an object schema");
    let required = definition["inputSchema"]["required"]
        .as_array()
        .expect("every descriptor lists its required fields");
    let valid = arguments.as_object().is_some_and(|a| {
        required
            .iter()
            .all(|k| a.contains_key(k.as_str().unwrap_or_default()))
            && a.keys().all(|k| fields.contains_key(k))
    });
    if !valid {
        return Some(error(id, -32602, "Invalid tool arguments"));
    }
    match serde_json::from_value::<AgentArgs>(arguments) {
        Err(_) => Some(error(id, -32602, "Invalid tool argument types")),
        Ok(args) => {
            Some(json!({"jsonrpc":"2.0","id":id,"result":call(config, name, args, data_dir)}))
        }
    }
}

#[cfg(test)]
mod refusal_tests {
    use super::*;

    fn strings(v: &Value, out: &mut Vec<String>) {
        match v {
            Value::String(s) => out.push(s.clone()),
            Value::Array(a) => a.iter().for_each(|v| strings(v, out)),
            Value::Object(o) => o.values().for_each(|v| strings(v, out)),
            _ => {}
        }
    }

    /// The finding's case: a directory in scope loses its read permission.
    #[test]
    fn an_io_failure_names_its_kind_and_not_the_server_path() {
        let e = CoreError::Io {
            op: "read_dir".into(),
            path: "/srv/notes/workspaces/samir/allowed/sub".into(),
            kind: notes_model::IoKind::PermissionDenied,
        };
        let v = refusal(&e);
        assert_eq!(v, json!({"code": "io", "kind": "permission_denied"}));
    }

    #[test]
    fn nothing_absolute_survives_any_variant() {
        let abs = "/srv/notes/workspaces/samir/secret.md".to_string();
        for e in [
            CoreError::NotFound { path: abs.clone() },
            CoreError::OutsideRoot { path: abs.clone() },
            CoreError::InvalidPath {
                path: abs.clone(),
                reason: format!("bad {abs}"),
            },
            CoreError::Unavailable {
                root: abs.clone(),
                reason: notes_model::UnavailableReason::PermissionRevoked,
            },
            CoreError::StateUnreadable {
                store: "drafts".into(),
                path: abs.clone(),
            },
            CoreError::Unsupported {
                cap: format!("reading {abs}"),
            },
            CoreError::Internal {
                message: format!("panic at {abs}"),
            },
        ] {
            let mut found = vec![];
            strings(&refusal(&e), &mut found);
            assert!(
                found
                    .iter()
                    .all(|s| !s.starts_with('/') && !s.contains("/srv")),
                "{e:?} -> {found:?}"
            );
        }
    }

    #[test]
    fn what_an_agent_acts_on_is_kept() {
        let rel = CoreError::NotFound {
            path: "allowed/a.md".into(),
        };
        assert_eq!(
            refusal(&rel),
            json!({"code": "not_found", "path": "allowed/a.md"})
        );
        let denied = CoreError::Unsupported {
            cap: "agent permission denied".into(),
        };
        assert_eq!(refusal(&denied)["reason"], "permission_denied");
    }
}
