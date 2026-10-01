//! The part of an HTTP exchange every provider shares.
//!
//! `reqwest`'s blocking client cannot time out a single read, and a stream may
//! sit quiet for a while while a model thinks, then must still stop promptly
//! when the user presses Stop. So the request runs on a worker thread that
//! forwards what it reads over a channel, and the caller polls that channel
//! every [`POLL`], checking the cancel flag and an idle deadline each time. A
//! hard ceiling on the whole request, set on the client, guarantees the worker
//! ends even if nobody is listening any more.

use crate::{sse, tidy, Error, Result};
use reqwest::blocking::{Client, RequestBuilder};
use std::{
    io::Read,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver, RecvTimeoutError},
    },
    time::{Duration, Instant},
};

const POLL: Duration = Duration::from_millis(250);
/// No bytes for this long: the stream is dead, not thinking.
const IDLE: Duration = Duration::from_secs(120);
/// The longest one request may live, however well it is going.
const CEILING: Duration = Duration::from_secs(600);
/// What an error body is allowed to cost.
const ERROR_BODY: usize = 16 * 1024;

pub(crate) struct Clients {
    /// For a stream: a long ceiling, no per-call timeout.
    pub stream: Client,
    /// For a short call, like a model list.
    pub short: Client,
}

impl Clients {
    pub(crate) fn new() -> Result<Self> {
        // rustls-no-provider requires explicit process initialisation. A
        // provider already selected by the embedding process is left intact.
        let _ = rustls::crypto::ring::default_provider().install_default();
        let build = |timeout: Duration| {
            Client::builder()
                // A key must never follow a redirect to another host.
                .redirect(reqwest::redirect::Policy::none())
                .retry(reqwest::retry::never())
                .user_agent(concat!("tura-notes/", env!("CARGO_PKG_VERSION")))
                .connect_timeout(Duration::from_secs(10))
                .timeout(timeout)
                .build()
                .map_err(|_| Error::Offline)
        };
        Ok(Self {
            stream: build(CEILING)?,
            short: build(Duration::from_secs(30))?,
        })
    }
}

enum Msg {
    Head(u16),
    Chunk(Vec<u8>),
    End,
    Failed,
}

pub(crate) struct Reply {
    rx: Receiver<Msg>,
    pub status: u16,
    last: Instant,
}

/// Send the request and wait for the status line, or for `cancel`.
pub(crate) fn open(request: RequestBuilder, cancel: &AtomicBool) -> Result<Reply> {
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut response = match request.send() {
            Ok(response) => response,
            Err(_) => {
                let _ = tx.send(Msg::Failed);
                return;
            }
        };
        if tx.send(Msg::Head(response.status().as_u16())).is_err() {
            return;
        }
        let mut buffer = [0u8; 8192];
        loop {
            match response.read(&mut buffer) {
                Ok(0) => {
                    let _ = tx.send(Msg::End);
                    return;
                }
                Ok(n) => {
                    if tx.send(Msg::Chunk(buffer[..n].to_vec())).is_err() {
                        return;
                    }
                }
                Err(_) => {
                    let _ = tx.send(Msg::Failed);
                    return;
                }
            }
        }
    });
    let mut reply = Reply {
        rx,
        status: 0,
        last: Instant::now(),
    };
    match reply.wait(cancel)? {
        Some(Msg::Head(status)) => {
            reply.status = status;
            Ok(reply)
        }
        _ => Err(Error::Offline),
    }
}

impl Reply {
    fn wait(&mut self, cancel: &AtomicBool) -> Result<Option<Msg>> {
        loop {
            if cancel.load(Ordering::Relaxed) {
                return Err(Error::Cancelled);
            }
            match self.rx.recv_timeout(POLL) {
                Ok(Msg::Failed) => return Err(Error::Offline),
                Ok(message) => {
                    self.last = Instant::now();
                    return Ok(Some(message));
                }
                Err(RecvTimeoutError::Timeout) => {
                    if self.last.elapsed() > IDLE {
                        return Err(Error::Offline);
                    }
                }
                Err(RecvTimeoutError::Disconnected) => return Err(Error::Offline),
            }
        }
    }

    /// The next piece of the body, or `None` at its end.
    pub(crate) fn next(&mut self, cancel: &AtomicBool) -> Result<Option<Vec<u8>>> {
        match self.wait(cancel)? {
            Some(Msg::Chunk(bytes)) => Ok(Some(bytes)),
            Some(Msg::End) => Ok(None),
            _ => Err(Error::Protocol),
        }
    }

    /// The rest of the body, up to what an error is allowed to cost.
    pub(crate) fn rest(&mut self, cancel: &AtomicBool) -> Result<Vec<u8>> {
        let mut body = vec![];
        while let Some(chunk) = self.next(cancel)? {
            if body.len() < ERROR_BODY {
                body.extend_from_slice(&chunk);
            }
        }
        body.truncate(ERROR_BODY);
        Ok(body)
    }
}

/// What a non-success status means, with the provider's own sentence when it
/// sent one in the usual `{"error": {"message": …}}` shape.
pub(crate) fn status_error(status: u16, body: &[u8]) -> Error {
    match status {
        401 | 403 => Error::Unauthorized,
        429 => Error::RateLimited,
        _ => {
            let said = serde_json::from_slice::<serde_json::Value>(body)
                .ok()
                .and_then(|v| v["error"]["message"].as_str().map(tidy))
                .filter(|s| !s.is_empty());
            Error::Provider(said.unwrap_or_else(|| format!("HTTP {status}")))
        }
    }
}

pub(crate) enum Flow {
    Continue,
    Done,
}

/// Send a streaming request and hand each server-sent event to `handle`, which
/// says when the reply is complete. A non-success status becomes its error
/// before any event is read. Returns whether the handler said `Done`: a body
/// that ends first returns `false`, and it is for the provider to decide whether
/// that is an error, since some servers end a finished stream without a marker.
pub(crate) fn drive(
    request: RequestBuilder,
    cancel: &AtomicBool,
    mut handle: impl FnMut(sse::Frame) -> Result<Flow>,
) -> Result<bool> {
    let mut reply = open(request, cancel)?;
    if !(200..300).contains(&reply.status) {
        let body = reply.rest(cancel)?;
        return Err(status_error(reply.status, &body));
    }
    let mut parser = sse::Parser::default();
    while let Some(chunk) = reply.next(cancel)? {
        for frame in parser.push(&chunk)? {
            if let Flow::Done = handle(frame)? {
                return Ok(true);
            }
        }
    }
    Ok(false)
}
