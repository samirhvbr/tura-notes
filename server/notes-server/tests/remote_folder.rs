//! The remote folder's client (ADR-099) against this server, over a real
//! loopback socket: the client's reading of every status and header is only
//! worth what it is worth against the server that sends them.
use notes_core::agent::Permission;
use notes_model::RelPath;
use notes_server::{admin, api};
use notes_sync_client::notes::{
    etag_hash, mark, LocalMark, RemoteConfig, RemoteFolder, RemoteNotes, RemoteSave,
};
use notes_sync_client::Error;
use std::{
    fs,
    io::{Read, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    path::PathBuf,
    time::Duration,
};

struct Served {
    _dir: tempfile::TempDir,
    data: PathBuf,
    config: RemoteConfig,
    _stop: tokio::sync::oneshot::Sender<()>,
}

fn serve(scope: &str, permissions: &[Permission]) -> Served {
    let dir = tempfile::tempdir().unwrap();
    let data = admin::data_root(&dir.path().join("data")).unwrap();
    fs::create_dir_all(data.join("workspaces/home/notes")).unwrap();
    fs::write(data.join("workspaces/home/outside.md"), "not in scope").unwrap();
    let token = dir.path().join("token");
    admin::create_token(
        &data,
        "remote folder".into(),
        "home".into(),
        RelPath::parse(scope).unwrap_or_else(|_| RelPath::root()),
        permissions.iter().copied().collect(),
        false,
        &token,
    )
    .unwrap();
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let address = listener.local_addr().unwrap();
    let app = api::router(api::Server::new(data.clone(), None));
    let (stop, stopped) = tokio::sync::oneshot::channel::<()>();
    std::thread::spawn(move || {
        tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async move {
                let listener = tokio::net::TcpListener::from_std(listener).unwrap();
                axum::serve(
                    listener,
                    app.into_make_service_with_connect_info::<SocketAddr>(),
                )
                .with_graceful_shutdown(async {
                    let _ = stopped.await;
                })
                .await
                .unwrap();
            });
    });
    Served {
        config: RemoteConfig {
            origin: format!("http://{address}"),
            workspace: "home".into(),
            token_file: token.to_string_lossy().into_owned(),
            allow_private: true,
        },
        _dir: dir,
        data,
        _stop: stop,
    }
}
fn all() -> Vec<Permission> {
    vec![
        Permission::Read,
        Permission::Create,
        Permission::Update,
        Permission::Move,
        Permission::Delete,
    ]
}
fn p(s: &str) -> RelPath {
    RelPath::parse(s).unwrap()
}

#[test]
fn a_note_is_created_listed_read_saved_renamed_and_deleted_under_the_scope() {
    let s = serve("notes", &all());
    let r = RemoteNotes::connect(&s.config).unwrap();
    // Created under a folder that does not exist yet, addressed from the scope.
    let made = r.create(&p("ideas/first.md"), "one\n").unwrap();
    assert_eq!(made.text, "one\n");
    assert_eq!(
        fs::read_to_string(s.data.join("workspaces/home/notes/ideas/first.md")).unwrap(),
        "one\n"
    );
    assert!(matches!(
        r.create(&p("ideas/first.md"), "again"),
        Err(Error::Exists)
    ));
    // Listed relative to the scope, with the tag a read answers with.
    let list = r.list().unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].path, p("ideas/first.md"));
    let read = r.read(&p("ideas/first.md")).unwrap();
    assert_eq!(list[0].etag.as_deref(), Some(read.etag.as_str()));
    assert_eq!(etag_hash(&read.etag), Some(notes_fs::hash(b"one\n")));
    // Saved on the tag it was read at.
    let RemoteSave::Saved { etag } = r.save(&p("ideas/first.md"), "two\n", &read.etag).unwrap()
    else {
        panic!("not saved")
    };
    assert_ne!(etag, read.etag);
    // Renamed: the new path answers with its own tag.
    let moved = r
        .rename(&p("ideas/first.md"), &p("ideas/renamed.md"), &etag)
        .unwrap();
    assert_eq!(moved.text, "two\n");
    assert!(matches!(r.read(&p("ideas/first.md")), Err(Error::Missing)));
    r.delete(&p("ideas/renamed.md"), &moved.etag).unwrap();
    assert!(r.list().unwrap().is_empty());
}

