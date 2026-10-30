//! The Markdown guide behind Help ▸ Markdown guide.
//!
//! A person who has never written Markdown has no way to learn that `#` in front
//! of a line is a heading, and the interface says nothing about it. The guide is
//! the answer: every construct this application's preview understands, each with
//! what to type and what it becomes.
//!
//! **What it becomes is rendered here, by the same renderer and the same
//! sanitizer as the preview**, and not written beside it. The frontend contains
//! no Markdown parser (`docs/ARCHITECTURE.md` §10), and a cheat sheet typed by
//! hand would promise what the application does not do: raw HTML is shown as
//! text, a picture from the web is blocked until it is allowed, `www.` alone is
//! not a link, and an e-mail address in angle brackets is refused. Those are
//! exactly the lines a hand-written list gets wrong, so each one is a test below.
//!
//! The words (titles and notes) belong to the interface and are keyed by `id`
//! in `apps/notes-app/src/i18n/*.json`; a test here checks that every id and
//! every group has them in both languages.

use crate::{render_html, RenderOpts};
use notes_model::{RelPath, WorkspaceId};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// One construct: what is typed, and what the preview shows for it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct GuideEntry {
    /// Stable name the interface keys its title and note on.
    pub id: String,
    /// The section it belongs to, also an interface key.
    pub group: String,
    /// Exactly what is typed. Never translated: it is syntax.
    pub source: String,
    /// Sanitized, as the preview would show it; empty when the construct has
    /// no picture of its own (a picture needs a file, properties are not drawn).
    pub html: String,
}

/// `(group, id, source)`, in the order the guide shows them.
pub(crate) const ENTRIES: &[(&str, &str, &str)] = &[
    (
        "headings",
        "headings",
        "# Heading 1\n## Heading 2\n### Heading 3\n#### Heading 4",
    ),
    ("text", "bold", "**bold text**"),
    ("text", "italic", "*italic text*"),
    ("text", "bold_italic", "***bold and italic***"),
    ("text", "strike", "~~struck through~~"),
    ("text", "code_inline", "Use the `print()` function."),
    ("text", "escape", "\\*not italic\\*"),
    (
        "text",
        "breaks",
        "First line\\\nSecond line\n\nA new paragraph.",
    ),
    ("lists", "bullets", "- First\n- Second\n  - Nested\n- Third"),
    ("lists", "numbers", "1. First\n2. Second\n3. Third"),
    ("lists", "tasks", "- [ ] To do\n- [x] Done"),
    ("links", "link", "[Tura Notes](https://example.com)"),
    ("links", "autolink", "https://example.com"),
    ("links", "note_link", "[Meeting notes](meetings/2026-10.md)"),
    ("links", "wikilink", "[[Meeting notes]]"),
    ("links", "image", "![A cat](images/cat.png)"),
    (
        "blocks",
        "quote",
        "> A quoted line.\n> Another line.\n>\n> > A quote inside a quote.",
    ),
    (
        "blocks",
        "code_block",
        "```rust\nfn main() {\n    println!(\"hi\");\n}\n```",
    ),
    ("blocks", "rule", "Above\n\n---\n\nBelow"),
    (
        "blocks",
        "table",
        "| Item | Qty |\n| :--- | ---: |\n| Tea  | 2 |\n| Milk | 1 |",
    ),
    (
        "blocks",
        "footnote",
        "A claim.[^1]\n\n[^1]: Where it comes from.",
    ),
    (
        "notes",
        "properties",
        "---\ntitle: Trip plan\ntags: [travel, ideas]\n---",
    ),
    ("notes", "tags", "Planning the #trip with the #family."),
    ("limits", "html", "<b>not bold</b>"),
    ("limits", "math", "$E = mc^2$"),
    ("limits", "highlight", "==highlighted=="),
    ("limits", "definition", "Term\n: Its definition"),
];

/// Entries whose preview would be a broken picture or nothing at all, so the
/// guide shows the syntax and says what happens instead of a drawing.
const NO_PICTURE: &[&str] = &["image", "properties"];

