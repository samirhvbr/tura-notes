//! The connection test, against a server that is actually running.
//!
//! Everything else about `Remote::probe` is exercised against a `TcpListener`
//! answering canned bytes, which proves the mapping and nothing about DNS, TLS,
//! a proxy in front, or a credential a real server issued. Those are the parts
//! that fail in the field, and they cannot be faked usefully.
//!
//! Ignored by default because it needs somebody's server and somebody's
//! credential. It prints the outcome and, when granted, the workspace the
//! credential is bound to — never the credential.
//!
//!   NOTES_PROBE_URL=https://notes.example.com \
//!   NOTES_PROBE_TOKEN_FILE=/path/to/credential \
//!   cargo test -p notes-sync-client --test probe -- --ignored --nocapture
use notes_sync_client::remote::{Remote, SyncProbe, SyncProbeOutcome};
use std::path::PathBuf;

#[test]
#[ignore = "needs NOTES_PROBE_URL and NOTES_PROBE_TOKEN_FILE for a real server"]
fn a_real_server_answers_the_connection_test() {
    let (Ok(url), Ok(token)) = (
        std::env::var("NOTES_PROBE_URL"),
        std::env::var("NOTES_PROBE_TOKEN_FILE"),
    ) else {
        panic!("set NOTES_PROBE_URL and NOTES_PROBE_TOKEN_FILE");
    };
    let private = std::env::var("NOTES_PROBE_ALLOW_PRIVATE").is_ok();
    let probe: SyncProbe = Remote::probe(&url, private, &PathBuf::from(&token), None);
    println!("outcome:    {:?}", probe.outcome);
    println!("status:     {:?}", probe.status);
    println!("workspace:  {:?}", probe.workspace);
    println!("scope:      {:?}", probe.scope);
    println!("permissions:{:?}", probe.permissions);
    println!("review:     {}", probe.review);
    assert!(
        matches!(probe.outcome, SyncProbeOutcome::Granted),
        "the server did not grant this credential; the outcome above says which step answered"
    );
    assert!(
        probe.workspace.is_some(),
        "granted without a workspace name"
    );
}