#[test]
fn an_empty_folder_is_made_on_the_server_listed_and_made_again_without_harm() {
    let s = serve("notes", &all());
    let r = RemoteNotes::connect(&s.config).unwrap();
    assert!(r.tree().unwrap().folders.is_some_and(|f| f.is_empty()));
    // Addressed from the scope, with the folders above it made too.
    assert!(r.create_folder(&p("ideas/2026")).unwrap());
    assert!(s.data.join("workspaces/home/notes/ideas/2026").is_dir());
    assert!(!r.create_folder(&p("ideas/2026")).unwrap(), "already there");
    assert!(
        !r.create_folder(&p("ideas")).unwrap(),
        "a parent made on the way"
    );
    // Listed relative to the scope, with no note in it, and the notes unchanged.
    let tree = r.tree().unwrap();
    assert_eq!(tree.folders, Some(vec![p("ideas"), p("ideas/2026")]));
    assert!(!tree.folders_truncated);
    assert!(tree.notes.is_empty());
    assert!(r.list().unwrap().is_empty());
    // A note made in it leaves it a folder, and the listing still names it.
    r.create(&p("ideas/2026/first.md"), "one\n").unwrap();
    let tree = r.tree().unwrap();
    assert_eq!(tree.notes.len(), 1);
    assert_eq!(tree.folders, Some(vec![p("ideas"), p("ideas/2026")]));
    // What a note may not be named, a folder may not either; nothing is made.
    assert!(matches!(r.create_folder(&p("con")), Err(Error::Invalid)));
    assert!(matches!(
        r.create_folder(&p("ideas/2026/first.md/deeper")),
        Err(Error::Invalid)
    ));
    assert!(!s.data.join("workspaces/home/notes/con").exists());
}

#[test]
fn a_credential_that_cannot_create_cannot_make_a_folder() {
    let s = serve("notes", &[Permission::Read]);
    let r = RemoteNotes::connect(&s.config).unwrap();
    assert!(matches!(r.create_folder(&p("ideas")), Err(Error::Denied)));
    assert!(!s.data.join("workspaces/home/notes/ideas").exists());
}

#[test]
fn a_save_on_a_stale_tag_comes_back_as_a_conflict_with_the_server_text() {
    let s = serve("notes", &all());
    let r = RemoteNotes::connect(&s.config).unwrap();
    let made = r.create(&p("a.md"), "mine\n").unwrap();
    // Someone else writes the note on the server.
    std::thread::sleep(std::time::Duration::from_millis(20));
    fs::write(s.data.join("workspaces/home/notes/a.md"), "theirs\n").unwrap();
    match r.save(&p("a.md"), "mine, edited\n", &made.etag).unwrap() {
        RemoteSave::Conflict { current } => assert_eq!(current.text, "theirs\n"),
        other => panic!("{other:?}"),
    }
    // Nothing was overwritten.
    assert_eq!(
        fs::read_to_string(s.data.join("workspaces/home/notes/a.md")).unwrap(),
        "theirs\n"
    );
    // And a note deleted on the server is gone, not an error.
    fs::remove_file(s.data.join("workspaces/home/notes/a.md")).unwrap();
    assert_eq!(
        r.save(&p("a.md"), "x", &made.etag).unwrap(),
        RemoteSave::Gone
    );
}

#[test]
fn the_list_follows_pages_and_marks_against_local_hashes() {
    let s = serve(".", &all());
    for i in 0..205 {
        fs::write(
            s.data.join(format!("workspaces/home/notes/n{i:03}.md")),
            format!("{i}\n"),
        )
        .unwrap();
    }
    let r = RemoteNotes::connect(&s.config).unwrap();
    let list = r.list().unwrap();
    // 205 in the folder plus the root note, over two pages.
    assert_eq!(list.len(), 206);
    let first = list.iter().find(|n| n.path == p("notes/n000.md")).unwrap();
    let tag = first.etag.as_deref();
    let same = notes_fs::hash(b"0\n");
    let other = notes_fs::hash(b"changed\n");
    assert_eq!(mark(tag, Some(Some(&same))), LocalMark::Same);
    assert_eq!(mark(tag, Some(Some(&other))), LocalMark::Differs);
    assert_eq!(mark(tag, Some(None)), LocalMark::Absent);
    assert_eq!(mark(tag, None), LocalMark::Unknown);
    assert_eq!(mark(None, Some(Some(&same))), LocalMark::Unknown);
}

