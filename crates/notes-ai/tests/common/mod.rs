//! A server on loopback that plays back canned replies, shared by the provider
//! tests. Nothing here touches the network, so nothing spends.
#![allow(dead_code)] // each test file uses a part of it

use std::{
    collections::HashMap,
    io::{Read, Write},
    net::TcpListener,
    thread::{self, JoinHandle},
    time::Duration,
};

pub struct Canned {
    pub status: u16,
    pub headers: Vec<(&'static str, String)>,
    pub chunks: Vec<Vec<u8>>,
    /// Between chunks, so the client's reads split where the test wants.
    pub gap: Duration,
}

impl Canned {
    pub fn ok(chunks: Vec<Vec<u8>>) -> Self {
        Self {
            status: 200,
            headers: vec![("Content-Type", "text/event-stream".into())],
            chunks,
            gap: Duration::from_millis(2),
        }
    }
    pub fn json(status: u16, body: &str) -> Self {
        Self {
            status,
            headers: vec![("Content-Type", "application/json".into())],
            chunks: vec![body.as_bytes().to_vec()],
            gap: Duration::ZERO,
        }
    }
}

pub struct Seen {
    pub line: String,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
}

/// Serve one canned reply per connection, in order, and report what arrived.
pub fn serve(canned: Vec<Canned>) -> (String, JoinHandle<Vec<Seen>>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let handle = thread::spawn(move || {
        let mut seen = vec![];
        for reply in canned {
            let (mut stream, _) = listener.accept().unwrap();
            let mut head = vec![];
            while !head.ends_with(b"\r\n\r\n") {
                let mut byte = [0u8; 1];
                if stream.read_exact(&mut byte).is_err() {
                    break;
                }
                head.push(byte[0]);
            }
            let text = String::from_utf8_lossy(&head).into_owned();
            let mut lines = text.lines();
            let line = lines.next().unwrap_or_default().to_owned();
            let headers: HashMap<String, String> = lines
                .filter_map(|l| l.split_once(':'))
                .map(|(k, v)| (k.trim().to_ascii_lowercase(), v.trim().to_owned()))
                .collect();
            let length = headers
                .get("content-length")
                .and_then(|v| v.parse().ok())
                .unwrap_or(0);
            let mut body = vec![0u8; length];
            let _ = stream.read_exact(&mut body);
            seen.push(Seen {
                line,
                headers,
                body,
            });

            let mut out = format!("HTTP/1.1 {} X\r\nConnection: close\r\n", reply.status);
            for (k, v) in &reply.headers {
                out.push_str(&format!("{k}: {v}\r\n"));
            }
            if reply.status != 200 {
                let length: usize = reply.chunks.iter().map(Vec::len).sum();
                out.push_str(&format!("Content-Length: {length}\r\n"));
            }
            out.push_str("\r\n");
            let _ = stream.write_all(out.as_bytes());
            for chunk in reply.chunks {
                if stream.write_all(&chunk).is_err() || stream.flush().is_err() {
                    break;
                }
                thread::sleep(reply.gap);
            }
        }
        seen
    });
    (base, handle)
}
