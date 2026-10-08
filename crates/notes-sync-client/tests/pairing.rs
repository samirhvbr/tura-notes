//! The pairing client (ADR-105) against a site on loopback that plays the part
//! `docs/PAIRING.md` gives it. Nothing here touches a real site, a real keychain
//! or a real server: what is proved is that the client does what the contract says
//! and refuses what the contract says to refuse.

use notes_sync_client::pairing::{begin, Paired, Pending};
use notes_sync_client::remote::{
    credential_name, has_credential, install_credential_store, CredentialStore, StoreFailure,
};
use notes_sync_client::Error;
use ring::digest;
use std::{
    collections::HashMap,
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Mutex,
    },
    thread,
};

const SECRET: &str =
    "nt_0b1c2d3e-0000-4000-8000-000000000000.s3cr3tS3cr3tS3cr3tS3cr3tS3cr3tS3cr3t00";

#[derive(Default)]
struct Keychain(Mutex<HashMap<String, String>>);
impl CredentialStore for Keychain {
    fn get(&self, name: &str) -> Result<Option<String>, StoreFailure> {
        Ok(self.0.lock().unwrap().get(name).cloned())
    }
    fn set(&self, name: &str, secret: &str) -> Result<(), StoreFailure> {
        self.0.lock().unwrap().insert(name.into(), secret.into());
        Ok(())
    }
    fn clear(&self, name: &str) -> Result<(), StoreFailure> {
        self.0.lock().unwrap().remove(name);
        Ok(())
    }
}

/// What the site does with the exchange, apart from checking the code.
#[derive(Clone)]
enum Answer {
    /// The contract: a code is good once, and only with the verifier it was made for.
    Honest,
    Status(u16),
    Body(&'static str),
    NotJson,
    Redirect,
    Big,
}

struct Site {
    origin: String,
    /// code -> the challenge it was issued for.
    issued: Arc<Mutex<HashMap<String, String>>>,
    hits: Arc<AtomicUsize>,
    saw: Arc<Mutex<Vec<String>>>,
    answer: Arc<Mutex<Answer>>,
    granted: Arc<Mutex<(String, String, String)>>,
}

fn respond(stream: &mut TcpStream, status: u16, json: bool, body: &str, extra: &str) {
    let text = format!(
        "HTTP/1.1 {status} X\r\nContent-Type: {}\r\nContent-Length: {}\r\n{extra}Connection: close\r\n\r\n{body}",
        if json { "application/json" } else { "text/plain" },
        body.len()
    );
    let _ = stream.write_all(text.as_bytes());
}

fn read_request(stream: &mut TcpStream) -> (String, String) {
    let mut buf = vec![];
    let mut chunk = [0u8; 1024];
    loop {
        let n = stream.read(&mut chunk).unwrap_or(0);
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&chunk[..n]);
        if let Some(at) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
            let head = String::from_utf8_lossy(&buf[..at]).to_string();
            let len = head
                .lines()
                .find_map(|l| {
                    l.to_ascii_lowercase()
                        .strip_prefix("content-length:")
                        .map(|v| v.trim().parse::<usize>().unwrap_or(0))
                })
                .unwrap_or(0);
            while buf.len() < at + 4 + len {
                let n = stream.read(&mut chunk).unwrap_or(0);
                if n == 0 {
                    break;
                }
                buf.extend_from_slice(&chunk[..n]);
            }
            let body = String::from_utf8_lossy(&buf[at + 4..]).to_string();
            return (head, body);
        }
    }
    (String::new(), String::new())
}

