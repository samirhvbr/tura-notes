use serde::{Deserialize, Serialize};
use std::fmt;
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum PathError {
    #[error("path is empty")]
    Empty,
    #[error("path is absolute")]
    Absolute,
    #[error("path contains a `.` or `..` segment")]
    DotSegment,
    #[error("path contains a backslash")]
    Backslash,
    #[error("path contains a control character")]
    Control,
    #[error("path has an empty segment")]
    EmptySegment,
    #[error("path ends with a separator")]
    TrailingSeparator,
    #[error("path contains a malformed raw-byte escape")]
    RawByte,
}

/// Marks one byte of a file name that is not valid UTF-8. `U+FFFF` is a
/// Unicode *noncharacter*: legal in a Rust string, accepted by [`RelPath::parse`],
/// and not something a real file name carries — and when one does, it is
/// escaped as two of these, so the encoding stays injective.
pub const RAW_BYTE: char = '\u{FFFF}';

/// One file name, from the bytes the filesystem returned, to a path segment.
///
/// Valid UTF-8 passes through unchanged except for a literal [`RAW_BYTE`],
/// which is doubled. Each byte that is not part of valid UTF-8 becomes
/// `RAW_BYTE` plus two lowercase hex digits. Such a byte is always `>= 0x80`, so
/// the encoding can never produce `/`, `.`, NUL or anything else the jail
/// cares about.
pub fn encode_segment(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len());
    for chunk in bytes.utf8_chunks() {
        for c in chunk.valid().chars() {
            out.push(c);
            if c == RAW_BYTE {
                out.push(RAW_BYTE);
            }
        }
        for b in chunk.invalid() {
            out.push(RAW_BYTE);
            out.push_str(&format!("{b:02x}"));
        }
    }
    out
}

/// A path segment back to the bytes of the file name it stands for.
///
/// **Strict, because the input may be hostile**: a path can arrive from a sync
/// peer, the REST API or an MCP client. An escape may only stand for a byte
/// `>= 0x80` — otherwise `RAW_BYTE` + `2f` would decode to `/` and walk out of
/// the workspace. And the segment must be **canonical** — exactly what
/// [`encode_segment`] would produce from the decoded bytes — or one file would
/// have two spellings, and identity, which the registry keys by path, would
/// split in two.
pub fn decode_segment(seg: &str) -> Result<Vec<u8>, PathError> {
    if !seg.contains(RAW_BYTE) {
        return Ok(seg.as_bytes().to_vec());
    }
    let mut out = Vec::with_capacity(seg.len());
    let mut chars = seg.chars();
    let mut buf = [0u8; 4];
    while let Some(c) = chars.next() {
        if c != RAW_BYTE {
            out.extend_from_slice(c.encode_utf8(&mut buf).as_bytes());
            continue;
        }
        match chars.next() {
            Some(RAW_BYTE) => out.extend_from_slice(RAW_BYTE.encode_utf8(&mut buf).as_bytes()),
            Some(hi) => {
                let lo = chars.next().ok_or(PathError::RawByte)?;
                let (Some(h), Some(l)) = (hi.to_digit(16), lo.to_digit(16)) else {
                    return Err(PathError::RawByte);
                };
                let byte = (h * 16 + l) as u8;
                if byte < 0x80 {
                    return Err(PathError::RawByte);
                }
                out.push(byte);
            }
            None => return Err(PathError::RawByte),
        }
    }
    if encode_segment(&out) != seg {
        return Err(PathError::RawByte);
    }
    Ok(out)
}

/// A segment as a person reads it: escapes decoded, and what is still not
/// UTF-8 shown as `U+FFFD`. For display only — never for opening anything.
pub fn display_segment(seg: &str) -> String {
    match decode_segment(seg) {
        Ok(bytes) => String::from_utf8_lossy(&bytes).into_owned(),
        Err(_) => seg.to_string(),
    }
}

