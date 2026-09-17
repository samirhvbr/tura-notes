use crate::{Error, Result};
use notes_sync::{
    transfer::{ApplicationAcknowledgment, Publication},
    Revision,
};
use reqwest::{
    blocking::{Client, Response},
    Url,
};
use serde::{Deserialize, Serialize};
use std::{
    io::Read,
    net::{IpAddr, SocketAddr, ToSocketAddrs},
    path::Path,
    time::Duration,
};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Endpoint {
    pub origin: String,
    pub name: String,
    pub allow_private: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<notes_model::RelPath>,
}
impl Endpoint {
    pub fn validate(&self) -> Result<Url> {
        let url = address(&self.origin, self.allow_private)?;
        if self
            .scope
            .as_ref()
            .is_some_and(|p| p.is_root() || p.as_str().split('/').any(|n| n.starts_with('.')))
            || self.name.is_empty()
            || self.name.len() > 64
            || !self
                .name
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-' || b == b'_')
        {
            return Err(Error::Invalid);
        }
        Ok(url)
    }
}
fn allowed_ip(ip: IpAddr, private: bool) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let b = ip.octets();
            if ip.is_link_local()
                || ip.is_unspecified()
                || ip.is_broadcast()
                || b[0] >= 224
                || b[0] == 0
                || ip.is_documentation()
            {
                return false;
            }
            private
                || !(ip.is_private()
                    || ip.is_loopback()
                    || (b[0] == 100 && (64..128).contains(&b[1])))
        }
        IpAddr::V6(ip) => {
            if let Some(v4) = ip.to_ipv4_mapped() {
                return allowed_ip(IpAddr::V4(v4), private);
            }
            if ip.is_unspecified() || ip.is_multicast() || ip.is_unicast_link_local() {
                return false;
            }
            private || !(ip.is_loopback() || ip.is_unique_local())
        }
    }
}
/// The address half of an endpoint: what is a property of the origin rather
/// than of the workspace being asked for.
///
/// Split out of `Endpoint::validate` for the connection test, which has to be
/// able to say *this address is not usable* before it has a workspace name —
/// discovering that name from the credential is most of what the test is for.
fn address(origin: &str, allow_private: bool) -> Result<Url> {
    let url = Url::parse(origin).map_err(|_| Error::Invalid)?;
    if url.username() != ""
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.path() != "/"
        || url.host_str().is_none()
    {
        return Err(Error::Invalid);
    }
    let host = url.host_str().unwrap().trim_matches(['[', ']']);
    let literal = host.parse::<IpAddr>().ok();
    if url.scheme() != "https"
        && !(url.scheme() == "http" && allow_private && literal.is_some_and(|ip| ip.is_loopback()))
    {
        return Err(Error::Invalid);
    }
    Ok(url)
}

/// Why a credential file was refused.
///
/// `connect` reports both as `Denied` and should: a transport that varies its
/// error by what it found in a secret file is a transport that describes the
/// secret. A connection test the owner asked for, about a file the owner
/// chose, is the one place the distinction is owed — `File` is fixed with
/// `chmod 600` and `Shape` by fetching the credential again, and one sentence
/// for both sends people to the wrong one.
pub(crate) enum CredentialProblem {
    File,
    Shape,
}

fn credential(token_file: &Path) -> std::result::Result<String, CredentialProblem> {
    let meta = std::fs::symlink_metadata(token_file).map_err(|_| CredentialProblem::File)?;
    if !token_file.is_absolute() || !meta.is_file() || meta.len() > 200 {
        return Err(CredentialProblem::File);
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if meta.permissions().mode() & 0o077 != 0 {
            return Err(CredentialProblem::File);
        }
    }
    let bearer = std::fs::read_to_string(token_file)
        .map_err(|_| CredentialProblem::File)?
        .trim()
        .to_owned();
    if !bearer.starts_with("nt_") || bearer.len() > 199 || bearer.chars().any(char::is_whitespace) {
        return Err(CredentialProblem::Shape);
    }
    Ok(bearer)
}

