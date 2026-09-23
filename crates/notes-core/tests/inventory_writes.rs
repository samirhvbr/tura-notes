//! The sync inventory rewrites the identity registry once, not once per note.
//!
//! It used to call `open_note` for every note, and each call took the write
//! lock, loaded the whole registry, observed one note and stored the whole
//! registry back — N rewrites of a registry that grows to N, under the lock
//! every save also needs (R6-13).
//!
//! Alone in its own test binary on purpose: it reads a process-wide counter,
//! and cargo runs the tests of one binary on parallel threads (the flake
//! `1.7.20` fixed was exactly that).

use notes_core::sync::inventory;

#[test]
fn an_inventory_of_many_notes_stores_the_registry_a_constant_number_of_times() {
    let work = tempfile::tempdir().unwrap();
    let data = tempfile::tempdir().unwrap();
    const N: usize = 200;
    for i in 0..N {
        std::fs::write(work.path().join(format!("n{i:03}.md")), format!("# {i}\n")).unwrap();
    }

    let before = notes_core::registry_writes();
    let files = inventory(work.path(), data.path()).unwrap();
    let writes = notes_core::registry_writes() - before;

    assert_eq!(files.len(), N, "every note inventoried");
    assert!(
        writes <= 4,
        "{N} notes cost {writes} whole-registry rewrites; the per-note path would cost about {N}"
    );

    // And the identities are stable across a second inventory: batching the
    // observation must not mint new ones.
    let again = inventory(work.path(), data.path()).unwrap();
    for (a, b) in files.iter().zip(&again) {
        assert_eq!(a.note, b.note, "{:?} kept its identity", a.path);
    }
}