/// A path relative to the workspace root, `/`-separated, **exactly as the name
/// is on disk**.
///
/// **One reversible exception: bytes that are not UTF-8** (ADR-090). A Unix file
/// name is bytes, and a name that is not valid UTF-8 used to be listed under a
/// lossy spelling that no file on disk has — a note the tree offered and that
/// never opened. Each such byte is now written as [`RAW_BYTE`] followed by two
/// lowercase hex digits, and a literal `U+FFFF` as two of them; see
/// [`encode_segment`]. Every name that is valid UTF-8 and has no `U+FFFF` in it —
/// every name that existed before this — is unchanged, byte for byte. Only
/// `notes-fs` decodes, at the moment it touches the disk.
///
/// Never normalised and never rewritten: normalising Unicode here would produce
/// a string that does not open the file the user actually has, on any
/// filesystem that stores NFD (`ARCHITECTURE.md` §3). Comparison is
/// [`CompareKey`]'s job, not this type's.
///
/// The parser is the **first** half of the root jail; the second half is
/// `notes-fs` re-resolving and re-checking at the moment of use, because a
/// symlink turns a valid-looking relative path into an escape.

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, TS)]
#[serde(try_from = "String", into = "String")]
#[ts(export, type = "string")]
pub struct RelPath(String);

impl RelPath {
    pub fn parse(s: &str) -> Result<Self, PathError> {
        if s.is_empty() {
            return Err(PathError::Empty);
        }
        if s.contains('\\') {
            return Err(PathError::Backslash);
        }
        if s.chars().any(|c| c.is_control()) {
            return Err(PathError::Control);
        }
        if s.starts_with('/') || Self::has_drive_letter(s) {
            return Err(PathError::Absolute);
        }
        if s.ends_with('/') {
            return Err(PathError::TrailingSeparator);
        }
        for seg in s.split('/') {
            match seg {
                "" => return Err(PathError::EmptySegment),
                "." | ".." => return Err(PathError::DotSegment),
                // Validated here, at the first half of the jail, so that a
                // malformed or non-canonical escape never becomes a `RelPath`.
                _ if seg.contains(RAW_BYTE) => {
                    decode_segment(seg)?;
                }
                _ => {}
            }
        }
        Ok(Self(s.to_string()))
    }

    fn has_drive_letter(s: &str) -> bool {
        let b = s.as_bytes();
        b.len() >= 2 && b[0].is_ascii_alphabetic() && b[1] == b':'
    }

