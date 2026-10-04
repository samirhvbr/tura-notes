//! The remote folder (ADR-099): the server's notes workspace, edited in place
//! through its REST API — `GET/POST …/notes`, `GET/PUT/DELETE …/notes/{path}`,
//! `POST …/moves` — with the server's ETag as the only revision.
//!
//! **Not sync.** Nothing here reads or writes the device-sync inbox, the queue
//! folder or a local note. The server's `.md` files are the notes, the way the
//! local folder's are on this machine, and every write is conditioned on the
//! revision the user last saw: a note changed on the server in between is a
//! conflict the user resolves, never an overwrite (ADR-001 holds on both sides).
//!
//! The transport safety is `remote.rs`'s, reused rather than copied: the same
//! address policy, DNS pinning, credential file rules, no proxy, no redirects
//! and timeouts. What differs is the reading of a response. The sync transport
//! accepts 200 only and has no use for headers; here 201, 404, 409 and 412 are
//! ordinary answers and the ETag header is the whole point.
use crate::remote::{address, client, credential, resolved};
use crate::{Error, Result};
use base64::Engine as _;
use notes_model::{ContentHash, RelPath};
use reqwest::{
    blocking::{Client, RequestBuilder, Response},
    Url,
};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
use ts_rs::TS;

/// Where the remote folder is: persisted as `<data>/remote-notes.json`. Holds
/// the credential's **path**, never its bytes, as `sync-control.json` does.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export)]
pub struct RemoteConfig {
    pub origin: String,
    pub workspace: String,
    pub token_file: String,
    pub allow_private: bool,
}
impl RemoteConfig {
    fn validate(&self) -> Result<Url> {
        let url = address(&self.origin, self.allow_private)?;
        if self.workspace.is_empty()
            || self.workspace.len() > 64
            || !self
                .workspace
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-' || b == b'_')
            || !Path::new(&self.token_file).is_absolute()
        {
            return Err(Error::Invalid);
        }
        Ok(url)
    }
}

/// One note of the remote tree. `path` is relative to the credential's scope,
/// which is what the user sees as the remote folder's root. `etag` is `None`
/// on a server older than 1.9.8, which lists paths only, and for a note over
/// the server's 8 MiB read limit.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ListedNote {
    pub path: RelPath,
    pub size: Option<u64>,
    pub etag: Option<String>,
}

/// A remote note as read: its text and the revision a save is conditioned on.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct RemoteNote {
    #[ts(type = "string")]
    pub path: RelPath,
    pub text: String,
    /// `not_utf8` or `mixed_eol`: the server refuses to write it back, so the
    /// editor opens it read-only, as it does a local one.
    pub read_only: Option<String>,
    pub etag: String,
}

/// What a save came back with.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, TS)]
#[serde(tag = "outcome", rename_all = "snake_case")]
#[ts(export)]
pub enum RemoteSave {
    Saved {
        etag: String,
    },
    /// The note changed on the server since `etag` was read (412). `current`
    /// is what is there now, read straight after, so the user can compare.
    Conflict {
        current: RemoteNote,
    },
    /// The note is gone from the server (404): deleted or moved elsewhere.
    Gone,
}

/// How a remote note compares with the note at the same path in the open
/// local folder.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum LocalMark {
    /// Only on the server: no local file at that path.
    Absent,
    /// Byte for byte the same file.
    Same,
    /// A local file with other content.
    Differs,
    /// Cannot tell: no local folder is open, or the server gave no hash.
    Unknown,
}
/// A remote note as the tree shows it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct RemoteEntry {
    #[ts(type = "string")]
    pub path: RelPath,
    #[ts(type = "number | null")]
    pub size: Option<u64>,
    pub etag: Option<String>,
    pub local: LocalMark,
}
/// Compare one remote note with its local counterpart. `local` is `None` when
/// no local folder is open, `Some(None)` when the file is not there.
pub fn mark(etag: Option<&str>, local: Option<Option<&ContentHash>>) -> LocalMark {
    match local {
        None => LocalMark::Unknown,
        Some(None) => LocalMark::Absent,
        Some(Some(here)) => match etag.and_then(etag_hash) {
            Some(there) if &there == here => LocalMark::Same,
            Some(_) => LocalMark::Differs,
            None => LocalMark::Unknown,
        },
    }
}

