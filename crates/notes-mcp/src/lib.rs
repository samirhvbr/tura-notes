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
            "Replace note text only if base_rev still matches.",
            vec!["path", "text", "base_rev"],
        ),
        (
            "notes_append",
            "Append once per note and base_rev; retrying does not duplicate text.",
            vec!["path", "text", "base_rev"],
        ),
        (
            "notes_move",
            "Move a note within scope. References are not rewritten.",
            vec!["path", "to", "base_rev"],
        ),
        (
            "notes_delete",
            "Delete a note if separately permitted and base_rev matches.",
            vec!["path", "base_rev"],
        ),
    ];
    Value::Array(specs.into_iter().filter(|(name,_,_)|AgentService::permission(name).is_some_and(|p|config.permissions.contains(&p))).map(|(name,description,required)|{
        let mut properties=serde_json::Map::new();
        for field in &required {properties.insert((*field).into(),if *field=="base_rev"{json!({"type":"object","properties":{"size":{"type":"integer","minimum":0},"mtime_ns":{"type":"number"},"hash":{"type":"string"}},"required":["size","mtime_ns","hash"],"additionalProperties":false})}else{json!({"type":"string"})});}
        if matches!(name,"notes_list"|"notes_search"){properties.insert("limit".into(),json!({"type":"integer","minimum":1,"maximum":200}));}
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
        Err(e) => (
            serde_json::to_value(e).unwrap_or_else(|_| json!({"code": "internal"})),
            true,
        ),
    };
    json!({"content":[{"type":"text","text":value.to_string()}],"isError":failed})
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