/// Resolve the host under the address policy: at most sixteen addresses, none
/// of them private unless the owner permitted it for this server.
fn resolved(url: &Url, allow_private: bool) -> Result<(String, Vec<SocketAddr>)> {
    let host = url
        .host_str()
        .ok_or(Error::Invalid)?
        .trim_matches(['[', ']'])
        .to_owned();
    let port = url.port_or_known_default().ok_or(Error::Invalid)?;
    let addresses: Vec<_> = if let Ok(ip) = host.parse::<IpAddr>() {
        vec![SocketAddr::new(ip, port)]
    } else {
        (host.as_str(), port)
            .to_socket_addrs()
            .map_err(|_| Error::Offline)?
            .take(17)
            .collect()
    };
    if addresses.is_empty()
        || addresses.len() > 16
        || addresses.iter().any(|a| !allowed_ip(a.ip(), allow_private))
    {
        return Err(Error::Invalid);
    }
    Ok((host, addresses))
}

fn client(host: &str, addresses: &[SocketAddr], ca_file: Option<&Path>) -> Result<Client> {
    // rustls-no-provider requires explicit process initialization. A provider
    // already selected by the embedding process is left intact.
    let _ = rustls::crypto::ring::default_provider().install_default();
    let mut builder = Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .retry(reqwest::retry::never())
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .resolve_to_addrs(host, addresses);
    if let Some(path) = ca_file {
        let meta = std::fs::metadata(path).map_err(|_| Error::Invalid)?;
        if !meta.is_file() || meta.len() > 64 * 1024 {
            return Err(Error::Invalid);
        }
        let bytes = std::fs::read(path).map_err(|_| Error::Invalid)?;
        let cert = reqwest::Certificate::from_pem(&bytes).map_err(|_| Error::Invalid)?;
        builder = builder.tls_certs_merge([cert]);
    }
    builder.build().map_err(|_| Error::Invalid)
}

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Page {
    pub workspace: Uuid,
    pub revisions: Vec<Revision>,
    pub heads: std::collections::BTreeMap<notes_model::NoteId, Uuid>,
    pub next_cursor: usize,
    pub has_more: bool,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Receipt {
    revision: Uuid,
    stored: bool,
    applied: bool,
}
/// Also implemented by fault-injecting tests. No filesystem methods belong here.
pub trait Transport {
    fn page(&mut self, cursor: usize) -> Result<Page>;
    fn fetch(&mut self, id: Uuid) -> Result<Publication>;
    fn publish(&mut self, publication: &Publication) -> Result<()>;
    fn acknowledge(&mut self, receipt: &ApplicationAcknowledgment) -> Result<()>;
}
pub struct Remote {
    client: Client,
    base: Url,
    bearer: String,
    scope: Option<notes_model::RelPath>,
}
impl Remote {
    pub fn connect(endpoint: &Endpoint, token_file: &Path, ca_file: Option<&Path>) -> Result<Self> {
        let url = endpoint.validate()?;
        let bearer = credential(token_file).map_err(|_| Error::Denied)?;
        let (host, addresses) = resolved(&url, endpoint.allow_private)?;
        let client = client(&host, &addresses, ca_file)?;
        // Pin the selected scope exactly; changing credentials must not silently
        // broaden or narrow the client namespace.
        let workspaces: serde_json::Value = decode(
            client
                .get(url.join("v1/workspaces").map_err(|_| Error::Invalid)?)
                .bearer_auth(&bearer)
                .send()
                .map_err(|_| Error::Offline)?,
        )?;
        let rows = workspaces["workspaces"].as_array().ok_or(Error::Protocol)?;
        if rows.len() != 1
            || rows[0]["name"] != endpoint.name
            || rows[0]["scope"] != endpoint.scope.as_ref().map(|p| p.as_str()).unwrap_or("")
            || rows[0]["review"] != false
        {
            return Err(Error::Denied);
        }
        let base = url
            .join(&format!("v1/workspaces/{}/sync/revisions", endpoint.name))
            .map_err(|_| Error::Invalid)?;
        Ok(Self {
            client,
            base,
            bearer,
            scope: endpoint.scope.clone(),
        })
    }
}
impl Remote {
    fn localize(&self, r: &mut Revision) -> Result<()> {
        if let Some(scope) = &self.scope {
            let path = r
                .path
                .as_str()
                .strip_prefix(&format!("{scope}/"))
                .ok_or(Error::Denied)?;
            r.path = notes_model::RelPath::parse(path).map_err(|_| Error::Protocol)?;
        }
        Ok(())
    }
    fn globalize(&self, r: &mut Revision) -> Result<()> {
        if let Some(scope) = &self.scope {
            r.path = notes_model::RelPath::parse(&format!("{scope}/{}", r.path))
                .map_err(|_| Error::Invalid)?;
        }
        Ok(())
    }
}
/// What a connection test found, at the first step that answered.
///
/// `Remote::connect` runs these same steps and reports `Invalid`, `Offline` or
/// `Denied` — three sentences for about thirty causes. That is the right shape
/// for a transport, which retries and must not narrate what it found in a
/// secret file, and the wrong shape for a person asking whether the thing works.
/// Each variant here is a different thing for the owner to go and fix.
#[derive(Clone, Copy, Debug, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum SyncProbeOutcome {
    /// The address cannot be used: not HTTPS, carrying a path, a query or
    /// credentials, or resolving to a private address without the explicit
    /// permission for this server.
    Address,
    /// The credential file was refused before anything was sent — missing, not
    /// an absolute path, too large, or readable by somebody other than its
    /// owner.
    CredentialFile,
    /// The file was read and does not contain a credential.
    CredentialShape,
    /// Nothing answered: the name does not resolve, or the connection or TLS
    /// handshake failed.
    Unreachable,
    /// A server answered and rejected the credential.
    Refused,
    /// Something answered and it was not this API: another site on the same
    /// name, a proxy error, a body in the wrong shape.
    Unexpected,
    /// The credential works. The workspace it is bound to comes back with it.
    Granted,
}

