use notes_core::WorkspaceService;
use notes_model::RelPath;
use std::{
    fs, thread,
    time::{Duration, Instant},
};
fn p(s: &str) -> RelPath {
    RelPath::parse(s).unwrap()
}
fn indexed(s: &mut WorkspaceService) {
    s.index_start(false).unwrap();
    let start = Instant::now();
    loop {
        let state = s.index_status().unwrap();
        if !state.running {
            assert!(state.error.is_none(), "{state:?}");
            break;
        }
        assert!(start.elapsed() < Duration::from_secs(20));
        thread::sleep(Duration::from_millis(5));
    }
}
#[test]
fn tags_backlinks_and_ambiguity_share_the_parser() {
    let root = tempfile::tempdir().unwrap();
    let data = tempfile::tempdir().unwrap();
    fs::create_dir(root.path().join("sub")).unwrap();
    fs::write(
        root.path().join("a.md"),
        "---\ntags: [Rust]\n---\n#visible `#hidden` [[Same]] [[Unique]] [other](sub/Same.md)\n",
    )
    .unwrap();
    for path in ["Same.md", "sub/Same.md", "Unique.md"] {
        fs::write(root.path().join(path), "note").unwrap();
    }
    let mut s = WorkspaceService::with_data_dir(data.path()).unwrap();
    s.open_workspace(root.path()).unwrap();
    indexed(&mut s);
    let k = s.knowledge().unwrap();
    let note = k.notes.iter().find(|n| n.path == p("a.md")).unwrap();
    assert_eq!(note.tags, vec!["rust", "visible"]);
    assert!(k
        .edges
        .iter()
        .any(|e| e.from == p("a.md") && e.to == p("Unique.md")));
    assert!(!k
        .edges
        .iter()
        .any(|e| e.from == p("a.md") && e.to == p("Same.md")));
    assert_eq!(k.unresolved[0].candidates.len(), 2);
    assert_eq!(s.wiki_candidates("./Same.md").unwrap(), vec![p("Same.md")]);
    // A newly created homonym must not produce a false unique graph edge
    // while the content index is still catching up.
    fs::write(root.path().join("sub/Unique.md"), "new homonym").unwrap();
    let pending = s.knowledge().unwrap();
    assert!(pending.partial);
    assert!(!pending.edges.iter().any(|e| e.to == p("Unique.md")));
    assert!(pending
        .unresolved
        .iter()
        .any(|l| l.target == "Unique" && l.candidates.len() == 2));
}
#[test]
fn reviewed_wiki_rename_preserves_alias_and_code() {
    let root = tempfile::tempdir().unwrap();
    let data = tempfile::tempdir().unwrap();
    fs::write(
        root.path().join("a.md"),
        "[[Old#heading|label]] `[[Old]]`\n",
    )
    .unwrap();
    fs::write(root.path().join("Old.md"), "# Heading\n").unwrap();
    let mut s = WorkspaceService::with_data_dir(data.path()).unwrap();
    s.open_workspace(root.path()).unwrap();
    indexed(&mut s);
    let plan = s.reference_preview(&p("Old.md"), &p("New.md")).unwrap();
    assert_eq!(plan.files.len(), 1);
    let result = s.reference_apply(&plan.token, &[0]).unwrap();
    assert!(result.failed.is_empty());
    assert_eq!(
        fs::read_to_string(root.path().join("a.md")).unwrap(),
        "[[./New.md#heading|label]] `[[Old]]`\n"
    );
}
#[test]
fn clipboard_import_validates_bytes_and_never_changes_the_note() {
    let root = tempfile::tempdir().unwrap();
    let data = tempfile::tempdir().unwrap();
    fs::create_dir(root.path().join("sub")).unwrap();
    fs::write(root.path().join("sub/a.md"), "original").unwrap();
    let mut bytes = std::io::Cursor::new(vec![]);
    image::DynamicImage::new_rgb8(1, 1)
        .write_to(&mut bytes, image::ImageFormat::Png)
        .unwrap();
    let bytes = bytes.into_inner();
    let mut s = WorkspaceService::with_data_dir(data.path()).unwrap();
    s.open_workspace(root.path()).unwrap();
    let a = s.import_attachment(&p("sub/a.md"), &bytes).unwrap();
    let b = s.import_attachment(&p("sub/a.md"), &bytes).unwrap();
    assert_ne!(a.path, b.path);
    assert!(a.markdown.contains("../attachments/"));
    assert_eq!(fs::read(root.path().join(a.path.as_str())).unwrap(), bytes);
    assert!(s.import_attachment(&p("sub/a.md"), b"<svg></svg>").is_err());
    assert_eq!(
        fs::read_to_string(root.path().join("sub/a.md")).unwrap(),
        "original"
    );
}

/// A link review walks the workspace **once**, not once per link.
///
/// `references.rs` called `knowledge::candidates(&paths, ...)` inside a loop
/// over every wiki link of every indexed document, and that helper builds a
/// whole `WikiLookup` — two maps over every note in the workspace — on each
/// call. Against the three-note fixtures every other test uses, it is
/// invisible; against the 10,000 notes the project says it supports, the work
/// is notes × documents × links.
///
/// The assertion counts **constructions**, not milliseconds. A wall-clock
/// ceiling is the shape that has produced three separate Windows flakes in this
/// repository, and the number of passes over the workspace is what actually
/// changed.
#[test]
fn a_link_review_builds_one_wiki_lookup_regardless_of_how_many_links_it_reads() {
    let root = tempfile::tempdir().unwrap();
    let data = tempfile::tempdir().unwrap();

    // Enough notes and links that a per-link rebuild is unmistakable in the
    // count: 12 documents, 8 wiki links each.
    for i in 0..12 {
        let links = (0..8)
            .map(|j| format!("[[Target{j}]]"))
            .collect::<Vec<_>>()
            .join(" ");
        fs::write(
            root.path().join(format!("n{i}.md")),
            format!("# n{i}\n{links}\n"),
        )
        .unwrap();
    }
    for j in 0..8 {
        fs::write(root.path().join(format!("Target{j}.md")), b"# t\n").unwrap();
    }

    let mut s = WorkspaceService::with_data_dir(data.path()).unwrap();
    s.open_workspace(root.path()).unwrap();
    indexed(&mut s);

    let before = notes_core::knowledge::wiki_lookups_built();
    s.reference_preview(&p("Target0.md"), &p("Renamed.md"))
        .unwrap();
    let built = notes_core::knowledge::wiki_lookups_built() - before;

    assert_eq!(
        built, 1,
        "one review, one pass over the workspace — 96 wiki links must not mean 96 passes"
    );
}
