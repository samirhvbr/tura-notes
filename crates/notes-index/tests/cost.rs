//! What rebuilding the full-text index costs, measured rather than asserted.
//!
//! A measurement, not a verdict (ADR-095): a wall clock on a shared runner
//! answers a question about the runner. Run it where the number means
//! something:
//!
//! ```bash
//! cargo test -p notes-index --test cost -- --ignored --nocapture
//! ```

use notes_index::{Index, Indexed, Seen};
use std::time::Instant;

#[test]
#[ignore = "a measurement; run with --ignored --nocapture"]
fn forced_rebuild_of_three_thousand_notes() {
    const N: usize = 3_000;
    // ~22 KB per note, the size the review measured with.
    let body = "palavra comum para o índice de texto completo ".repeat(480);
    let d = tempfile::tempdir().unwrap();
    let mut index = Index::open(&d.path().join("index.db")).unwrap();
    let seen: Vec<Seen> = (0..N)
        .map(|i| Seen {
            path: format!("n{i:05}.md"),
            size: body.len() as u64,
            mtime: "1".into(),
        })
        .collect();

    let t = Instant::now();
    index.plan().unwrap();
    for s in &seen {
        index
            .apply(
                Indexed {
                    seen: s,
                    hash: "h",
                    text: &body,
                },
                true,
            )
            .unwrap();
    }
    let cold = t.elapsed();

    let t = Instant::now();
    index.plan().unwrap();
    for s in &seen {
        index
            .apply(
                Indexed {
                    seen: s,
                    hash: "h2",
                    text: &body,
                },
                true,
            )
            .unwrap();
    }
    let forced = t.elapsed();

    println!("cold build of {N}:     {:>8.2} s", cold.as_secs_f64());
    println!("forced rebuild of {N}: {:>8.2} s", forced.as_secs_f64());
    assert_eq!(
        index.words("palavra", 5).unwrap().len(),
        5,
        "and it still answers"
    );
}