#[derive(Clone, Serialize, TS)]
#[ts(export)]
pub struct SyncProbe {
    pub outcome: SyncProbeOutcome,
    /// The HTTP status, when something answered. `401` and `502` send the owner
    /// to different machines; the transport must not branch on it, and a test
    /// the owner asked for is exactly where it belongs.
    pub status: Option<u16>,
    /// What the server says this credential is for, present only when granted.
    /// The workspace name is not something the owner can know from the app —
    /// it is the credential that decides it — so discovering it here is most of
    /// the reason this call exists.
    pub workspace: Option<String>,
    pub scope: Option<String>,
    pub permissions: Vec<String>,
    /// True when the credential needs server-side review. `connect` refuses
    /// such a credential; this reports it before a pairing fails on it.
    pub review: bool,
}

impl SyncProbe {
    fn at(outcome: SyncProbeOutcome) -> Self {
        Self {
            outcome,
            status: None,
            workspace: None,
            scope: None,
            permissions: vec![],
            review: false,
        }
    }
    fn answered(outcome: SyncProbeOutcome, status: u16) -> Self {
        Self {
            status: Some(status),
            ..Self::at(outcome)
        }
    }
}

impl Remote {
    /// Run `connect`'s steps and report which one answered.
    ///
    /// Every check here is the same function `connect` calls, and deliberately:
    /// a test that approves what the transport would refuse is worse than no
    /// test, because it moves the search for the cause somewhere the cause is
    /// not. It takes no workspace name for the same reason — the server names
    /// the workspace, and asking the owner to type it first is asking them to
    /// guess the answer to the question.
    ///
    /// The address policy is the one `connect` uses, so this cannot be pointed
    /// at a private address that pairing itself would refuse.
    pub fn probe(
        origin: &str,
        allow_private: bool,
        token_file: &Path,
        ca_file: Option<&Path>,
    ) -> SyncProbe {
        let Ok(url) = address(origin, allow_private) else {
            return SyncProbe::at(SyncProbeOutcome::Address);
        };
        let bearer = match credential(token_file) {
            Ok(bearer) => bearer,
            Err(CredentialProblem::File) => return SyncProbe::at(SyncProbeOutcome::CredentialFile),
            Err(CredentialProblem::Shape) => {
                return SyncProbe::at(SyncProbeOutcome::CredentialShape)
            }
        };
        let (host, addresses) = match resolved(&url, allow_private) {
            Ok(resolved) => resolved,
            // A name that resolves nowhere is unreachable; one that resolves to
            // an address the policy forbids is the address's problem, and the
            // owner fixes it in the field or in the permission beside it.
            Err(Error::Offline) => return SyncProbe::at(SyncProbeOutcome::Unreachable),
            Err(_) => return SyncProbe::at(SyncProbeOutcome::Address),
        };
        let (Ok(client), Ok(endpoint)) = (
            client(&host, &addresses, ca_file),
            url.join("v1/workspaces"),
        ) else {
            return SyncProbe::at(SyncProbeOutcome::Unexpected);
        };
        let Ok(response) = client.get(endpoint).bearer_auth(&bearer).send() else {
            return SyncProbe::at(SyncProbeOutcome::Unreachable);
        };
        let status = response.status().as_u16();
        // `decode` is the transport's own reading of a response, called here so
        // that a status or a content type it rejects cannot be approved.
        let body: serde_json::Value = match decode(response) {
            Ok(body) => body,
            Err(Error::Denied) => return SyncProbe::answered(SyncProbeOutcome::Refused, status),
            Err(_) => return SyncProbe::answered(SyncProbeOutcome::Unexpected, status),
        };
        let rows = body["workspaces"].as_array();
        let Some(row) = rows.filter(|rows| rows.len() == 1).map(|rows| &rows[0]) else {
            return SyncProbe::answered(SyncProbeOutcome::Unexpected, status);
        };
        let Some(workspace) = row["name"].as_str() else {
            return SyncProbe::answered(SyncProbeOutcome::Unexpected, status);
        };
        let scope = row["scope"].as_str().unwrap_or_default();
        SyncProbe {
            workspace: Some(workspace.to_owned()),
            scope: (!scope.is_empty()).then(|| scope.to_owned()),
            permissions: row["permissions"]
                .as_array()
                .map(|p| {
                    p.iter()
                        .filter_map(|v| v.as_str().map(str::to_owned))
                        .collect()
                })
                .unwrap_or_default(),
            // A server that did not say is treated as review, which is the
            // answer that blocks rather than the one that proceeds.
            review: row["review"].as_bool().unwrap_or(true),
            ..SyncProbe::answered(SyncProbeOutcome::Granted, status)
        }
    }
}