/// The hash inside a server ETag: the tag is the unpadded base64url of the
/// revision's JSON, `{"hash":"b3:…","mtime_ns":…,"size":…}`. Used only to
/// compare with a local file; the tag itself stays opaque for `If-Match`.
pub fn etag_hash(etag: &str) -> Option<ContentHash> {
    #[derive(Deserialize)]
    struct Rev {
        hash: ContentHash,
    }
    let raw = etag.strip_prefix('"')?.strip_suffix('"')?;
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(raw)
        .ok()?;
    serde_json::from_slice::<Rev>(&bytes).ok().map(|r| r.hash)
}

/// A connection to one workspace's notes, bound to its credential's scope.
pub struct RemoteNotes {
    client: Client,
    base: Url,
    bearer: String,
    scope: Option<RelPath>,
}
const LIMIT: usize = 16 * 1024 * 1024;

impl RemoteNotes {
    pub fn connect(config: &RemoteConfig) -> Result<Self> {
        let url = config.validate()?;
        let bearer = credential(Path::new(&config.token_file)).map_err(|_| Error::Denied)?;
        let (host, addresses) = resolved(&url, config.allow_private)?;
        let client = client(&host, &addresses, None)?;
        let response = send(
            client
                .get(url.join("v1/workspaces").map_err(|_| Error::Invalid)?)
                .bearer_auth(&bearer),
        )?;
        let (status, _, body) = read(response)?;
        if status != 200 {
            return Err(refusal(status));
        }
        let row = &body["workspaces"][0];
        if body["workspaces"].as_array().map(Vec::len) != Some(1) || row["name"] != config.workspace
        {
            return Err(Error::Denied);
        }
        let scope = match row["scope"].as_str() {
            None | Some("") => None,
            Some(s) => Some(RelPath::parse(s).map_err(|_| Error::Protocol)?),
        };
        let base = url
            .join(&format!("v1/workspaces/{}/", config.workspace))
            .map_err(|_| Error::Invalid)?;
        Ok(Self {
            client,
            base,
            bearer,
            scope,
        })
    }

    /// The server's path for a path relative to the scope.
    fn global(&self, path: &RelPath) -> Result<String> {
        Ok(match &self.scope {
            Some(scope) => scope
                .join(path.as_str())
                .map_err(|_| Error::Invalid)?
                .to_string(),
            None => path.to_string(),
        })
    }
    /// A server path relative to the scope. Anything outside it is a protocol
    /// error: the server lists only what the credential may see.
    fn local(&self, path: &str) -> Result<RelPath> {
        let rel = match &self.scope {
            Some(scope) => path
                .strip_prefix(&format!("{scope}/"))
                .ok_or(Error::Protocol)?,
            None => path,
        };
        RelPath::parse(rel).map_err(|_| Error::Protocol)
    }
    fn note_url(&self, path: &RelPath) -> Result<Url> {
        let global = self.global(path)?;
        let mut url = self.base.join("notes/").map_err(|_| Error::Invalid)?;
        url.path_segments_mut()
            .map_err(|_| Error::Invalid)?
            .pop_if_empty()
            .extend(global.split('/'));
        Ok(url)
    }
    fn get(&self, url: Url) -> RequestBuilder {
        self.client.get(url).bearer_auth(&self.bearer)
    }

    /// The whole remote tree, 200 notes per request. A server older than
    /// 1.9.8 refuses `detail` (400 `invalid_query`); the plain list is then
    /// used, and every note comes back without a tag, which the comparison
    /// shows as unknown rather than guessing.
    pub fn list(&self) -> Result<Vec<ListedNote>> {
        let mut notes = vec![];
        let mut cursor = 0usize;
        let mut detailed = true;
        loop {
            let mut url = self.base.join("notes").map_err(|_| Error::Invalid)?;
            url.query_pairs_mut()
                .append_pair("limit", "200")
                .append_pair("cursor", &cursor.to_string());
            if detailed {
                url.query_pairs_mut().append_pair("detail", "true");
            }
            let (status, _, body) = read(send(self.get(url))?)?;
            if detailed && status == 400 && body["error"] == "invalid_query" && cursor == 0 {
                detailed = false;
                continue;
            }
            if status != 200 {
                return Err(refusal(status));
            }
            if detailed {
                for n in body["notes"].as_array().ok_or(Error::Protocol)? {
                    notes.push(ListedNote {
                        path: self.local(n["path"].as_str().ok_or(Error::Protocol)?)?,
                        size: n["size"].as_u64(),
                        etag: n["etag"].as_str().map(str::to_owned),
                    });
                }
            } else {
                for p in body["paths"].as_array().ok_or(Error::Protocol)? {
                    notes.push(ListedNote {
                        path: self.local(p.as_str().ok_or(Error::Protocol)?)?,
                        size: None,
                        etag: None,
                    });
                }
            }
            match body["next_cursor"].as_u64() {
                Some(next) if (next as usize) > cursor && notes.len() < 100_000 => {
                    cursor = next as usize
                }
                Some(_) => return Err(Error::Protocol),
                None => break,
            }
        }
        Ok(notes)
    }

