//! File names between the operating system and [`RelPath`].
//!
//! The one place a name crosses in either direction, so that the listing, the
//! jail, the watcher and the quick-open walk cannot disagree about how a name
//! that is not UTF-8 is spelled (ADR-090). Before this each of them made its
//! own choice: the listing invented a lossy spelling no file has, and the
//! watcher dropped the event entirely.

use notes_model::{decode_segment, encode_segment, CoreError};
use std::ffi::{OsStr, OsString};

/// One OS file name as a path segment. `None` only where the platform's name
/// cannot be expressed as bytes at all — an unpaired surrogate in a Windows
/// name — which is the one case still skipped.
#[cfg(unix)]
pub fn to_segment(name: &OsStr) -> Option<String> {
    use std::os::unix::ffi::OsStrExt;
    Some(encode_segment(name.as_bytes()))
}

#[cfg(not(unix))]
pub fn to_segment(name: &OsStr) -> Option<String> {
    name.to_str().map(|s| encode_segment(s.as_bytes()))
}

/// One path segment back to the OS name it stands for.
#[cfg(unix)]
pub fn to_os(seg: &str) -> Result<OsString, CoreError> {
    use std::os::unix::ffi::OsStringExt;
    let bytes = decode_segment(seg).map_err(|e| CoreError::InvalidPath {
        path: seg.to_string(),
        reason: e.to_string(),
    })?;
    Ok(OsString::from_vec(bytes))
}

/// Off Unix a name is not bytes, so a segment that decodes to something other
/// than UTF-8 names a file that cannot exist here — one synced from a Linux
/// device, say. Refused, rather than approximated.
#[cfg(not(unix))]
pub fn to_os(seg: &str) -> Result<OsString, CoreError> {
    let bytes = decode_segment(seg).map_err(|e| CoreError::InvalidPath {
        path: seg.to_string(),
        reason: e.to_string(),
    })?;
    String::from_utf8(bytes)
        .map(OsString::from)
        .map_err(|_| CoreError::Unsupported {
            cap: "a file name that is not UTF-8 on this platform".into(),
        })
}