#[test]
fn refusals_are_named() {
    // Read only: writing is denied, reading works.
    let s = serve("notes", &[Permission::Read]);
    let r = RemoteNotes::connect(&s.config).unwrap();
    assert!(matches!(r.create(&p("a.md"), "x"), Err(Error::Denied)));
    assert!(matches!(r.read(&p("missing.md")), Err(Error::Missing)));
    // A workspace name the credential is not for.
    let mut wrong = s.config.clone();
    wrong.workspace = "other".into();
    assert!(matches!(RemoteNotes::connect(&wrong), Err(Error::Denied)));
    // Nothing listening.
    let mut gone = s.config.clone();
    gone.origin = "http://127.0.0.1:9".into();
    assert!(matches!(RemoteNotes::connect(&gone), Err(Error::Offline)));
}

#[test]
fn the_folder_keeps_its_configuration_and_forgets_it() {
    let s = serve("notes", &all());
    let data = tempfile::tempdir().unwrap();
    let folder = RemoteFolder::new(data.path());
    assert!(folder.config().is_none());
    assert!(matches!(folder.with(|r| r.list()), Err(Error::Invalid)));
    folder.configure(Some(s.config.clone())).unwrap();
    assert!(folder.with(|r| r.list()).unwrap().is_empty());
    // Persisted, holding the credential's path and never its bytes.
    // Compared as JSON, not as text: a Windows path's backslashes are escaped
    // in the file, so the path never appears in it verbatim.
    let saved = fs::read_to_string(data.path().join("remote-notes.json")).unwrap();
    let value: serde_json::Value = serde_json::from_str(&saved).unwrap();
    assert_eq!(value["token_file"], s.config.token_file.as_str());
    assert!(!saved.contains("nt_"));
    assert_eq!(
        RemoteFolder::new(data.path()).config(),
        Some(s.config.clone())
    );
    // A relative credential path or a bad name is refused before it is written.
    let mut bad = s.config.clone();
    bad.token_file = "token".into();
    assert!(matches!(folder.configure(Some(bad)), Err(Error::Invalid)));
    folder.configure(None).unwrap();
    assert!(!data.path().join("remote-notes.json").exists());
    assert!(RemoteFolder::new(data.path()).config().is_none());
}

/// Transform only the response ETag as the production proxy chain does.
///
/// Cloudflare prefixes `W/`; Apache can append `-gzip` to the opaque value.
/// The final response need not itself be compressed, as observed in production.
/// A plain forwarder rewrites that header and passes every other byte through:
/// direct loopback tests alone never exercise this path.
fn weakening_proxy(upstream: SocketAddr, gzip_suffix: bool) -> SocketAddr {
    fn head(stream: &mut TcpStream) -> std::io::Result<Option<Vec<u8>>> {
        let mut bytes = Vec::new();
        let mut one = [0u8; 1];
        while !bytes.ends_with(b"\r\n\r\n") {
            if stream.read(&mut one)? == 0 {
                return Ok(None);
            }
            bytes.push(one[0]);
        }
        Ok(Some(bytes))
    }
    fn length(head: &[u8]) -> usize {
        String::from_utf8_lossy(head)
            .lines()
            .find_map(|l| {
                l.to_ascii_lowercase()
                    .strip_prefix("content-length:")
                    .map(|v| v.trim().parse().unwrap_or(0))
            })
            .unwrap_or(0)
    }
    fn relay(
        client: &mut TcpStream,
        upstream: SocketAddr,
        gzip_suffix: bool,
    ) -> std::io::Result<()> {
        // One exchange per client connection: the answer carries `connection: close`
        // (the upstream saw it asked for), so a client reconnects for the next one.
        if let Some(request) = head(client)? {
            let mut body = vec![0u8; length(&request)];
            client.read_exact(&mut body)?;
            // One request per upstream connection, so its end is the end of the answer.
            let text = String::from_utf8_lossy(&request).into_owned();
            let (line, rest) = text.split_once("\r\n").unwrap();
            let mut up = TcpStream::connect(upstream)?;
            up.write_all(format!("{line}\r\nconnection: close\r\n{rest}").as_bytes())?;
            up.write_all(&body)?;
            let mut answer = Vec::new();
            up.read_to_end(&mut answer)?;
            let split = answer
                .windows(4)
                .position(|w| w == b"\r\n\r\n")
                .map_or(answer.len(), |i| i + 4);
            let weakened: String = String::from_utf8_lossy(&answer[..split])
                .split("\r\n")
                .map(|l| match l.split_once(": ") {
                    Some((k, v)) if k.eq_ignore_ascii_case("etag") && v.starts_with('"') => {
                        if gzip_suffix {
                            format!("{k}: W/{}-gzip\"", v.strip_suffix('"').unwrap())
                        } else {
                            format!("{k}: W/{v}")
                        }
                    }
                    _ => l.to_owned(),
                })
                .collect::<Vec<_>>()
                .join("\r\n");
            client.write_all(weakened.as_bytes())?;
            client.write_all(&answer[split..])?;
        }
        Ok(())
    }
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    std::thread::spawn(move || {
        for client in listener.incoming().flatten() {
            let _ = client.set_read_timeout(Some(Duration::from_secs(10)));
            std::thread::spawn(move || {
                let mut client = client;
                let _ = relay(&mut client, upstream, gzip_suffix);
            });
        }
    });
    address
}