    pub fn read(&self, path: &RelPath) -> Result<RemoteNote> {
        let (status, etag, body) = read(send(self.get(self.note_url(path)?))?)?;
        if status != 200 {
            return Err(refusal(status));
        }
        self.note(path, etag, &body)
    }
    fn note(
        &self,
        path: &RelPath,
        etag: Option<String>,
        body: &serde_json::Value,
    ) -> Result<RemoteNote> {
        Ok(RemoteNote {
            path: path.clone(),
            text: body["text"].as_str().ok_or(Error::Protocol)?.to_owned(),
            read_only: body["read_only"].as_str().map(str::to_owned),
            etag: etag.ok_or(Error::Protocol)?,
        })
    }

    /// Replace the note's text, if it is still the revision `etag` names.
    pub fn save(&self, path: &RelPath, text: &str, etag: &str) -> Result<RemoteSave> {
        let request = self
            .client
            .put(self.note_url(path)?)
            .bearer_auth(&self.bearer)
            .header("if-match", etag)
            .json(&serde_json::json!({ "text": text }));
        let (status, tag, _) = read(send(request)?)?;
        match status {
            200 => Ok(RemoteSave::Saved {
                etag: tag.ok_or(Error::Protocol)?,
            }),
            412 => match self.read(path) {
                Ok(current) => Ok(RemoteSave::Conflict { current }),
                Err(Error::Missing) => Ok(RemoteSave::Gone),
                Err(e) => Err(e),
            },
            404 => Ok(RemoteSave::Gone),
            s => Err(refusal(s)),
        }
    }

    /// Create a note, and the folders above it. Refused (`Exists`) when the
    /// name is taken, under the server's case and normalisation rules.
    pub fn create(&self, path: &RelPath, text: &str) -> Result<RemoteNote> {
        let request = self
            .client
            .post(self.base.join("notes").map_err(|_| Error::Invalid)?)
            .bearer_auth(&self.bearer)
            .header("if-none-match", "*")
            .json(
                &serde_json::json!({ "path": self.global(path)?, "text": text, "parents": true }),
            );
        let (status, etag, body) = read(send(request)?)?;
        if status != 201 {
            return Err(refusal(status));
        }
        self.note(path, etag, &body)
    }

    /// Move or rename a note. The server never replaces a note at `to`, and a
    /// move answers no tag, so the moved note is read again.
    pub fn rename(&self, from: &RelPath, to: &RelPath, etag: &str) -> Result<RemoteNote> {
        let request = self
            .client
            .post(self.base.join("moves").map_err(|_| Error::Invalid)?)
            .bearer_auth(&self.bearer)
            .header("if-match", etag)
            .json(&serde_json::json!({ "from": self.global(from)?, "to": self.global(to)? }));
        let (status, _, _) = read(send(request)?)?;
        if status != 200 {
            return Err(refusal(status));
        }
        self.read(to)
    }

    /// Delete a note that is still the revision `etag` names. The server moves
    /// it to its own trash when it has one.
    pub fn delete(&self, path: &RelPath, etag: &str) -> Result<()> {
        let request = self
            .client
            .delete(self.note_url(path)?)
            .bearer_auth(&self.bearer)
            .header("if-match", etag);
        match read(send(request)?)?.0 {
            200 => Ok(()),
            s => Err(refusal(s)),
        }
    }
}

fn send(request: RequestBuilder) -> Result<Response> {
    request.send().map_err(|_| Error::Offline)
}

/// A tag as this API means it: the quoted value, never its weak form.
///
/// The server answers `etag: "…"` and accepts `if-match: "…"` in exactly that
/// shape — the tag *is* the revision, base64url of its JSON, so it has no weak
/// and strong form. A CDN has one: Cloudflare rewrites the answers it may
/// transform and turns `"x"` into `W/"x"`, and `tura.samirhv.com.br` is behind
/// it. Sent back as received, that tag is `400 invalid_etag`, which `refusal`
/// reports as *"the sync settings are not valid"*. Reads and listings worked and
/// every write failed, which is why it went undiagnosed: the part that broke was
/// the part nobody had tried.
///
/// The `W/` is dropped where the header is read, once, so that everything built
/// on a tag — the buffer's `If-Match`, the *same*/*different* marks that decode
/// it, the comparison that notices another device's change — sees the form the
/// server speaks. The payload inside the quotes is the origin's and is untouched.
fn strong(tag: &str) -> &str {
    tag.strip_prefix("W/").unwrap_or(tag)
}