fn site() -> Site {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let origin = format!("http://{}", listener.local_addr().unwrap());
    let issued: Arc<Mutex<HashMap<String, String>>> = Default::default();
    let hits = Arc::new(AtomicUsize::new(0));
    let saw: Arc<Mutex<Vec<String>>> = Default::default();
    let answer = Arc::new(Mutex::new(Answer::Honest));
    let granted = Arc::new(Mutex::new((
        origin.clone(),
        "personal".to_owned(),
        "Pixel 8".to_owned(),
    )));
    {
        let (issued, hits, saw, answer, granted) = (
            issued.clone(),
            hits.clone(),
            saw.clone(),
            answer.clone(),
            granted.clone(),
        );
        thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut stream) = stream else { continue };
                let (head, body) = read_request(&mut stream);
                hits.fetch_add(1, Ordering::SeqCst);
                saw.lock()
                    .unwrap()
                    .push(head.lines().next().unwrap_or("").to_owned());
                let json: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();
                match answer.lock().unwrap().clone() {
                    Answer::Status(s) => respond(&mut stream, s, true, r#"{"error":"x"}"#, ""),
                    Answer::Body(b) => respond(&mut stream, 200, true, b, ""),
                    Answer::NotJson => respond(&mut stream, 200, false, "hello", ""),
                    Answer::Redirect => {
                        respond(&mut stream, 302, false, "", "Location: /elsewhere\r\n")
                    }
                    Answer::Big => respond(
                        &mut stream,
                        200,
                        true,
                        &format!("{{\"x\":\"{}\"}}", "a".repeat(20_000)),
                        "",
                    ),
                    Answer::Honest => {
                        let code = json["code"].as_str().unwrap_or("");
                        let verifier = json["verifier"].as_str().unwrap_or("");
                        let hash = digest::digest(&digest::SHA256, verifier.as_bytes());
                        let challenge = base64_url(hash.as_ref());
                        // Single use: taken out whether or not it matches.
                        let wanted = issued.lock().unwrap().remove(code);
                        if wanted.as_deref() == Some(challenge.as_str()) {
                            let g = granted.lock().unwrap().clone();
                            let body = serde_json::json!({
                                "origin": g.0, "workspace": g.1, "credential": SECRET, "label": g.2
                            })
                            .to_string();
                            respond(&mut stream, 200, true, &body, "Cache-Control: no-store\r\n");
                        } else {
                            respond(&mut stream, 400, true, r#"{"error":"invalid_grant"}"#, "");
                        }
                    }
                }
            }
        });
    }
    Site {
        origin,
        issued,
        hits,
        saw,
        answer,
        granted,
    }
}

fn base64_url(bytes: &[u8]) -> String {
    const A: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::new();
    for c in bytes.chunks(3) {
        let n = (c[0] as u32) << 16
            | (*c.get(1).unwrap_or(&0) as u32) << 8
            | *c.get(2).unwrap_or(&0) as u32;
        for i in 0..=c.len() {
            out.push(A[(n >> (18 - 6 * i) & 63) as usize] as char);
        }
    }
    out
}

fn param(url: &str, key: &str) -> String {
    reqwest::Url::parse(url)
        .unwrap()
        .query_pairs()
        .find(|(k, _)| k == key)
        .map(|(_, v)| v.into_owned())
        .unwrap()
}

/// The person signs in and presses Allow: the site issues a code for the request's
/// challenge, and the browser comes back with it.
fn allowed(site: &Site, pending: &Pending, code: &str) -> String {
    site.issued
        .lock()
        .unwrap()
        .insert(code.into(), param(&pending.authorize_url, "challenge"));
    format!(
        "tura://pair?code={code}&state={}",
        param(&pending.authorize_url, "state")
    )
}

// One keychain for the whole file: it is a process-wide slot, and every test uses
// its own name in it.
fn keychain() -> Arc<Keychain> {
    static ONE: std::sync::OnceLock<Arc<Keychain>> = std::sync::OnceLock::new();
    let k = ONE.get_or_init(Default::default).clone();
    install_credential_store(k.clone());
    k
}

#[test]
fn signing_in_keeps_the_credential_in_the_keychain_and_hands_back_only_where_to_connect() {
    keychain();
    let site = site();
    let pending = begin(&site.origin, "Pixel 8", true).unwrap();
    let redirect = allowed(&site, &pending, "code-1");
    let paired: Paired = pending.finish(&redirect, "happy").unwrap();
    assert_eq!(
        paired,
        Paired {
            origin: site.origin.clone(),
            workspace: "personal".into(),
            label: "Pixel 8".into(),
            token_file: "keychain:happy".into()
        }
    );
    assert_eq!(credential_name(&paired.token_file), Some("happy"));
    assert!(has_credential("happy"));
    // The secret is in the keychain and in nothing this crate returned.
    assert!(!format!("{paired:?}").contains("s3cr3t"));
    assert!(!format!("{pending:?}").contains(&param(&pending.authorize_url, "state")));
    // One request, to the contract's address, as a POST.
    assert_eq!(
        site.saw.lock().unwrap().as_slice(),
        ["POST /tura/pair/exchange HTTP/1.1"]
    );
}

