//! Server-sent events, incrementally.
//!
//! A provider streams `event:` / `data:` lines separated by blank lines, and a
//! network read can end anywhere: between two events, inside one, or in the
//! middle of a multi-byte character. This parser takes whatever bytes arrive and
//! returns the frames that are complete. It splits on `\n` before decoding, so a
//! character is never cut, because a UTF-8 continuation byte is never `\n`.

use crate::{Error, Result};

/// The most a single frame may hold before the stream is refused. A provider
/// that never sends a blank line must not grow this buffer without limit.
const MAX_FRAME: usize = 1 << 20;

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct Frame {
    pub event: Option<String>,
    pub data: String,
}

#[derive(Default)]
pub(crate) struct Parser {
    line: Vec<u8>,
    event: Option<String>,
    data: String,
    has_data: bool,
}

impl Parser {
    pub(crate) fn push(&mut self, bytes: &[u8]) -> Result<Vec<Frame>> {
        let mut frames = vec![];
        for &byte in bytes {
            if byte == b'\n' {
                self.finish_line(&mut frames);
            } else {
                self.line.push(byte);
            }
            if self.line.len() + self.data.len() > MAX_FRAME {
                return Err(Error::Protocol);
            }
        }
        Ok(frames)
    }

    fn finish_line(&mut self, frames: &mut Vec<Frame>) {
        let raw = std::mem::take(&mut self.line);
        let line = String::from_utf8_lossy(&raw);
        let line = line.strip_suffix('\r').unwrap_or(&line);
        if line.is_empty() {
            if self.has_data {
                frames.push(Frame {
                    event: self.event.take(),
                    data: std::mem::take(&mut self.data),
                });
            }
            self.event = None;
            self.has_data = false;
            return;
        }
        if line.starts_with(':') {
            return; // a comment, used by some servers as a keep-alive
        }
        let (field, value) = match line.split_once(':') {
            Some((field, value)) => (field, value.strip_prefix(' ').unwrap_or(value)),
            None => (line, ""),
        };
        match field {
            "event" => self.event = Some(value.to_owned()),
            "data" => {
                if self.has_data {
                    self.data.push('\n');
                }
                self.data.push_str(value);
                self.has_data = true;
            }
            _ => {} // `id:` and `retry:` mean nothing to a chat stream
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn all(chunks: &[&[u8]]) -> Vec<Frame> {
        let mut parser = Parser::default();
        let mut out = vec![];
        for chunk in chunks {
            out.extend(parser.push(chunk).unwrap());
        }
        out
    }

    #[test]
    fn a_frame_is_complete_only_at_its_blank_line() {
        let mut parser = Parser::default();
        assert!(parser.push(b"event: ping\ndata: {}\n").unwrap().is_empty());
        let frames = parser.push(b"\n").unwrap();
        assert_eq!(
            frames,
            vec![Frame {
                event: Some("ping".into()),
                data: "{}".into()
            }]
        );
    }

    #[test]
    fn any_split_of_the_same_bytes_gives_the_same_frames() {
        let whole = "event: a\ndata: um\n\nevent: b\ndata: dois\n\n".as_bytes();
        let expected = all(&[whole]);
        for cut in 0..whole.len() {
            assert_eq!(
                all(&[&whole[..cut], &whole[cut..]]),
                expected,
                "cut at {cut}"
            );
        }
        assert_eq!(expected.len(), 2);
    }

    #[test]
    fn a_multibyte_character_cut_in_two_arrives_whole() {
        let bytes = "data: aé\n\n".as_bytes();
        let cut = bytes.iter().position(|b| *b == 0xC3).unwrap() + 1; // inside "é"
        let frames = all(&[&bytes[..cut], &bytes[cut..]]);
        assert_eq!(frames[0].data, "aé");
    }

    #[test]
    fn crlf_comments_and_several_data_lines_are_read_as_the_standard_says() {
        let frames = all(&[b": keep-alive\r\nevent: x\r\ndata: um\r\ndata: dois\r\nid: 7\r\n\r\n"]);
        assert_eq!(
            frames,
            vec![Frame {
                event: Some("x".into()),
                data: "um\ndois".into()
            }]
        );
    }

    #[test]
    fn a_blank_line_with_no_data_emits_nothing() {
        assert!(all(&[b"\n\nevent: only\n\n"]).is_empty());
    }

    #[test]
    fn a_stream_with_no_blank_line_is_refused_instead_of_buffered_forever() {
        let mut parser = Parser::default();
        let chunk = vec![b'a'; 64 * 1024];
        let refused = (0..32).any(|_| parser.push(&chunk).is_err());
        assert!(refused);
    }
}