fn decode<T: serde::de::DeserializeOwned>(response: Response) -> Result<T> {
    match response.status().as_u16() {
        200 => {}
        401 | 403 => return Err(Error::Denied),
        409 => return Err(Error::Conflict),
        507 => return Err(Error::Limit),
        429 | 503 => return Err(Error::Busy),
        _ => return Err(Error::Protocol),
    }
    if response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(';').next())
        != Some("application/json")
    {
        return Err(Error::Protocol);
    }
    let mut bytes = vec![];
    response
        .take(16 * 1024 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| Error::Offline)?;
    if bytes.len() > 16 * 1024 * 1024 {
        return Err(Error::Limit);
    }
    serde_json::from_slice(&bytes).map_err(|_| Error::Protocol)
}
impl Transport for Remote {
    fn acknowledge(&mut self, receipt: &ApplicationAcknowledgment) -> Result<()> {
        let response: ApplicationAcknowledgment = decode(
            self.client
                .post(
                    self.base
                        .join("acknowledgments")
                        .map_err(|_| Error::Invalid)?,
                )
                .bearer_auth(&self.bearer)
                .json(receipt)
                .send()
                .map_err(|_| Error::Offline)?,
        )?;
        if response != *receipt {
            return Err(Error::Protocol);
        }
        Ok(())
    }