#[test]
fn a_code_is_good_once() {
    keychain();
    let site = site();
    let pending = begin(&site.origin, "Pixel 8", true).unwrap();
    let redirect = allowed(&site, &pending, "code-2");
    pending.finish(&redirect, "once").unwrap();
    notes_sync_client::remote::forget_credential("once").unwrap();
    assert!(matches!(
        pending.finish(&redirect, "once"),
        Err(Error::Denied)
    ));
    assert!(!has_credential("once"), "a refused exchange stores nothing");
}

#[test]
fn a_code_taken_to_the_exchange_with_another_verifier_is_refused_like_a_spent_one() {
    keychain();
    let site = site();
    let ours = begin(&site.origin, "Pixel 8", true).unwrap();
    // Another application on the device started its own sign-in and claimed our
    // redirect link: the code the site issued was for *its* challenge.
    let theirs = begin(&site.origin, "Evil", true).unwrap();
    site.issued
        .lock()
        .unwrap()
        .insert("code-3".into(), param(&theirs.authorize_url, "challenge"));
    let redirect = format!(
        "tura://pair?code=code-3&state={}",
        param(&ours.authorize_url, "state")
    );
    assert!(matches!(
        ours.finish(&redirect, "stolen"),
        Err(Error::Denied)
    ));
    assert!(!has_credential("stolen"));
}

#[test]
fn a_redirect_this_request_did_not_start_never_reaches_the_site() {
    keychain();
    let site = site();
    let pending = begin(&site.origin, "Pixel 8", true).unwrap();
    for bad in [
        "tura://pair?code=x&state=not-ours",
        "tura://elsewhere?code=x&state=whatever",
        "https://site.example/cb?code=x",
        "garbage",
    ] {
        assert!(
            matches!(pending.finish(bad, "never"), Err(Error::Invalid)),
            "{bad}"
        );
    }
    // And a name that cannot be a keychain entry is refused before a code is spent.
    let redirect = allowed(&site, &pending, "code-4");
    assert!(matches!(
        pending.finish(&redirect, "../x"),
        Err(Error::Invalid)
    ));
    assert_eq!(site.hits.load(Ordering::SeqCst), 0);
    assert!(!has_credential("never"));
}

#[test]
fn what_the_site_gets_wrong_is_refused_and_nothing_is_stored() {
    keychain();
    let site = site();
    for (what, grant) in [
        (
            "an origin the address policy forbids",
            (
                "http://evil.example".to_owned(),
                "personal".to_owned(),
                "x".to_owned(),
            ),
        ),
        (
            "a workspace that is not a name",
            (site.origin.clone(), "Not A Name".to_owned(), "x".to_owned()),
        ),
        (
            "a workspace that is empty",
            (site.origin.clone(), String::new(), "x".to_owned()),
        ),
    ] {
        *site.granted.lock().unwrap() = grant;
        let pending = begin(&site.origin, "Pixel 8", true).unwrap();
        let redirect = allowed(&site, &pending, "code-5");
        assert!(pending.finish(&redirect, "bad").is_err(), "{what}");
        assert!(!has_credential("bad"), "{what}");
    }
    for (what, answer) in [
        (
            "a credential of the wrong shape",
            Answer::Body(
                r#"{"origin":"http://127.0.0.1:1","workspace":"home","credential":"hello","label":"x"}"#,
            ),
        ),
        (
            "an answer with a field nobody asked for",
            Answer::Body(
                r#"{"origin":"http://127.0.0.1:1","workspace":"home","credential":"nt_a.b","label":"x","extra":1}"#,
            ),
        ),
        ("an answer that is not JSON", Answer::NotJson),
        ("an answer that is far too large", Answer::Big),
        ("a redirect, which is never followed", Answer::Redirect),
        ("a server error", Answer::Status(500)),
    ] {
        *site.answer.lock().unwrap() = answer;
        let pending = begin(&site.origin, "Pixel 8", true).unwrap();
        let redirect = allowed(&site, &pending, "code-6");
        assert!(
            matches!(pending.finish(&redirect, "bad"), Err(Error::Protocol)),
            "{what}"
        );
        assert!(!has_credential("bad"), "{what}");
    }
}