/// Status, ETag and JSON body. Every answer this API gives is JSON, errors
/// included (`{"error": code}`), so a body that is not is a protocol error
/// whatever its status.
fn read(response: Response) -> Result<(u16, Option<String>, serde_json::Value)> {
    let status = response.status().as_u16();
    let etag = response
        .headers()
        .get("etag")
        .and_then(|v| v.to_str().ok())
        .filter(|v| v.len() <= 1024)
        .map(|v| strong(v).to_owned());
    if response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(';').next())
        != Some("application/json")
    {
        return Err(if status == 429 || status == 503 {
            Error::Busy
        } else {
            Error::Protocol
        });
    }
    let mut bytes = vec![];
    response
        .take(LIMIT as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| Error::Offline)?;
    if bytes.len() > LIMIT {
        return Err(Error::Limit);
    }
    let body = serde_json::from_slice(&bytes).map_err(|_| Error::Protocol)?;
    Ok((status, etag, body))
}

/// A status the caller did not handle, as the error the interface explains.
fn refusal(status: u16) -> Error {
    match status {
        401 | 403 => Error::Denied,
        404 => Error::Missing,
        409 => Error::Exists,
        400 => Error::Invalid,
        412 => Error::Conflict,
        413 | 507 => Error::Limit,
        429 | 503 => Error::Busy,
        _ => Error::Protocol,
    }
}

/// The remote folder's configuration and its open connection, owned by the
/// application for its lifetime.
///
/// The connection is kept: `connect` costs a request, and the server allows a
/// credential 60 a minute. It is dropped when the configuration changes and
/// after an error that may mean the credential or the address did.
pub struct RemoteFolder {
    file: PathBuf,
    data: PathBuf,
    state: Mutex<(Option<RemoteConfig>, Option<Arc<RemoteNotes>>)>,
}
impl RemoteFolder {
    pub fn new(data: &Path) -> Self {
        let file = data.join("remote-notes.json");
        let config = (|| -> Option<RemoteConfig> {
            let meta = fs::symlink_metadata(&file).ok()?;
            if !meta.is_file() || meta.len() > 16_384 {
                return None;
            }
            let c: RemoteConfig = serde_json::from_slice(&fs::read(&file).ok()?).ok()?;
            c.validate().ok()?;
            Some(c)
        })();
        Self {
            file,
            data: data.to_owned(),
            state: Mutex::new((config, None)),
        }
    }
    pub fn config(&self) -> Option<RemoteConfig> {
        self.state.lock().ok()?.0.clone()
    }
    /// Save a configuration, or forget it with `None`. Validated before it is
    /// written, and written atomically, as `sync-control.json` is.
    pub fn configure(&self, config: Option<RemoteConfig>) -> Result<()> {
        let mut state = self.state.lock().map_err(|_| Error::Busy)?;
        match &config {
            Some(c) => {
                c.validate()?;
                fs::create_dir_all(&self.data).map_err(|_| Error::Storage)?;
                let mut tmp =
                    tempfile::NamedTempFile::new_in(&self.data).map_err(|_| Error::Storage)?;
                tmp.write_all(&serde_json::to_vec(c).map_err(|_| Error::Invalid)?)
                    .map_err(|_| Error::Storage)?;
                tmp.as_file().sync_all().map_err(|_| Error::Storage)?;
                tmp.persist(&self.file).map_err(|_| Error::Storage)?;
            }
            None => match fs::remove_file(&self.file) {
                Ok(()) => {}
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(_) => return Err(Error::Storage),
            },
        }
        *state = (config, None);
        Ok(())
    }
    /// Run `f` against the connection, opening it first when there is none.
    /// A refusal that may mean the credential, the address or the server
    /// changed drops the connection, so the next call starts over.
    pub fn with<T>(&self, f: impl FnOnce(&RemoteNotes) -> Result<T>) -> Result<T> {
        let remote = {
            let mut state = self.state.lock().map_err(|_| Error::Busy)?;
            match &state.1 {
                Some(remote) => remote.clone(),
                None => {
                    let config = state.0.clone().ok_or(Error::Invalid)?;
                    let remote = Arc::new(RemoteNotes::connect(&config)?);
                    state.1 = Some(remote.clone());
                    remote
                }
            }
        };
        let result = f(&remote);
        if matches!(
            result,
            Err(Error::Denied | Error::Offline | Error::Protocol)
        ) {
            if let Ok(mut state) = self.state.lock() {
                state.1 = None;
            }
        }
        result
    }
}