/// Every construct, rendered by the preview's own renderer.
///
/// No workspace is needed: the render options carry a nil workspace id and the
/// root as the note's folder, which only matters to the entries that are not
/// drawn.
pub fn guide() -> Vec<GuideEntry> {
    let opts = RenderOpts {
        base: RelPath::root(),
        raw_html: false,
        remote_images: false,
        workspace_id: "00000000-0000-0000-0000-000000000000"
            .parse::<WorkspaceId>()
            .expect("the nil uuid parses"),
    };
    ENTRIES
        .iter()
        .map(|&(group, id, source)| GuideEntry {
            id: id.to_owned(),
            group: group.to_owned(),
            source: source.to_owned(),
            html: if NO_PICTURE.contains(&id) {
                String::new()
            } else {
                render_html(source, &opts).html
            },
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parse;

    /// The groups, in the order the guide shows them. The interface takes the
    /// order from the entries themselves; this is what checks it.
    const GROUPS: &[&str] = &[
        "headings", "text", "lists", "links", "blocks", "notes", "limits",
    ];

    fn entry(id: &str) -> GuideEntry {
        guide()
            .into_iter()
            .find(|e| e.id == id)
            .unwrap_or_else(|| panic!("no guide entry named {id}"))
    }

    fn html(id: &str) -> String {
        entry(id).html
    }

    #[test]
    fn ids_are_unique_and_every_group_is_declared_and_used() {
        let mut seen = std::collections::BTreeSet::new();
        for (group, id, _) in ENTRIES {
            assert!(seen.insert(*id), "{id} appears twice");
            assert!(
                GROUPS.contains(group),
                "{id} is in an undeclared group {group}"
            );
        }
        for group in GROUPS {
            assert!(
                ENTRIES.iter().any(|(g, _, _)| g == group),
                "group {group} has no entry"
            );
        }
        // And the groups come out in the order they are declared.
        let order: Vec<&str> = ENTRIES.iter().map(|e| e.0).collect();
        let mut firsts: Vec<&str> = vec![];
        for g in order {
            if firsts.last() != Some(&g) {
                assert!(!firsts.contains(&g), "group {g} is split in two");
                firsts.push(g);
            }
        }
        assert_eq!(firsts, GROUPS);
    }

    #[test]
    fn headings_have_levels_one_to_four() {
        let h = html("headings");
        for level in 1..=4 {
            assert!(h.contains(&format!("<h{level}")), "no h{level} in {h}");
        }
    }

    #[test]
    fn emphasis_strike_and_code_are_what_the_guide_says() {
        assert!(html("bold").contains("<strong>bold text</strong>"));
        assert!(html("italic").contains("<em>italic text</em>"));
        let both = html("bold_italic");
        assert!(both.contains("<em>") && both.contains("<strong>"), "{both}");
        assert!(html("strike").contains("<del>struck through</del>"));
        assert!(html("code_inline").contains("<code>print()</code>"));
    }

    #[test]
    fn a_backslash_turns_a_mark_into_a_letter_and_ends_a_line() {
        let e = html("escape");
        assert!(e.contains("*not italic*") && !e.contains("<em>"), "{e}");
        let b = html("breaks");
        assert!(b.contains("<br"), "{b}");
        assert_eq!(b.matches("<p>").count(), 2, "{b}");
    }

    #[test]
    fn lists_nest_number_and_carry_checkboxes() {
        let b = html("bullets");
        assert_eq!(
            b.matches("<ul>").count(),
            2,
            "a list and the one nested in it: {b}"
        );
        assert!(html("numbers").contains("<ol>"));
        let t = html("tasks");
        assert_eq!(t.matches("type=\"checkbox\"").count(), 2, "{t}");
        assert_eq!(t.matches("checked").count(), 1, "only the done one: {t}");
    }

    #[test]
    fn links_notes_and_wiki_links_are_distinct_kinds() {
        assert!(html("link").contains("href=\"https://example.com\""));
        assert!(html("autolink").contains("href=\"https://example.com\""));
        assert!(html("note_link").contains("data-note-path=\"meetings/2026-10.md\""));
        assert!(html("wikilink").contains("data-wiki-target=\"Meeting notes\""));
    }

    #[test]
    fn what_a_hand_written_cheat_sheet_would_get_wrong() {
        let opts = RenderOpts {
            base: RelPath::root(),
            raw_html: false,
            remote_images: false,
            workspace_id: "00000000-0000-0000-0000-000000000000".parse().unwrap(),
        };
        // `www.` without a scheme is text; guessing http:// for the reader is not done.
        let www = render_html("www.example.com", &opts).html;
        assert!(!www.contains("<a "), "{www}");
        // An address in angle brackets is refused, not turned into a mailto link.
        let mail = render_html("<someone@example.com>", &opts).html;
        assert!(!mail.contains("href=\"mailto"), "{mail}");
        // A picture from the web is blocked until the workspace allows it...
        let remote = render_html("![x](https://example.com/x.png)", &opts);
        assert!(!remote.html.contains("<img"), "{}", remote.html);
        assert_eq!(remote.blocked_remote, ["https://example.com/x.png"]);
        // ...and a picture of the workspace is drawn.
        let local = render_html(ENTRIES.iter().find(|e| e.1 == "image").unwrap().2, &opts);
        assert!(local.html.contains("<img"), "{}", local.html);
    }

    #[test]
    fn blocks_are_quotes_code_rules_tables_and_footnotes() {
        let q = html("quote");
        assert_eq!(q.matches("<blockquote>").count(), 2, "{q}");
        let c = html("code_block");
        assert!(c.contains("<pre><code class=\"language-rust\">"), "{c}");
        assert!(html("rule").contains("<hr"));
        let t = html("table");
        assert!(
            t.contains("<table") && t.contains("<th") && t.contains("<td"),
            "{t}"
        );
        assert!(
            t.contains("left") && t.contains("right"),
            "alignment survives: {t}"
        );
        let f = html("footnote");
        assert!(
            f.contains("footnote-reference") && f.contains("footnote-definition"),
            "{f}"
        );
    }

    #[test]
    fn properties_and_tags_reach_the_index_and_are_not_drawn() {
        let p = entry("properties");
        assert_eq!(p.html, "", "properties have no picture of their own");
        let doc = parse(&p.source);
        assert!(doc.front_matter.is_some(), "the block is front matter");
        assert_eq!(
            parse(&format!("{}\nbody", p.source)).tags,
            ["ideas", "travel"]
        );
        assert_eq!(parse(&entry("tags").source).tags, ["family", "trip"]);
    }

    #[test]
    fn what_is_not_supported_is_shown_as_typed() {
        let h = html("html");
        assert!(
            h.contains("&lt;b&gt;") && !h.contains("<b>"),
            "raw HTML is text: {h}"
        );
        assert!(!html("math").contains("<math") && html("math").contains("E = mc^2"));
        assert!(
            !html("highlight").contains("<mark") && html("highlight").contains("==highlighted==")
        );
        let d = html("definition");
        assert!(!d.contains("<dl") && !d.contains("<dd"), "{d}");
    }

    /// Every id and every group has its words in both languages. The interface
    /// reads `guide.group.<group>` and `guide.entry.<id>.title` / `.note`; a
    /// construct added here without them would show a raw key.
    #[test]
    fn every_entry_and_group_has_its_words_in_both_languages() {
        let sources = [
            (
                "en",
                include_str!("../../../apps/notes-app/src/i18n/en.json"),
            ),
            (
                "pt-BR",
                include_str!("../../../apps/notes-app/src/i18n/pt-BR.json"),
            ),
        ];
        for (lang, text) in sources {
            let words: serde_json::Value = serde_json::from_str(text).unwrap();
            let has = |key: &str| {
                words
                    .get(key)
                    .and_then(|v| v.as_str())
                    .is_some_and(|s| !s.trim().is_empty())
            };
            for g in GROUPS {
                assert!(has(&format!("guide.group.{g}")), "{lang}: guide.group.{g}");
            }
            for (_, id, _) in ENTRIES {
                for part in ["title", "note"] {
                    assert!(
                        has(&format!("guide.entry.{id}.{part}")),
                        "{lang}: guide.entry.{id}.{part}"
                    );
                }
            }
        }
    }
}
