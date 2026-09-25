//! Path-addressed, authenticated API. Policy and note writes stay in notes-core.
use crate::admin;
use axum::{
    body::to_bytes,
    extract::{ConnectInfo, Request, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::any,
    Json, Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use notes_core::agent::{AgentArgs, AgentConfig, AgentService};
use notes_model::{BaseRev, CoreError, IoKind, RelPath};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    net::{IpAddr, SocketAddr},
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::sync::Semaphore;
use uuid::Uuid;

const BODY_LIMIT: usize = 16 * 1024 * 1024;

/// Where the rate limiter reads the time.
///
/// The limiter's window is sixty seconds of *this* clock, and the test that
/// bounds it used to read the real one: sixty authenticated requests followed
/// by one that must be refused. On a contended Windows runner the sixty took
/// longer than a minute, the window expired under the test, and the sixty-first
/// was allowed — red on two documentation-only commits, and nothing to do with
/// the limiter. A test that freezes this clock asserts the window itself, and
/// can also assert what the old one could not: that the window does expire.
#[derive(Clone)]
pub struct Clock(Arc<dyn Fn() -> Instant + Send + Sync>);

impl Clock {
    pub fn system() -> Self {
        Clock(Arc::new(Instant::now))
    }
    /// A clock that reads whatever the caller last stored. For tests.
    #[doc(hidden)]
    pub fn manual(at: Arc<Mutex<Instant>>) -> Self {
        Clock(Arc::new(move || *at.lock().expect("clock")))
    }
    fn now(&self) -> Instant {
        (self.0)()
    }
}

#[derive(Clone)]
pub struct Server {
    pub data: PathBuf,
    pub trusted_proxy: Option<IpAddr>,
    /// How many proxies stand in front, so the client's own address can be
    /// picked out of `X-Forwarded-For`. Meaningless without `trusted_proxy`.
    trusted_hops: usize,
    slots: Arc<Semaphore>,
    rates: Arc<Mutex<Rates>>,
    clock: Clock,
}

/// Fixed one-minute windows, one table per kind of key, each with a ceiling.
///
/// **At the ceiling the oldest window is evicted, never the new key refused**
/// (R6-18). The table was one map for both kinds, and a full one answered 429
/// to every key it did not already hold. Its keys are chosen by whoever sends
/// the request -- an address is charged before authentication -- so 4096
/// requests from 4096 addresses, trivial from one routed IPv6 /64, locked out
/// every paired device and the deploy script's own health check for a minute,
/// renewable at about 68 requests a second. The ceiling bounds memory; which
/// way it fails is the choice, and evicting fails towards letting a caller
/// through with a fresh window rather than towards refusing everyone.
///
/// Separate tables so addresses cannot crowd out credentials: there are at most
/// 1024 credentials, so their table never reaches its ceiling at all.
#[derive(Default)]
struct Rates {
    addresses: HashMap<IpAddr, (Instant, u32)>,
    tokens: HashMap<uuid::Uuid, (Instant, u32)>,
}

const RATE_ENTRIES: usize = 4096;
const RATE_WINDOW: Duration = Duration::from_secs(60);

fn charge<K: std::hash::Hash + Eq + Copy>(
    table: &mut HashMap<K, (Instant, u32)>,
    key: K,
    limit: u32,
    now: Instant,
) -> bool {
    table.retain(|_, (start, _)| now.saturating_duration_since(*start) < RATE_WINDOW);
    if table.len() >= RATE_ENTRIES && !table.contains_key(&key) {
        if let Some(oldest) = table
            .iter()
            .min_by_key(|(_, (start, _))| *start)
            .map(|(k, _)| *k)
        {
            table.remove(&oldest);
        }
    }
    let entry = table.entry(key).or_insert((now, 0));
    entry.1 += 1;
    entry.1 <= limit
}

/// The address a budget is charged to: IPv6 by its /64, the smallest block a
/// site is normally given, so one host cannot mint a fresh budget per address.
fn rate_key(ip: IpAddr) -> IpAddr {
    match ip {
        IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
            Some(v4) => IpAddr::V4(v4),
            None => {
                let s = v6.segments();
                IpAddr::V6(std::net::Ipv6Addr::new(s[0], s[1], s[2], s[3], 0, 0, 0, 0))
            }
        },
        v4 => v4,
    }
}
impl Server {
    pub fn new(data: PathBuf, trusted_proxy: Option<IpAddr>) -> Self {
        Self::with_hops(data, trusted_proxy, 1)
    }

    /// The same server, reading time from `clock`. For tests.
    #[doc(hidden)]
    pub fn with_clock(mut self, clock: Clock) -> Self {
        self.clock = clock;
        self
    }

    pub fn with_hops(data: PathBuf, trusted_proxy: Option<IpAddr>, trusted_hops: usize) -> Self {
        Self {
            data,
            trusted_proxy,
            trusted_hops: trusted_hops.max(1),
            slots: Arc::new(Semaphore::new(8)),
            rates: Arc::new(Mutex::new(Rates::default())),
            clock: Clock::system(),
        }
    }

    /// The address the per-address budget is charged to.
    ///
    /// **Behind a proxy the peer is the proxy**, so a budget meant to bound one
    /// caller became the budget of everyone put together: past three active
    /// devices it is tighter than the 60/min each credential already has, and
    /// one busy device locks the others out. That is not the control failing
    /// open, it is the control hitting the wrong people.
    ///
    /// `X-Forwarded-For` is the answer and only because the peer has already
    /// been checked to *be* the trusted proxy: the header is then something our
    /// proxy appended, not something a client sent. **The last entry is the one
    /// to trust** — each hop appends the address it saw, so anything further
    /// left came from the client and is forgeable. With more than one proxy in
    /// front, `trusted_hops` says how far back to count.
    ///
    /// Anything unparseable falls back to the peer, which is the shared bucket:
    /// the old behaviour, and the safe direction.
    fn charged_address(&self, peer: IpAddr, headers: &HeaderMap) -> IpAddr {
        if self.trusted_proxy.is_none() {
            return peer;
        }
        let Some(forwarded) = header(headers, "x-forwarded-for") else {
            return peer;
        };
        let hops: Vec<&str> = forwarded.split(',').map(str::trim).collect();
        let Some(index) = hops.len().checked_sub(self.trusted_hops) else {
            return peer;
        };
        parse_address(hops[index]).unwrap_or(peer)
    }
    fn rate_address(&self, ip: IpAddr) -> bool {
        let Ok(mut rates) = self.rates.lock() else {
            return false;
        };
        charge(&mut rates.addresses, rate_key(ip), 120, self.clock.now())
    }
    fn rate_token(&self, credential: uuid::Uuid) -> bool {
        let Ok(mut rates) = self.rates.lock() else {
            return false;
        };
        charge(&mut rates.tokens, credential, 60, self.clock.now())
    }
}
/// One `X-Forwarded-For` entry as an address: bare, bracketed IPv6, or with a
/// port, which some proxies append and others do not.
fn parse_address(entry: &str) -> Option<IpAddr> {
    let entry = entry.trim();
    if let Ok(ip) = entry.parse::<IpAddr>() {
        return Some(ip);
    }
    if let Ok(socket) = entry.parse::<std::net::SocketAddr>() {
        return Some(socket.ip());
    }
    entry
        .strip_prefix('[')
        .and_then(|e| e.split(']').next())
        .and_then(|e| e.parse::<IpAddr>().ok())
}

pub fn router(server: Server) -> Router {
    Router::new().fallback(any(handle)).with_state(server)
}
#[derive(Debug)]
struct ApiError(StatusCode, &'static str);
type ApiResult<T> = std::result::Result<T, ApiError>;
fn err(status: StatusCode, code: &'static str) -> ApiError {
    ApiError(status, code)
}
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let mut response = (self.0, Json(json!({"error":self.1}))).into_response();
        if self.0 == StatusCode::TOO_MANY_REQUESTS {
            response
                .headers_mut()
                .insert("retry-after", "60".parse().unwrap());
        }
        if self.0 == StatusCode::UNAUTHORIZED {
            response
                .headers_mut()
                .insert("www-authenticate", "Bearer".parse().unwrap());
        }
        response
    }
}
impl From<CoreError> for ApiError {
    fn from(error: CoreError) -> Self {
        use StatusCode as S;
        match error {
            CoreError::Conflict { .. } => err(S::PRECONDITION_FAILED, "revision_changed"),
            CoreError::NotFound { .. }
            | CoreError::Io {
                kind: IoKind::NotFound,
                ..
            } => err(S::NOT_FOUND, "not_found"),
            CoreError::AlreadyExists { .. } => err(S::CONFLICT, "already_exists"),
            CoreError::OutsideRoot { .. }
            | CoreError::SymlinkNotFollowed { .. }
            | CoreError::ReadOnly { .. } => err(S::FORBIDDEN, "forbidden"),
            CoreError::Unsupported { cap } if cap == "agent permission denied" => {
                err(S::FORBIDDEN, "forbidden")
            }
            CoreError::Unsupported { .. } | CoreError::InvalidPath { .. } => {
                err(S::BAD_REQUEST, "invalid_request")
            }
            // Both are "come back in a moment", and both keep the 503 they
            // had when they were one variant. Which wait it was belongs in the
            // log, not in the status line.
            CoreError::LockTimeout { .. } | CoreError::NotSettled { .. } => {
                err(S::SERVICE_UNAVAILABLE, "busy")
            }
            _ => internal(),
        }
    }
}
fn internal() -> ApiError {
    err(StatusCode::INTERNAL_SERVER_ERROR, "operation_failed")
}
fn header<'a>(headers: &'a HeaderMap, key: &str) -> Option<&'a str> {
    headers.get(key)?.to_str().ok()
}
fn base(headers: &HeaderMap) -> ApiResult<BaseRev> {
    let value = header(headers, "if-match")
        .ok_or(err(StatusCode::PRECONDITION_REQUIRED, "if_match_required"))?;
    if value.len() > 1024 {
        return Err(err(StatusCode::BAD_REQUEST, "invalid_etag"));
    }
    let raw = value
        .strip_prefix('"')
        .and_then(|s| s.strip_suffix('"'))
        .ok_or(err(StatusCode::BAD_REQUEST, "invalid_etag"))?;
    let bytes = URL_SAFE_NO_PAD
        .decode(raw)
        .map_err(|_| err(StatusCode::BAD_REQUEST, "invalid_etag"))?;
    serde_json::from_slice(&bytes).map_err(|_| err(StatusCode::BAD_REQUEST, "invalid_etag"))
}
fn reply(mut value: Value, status: StatusCode) -> Response {
    // Internal identity is not a second REST addressing convention.
    let rev = value.as_object_mut().and_then(|o| {
        o.remove("note_id");
        o.remove("note_ids");
        o.remove("base_rev")
    });
    let mut response = (status, Json(value)).into_response();
    if let Some(rev) = rev {
        let tag = format!(
            "\"{}\"",
            URL_SAFE_NO_PAD.encode(serde_json::to_vec(&rev).unwrap())
        );
        response.headers_mut().insert("etag", tag.parse().unwrap());
    }
    response
}
#[derive(Default, Deserialize)]
#[serde(deny_unknown_fields)]
struct Query {
    limit: Option<usize>,
    cursor: Option<usize>,
    q: Option<String>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Create {
    path: RelPath,
    text: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Text {
    text: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Move {
    from: RelPath,
    to: RelPath,
}
fn body<T: serde::de::DeserializeOwned>(bytes: &[u8], headers: &HeaderMap) -> ApiResult<T> {
    if header(headers, "content-type").and_then(|s| s.split(';').next()) != Some("application/json")
    {
        return Err(err(StatusCode::UNSUPPORTED_MEDIA_TYPE, "json_required"));
    }
    serde_json::from_slice(bytes).map_err(|_| err(StatusCode::BAD_REQUEST, "invalid_json"))
}
async fn handle(State(server): State<Server>, request: Request) -> Response {
    let id = Uuid::new_v4().to_string();
    let secure = server.trusted_proxy.is_some();
    let result = execute(server, request, id.clone()).await;
    let mut response = result.unwrap_or_else(IntoResponse::into_response);
    let h = response.headers_mut();
    for (key, value) in [
        ("cache-control", "no-store"),
        ("x-content-type-options", "nosniff"),
        ("referrer-policy", "no-referrer"),
        (
            "content-security-policy",
            "default-src 'none'; frame-ancestors 'none'",
        ),
        ("x-frame-options", "DENY"),
    ] {
        h.insert(
            axum::http::HeaderName::from_static(key),
            value.parse().unwrap(),
        );
    }
    h.insert("x-request-id", id.parse().unwrap());
    if secure {
        h.insert(
            "strict-transport-security",
            "max-age=31536000".parse().unwrap(),
        );
    }
    response
}
async fn execute(server: Server, request: Request, id: String) -> ApiResult<Response> {
    let peer = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|c| c.0.ip())
        .ok_or(err(StatusCode::FORBIDDEN, "invalid_peer"))?;
    if let Some(proxy) = server.trusted_proxy {
        if peer != proxy || header(request.headers(), "x-forwarded-proto") != Some("https") {
            return Err(err(StatusCode::FORBIDDEN, "https_required"));
        }
    } else if !peer.is_loopback() {
        return Err(err(StatusCode::FORBIDDEN, "https_required"));
    }
    if request.headers().contains_key("origin") {
        return Err(err(StatusCode::FORBIDDEN, "browser_origin_denied"));
    }
    let client = server.charged_address(peer, request.headers());
    if !server.rate_address(client) {
        return Err(err(StatusCode::TOO_MANY_REQUESTS, "rate_limited"));
    }
    if request.method() == "GET" && request.uri().path() == "/healthz" {
        return Ok(Json(json!({"status":"ok"})).into_response());
    }
    let permit = server
        .slots
        .clone()
        .try_acquire_owned()
        .map_err(|_| err(StatusCode::SERVICE_UNAVAILABLE, "busy"))?;
    let (parts, body_stream) = request.into_parts();
    // The semaphore bounds bodies as well as blocking filesystem operations.
    let bytes = tokio::time::timeout(Duration::from_secs(15), to_bytes(body_stream, BODY_LIMIT))
        .await
        .map_err(|_| err(StatusCode::REQUEST_TIMEOUT, "body_timeout"))?
        .map_err(|_| err(StatusCode::PAYLOAD_TOO_LARGE, "body_too_large"))?;
    let rewrites_store = device_revocation(&parts).is_some();
    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        let mut lock = admin::lock(&server.data).map_err(|_| internal())?;
        // Every request reads the credential store under a shared lock, and one
        // route writes it: revoking another device's credential (ADR-096). That
        // one takes the lock exclusively, as `token revoke` on the host does,
        // since a shared holder cannot upgrade without deadlocking against
        // itself.
        let _guard = if rewrites_store {
            Held::Write(lock.write().map_err(|_| internal())?)
        } else {
            Held::Read(lock.read().map_err(|_| internal())?)
        };
        // RE-READ ON EVERY REQUEST, AND DELIBERATELY. Caching the parsed store
        // is the obvious optimisation and it is the wrong trade here.
        //
        // The ceiling is 1024 credentials, which is a 285 KB file; reading and
        // parsing it is well under a millisecond, on a request that has already
        // taken a permit from a semaphore of eight, taken a file lock, and is
        // about to do filesystem work. It is not the bottleneck, and nothing
        // measured says otherwise.
        //
        // What a cache costs is the other side: `token revoke` is a separate
        // process, and SERVER-0.5 promises it takes effect with **no server
        // restart**. A cache keeps that promise only while its invalidation is
        // right, and the failure mode of getting it wrong is a revoked
        // credential that still works. Trading a correct security control for
        // microseconds is how this kind of bug is born.
        let store = admin::load(&server.data).map_err(|_| internal())?;
        let credential = header(&parts.headers, "authorization")
            .and_then(|s| s.strip_prefix("Bearer "))
            .filter(|s| s.len() < 200)
            .and_then(|s| admin::authenticate(&store, s));
        let Some(credential) = credential else {
            admin::audit_event(
                &server.data,
                &admin::Event {
                    actor: "anonymous",
                    peer: &peer.to_string(),
                    operation: "authenticate",
                    result: "denied",
                    request: &id,
                    target_ref: None,
                    client: Some(&client.to_string()),
                },
            )
            .map_err(|_| internal())?;
            return Err(err(StatusCode::UNAUTHORIZED, "unauthorized"));
        };
        if !server.rate_token(credential.id) {
            return Err(err(StatusCode::TOO_MANY_REQUESTS, "rate_limited"));
        }
        let (operation, target_ref) = audit_subject(&parts, &bytes);
        admin::audit_event(
            &server.data,
            &admin::Event {
                actor: &credential.id.to_string(),
                peer: &peer.to_string(),
                operation: &operation,
                result: "started",
                request: &id,
                target_ref: Some(&target_ref),
                client: Some(&client.to_string()),
            },
        )
        .map_err(|_| internal())?;
        let result = dispatch(&server, &credential, &parts, &bytes);
        let outcome = result.as_ref().map(|_| "ok").unwrap_or_else(|e| e.1);
        admin::audit_event(
            &server.data,
            &admin::Event {
                actor: &credential.id.to_string(),
                peer: &peer.to_string(),
                operation: &operation,
                result: outcome,
                request: &id,
                target_ref: Some(&target_ref),
                client: Some(&client.to_string()),
            },
        )
        .map_err(|_| internal())?;
        result
    })
    .await
    .map_err(|_| internal())?
}
/// The admin lock as one request holds it.
enum Held<'a> {
    Read(#[allow(dead_code)] fd_lock::RwLockReadGuard<'a, std::fs::File>),
    Write(#[allow(dead_code)] fd_lock::RwLockWriteGuard<'a, std::fs::File>),
}

/// The device a `POST /v1/workspaces/{w}/sync/devices/{device}/revoke` names,
/// or `None` for any other request, a malformed id included (the handler then
/// answers it, under the shared lock like everything else).
fn device_revocation(parts: &axum::http::request::Parts) -> Option<Uuid> {
    if parts.method != "POST" {
        return None;
    }
    let segments: Vec<&str> = parts.uri.path().split('/').collect();
    match segments.as_slice() {
        ["", "v1", "workspaces", _, "sync", "devices", device, "revoke"] => {
            Uuid::parse_str(device).ok()
        }
        _ => None,
    }
}

/// Every tool `notes_mcp::tools` can publish; the audit names no other. A test
/// holds the two lists together.
#[doc(hidden)]
pub const MCP_TOOLS: [&str; 8] = [
    "notes_list",
    "notes_search",
    "notes_read",
    "notes_create",
    "notes_update",
    "notes_append",
    "notes_move",
    "notes_delete",
];
/// What an audit line says was done, and to what: an allowlisted operation name
/// and a short hash, never a URL, a path or an argument.
///
/// Built from the HTTP verb and the route, every MCP call was the same line --
/// `POST /v1/mcp` is `create_or_move` with the hash of `/v1/mcp` -- so forty
/// deletions through a leaked credential read exactly like forty creations
/// (R6-19). For MCP the operation is the JSON-RPC method and, for a tool call,
/// the tool's name, both checked against the catalogue so nothing a client sent
/// reaches the log verbatim; the target is a hash of the `path` argument when
/// there is one, which correlates calls on one note without naming it.
fn audit_subject(parts: &axum::http::request::Parts, bytes: &[u8]) -> (String, String) {
    let hash = |s: &str| blake3::hash(s.as_bytes()).to_hex()[..20].to_owned();
    let route = parts.uri.path();
    if parts.method == "POST" && route == "/v1/mcp" {
        let message: Value = serde_json::from_slice(bytes).unwrap_or(Value::Null);
        let method = match message["method"].as_str() {
            Some(m @ ("initialize" | "ping" | "tools/list" | "tools/call")) => m,
            Some(m) if m.starts_with("notifications/") => "notification",
            Some(_) => "other",
            None => "unparsed",
        };
        if method != "tools/call" {
            return (format!("mcp:{method}"), hash(route));
        }
        let tool = message["params"]["name"]
            .as_str()
            .and_then(|name| MCP_TOOLS.iter().find(|t| **t == name))
            .copied()
            .unwrap_or("unknown");
        let target = match message["params"]["arguments"]["path"].as_str() {
            Some(path) => hash(&format!("path:{path}")),
            None => hash(route),
        };
        return (format!("mcp:{tool}"), target);
    }
    if let Some(device) = device_revocation(parts) {
        return ("sync_device_revoke".into(), format!("device:{device}"));
    }
    if parts.method == "GET" && route.ends_with("/sync/devices") {
        return ("sync_devices_list".into(), hash(route));
    }
    let operation = match parts.method.as_str() {
        "GET" => "read",
        "POST" => "create_or_move",
        "PUT" => "update",
        "PATCH" => "append",
        "DELETE" => "delete",
        _ => "unsupported",
    };
    (operation.into(), hash(route))
}
/// MCP over HTTP: one JSON-RPC message in, one JSON-RPC response out.
///
/// The credential has already been authenticated, rate-limited and audited by
/// the time this runs, and the `AgentConfig` it produces is the same one the
/// REST routes below build — workspace, scope, permissions, review. So this is
/// an envelope over a call path that already exists, which is the whole design
/// (`docs/MCP-0.7.md`).
///
/// **No session gate.** `Session::stateless()` because each request carries its
/// own credential and HTTP keeps nothing between them; refusing `tools/list`
/// until some earlier request said `initialize` would make correctness depend on
/// state this transport does not have. `Mcp-Session-Id` is echoed when a client
/// sends one so a client that tracks sessions is not confused, and is never
/// required.
///
/// A notification carries no `id` and gets `202` with an empty body, which is
/// what the spec asks for and what the stdio loop does by writing nothing.
fn mcp(
    server: &Server,
    credential: &admin::Credential,
    parts: &axum::http::request::Parts,
    bytes: &[u8],
) -> ApiResult<Response> {
    let request: Value = body(bytes, &parts.headers)?;
    let config = AgentConfig {
        workspace: admin::workspace(&server.data, &credential.workspace).map_err(|_| internal())?,
        scope: credential.scope.clone(),
        permissions: credential.permissions.clone(),
        review: credential.review,
    };
    let state = server.data.join("state");
    let answer = notes_mcp::handle(
        &config,
        &request,
        &mut notes_mcp::Session::stateless(),
        Some(&state),
    );
    let mut response = match answer {
        Some(value) => (StatusCode::OK, Json(value)).into_response(),
        None => StatusCode::ACCEPTED.into_response(),
    };
    if let Some(session) = header(&parts.headers, "mcp-session-id") {
        if session.len() <= 200 {
            if let Ok(value) = session.parse() {
                response.headers_mut().insert("mcp-session-id", value);
            }
        }
    }
    Ok(response)
}

fn dispatch(
    server: &Server,
    credential: &admin::Credential,
    parts: &axum::http::request::Parts,
    bytes: &[u8],
) -> ApiResult<Response> {
    let method = parts.method.as_str();
    let path = percent_encoding::percent_decode_str(parts.uri.path())
        .decode_utf8()
        .map_err(|_| err(StatusCode::BAD_REQUEST, "invalid_path"))?;
    if path.len() > 4096 {
        return Err(err(StatusCode::URI_TOO_LONG, "path_too_long"));
    }
    let query: Query = serde_urlencoded::from_str(parts.uri.query().unwrap_or(""))
        .map_err(|_| err(StatusCode::BAD_REQUEST, "invalid_query"))?;
    let limit = query.limit.unwrap_or(100);
    let offset = query.cursor.unwrap_or(0);
    if !(1..=200).contains(&limit) || offset > 1_000_000 {
        return Err(err(StatusCode::BAD_REQUEST, "invalid_page"));
    }
    if method == "GET" && path == "/v1/openapi.json" {
        return Ok(reply(
            serde_json::from_str(include_str!("../openapi.json")).map_err(|_| internal())?,
            StatusCode::OK,
        ));
    }
    if method == "GET" && path == "/v1/workspaces" {
        return Ok(reply(
            json!({"workspaces":[{"name":credential.workspace,"scope":credential.scope,"permissions":credential.permissions,"review":credential.review}]}),
            StatusCode::OK,
        ));
    }
    if method == "POST" && path == "/v1/mcp" {
        return mcp(server, credential, parts, bytes);
    }
    let route = path
        .strip_prefix("/v1/workspaces/")
        .and_then(|p| p.split_once('/'))
        .ok_or(err(StatusCode::NOT_FOUND, "not_found"))?;
    if route.0 != credential.workspace {
        return Err(err(StatusCode::FORBIDDEN, "forbidden"));
    }
    if route.1 == "sync/acknowledgments"
        || route.1 == "sync/capacity"
        || route.1 == "sync/devices"
        || route.1.starts_with("sync/devices/")
        || route.1 == "sync/revisions"
        || route.1.starts_with("sync/revisions/")
    {
        return sync_dispatch(server, credential, parts, bytes, route.1, offset, limit);
    }
    let config = AgentConfig {
        workspace: admin::workspace(&server.data, &credential.workspace).map_err(|_| internal())?,
        scope: credential.scope.clone(),
        permissions: credential.permissions.clone(),
        review: credential.review,
    };
    let mut service = AgentService::with_data_dir(config, &server.data.join("state"))?;
    let mut args = AgentArgs {
        limit: Some(limit),
        offset: Some(offset),
        ..Default::default()
    };
    let (tool, status) = match (method, route.1) {
        ("GET", "notes") => ("notes_list", StatusCode::OK),
        ("GET", "search") => {
            args.query = query.q;
            ("notes_search", StatusCode::OK)
        }
        ("POST", "notes") => {
            if header(&parts.headers, "if-none-match") != Some("*") {
                return Err(err(
                    StatusCode::PRECONDITION_REQUIRED,
                    "if_none_match_required",
                ));
            }
            let input: Create = body(bytes, &parts.headers)?;
            args.path = Some(input.path);
            args.text = Some(input.text);
            ("notes_create", StatusCode::CREATED)
        }
        ("POST", "moves") => {
            let input: Move = body(bytes, &parts.headers)?;
            args.path = Some(input.from);
            args.to = Some(input.to);
            args.base_rev = Some(base(&parts.headers)?);
            ("notes_move", StatusCode::OK)
        }
        (_, rest) if rest.starts_with("notes/") => {
            args.path = Some(
                RelPath::parse(&rest[6..])
                    .map_err(|_| err(StatusCode::BAD_REQUEST, "invalid_path"))?,
            );
            if method != "GET" {
                args.base_rev = Some(base(&parts.headers)?);
            }
            let tool = match method {
                "GET" => "notes_read",
                "DELETE" => "notes_delete",
                "PUT" | "PATCH" => {
                    args.text = Some(body::<Text>(bytes, &parts.headers)?.text);
                    if method == "PUT" {
                        "notes_update"
                    } else {
                        "notes_append"
                    }
                }
                _ => return Err(err(StatusCode::METHOD_NOT_ALLOWED, "method_not_allowed")),
            };
            (tool, StatusCode::OK)
        }
        _ => return Err(err(StatusCode::NOT_FOUND, "not_found")),
    };
    let requested_path = args.to.clone().or_else(|| args.path.clone());
    let mut value = service.call(tool, args)?;
    if let Some(path) = requested_path {
        value["path"] = json!(path);
    }
    if tool == "notes_list" || tool == "notes_search" {
        value["next_cursor"] = if value["truncated"] == true {
            json!(offset + limit)
        } else {
            Value::Null
        };
    }
    Ok(reply(value, status))
}

fn sync_dispatch(
    server: &Server,
    credential: &admin::Credential,
    parts: &axum::http::request::Parts,
    bytes: &[u8],
    route: &str,
    cursor: usize,
    limit: usize,
) -> ApiResult<Response> {
    use crate::sync;
    let map = |e| match e {
        sync::Error::Forbidden => err(StatusCode::FORBIDDEN, "forbidden"),
        sync::Error::OwnDevice => err(StatusCode::CONFLICT, "own_device"),
        sync::Error::Invalid => err(StatusCode::BAD_REQUEST, "invalid_sync_revision"),
        sync::Error::Missing => err(StatusCode::NOT_FOUND, "not_found"),
        sync::Error::Stale => err(StatusCode::CONFLICT, "sync_revision_changed"),
        sync::Error::Limit => err(StatusCode::INSUFFICIENT_STORAGE, "sync_capacity_reached"),
        sync::Error::Busy => err(StatusCode::SERVICE_UNAVAILABLE, "busy"),
        sync::Error::Storage => internal(),
    };
    match (parts.method.as_str(), route) {
        ("POST", "sync/acknowledgments") => {
            let input: notes_sync::transfer::ApplicationAcknowledgment =
                body(bytes, &parts.headers)?;
            sync::acknowledge(&server.data, credential, &input).map_err(map)?;
            Ok(Json(input).into_response())
        }
        ("GET", "sync/capacity") => {
            Ok(Json(sync::capacity(&server.data, credential).map_err(map)?).into_response())
        }
        ("GET", "sync/devices") => Ok(Json(
            json!({"devices": sync::list_devices(&server.data, credential).map_err(map)?}),
        )
        .into_response()),
        ("POST", path) if path.starts_with("sync/devices/") => {
            let device = device_revocation(parts)
                .ok_or(err(StatusCode::BAD_REQUEST, "invalid_device_id"))?;
            Ok(
                Json(sync::revoke_device(&server.data, credential, device).map_err(map)?)
                    .into_response(),
            )
        }
        ("GET", "sync/revisions") => Ok(Json(
            sync::page(&server.data, credential, cursor, limit).map_err(map)?,
        )
        .into_response()),
        ("POST", "sync/revisions") => {
            let input: sync::Publication = body(bytes, &parts.headers)?;
            let revision = sync::publish(&server.data, credential, input).map_err(map)?;
            Ok(Json(json!({"revision":revision,"stored":true,"applied":false})).into_response())
        }
        ("GET", path) => {
            let id = path
                .strip_prefix("sync/revisions/")
                .and_then(|s| Uuid::parse_str(s).ok())
                .ok_or(err(StatusCode::BAD_REQUEST, "invalid_revision_id"))?;
            Ok(Json(sync::fetch(&server.data, credential, id).map_err(map)?).into_response())
        }
        _ => Err(err(StatusCode::METHOD_NOT_ALLOWED, "method_not_allowed")),
    }
}