#[test]
fn a_busy_site_and_an_absent_one_are_told_apart_and_neither_stores_anything() {
    keychain();
    let site = site();
    *site.answer.lock().unwrap() = Answer::Status(429);
    let pending = begin(&site.origin, "Pixel 8", true).unwrap();
    let redirect = allowed(&site, &pending, "code-7");
    assert!(matches!(
        pending.finish(&redirect, "busy"),
        Err(Error::Busy)
    ));

    let gone = begin("http://127.0.0.1:9", "Pixel 8", true).unwrap();
    assert!(matches!(
        gone.finish(
            &format!(
                "tura://pair?code=x&state={}",
                param(&gone.authorize_url, "state")
            ),
            "busy"
        ),
        Err(Error::Offline)
    ));
    assert!(!has_credential("busy"));
}

#[test]
fn a_good_credential_is_not_overwritten_by_a_sign_in_that_fails() {
    let store = keychain();
    store.set("keep", SECRET).unwrap();
    let site = site();
    *site.answer.lock().unwrap() = Answer::Status(400);
    let pending = begin(&site.origin, "Pixel 8", true).unwrap();
    let redirect = allowed(&site, &pending, "code-8");
    assert!(pending.finish(&redirect, "keep").is_err());
    assert_eq!(store.get("keep").unwrap().as_deref(), Some(SECRET));
}

// ---- Device sync pairing takes the same reference (ADR-105) -------------------

fn pair_request(
    dir: &std::path::Path,
    token_file: &str,
    origin: &str,
) -> notes_sync_client::control::SyncPairRequest {
    let (source, state) = (dir.join("notes"), dir.join("state"));
    std::fs::create_dir_all(&source).unwrap();
    notes_sync_client::control::SyncPairRequest {
        state_dir: state.to_string_lossy().into_owned(),
        source: source.to_string_lossy().into_owned(),
        origin: origin.into(),
        workspace: "personal".into(),
        scope: None,
        token_file: token_file.into(),
        allow_private: true,
        mode: "upload".into(),
    }
}

/// Before the fix, `Controller::pair` asked `validate_state_location` whether the
/// credential's *path* was outside the synchronized folder, and a keychain name is
/// not a path, so every sign-in that ended in Device sync was refused as `Invalid`
/// before a single request was made, while `validate_connection` (the saved
/// connection) accepted the same name. The credential is in no folder at all.
#[test]
fn device_sync_pairing_accepts_a_credential_in_the_keychain() {
    let store = keychain();
    let dir = tempfile::tempdir().unwrap();
    let controller = notes_sync_client::control::Controller::new(&dir.path().join("data"));

    // Nothing under that name: the pairing gets as far as reading the credential,
    // and says what it says for a missing credential file, which is "denied".
    let missing = pair_request(dir.path(), "keychain:nobody", "http://127.0.0.1:9");
    assert!(
        matches!(controller.pair(missing), Err(Error::Denied)),
        "a reference must reach the connection step"
    );

    // A credential kept there, and nothing listening: it is read and used, and the
    // answer is the network's.
    store.set("devsync", SECRET).unwrap();
    let kept = pair_request(dir.path(), "keychain:devsync", "http://127.0.0.1:9");
    assert!(matches!(controller.pair(kept), Err(Error::Offline)));
}

#[test]
fn device_sync_pairing_still_refuses_what_it_always_refused() {
    keychain();
    let dir = tempfile::tempdir().unwrap();
    let controller = notes_sync_client::control::Controller::new(&dir.path().join("data"));
    // A relative path, a name that is not a token, and a credential file inside the
    // synchronized folder are all still invalid.
    for token in ["token.txt", "keychain:a/b", "keychain:", ""] {
        let request = pair_request(dir.path(), token, "http://127.0.0.1:9");
        assert!(
            matches!(controller.pair(request), Err(Error::Invalid)),
            "{token:?}"
        );
    }
    let inside = dir.path().join("notes").join("nt.secret");
    std::fs::create_dir_all(inside.parent().unwrap()).unwrap();
    std::fs::write(&inside, SECRET).unwrap();
    let request = pair_request(dir.path(), &inside.to_string_lossy(), "http://127.0.0.1:9");
    assert!(matches!(controller.pair(request), Err(Error::Invalid)));
}