    /// The workspace root itself, for listing. Not a valid note path.
    pub fn root() -> Self {
        Self(String::new())
    }
    pub fn is_root(&self) -> bool {
        self.0.is_empty()
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn file_name(&self) -> &str {
        self.0.rsplit('/').next().unwrap_or(&self.0)
    }

    pub fn parent(&self) -> Option<RelPath> {
        match self.0.rfind('/') {
            Some(i) => Some(RelPath(self.0[..i].to_string())),
            None if self.0.is_empty() => None,
            None => Some(RelPath::root()),
        }
    }

    /// Append one already-validated segment.
    pub fn join(&self, name: &str) -> Result<RelPath, PathError> {
        let candidate = if self.0.is_empty() {
            name.to_string()
        } else {
            format!("{}/{}", self.0, name)
        };
        RelPath::parse(&candidate)
    }

    /// The extension, lowercased, without the dot.
    pub fn extension(&self) -> Option<String> {
        let name = self.file_name();
        let i = name.rfind('.')?;
        if i == 0 {
            return None; // a dot-file is not an extension
        }
        Some(name[i + 1..].to_lowercase())
    }

    /// A file the app treats as a note. `.md` and `.markdown` (scope §7.6).
    pub fn is_note(&self) -> bool {
        matches!(self.extension().as_deref(), Some("md") | Some("markdown"))
    }
}

impl fmt::Display for RelPath {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

/// The wire form, and **the one place the empty string means the root**.
///
/// [`RelPath::parse`] refuses `""` on purpose: it parses something a user typed,
/// and an empty name is not a path. But `RelPath::root()` is a legitimate value
/// of this type — `tree_list` takes it on every listing — and it serialises to
/// `""`, so a `try_from` that refused `""` made the type unable to deserialise a
/// value it can produce. The frontend's `ROOT` is exactly that string, and every
/// `tree_list` of the workspace root was rejected before the command body ran.
///
/// Accepting it here rather than relaxing `parse` keeps the strictness where it
/// belongs: a name the user typed still cannot be empty.
impl TryFrom<String> for RelPath {
    type Error = PathError;
    fn try_from(s: String) -> Result<Self, Self::Error> {
        if s.is_empty() {
            return Ok(RelPath::root());
        }
        RelPath::parse(&s)
    }
}

impl From<RelPath> for String {
    fn from(p: RelPath) -> String {
        p.0
    }
}

/// Why a *new* name was refused.
#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum NameRule {
    #[error("the name is empty")]
    Empty,
    #[error("the name contains a character that is illegal on some systems")]
    IllegalCharacter,
    #[error("the name is reserved by Windows")]
    ReservedOnWindows,
    #[error("the name ends with a dot or a space")]
    TrailingDotOrSpace,
    #[error("the name contains a path separator")]
    Separator,
}

/// Windows refuses these regardless of extension, and has since DOS.
const RESERVED: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Check a name the **user is creating**. Scope §7.6.
///
/// A name already on disk is never touched — an odd one is flagged, not
/// renamed. This applies only to a new name, and it is deliberately the
/// strictest of the platforms rather than the current one: a workspace is meant
/// to be carried between machines, put in Dropbox and cloned from Git, and a
/// name that is legal here and illegal there turns into a folder the user cannot
/// sync or check out. `fixtures/edge-cases` shipped a file ending in a dot for
/// one commit, and it made the repository impossible to clone on Windows —
/// git aborts with `invalid path` before any test runs.
pub fn portable_name(name: &str) -> Result<(), NameRule> {
    if name.is_empty() {
        return Err(NameRule::Empty);
    }
    if name.contains('/') || name.contains('\\') {
        return Err(NameRule::Separator);
    }
    if name
        .chars()
        .any(|c| matches!(c, ':' | '*' | '?' | '"' | '<' | '>' | '|') || c.is_control())
    {
        return Err(NameRule::IllegalCharacter);
    }
    if name.ends_with('.') || name.ends_with(' ') {
        return Err(NameRule::TrailingDotOrSpace);
    }
    let stem = name.split('.').next().unwrap_or(name);
    if RESERVED.iter().any(|r| r.eq_ignore_ascii_case(stem)) {
        return Err(NameRule::ReservedOnWindows);
    }
    Ok(())
}

/// A key for *comparing* paths — never for opening one, never shown, never
/// written to disk.
///
/// NFC always, plus Unicode case-folding when the root's filesystem does not
/// distinguish case. Two files whose `CompareKey`s are equal collide on that
/// root even when their `RelPath`s differ.
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct CompareKey(String);

impl CompareKey {
    pub fn new(path: &RelPath, case_insensitive: bool) -> Self {
        let nfc = nfc(path.as_str());
        Self(if case_insensitive {
            case_fold(&nfc)
        } else {
            nfc
        })
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Case-folding, approximated by `to_lowercase`.
///
/// Full Unicode case-folding differs from lowercasing in a handful of scripts
/// (final sigma, dotted/dotless I). Those differences matter for correctness of
/// *collision refusal*, and refusing a collision too eagerly is the safe
/// direction — the same direction the unknown-case default takes. Replacing this
/// with `unicode-case-mapping` is a dependency decision, not a design one.
fn case_fold(s: &str) -> String {
    s.to_lowercase()
}

/// NFC, restricted to what a note path realistically contains.
///
/// A full normaliser is `unicode-normalization`, which this crate deliberately
/// does not depend on (`ARCHITECTURE.md` §2 pins the dependency list). What is
/// implemented is the case that actually occurs: macOS hands out NFD, so a
/// combining mark following a Latin letter is recomposed. Anything else is left
/// alone, which can only make two different paths compare unequal — the safe
/// direction again.
fn nfc(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        if let Some(prev) = out.chars().last() {
            if let Some(composed) = compose(prev, c) {
                out.pop();
                out.push(composed);
                continue;
            }
        }
        out.push(c);
    }
    out
}

/// Latin-1 Supplement and Latin Extended-A compositions, which is what a
/// Portuguese, Spanish, French or German filename needs.
fn compose(base: char, mark: char) -> Option<char> {
    let table: &[(char, char, char)] = &[
        ('a', '\u{300}', 'à'),
        ('a', '\u{301}', 'á'),
        ('a', '\u{302}', 'â'),
        ('a', '\u{303}', 'ã'),
        ('a', '\u{308}', 'ä'),
        ('a', '\u{30a}', 'å'),
        ('c', '\u{327}', 'ç'),
        ('e', '\u{300}', 'è'),
        ('e', '\u{301}', 'é'),
        ('e', '\u{302}', 'ê'),
        ('e', '\u{308}', 'ë'),
        ('i', '\u{300}', 'ì'),
        ('i', '\u{301}', 'í'),
        ('i', '\u{302}', 'î'),
        ('i', '\u{308}', 'ï'),
        ('n', '\u{303}', 'ñ'),
        ('o', '\u{300}', 'ò'),
        ('o', '\u{301}', 'ó'),
        ('o', '\u{302}', 'ô'),
        ('o', '\u{303}', 'õ'),
        ('o', '\u{308}', 'ö'),
        ('u', '\u{300}', 'ù'),
        ('u', '\u{301}', 'ú'),
        ('u', '\u{302}', 'û'),
        ('u', '\u{308}', 'ü'),
        ('y', '\u{301}', 'ý'),
        ('y', '\u{308}', 'ÿ'),
    ];
    let lower = base.to_lowercase().next()?;
    let (_, _, composed) = table.iter().find(|(b, m, _)| *b == lower && *m == mark)?;
    if base.is_uppercase() {
        composed.to_uppercase().next()
    } else {
        Some(*composed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The regression this type was carrying in silence.
    ///
    /// `RelPath::root()` serialises to `""`, and `try_from` refused `""`, so the
    /// root could cross the wire in one direction only. Every `tree_list` of the
    /// workspace root failed to deserialise before the command body ran — the
    /// sidebar's first call, on every launch.
    #[test]
    fn the_workspace_root_survives_a_round_trip() {
        let root = RelPath::root();
        let json = serde_json::to_string(&root).unwrap();
        assert_eq!(json, "\"\"");
        let back: RelPath = serde_json::from_str(&json).unwrap();
        assert_eq!(back, root);
        assert!(back.is_root());
    }

    /// …and the strictness stays where it belongs.
    #[test]
    fn an_empty_name_is_still_not_a_path() {
        assert_eq!(RelPath::parse(""), Err(PathError::Empty));
    }

    #[test]
    fn every_other_escape_still_fails_the_wire() {
        for bad in ["/etc/passwd", "../x.md", "a//b.md", "a\\b.md", "a/"] {
            let json = serde_json::to_string(bad).unwrap();
            assert!(
                serde_json::from_str::<RelPath>(&json).is_err(),
                "{bad} must not deserialise"
            );
        }
    }

    #[test]
    fn rejects_every_escape_shape() {
        for bad in [
            "",
            "/etc/passwd",
            "../x.md",
            "a/../../x.md",
            "./x.md",
            "a\\b.md",
            "a//b.md",
            "dir/",
            "C:/x.md",
            "a\u{0}b.md",
        ] {
            assert!(RelPath::parse(bad).is_err(), "should reject {bad:?}");
        }
    }

    #[test]
    fn accepts_names_the_user_actually_has() {
        for good in [
            "a.md",
            "dir/a.md",
            "com espaço.md",
            "acentuação.md",
            "a.b/c.d.md",
            ".oculto.md",
            "dir/sub/deep.md",
        ] {
            assert!(RelPath::parse(good).is_ok(), "should accept {good:?}");
        }
    }

    #[test]
    fn keeps_the_name_exactly_as_given() {
        let nfd = "cafe\u{301}.md";
        let p = RelPath::parse(nfd).unwrap();
        assert_eq!(p.as_str(), nfd, "RelPath must not normalise");
    }

    #[test]
    fn extension_and_note_detection() {
        assert!(RelPath::parse("a.md").unwrap().is_note());
        assert!(RelPath::parse("a.MD").unwrap().is_note());
        assert!(RelPath::parse("a.markdown").unwrap().is_note());
        assert!(!RelPath::parse("a.txt").unwrap().is_note());
        assert!(!RelPath::parse("a").unwrap().is_note());
        assert!(
            !RelPath::parse(".md").unwrap().is_note(),
            "a dot-file is not an extension"
        );
    }

    #[test]
    fn parent_and_join() {
        let p = RelPath::parse("a/b/c.md").unwrap();
        assert_eq!(p.parent().unwrap().as_str(), "a/b");
        assert_eq!(p.file_name(), "c.md");
        assert_eq!(RelPath::root().join("x.md").unwrap().as_str(), "x.md");
        assert_eq!(
            RelPath::parse("a").unwrap().join("b.md").unwrap().as_str(),
            "a/b.md"
        );
        assert!(RelPath::parse("a").unwrap().join("../b.md").is_err());
    }

    #[test]
    fn a_new_name_may_not_be_one_that_breaks_another_platform() {
        // The case that already cost this repository a Windows clone.
        assert_eq!(
            portable_name("trailing-dot.md."),
            Err(NameRule::TrailingDotOrSpace)
        );
        assert_eq!(
            portable_name("trailing space.md "),
            Err(NameRule::TrailingDotOrSpace)
        );
        for bad in [
            "a:b.md", "a?b.md", "a*b.md", "a\"b.md", "a<b.md", "a>b.md", "a|b.md",
        ] {
            assert_eq!(portable_name(bad), Err(NameRule::IllegalCharacter), "{bad}");
        }
        for bad in ["CON", "con.md", "NUL.markdown", "com1.md", "LPT9.md"] {
            assert_eq!(
                portable_name(bad),
                Err(NameRule::ReservedOnWindows),
                "{bad}"
            );
        }
        assert_eq!(portable_name("a/b.md"), Err(NameRule::Separator));
        assert_eq!(portable_name(""), Err(NameRule::Empty));
    }

    #[test]
    fn a_new_name_the_user_would_actually_type_is_accepted() {
        for good in [
            "nota.md",
            "Reunião 2026-09-07.md",
            "a.b.c.md",
            ".oculto.md",
            "console.md",
            "computador.md",
            "com10.md",
        ] {
            assert_eq!(portable_name(good), Ok(()), "{good}");
        }
    }

    #[test]
    fn compare_key_folds_nfd_onto_nfc() {
        let nfd = RelPath::parse("cafe\u{301}.md").unwrap();
        let nfc = RelPath::parse("café.md").unwrap();
        assert_ne!(nfd, nfc, "distinct paths on disk");
        assert_eq!(
            CompareKey::new(&nfd, false),
            CompareKey::new(&nfc, false),
            "but the same file to compare against"
        );
    }

    #[test]
    fn compare_key_respects_case_only_when_asked() {
        let a = RelPath::parse("Nota.md").unwrap();
        let b = RelPath::parse("nota.md").unwrap();
        assert_ne!(CompareKey::new(&a, false), CompareKey::new(&b, false));
        assert_eq!(CompareKey::new(&a, true), CompareKey::new(&b, true));
    }
}

#[cfg(test)]
mod raw_byte_tests {
    use super::*;

    #[test]
    fn every_valid_name_is_unchanged() {
        for name in ["nota.md", "ação.md", "文档.md", "2026-09-22.md", ".hidden"] {
            assert_eq!(encode_segment(name.as_bytes()), name);
            assert_eq!(decode_segment(name).unwrap(), name.as_bytes());
        }
    }

    #[test]
    fn a_name_that_is_not_utf8_round_trips_and_keeps_its_extension() {
        let raw = b"reuni\xe3o.md";
        let seg = encode_segment(raw);
        assert!(seg.ends_with(".md"), "{seg:?}");
        assert_eq!(decode_segment(&seg).unwrap(), raw);
        let path = RelPath::parse(&format!("pasta/{seg}")).unwrap();
        assert!(path.is_note());
        assert_eq!(display_segment(&seg), "reuni\u{FFFD}o.md");
    }

    #[test]
    fn a_literal_ffff_is_escaped_so_the_encoding_stays_injective() {
        let name = "a\u{FFFF}b.md";
        let seg = encode_segment(name.as_bytes());
        assert_eq!(seg, "a\u{FFFF}\u{FFFF}b.md");
        assert_eq!(decode_segment(&seg).unwrap(), name.as_bytes());
    }

    #[test]
    fn an_escape_can_never_produce_a_separator_or_a_dot() {
        for bad in ["\u{FFFF}2f", "a\u{FFFF}2e", "\u{FFFF}00"] {
            assert_eq!(decode_segment(bad), Err(PathError::RawByte), "{bad:?}");
            assert!(RelPath::parse(bad).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn a_non_canonical_spelling_is_refused() {
        // Uppercase hex, and escaped bytes that form valid UTF-8, would both be
        // a second spelling of a name that already has one.
        for bad in [
            "\u{FFFF}E3",
            "\u{FFFF}c3\u{FFFF}a3",
            "\u{FFFF}",
            "\u{FFFF}e",
            "\u{FFFF}zz",
        ] {
            assert_eq!(decode_segment(bad), Err(PathError::RawByte), "{bad:?}");
        }
    }

    #[test]
    fn arbitrary_bytes_round_trip() {
        // Deterministic sweep instead of a random generator: every byte value in
        // every position of a short name, around a valid core.
        for b in 0u8..=255 {
            if b == b'/' || b == 0 {
                continue;
            }
            for raw in [
                vec![b],
                vec![b'x', b, b'y'],
                vec![b, 0xe3, b'.', b'm', b'd'],
            ] {
                let seg = encode_segment(&raw);
                assert_eq!(decode_segment(&seg).unwrap(), raw, "{raw:?} -> {seg:?}");
            }
        }
    }
}
