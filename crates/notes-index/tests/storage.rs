use notes_index::{Index, Indexed, RegistryStore, Seen};
use notes_model::CoreError;
#[test]
fn fts_words_are_tokens_and_not_a_query_language() {
    let d = tempfile::tempdir().unwrap();
    let mut index = Index::open(&d.path().join("index.db")).unwrap();
    let seen = Seen {
        path: "a.md".into(),
        size: 42,
        mtime: "1".into(),
    };
    index
        .apply(
            Indexed {
                seen: &seen,
                hash: "one",
                text: "heading\nação tested testing\n",
            },
            true,
        )
        .unwrap();
    let hit = index.words("acao", 10).unwrap();
    assert_eq!(hit.len(), 1);
    assert_eq!(hit[0].line, 2);
    assert!(index.words("test", 10).unwrap().is_empty());
    assert_eq!(index.words("TESTED", 10).unwrap().len(), 1);
    assert!(index.words("tested OR absent", 10).unwrap().is_empty());
    index.remove(&["a.md".into()]).unwrap();
    assert!(index.words("acao", 10).unwrap().is_empty());
}
#[test]
fn future_schema_is_refused_without_changing_it() {
    let d = tempfile::tempdir().unwrap();
    let path = d.path().join("registry.db");
    let db = rusqlite::Connection::open(&path).unwrap();
    db.pragma_update(None, "user_version", 99).unwrap();
    drop(db);
    assert!(matches!(
        RegistryStore::open(&path),
        Err(CoreError::SchemaAhead { found: 99, .. })
    ));
    let db = rusqlite::Connection::open(path).unwrap();
    assert_eq!(
        db.pragma_query_value::<u32, _>(None, "user_version", |r| r.get(0))
            .unwrap(),
        99
    );
}
#[test]
fn index_recreation_does_not_touch_identity() {
    let d = tempfile::tempdir().unwrap();
    let registry = d.path().join("registry.db");
    let mut store = RegistryStore::open(&registry).unwrap();
    store.write(b"identity").unwrap();
    drop(store);
    let path = d.path().join("index.db");
    drop(Index::open(&path).unwrap());
    std::fs::remove_file(&path).unwrap();
    drop(Index::open(&path).unwrap());
    assert_eq!(
        RegistryStore::open(&registry)
            .unwrap()
            .read()
            .unwrap()
            .unwrap(),
        b"identity"
    );
}

#[test]
fn stale_registry_snapshots_merge_unrelated_notes_but_refuse_conflicts() {
    let d = tempfile::tempdir().unwrap();
    let mut store = RegistryStore::open(&d.path().join("registry.db")).unwrap();
    let base = br#"{"notes":{},"schema":1}"#;
    store.write_merged(None, base).unwrap();
    let a = br#"{"notes":{"a":{"path":"a.md","rev":1}},"schema":1}"#;
    let b = br#"{"notes":{"b":{"path":"b.md","rev":1}},"schema":1}"#;
    store.write_merged(Some(base), a).unwrap();
    store.write_merged(Some(base), b).unwrap();
    let result: serde_json::Value =
        serde_json::from_slice(&store.read().unwrap().unwrap()).unwrap();
    assert_eq!(result["notes"].as_object().unwrap().len(), 2);
    assert!(store
        .write_merged(
            Some(base),
            br#"{"notes":{"a":{"path":"changed.md","rev":2}},"schema":1}"#
        )
        .is_err());
}

#[test]
fn upgrading_derived_parser_schema_clears_only_index_data() {
    let d = tempfile::tempdir().unwrap();
    let path = d.path().join("index.db");
    let db = rusqlite::Connection::open(&path).unwrap();
    db.execute_batch("CREATE TABLE notes(path TEXT); INSERT INTO notes VALUES('old.md'); CREATE TABLE fts(text TEXT); PRAGMA user_version=1;").unwrap();
    drop(db);
    let mut index = Index::open(&path).unwrap();
    assert!(index.plan().unwrap().is_empty());
    drop(index);
    let db = rusqlite::Connection::open(&path).unwrap();
    assert_eq!(
        db.pragma_query_value::<u32, _>(None, "user_version", |r| r.get(0))
            .unwrap(),
        2
    );
}

/// R6-12: deletes now go by `rowid`, from a map `plan()` reads once. A wrong
/// rowid would delete **another note's** text, silently, so what is asserted
/// here is that every note keeps exactly its own words through a rebuild, an
/// update and a removal.
#[test]
fn deleting_by_rowid_touches_only_the_note_it_names() {
    let d = tempfile::tempdir().unwrap();
    let mut index = Index::open(&d.path().join("index.db")).unwrap();
    let seen = |p: &str| Seen {
        path: p.into(),
        size: 1,
        mtime: "1".into(),
    };
    let (a, b, c) = (seen("a.md"), seen("b.md"), seen("c.md"));
    let put = |index: &mut Index, s: &Seen, text: &str| {
        index
            .apply(
                Indexed {
                    seen: s,
                    hash: text,
                    text,
                },
                true,
            )
            .unwrap();
    };
    let found = |index: &Index, w: &str| {
        index
            .words(w, 10)
            .unwrap()
            .into_iter()
            .map(|h| h.path)
            .collect::<Vec<_>>()
    };

    // Cold build through the map.
    index.plan().unwrap();
    put(&mut index, &a, "alfa");
    put(&mut index, &b, "bravo");
    put(&mut index, &c, "charlie");

    // A forced rebuild in a fresh pass: every row replaced by rowid.
    index.plan().unwrap();
    put(&mut index, &a, "alfa");
    put(&mut index, &b, "bravo");
    put(&mut index, &c, "charlie");
    assert_eq!(found(&index, "alfa"), ["a.md"]);
    assert_eq!(found(&index, "bravo"), ["b.md"]);
    assert_eq!(found(&index, "charlie"), ["c.md"]);

    // Update one: its old words go, its new ones arrive, the others are intact.
    put(&mut index, &b, "delta");
    assert!(found(&index, "bravo").is_empty());
    assert_eq!(found(&index, "delta"), ["b.md"]);
    assert_eq!(found(&index, "alfa"), ["a.md"]);
    assert_eq!(found(&index, "charlie"), ["c.md"]);

    // Remove one: only it disappears.
    index.remove(&["a.md".into()]).unwrap();
    assert!(found(&index, "alfa").is_empty());
    assert_eq!(found(&index, "delta"), ["b.md"]);
    assert_eq!(found(&index, "charlie"), ["c.md"]);
}

/// Without `plan()`, the delete by path still runs and is still correct — the
/// map is an optimisation for a build, not a precondition.
#[test]
fn without_a_plan_the_delete_by_path_still_keeps_one_row_per_note() {
    let d = tempfile::tempdir().unwrap();
    let mut index = Index::open(&d.path().join("index.db")).unwrap();
    let s = Seen {
        path: "a.md".into(),
        size: 1,
        mtime: "1".into(),
    };
    index
        .apply(
            Indexed {
                seen: &s,
                hash: "1",
                text: "first",
            },
            true,
        )
        .unwrap();
    index
        .apply(
            Indexed {
                seen: &s,
                hash: "2",
                text: "second",
            },
            true,
        )
        .unwrap();
    assert!(index.words("first", 10).unwrap().is_empty());
    assert_eq!(index.words("second", 10).unwrap().len(), 1);
}
