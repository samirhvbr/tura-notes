//! A link review builds the workspace's wiki index **once**.
//!
//! This test lives alone in its own binary on purpose. It reads a
//! process-global counter before and after one call, and cargo runs the tests
//! of one binary on parallel threads: when it sat in `knowledge.rs`, a sibling
//! test building its own lookup between the two reads made the Windows runner
//! answer `2` where Linux had always answered `1`. An integration-test file is
//! its own process, so here nothing else can touch the counter.

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
