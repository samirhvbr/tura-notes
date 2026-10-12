//! Read-only metadata interpretation; source bytes are never serialized back.
use crate::{Span, Spanned};
use pulldown_cmark::{Event, Tag, TagEnd};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use ts_rs::TS;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Metadata {
    pub title: Option<String>,
    pub properties: Vec<Property>,
    pub tags: Vec<String>,
    pub error: Option<String>,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Property {
    pub name: String,
    pub value: String,
}

pub fn metadata(src: &str) -> Metadata {
    let (doc, _) = crate::analyse(src);
    let mut result = front_matter(src, doc.front_matter);
    result.tags = doc.tags;
    result
}

pub(crate) fn front_matter(src: &str, span: Option<Span>) -> Metadata {
    let mut result = Metadata::default();
    let Some(span) = span else { return result };
    let raw = &src[span.start..span.end];
    if raw.len() > 65536 {
        result.error = Some("Front matter exceeds 64 KiB".into());
        return result;
    }
    let body = raw
        .lines()
        .skip(1)
        .take_while(|l| l.trim_end() != "---" && l.trim_end() != "...")
        .collect::<Vec<_>>()
        .join("\n");
    let value = match serde_norway::from_str::<serde_norway::Value>(&body) {
        Ok(v) => v,
        Err(_) => {
            result.error = Some("Invalid YAML front matter".into());
            return result;
        }
    };
    if value.is_null() {
        return result;
    }
    let Some(map) = value.as_mapping() else {
        result.error = Some("Front matter must be a mapping".into());
        return result;
    };
    for (key, value) in map {
        let Some(name) = key.as_str() else { continue };
        if name == "title" {
            result.title = value.as_str().map(str::to_owned);
        }
        if name == "tags" {
            if let Some(tag) = value.as_str() {
                result
                    .tags
                    .extend(tag.split([',', ' ']).filter_map(normalize_tag));
            }
            if let Some(tags) = value.as_sequence() {
                result.tags.extend(
                    tags.iter()
                        .filter_map(|v| v.as_str())
                        .filter_map(normalize_tag),
                );
            }
        }
        let text = value.as_str().map(str::to_owned).unwrap_or_else(|| {
            serde_norway::to_string(value)
                .unwrap_or_default()
                .trim()
                .to_owned()
        });
        result.properties.push(Property {
            name: name.into(),
            value: text,
        });
    }
    result
}
fn normalize_tag(raw: &str) -> Option<String> {
    let tag = raw.trim().trim_start_matches('#').trim_end_matches('/');
    if tag.is_empty()
        || !tag.chars().any(char::is_alphabetic)
        || !tag
            .chars()
            .all(|c| c.is_alphanumeric() || matches!(c, '_' | '-' | '/'))
    {
        return None;
    }
    Some(tag.to_lowercase())
}
pub(crate) fn tags(src: &str, events: &[Spanned<'_>], front: Option<Span>) -> Vec<String> {
    let mut found: BTreeSet<String> = front_matter(src, front).tags.into_iter().collect();
    let mut blocked = 0usize;
    for (event, range) in events {
        match event {
            Event::Start(
                Tag::CodeBlock(_)
                | Tag::MetadataBlock(_)
                | Tag::Link { .. }
                | Tag::Image { .. }
                | Tag::HtmlBlock,
            ) => blocked += 1,
            Event::End(
                TagEnd::CodeBlock
                | TagEnd::MetadataBlock(_)
                | TagEnd::Link
                | TagEnd::Image
                | TagEnd::HtmlBlock,
            ) => blocked = blocked.saturating_sub(1),
            Event::Text(text) if blocked == 0 && src.get(range.clone()) == Some(text.as_ref()) => {
                let chars: Vec<(usize, char)> = text.char_indices().collect();
                for (i, (offset, c)) in chars.iter().enumerate() {
                    if *c != '#'
                        || (i > 0
                            && !chars[i - 1].1.is_whitespace()
                            && !matches!(chars[i - 1].1, '(' | '['))
                    {
                        continue;
                    }
                    if range.start + offset > 0 && src.as_bytes()[range.start + offset - 1] == b'\\'
                    {
                        continue;
                    }
                    let tail = &text[offset + 1..];
                    let end = tail
                        .find(|c: char| !c.is_alphanumeric() && !matches!(c, '_' | '-' | '/'))
                        .unwrap_or(tail.len());
                    if let Some(tag) = normalize_tag(&tail[..end]) {
                        found.insert(tag);
                    }
                }
            }
            _ => {}
        }
    }
    found.into_iter().collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn metadata_and_tags_exclude_code_and_destinations() {
        let src="---\ntitle: Café\ntags: [Rust, 'projeto/ação']\ncount: 3\n---\n# Heading\n#Visible `#inline` [link](#anchor) \\#escaped\n```md\n#hidden\n```\n";
        let m = metadata(src);
        assert_eq!(m.title.as_deref(), Some("Café"));
        assert_eq!(m.tags, vec!["projeto/ação", "rust", "visible"]);
        assert!(m.error.is_none());
    }
    #[test]
    fn indented_fences_are_yaml_scalar_content_not_metadata_delimiters() {
        let src =
            "---\nsummary: |\n  before\n  ---\n  middle\n  ...\n  after\ntags: [kept]\n---\nbody\n";
        let m = metadata(src);
        assert!(m.error.is_none());
        assert_eq!(m.tags, vec!["kept"]);
        assert_eq!(m.properties[0].value, "before\n---\nmiddle\n...\nafter\n");
    }

    #[test]
    fn invalid_yaml_does_not_hide_body_tags() {
        let m = metadata("---\ntags: [broken\n---\n#visible\n");
        assert!(m.error.is_some());
        assert_eq!(m.tags, vec!["visible"]);
    }
    /// A note whose front matter is exactly `body`, read through the whole pipeline.
    fn note(body: &str) -> Metadata {
        metadata(&format!("---\n{body}\n---\nbody\n"))
    }
    fn props(body: &str) -> Vec<(String, String)> {
        note(body)
            .properties
            .into_iter()
            .map(|p| (p.name, p.value))
            .collect()
    }
    fn one(body: &str) -> String {
        let mut all = props(body);
        assert_eq!(
            all.len(),
            1,
            "{body:?} should give one property, got {all:?}"
        );
        all.remove(0).1
    }

    // The tests below pin what the Properties panel shows for every kind of YAML
    // value, because nothing did. A property whose value is not text is shown by
    // **re-serialising** it, so the text the person sees is the parser's own
    // emitter talking — and the YAML parser has already been replaced once
    // (RUSTSEC-2024-0449), which is when a gap like this stops being theoretical.
    // They were written against `serde_yaml_ng`, hold for `serde_norway` (ADR-108), and a
    // parser that differs fails here instead of changing a note's panel silently.
    // Measured against a safe-Rust parser (`serde-saphyr` into `serde_json::Value`)
    // 22 of 79 cases differed: `.inf`/`.nan` and an odd key emptied the whole panel,
    // `0777` became `777.0`, `1_000` became `1000`, and the order went alphabetical.

    #[test]
    fn values_that_are_not_text_show_the_text_the_note_would_have_as_yaml() {
        for (yaml, shown) in [
            ("count: 3", "3"),
            ("n: -7", "-7"),
            ("ratio: 0.5", "0.5"),
            ("e: 1e3", "1000.0"),
            ("h: 0x1F", "31"),
            ("draft: true", "true"),
            ("d: TRUE", "true"),
            ("empty:", "null"),
            ("t: ~", "null"),
            ("l: [a, b]", "- a\n- b"),
            ("l:\n  - a\n  - b", "- a\n- b"),
            ("l: [[1, 2], [3]]", "- - 1\n  - 2\n- - 3"),
            ("l:\n  - k: v\n  - k: w", "- k: v\n- k: w"),
            ("m:\n  k: v\n  z:\n    deep: 1", "k: v\nz:\n  deep: 1"),
            ("m: {a: 1, b: [2, 3]}", "a: 1\nb:\n- 2\n- 3"),
            ("a: &x 1\nb: *x", "1"),
        ] {
            let got = props(yaml);
            assert_eq!(
                got.last().map(|p| p.1.as_str()),
                Some(shown),
                "{yaml:?} -> {got:?}"
            );
        }
    }

    #[test]
    fn what_is_written_as_text_stays_as_it_was_written() {
        // YAML 1.1 words and numerals that only look like numbers are strings here:
        // a note that says `yes`, `0777` or `1_000` must not come back as something else.
        for (yaml, shown) in [
            ("a: yes", "yes"),
            ("a: on", "on"),
            ("a: off", "off"),
            ("a: y", "y"),
            ("o: 0777", "0777"),
            ("u: 1_000", "1_000"),
            ("d: 2024-05-01", "2024-05-01"),
            ("q: '3'", "3"),
            ("q: \"true\"", "true"),
            ("q: ''", ""),
            ("q: ação ✓ 🦀", "ação ✓ 🦀"),
            ("s: \"a\\tb\\n\\u00e9\"", "a\tb\né"),
        ] {
            assert_eq!(one(yaml), shown, "{yaml:?}");
        }
    }

    #[test]
    fn non_finite_numbers_do_not_empty_the_panel() {
        // One odd value must not cost the note the rest of its metadata.
        let m = note("a: 1\nx: .inf\ny: -.inf\nz: .nan\nb: 2");
        assert!(m.error.is_none(), "{:?}", m.error);
        let names: Vec<_> = m.properties.iter().map(|p| p.name.as_str()).collect();
        assert_eq!(names, ["a", "x", "y", "z", "b"]);
    }

    #[test]
    fn properties_keep_the_order_of_the_document() {
        let names: Vec<_> = props("zeta: 1\nalpha: 2\nmid: 3")
            .into_iter()
            .map(|p| p.0)
            .collect();
        assert_eq!(names, ["zeta", "alpha", "mid"]);
    }

    #[test]
    fn a_key_that_is_not_text_is_skipped_and_the_rest_survives() {
        for yaml in [
            "1: a\nb: 2",
            "true: a\nb: 2",
            "~: a\nb: 2",
            "? [a, b]\n: c\nb: 2",
        ] {
            let m = note(yaml);
            assert!(m.error.is_none(), "{yaml:?} -> {:?}", m.error);
            assert_eq!(
                props(yaml),
                [("b".to_string(), "2".to_string())],
                "{yaml:?}"
            );
        }
    }

    #[test]
    fn a_title_that_is_not_text_is_a_property_and_not_the_title() {
        let m = note("title: 123");
        assert_eq!(m.title, None);
        assert_eq!(one("title: 123"), "123");
        assert_eq!(note("title:").title, None);
        assert_eq!(one("title:"), "null");
    }

    #[test]
    fn tags_come_from_text_and_lists_and_ignore_what_cannot_be_a_tag() {
        assert_eq!(note("tags: a, b c").tags, ["a", "b", "c"]);
        assert_eq!(note("tags: '#x #y'").tags, ["x", "y"]);
        assert_eq!(note("tags: [a, 1, true, {k: v}, '#b/']").tags, ["a", "b"]);
        assert!(note("tags: [1, 2]").tags.is_empty());
        assert!(note("tags:").tags.is_empty());
    }

    #[test]
    fn broken_front_matter_is_one_named_error() {
        for yaml in [
            "a: 1\na: 2", // a repeated key
            "a:\n\tb: 1", // a tab for indentation
            "a: \"unclosed",
            "a: b: c",
            "a: *missing",    // an alias nobody defined
            "a: 1\n--- b: 2", // a second document
            "i: 123456789012345678901234567890",
        ] {
            assert_eq!(
                note(yaml).error.as_deref(),
                Some("Invalid YAML front matter"),
                "{yaml:?}"
            );
        }
        for yaml in ["- a\n- b", "just text", "42"] {
            assert_eq!(
                note(yaml).error.as_deref(),
                Some("Front matter must be a mapping"),
                "{yaml:?}"
            );
        }
        assert!(note("").error.is_none());
        assert!(note("# only a comment").error.is_none());
    }

    #[test]
    fn hostile_front_matter_is_refused_instead_of_expanded() {
        // This YAML arrives in notes from other devices, so it is untrusted. A
        // billion-laughs document fits in 64 KiB and would expand to gigabytes if the
        // parser resolved aliases naively; deep nesting would overflow a stack — and
        // a `cargo test` thread has the 2 MiB a worker thread has, which is the
        // realistic one. Neither may crash, hang or allocate without bound.
        let mut bomb = String::from("a: &a0 [lol,lol,lol,lol,lol,lol,lol,lol,lol]\n");
        for i in 1..9 {
            let p = i - 1;
            bomb +=
                &format!("a{i}: &a{i} [*a{p},*a{p},*a{p},*a{p},*a{p},*a{p},*a{p},*a{p},*a{p}]\n");
        }
        assert!(bomb.len() < 65536);
        assert_eq!(
            note(&bomb).error.as_deref(),
            Some("Invalid YAML front matter")
        );
        let deep = format!("a: {}{}", "[".repeat(2000), "]".repeat(2000));
        assert_eq!(
            note(&deep).error.as_deref(),
            Some("Invalid YAML front matter")
        );
        // And the project's own guard answers before any parser is asked.
        let big = format!("k: {}", "x".repeat(70000));
        assert_eq!(
            note(&big).error.as_deref(),
            Some("Front matter exceeds 64 KiB")
        );
    }

    #[test]
    fn wiki_links_are_parser_nodes_but_code_is_not() {
        let d = crate::parse("[[Note|label]] `[[hidden]]`\n");
        assert_eq!(
            d.links
                .iter()
                .filter(|l| l.kind == crate::LinkKind::Wiki)
                .count(),
            1
        );
        let r = crate::render_html(
            "[[Note|label]]",
            &crate::RenderOpts::for_note(
                &notes_model::RelPath::parse("a.md").unwrap(),
                notes_model::WorkspaceId::new(),
            ),
        );
        assert!(r.html.contains("data-wiki-target=\"Note\""));
        assert!(r.html.contains("label"));
    }
}