fn behind_a_weakening_proxy(mut served: Served) -> Served {
    served.config.origin = proxy_origin(&served, false);
    served
}

fn proxy_origin(served: &Served, gzip_suffix: bool) -> String {
    let upstream: SocketAddr = served
        .config
        .origin
        .trim_start_matches("http://")
        .parse()
        .unwrap();
    format!("http://{}", weakening_proxy(upstream, gzip_suffix))
}

#[test]
fn the_proxy_really_weakens_the_tag() {
    // The guard on the test below: a save that passes through a proxy which does
    // nothing proves nothing, so this reads the header the client would see.
    let s = behind_a_weakening_proxy(serve("", &all()));
    RemoteNotes::connect(&s.config)
        .unwrap()
        .create(&p("a.md"), "x\n")
        .unwrap();
    assert!(raw_tag(&s, "a.md").starts_with("W/\""));
}

fn raw_tag(s: &Served, path: &str) -> String {
    let token = fs::read_to_string(&s.config.token_file).unwrap();
    let address = s.config.origin.trim_start_matches("http://").to_owned();
    let mut raw = TcpStream::connect(&address).unwrap();
    raw.set_read_timeout(Some(Duration::from_secs(10))).unwrap();
    write!(
        raw,
        "GET /v1/workspaces/home/notes/{path} HTTP/1.1\r\nhost: {address}\r\nauthorization: Bearer {}\r\nconnection: close\r\n\r\n",
        token.trim()
    )
    .unwrap();
    let mut answer = String::new();
    raw.read_to_string(&mut answer).unwrap();
    let tag = answer
        .lines()
        .find(|l| l.to_ascii_lowercase().starts_with("etag:"))
        .expect("an etag header");
    tag.split_once(": ").unwrap().1.to_owned()
}

#[test]
fn a_cdn_that_weakens_the_tag_does_not_stop_a_save() {
    // `tura.samirhv.com.br` is behind Cloudflare, which answers `etag: W/"…"`.
    // The server accepts `If-Match` only in its own quoted form, so a client that
    // sent the tag back as received got `400 invalid_etag` — which the client
    // reports as "the sync settings are not valid". Reading and listing worked;
    // every write failed, which is what the owner saw.
    let s = behind_a_weakening_proxy(serve("", &all()));
    let r = RemoteNotes::connect(&s.config).unwrap();
    r.create(&p("IP-Server.md"), "one\n").unwrap();
    let read = r.read(&p("IP-Server.md")).unwrap();
    let saved = match r.save(&p("IP-Server.md"), "two\n", &read.etag) {
        Ok(RemoteSave::Saved { etag }) => etag,
        other => panic!("the save was not accepted: {other:?}"),
    };
    // A rename and a delete carry the tag the same way.
    let moved = r
        .rename(&p("IP-Server.md"), &p("renamed.md"), &saved)
        .unwrap();
    assert_eq!(moved.text, "two\n");
    r.delete(&p("renamed.md"), &moved.etag).unwrap();
    // And what the list says about a note is still the tag a read answers with:
    // `etag_hash` is what marks a row *same* or *different*.
    r.create(&p("b.md"), "bee\n").unwrap();
    let list = r.list().unwrap();
    let read = r.read(&p("b.md")).unwrap();
    assert_eq!(list[0].etag.as_deref(), Some(read.etag.as_str()));
    assert_eq!(etag_hash(&read.etag), Some(notes_fs::hash(b"bee\n")));
}

