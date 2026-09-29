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
use std::{fs, net::SocketAddr, path::PathBuf};

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
