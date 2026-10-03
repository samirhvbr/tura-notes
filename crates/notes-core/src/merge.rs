//! Joining two edits of one note that started from the same text.
//!
//! Two apps with the same remote note open each change it; whichever saves
//! second finds the server's copy has moved (ADR-099). Refusing to save is the
//! safe answer, and the wrong one when the two edits touched different parts of
//! the note: nothing is in conflict, and asking a person to compare is asking
//! them to do what a three-way merge does. This is that merge, line by line,
//! the way a version-control tool does it.
//!
//! **It only ever says yes when it is sure.** Edits that touch the same lines,
//! or lines next to each other, are a conflict, and a conflict is returned as a
//! conflict with no text: the markers a tool would write into the file are not
//! something to put in somebody's note, so the caller shows the two versions
//! and the person chooses (the flow that already existed). A note beyond the
//! size limit is treated the same way, because finding the differences of two
//! very large texts is work this call should not start.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// The most any one of the three texts may be, in bytes.
pub const MAX_MERGE_BYTES: usize = 2 * 1024 * 1024;

/// What joining the two edits came to.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Merged {
    /// Both edits, in one text. Present only when they did not collide.
    pub text: Option<String>,
}

/// `base` is the text both edits started from, `mine` the local one and `theirs`
/// the server's.
pub fn merge3(base: &str, mine: &str, theirs: &str) -> Merged {
    if [base, mine, theirs]
        .iter()
        .any(|t| t.len() > MAX_MERGE_BYTES)
    {
        return Merged { text: None };
    }
    // The easy answers first, and exact: they also keep a note's bytes as they
    // are when only one side did anything.
    if mine == theirs || theirs == base {
        return Merged {
            text: Some(mine.to_owned()),
        };
    }
    if mine == base {
        return Merged {
            text: Some(theirs.to_owned()),
        };
    }
    Merged {
        text: diffy::merge(base, mine, theirs).ok(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const BASE: &str = "# Plan\n\none\ntwo\nthree\nfour\nfive\nsix\nseven\n";

    #[test]
    fn edits_in_different_places_are_joined() {
        let mine = BASE.replace("one\n", "ONE\n");
        let theirs = BASE.replace("seven\n", "SEVEN\n");
        assert_eq!(
            merge3(BASE, &mine, &theirs).text.as_deref(),
            Some("# Plan\n\nONE\ntwo\nthree\nfour\nfive\nsix\nSEVEN\n")
        );
    }

    #[test]
    fn lines_added_at_both_ends_are_joined() {
        let mine = format!("{BASE}eight\n");
        let theirs = format!("intro\n{BASE}");
        assert_eq!(
            merge3(BASE, &mine, &theirs).text.as_deref(),
            Some(format!("intro\n{BASE}eight\n").as_str())
        );
    }

    #[test]
    fn the_same_line_changed_two_ways_is_a_conflict_and_carries_no_text() {
        let mine = BASE.replace("three\n", "mine\n");
        let theirs = BASE.replace("three\n", "theirs\n");
        assert_eq!(merge3(BASE, &mine, &theirs), Merged { text: None });
    }

    #[test]
    fn lines_next_to_each_other_are_a_conflict_not_a_guess() {
        let mine = BASE.replace("three\n", "mine\n");
        let theirs = BASE.replace("four\n", "theirs\n");
        assert_eq!(merge3(BASE, &mine, &theirs).text, None);
    }

    #[test]
    fn when_only_one_side_changed_its_bytes_come_back_exactly() {
        let odd = "no newline at the end\r\nand a crlf";
        let edited = "no newline at the end\r\nand a crlf!";
        assert_eq!(merge3(odd, edited, odd).text.as_deref(), Some(edited));
        assert_eq!(merge3(odd, odd, edited).text.as_deref(), Some(edited));
        assert_eq!(merge3(odd, edited, edited).text.as_deref(), Some(edited));
    }

    #[test]
    fn a_note_with_no_final_newline_still_merges_where_it_can() {
        let base = "a\nb\nc\nd\ne\nf\ng";
        let mine = base.replace("a\n", "A\n");
        let theirs = base.replace("g", "G");
        assert_eq!(
            merge3(base, &mine, &theirs).text.as_deref(),
            Some("A\nb\nc\nd\ne\nf\nG")
        );
    }

    #[test]
    fn an_empty_base_is_two_notes_that_started_apart() {
        assert_eq!(merge3("", "mine\n", "theirs\n").text, None);
        assert_eq!(
            merge3("", "same\n", "same\n").text.as_deref(),
            Some("same\n")
        );
    }

    #[test]
    fn markers_never_reach_the_text() {
        let mine = BASE.replace("three\n", "mine\n");
        let theirs = BASE.replace("three\n", "theirs\n");
        // A collision is no text at all, not a text with markers in it...
        assert_eq!(merge3(BASE, &mine, &theirs).text, None);
        // ...and a join has none either.
        let joined = merge3(
            BASE,
            &BASE.replace("one\n", "ONE\n"),
            &BASE.replace("seven\n", "SEVEN\n"),
        );
        assert!(!joined.text.unwrap().contains("<<<<<<<"));
    }

    #[test]
    fn a_text_over_the_limit_is_left_to_the_person() {
        let big = "x\n".repeat(MAX_MERGE_BYTES / 2 + 1);
        assert_eq!(
            merge3(&big, &format!("a\n{big}"), &format!("{big}b\n")).text,
            None
        );
        // Even when one side did nothing: the answer would be right, but the
        // limit is on what this call will look at, and it says so the same way.
        assert_eq!(merge3(&big, &big, &big).text, None);
    }

    #[test]
    fn it_is_stable_when_asked_again_with_the_sides_swapped() {
        let mine = BASE.replace("one\n", "ONE\n");
        let theirs = BASE.replace("seven\n", "SEVEN\n");
        assert_eq!(merge3(BASE, &mine, &theirs), merge3(BASE, &theirs, &mine));
    }
}