#[test]
fn a_gzip_suffix_is_removed_without_losing_the_original_revision_guard() {
    let mut s = serve("", &all());
    s.config.origin = proxy_origin(&s, true);
    let r = RemoteNotes::connect(&s.config).unwrap();
    let path = p("SHVIA-sec.md");
    let made = r.create(&path, "one\n").unwrap();
    let raw = raw_tag(&s, path.as_str());
    assert!(raw.starts_with("W/\""));
    assert!(raw.ends_with("-gzip\""));

    // The JSON listing retains the origin's exact tag. Both headers (create
    // and read) must recover those same bytes, not a guessed/newer revision.
    let listed = r
        .list()
        .unwrap()
        .into_iter()
        .find(|n| n.path == path)
        .unwrap();
    let read = r.read(&path).unwrap();
    assert_eq!(Some(made.etag.as_str()), listed.etag.as_deref());
    assert_eq!(made.etag, read.etag);
    assert_eq!(etag_hash(&read.etag), Some(notes_fs::hash(b"one\n")));
    let RemoteSave::Saved { etag } = r.save(&path, "two\n", &read.etag).unwrap() else {
        panic!("the save through the gzip proxy was not accepted")
    };
    assert_eq!(r.read(&path).unwrap().etag, etag);

    // Recovery of a transformed tag must never turn a stale write into an
    // overwrite. The stale create/read tag still conflicts after this save.
    let RemoteSave::Conflict { current } = r.save(&path, "stale edit\n", &read.etag).unwrap()
    else {
        panic!("the stale save bypassed the original revision guard")
    };
    assert_eq!(current.text, "two\n");
    assert_eq!(current.etag, etag);
    assert_eq!(
        fs::read_to_string(s.data.join("workspaces/home/SHVIA-sec.md")).unwrap(),
        "two\n"
    );
    let moved = r.rename(&path, &p("renamed.md"), &etag).unwrap();
    r.delete(&moved.path, &moved.etag).unwrap();
    assert!(r.list().unwrap().iter().all(|n| n.path != moved.path));
}

// ---- a credential kept in the keychain (ADR-105) ------------------------------

struct Keychain(std::sync::Mutex<std::collections::HashMap<String, String>>);
impl notes_sync_client::remote::CredentialStore for Keychain {
    fn get(&self, name: &str) -> Result<Option<String>, notes_sync_client::remote::StoreFailure> {
        Ok(self.0.lock().unwrap().get(name).cloned())
    }
    fn set(&self, name: &str, secret: &str) -> Result<(), notes_sync_client::remote::StoreFailure> {
        self.0.lock().unwrap().insert(name.into(), secret.into());
        Ok(())
    }
    fn clear(&self, name: &str) -> Result<(), notes_sync_client::remote::StoreFailure> {
        self.0.lock().unwrap().remove(name);
        Ok(())
    }
}

#[test]
fn the_remote_folder_works_with_the_credential_in_the_keychain_and_no_file_at_all() {
    let s = serve("notes", &all());
    let secret = fs::read_to_string(&s.config.token_file)
        .unwrap()
        .trim()
        .to_owned();
    // The credential goes into the keychain, and the file it came from is gone:
    // what remains is a name, which is all the configuration holds.
    let store = std::sync::Arc::new(Keychain(Default::default()));
    notes_sync_client::remote::install_credential_store(store);
    notes_sync_client::remote::store_credential("integration", &secret).unwrap();
    fs::remove_file(&s.config.token_file).unwrap();
    let mut config = s.config.clone();
    config.token_file = "keychain:integration".into();

    let r = RemoteNotes::connect(&config).unwrap();
    r.create(&p("from-keychain.md"), "hello\n").unwrap();
    assert_eq!(
        fs::read_to_string(s.data.join("workspaces/home/notes/from-keychain.md")).unwrap(),
        "hello\n"
    );

    // Forgotten, the same configuration has no credential, and says Denied like
    // a missing file: it does not say what it found or did not find.
    notes_sync_client::remote::forget_credential("integration").unwrap();
    assert!(matches!(RemoteNotes::connect(&config), Err(Error::Denied)));
    // A name that cannot be one is refused before anything is read.
    let mut odd = s.config.clone();
    odd.token_file = "keychain:../x".into();
    assert!(matches!(RemoteNotes::connect(&odd), Err(Error::Invalid)));
}