    fn page(&mut self, cursor: usize) -> Result<Page> {
        let mut url = self.base.clone();
        url.set_query(Some(&format!("cursor={cursor}&limit=20")));
        let mut page: Page = decode(
            self.client
                .get(url)
                .bearer_auth(&self.bearer)
                .send()
                .map_err(|_| Error::Offline)?,
        )?;
        for revision in &mut page.revisions {
            self.localize(revision)?;
        }
        Ok(page)
    }
    fn fetch(&mut self, id: Uuid) -> Result<Publication> {
        let url = Url::parse(&format!("{}/{id}", self.base)).map_err(|_| Error::Invalid)?;
        let mut p: Publication = decode(
            self.client
                .get(url)
                .bearer_auth(&self.bearer)
                .send()
                .map_err(|_| Error::Offline)?,
        )?;
        self.localize(&mut p.revision)?;
        for branch in &mut p.branches {
            self.localize(&mut branch.revision)?;
        }
        for revision in &mut p.history {
            self.localize(revision)?;
        }
        if let Some(scope) = &self.scope {
            for asset in p
                .attachments
                .iter_mut()
                .chain(p.branches.iter_mut().flat_map(|b| &mut b.attachments))
            {
                asset.path = notes_model::RelPath::parse(
                    asset
                        .path
                        .as_str()
                        .strip_prefix(&format!("{scope}/"))
                        .ok_or(Error::Denied)?,
                )
                .map_err(|_| Error::Protocol)?;
            }
        }
        Ok(p)
    }
    fn publish(&mut self, p: &Publication) -> Result<()> {
        let mut wire = p.clone();
        self.globalize(&mut wire.revision)?;
        for branch in &mut wire.branches {
            self.globalize(&mut branch.revision)?;
        }
        for revision in &mut wire.history {
            self.globalize(revision)?;
        }
        if let Some(scope) = &self.scope {
            for asset in wire
                .attachments
                .iter_mut()
                .chain(wire.branches.iter_mut().flat_map(|b| &mut b.attachments))
            {
                asset.path = notes_model::RelPath::parse(&format!("{scope}/{}", asset.path))
                    .map_err(|_| Error::Invalid)?;
            }
        }
        let receipt: Receipt = decode(
            self.client
                .post(self.base.clone())
                .bearer_auth(&self.bearer)
                .json(&wire)
                .send()
                .map_err(|_| Error::Offline)?,
        )?;
        if receipt.revision != p.revision.id || !receipt.stored || receipt.applied {
            return Err(Error::Protocol);
        }
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn address_policy_never_allows_metadata_or_redirect_credentials() {
        for ip in [
            "169.254.169.254",
            "fe80::1",
            "::ffff:169.254.169.254",
            "0.0.0.0",
            "224.0.0.1",
        ] {
            assert!(!allowed_ip(ip.parse().unwrap(), true));
        }
        assert!(!allowed_ip("127.0.0.1".parse().unwrap(), false));
        assert!(allowed_ip("127.0.0.1".parse().unwrap(), true));
        for origin in [
            "https://token@example.org/",
            "https://example.org/path",
            "https://example.org/?token=x",
            "http://example.org/",
            "http://localhost/",
        ] {
            assert!(Endpoint {
                scope: None,
                origin: origin.into(),
                name: "home".into(),
                allow_private: true
            }
            .validate()
            .is_err());
        }
    }
}

#[cfg(test)]
mod http_tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpListener,
    };
    #[test]
    fn client_builds_tls_backend_and_refuses_redirects() {
        for redirect in [false, true] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let address = listener.local_addr().unwrap();
            let server = std::thread::spawn(move || {
                let (mut stream, _) = listener.accept().unwrap();
                let mut received = vec![];
                while !received.ends_with(b"\r\n\r\n") {
                    let mut b = [0u8; 1];
                    stream.read_exact(&mut b).unwrap();
                    received.push(b[0]);
                    assert!(received.len() < 4096);
                }
                let body = r#"{"workspaces":[{"name":"home","scope":"","review":false}]}"#;
                let response = if redirect {
                    "HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1:9/\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".into()
                } else {
                    format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len())
                };
                stream.write_all(response.as_bytes()).unwrap();
            });
            let dir = tempfile::tempdir().unwrap();
            let token = dir.path().join("token");
            std::fs::write(&token, "nt_test").unwrap();
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&token, std::fs::Permissions::from_mode(0o600)).unwrap();
            }
            let result = Remote::connect(
                &Endpoint {
                    scope: None,
                    origin: format!("http://{address}"),
                    name: "home".into(),
                    allow_private: true,
                },
                &token,
                None,
            );
            if redirect {
                assert!(matches!(result, Err(Error::Protocol)));
            } else {
                assert!(result.is_ok());
            }
            server.join().unwrap();
        }
    }

    /// One request, one canned reply, then the socket closes.
    fn answering(response: String) -> (std::net::SocketAddr, std::thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let handle = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut received = vec![];
            while !received.ends_with(b"\r\n\r\n") {
                let mut b = [0u8; 1];
                if stream.read_exact(&mut b).is_err() {
                    return;
                }
                received.push(b[0]);
                assert!(received.len() < 4096);
            }
            let _ = stream.write_all(response.as_bytes());
        });
        (address, handle)
    }

    fn json(status: &str, body: &str) -> String {
        format!(
            "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
    }

    fn token_at(dir: &std::path::Path, contents: &str, mode: u32) -> std::path::PathBuf {
        std::fs::create_dir_all(dir).unwrap();
        let token = dir.join("token");
        std::fs::write(&token, contents).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&token, std::fs::Permissions::from_mode(mode)).unwrap();
        }
        let _ = mode;
        token
    }

    /// The point of the probe: one cause each, where the transport has three
    /// sentences for all of them.
    #[test]
    fn a_connection_test_names_the_step_that_answered() {
        let dir = tempfile::tempdir().unwrap();
        let good = token_at(dir.path(), "nt_test", 0o600);

        // The credential is bound to a workspace the owner never typed, and the
        // probe is how they find out what it is.
        let (address, server) = answering(json(
            "200 OK",
            r#"{"workspaces":[{"name":"personal","scope":"","permissions":["read","create"],"review":false}]}"#,
        ));
        let granted = Remote::probe(&format!("http://{address}"), true, &good, None);
        assert!(matches!(granted.outcome, SyncProbeOutcome::Granted));
        assert_eq!(granted.workspace.as_deref(), Some("personal"));
        assert_eq!(granted.scope, None);
        assert_eq!(granted.permissions, ["read", "create"]);
        assert!(!granted.review);
        server.join().unwrap();

        let (address, server) = answering(json("401 Unauthorized", r#"{"error":"unauthorized"}"#));
        let refused = Remote::probe(&format!("http://{address}"), true, &good, None);
        assert!(matches!(refused.outcome, SyncProbeOutcome::Refused));
        assert_eq!(refused.status, Some(401));
        server.join().unwrap();

        // The state this host was actually in: the name resolved, Apache
        // answered, and what answered was somebody else's site.
        let body = "<html><body>Matomo</body></html>";
        let (address, server) = answering(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        ));
        let other = Remote::probe(&format!("http://{address}"), true, &good, None);
        assert!(matches!(other.outcome, SyncProbeOutcome::Unexpected));
        assert_eq!(other.status, Some(200));
        server.join().unwrap();

        // Reachable, this API, and a shape it does not know.
        let (address, server) = answering(json("200 OK", r#"{"workspaces":[]}"#));
        let empty = Remote::probe(&format!("http://{address}"), true, &good, None);
        assert!(matches!(empty.outcome, SyncProbeOutcome::Unexpected));
        server.join().unwrap();

        // Nothing is sent for any of these three, so no server is needed.
        assert!(matches!(
            Remote::probe("http://127.0.0.1:9/", false, &good, None).outcome,
            SyncProbeOutcome::Address
        ));
        assert!(matches!(
            Remote::probe("https://example.org/", false, dir.path(), None).outcome,
            SyncProbeOutcome::CredentialFile
        ));
        let wrong = token_at(&dir.path().join("shape"), "hello", 0o600);
        assert!(matches!(
            Remote::probe("https://example.org/", false, &wrong, None).outcome,
            SyncProbeOutcome::CredentialShape
        ));
    }

    #[cfg(unix)]
    #[test]
    fn a_credential_anybody_can_read_is_reported_as_the_file_rather_than_the_server() {
        let dir = tempfile::tempdir().unwrap();
        let loose = token_at(dir.path(), "nt_test", 0o644);
        let probe = Remote::probe("https://example.org/", false, &loose, None);
        assert!(matches!(probe.outcome, SyncProbeOutcome::CredentialFile));
        assert_eq!(probe.status, None);
    }
}
