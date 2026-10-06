//! Signing in to the owner's site to get a device's cloud connection (ADR-105,
//! `docs/PAIRING.md`).
//!
//! An OAuth 2.0 authorization code flow with PKCE, the shape RFC 8252 asks of a
//! native application. This module is the application's half of it: it makes the
//! request the browser is sent to, checks what comes back, trades the single-use
//! code for the credential, and **keeps the credential in the keychain without
//! ever handing it to the caller**. What the caller gets back is a name to put
//! where a credential file's path goes (`keychain:<name>`), and where to connect.
//!
//! What it guards against, and where:
//! - a link another application on the device claimed: the redirect carries only a
//!   code, and the code is worthless without the `verifier` that never left here;
//! - a redirect that this request did not start: `state`;
//! - a site that answers with something it should not: the origin must pass the
//!   same address policy as every other connection, the workspace the same name
//!   rule as a configuration's, the credential the same shape, and nothing is
//!   stored unless all three hold.
//!
//! The exchange goes through the transport every other connection uses: HTTPS
//! only (plain HTTP to a private address only when the person allowed it), no
//! redirects followed, no proxy, the pinned-address rules, and an answer bounded
//! at a few kilobytes.

use crate::{
    remote::{address, client, resolved, shaped_credential, store_credential, KEYCHAIN_PREFIX},
    Error, Result,
};
use base64::Engine;
use reqwest::Url;
use ring::{
    digest,
    rand::{SecureRandom, SystemRandom},
};
use serde::Serialize;
use std::io::Read;
use ts_rs::TS;

/// The only redirect the site may be told about, and the only one accepted back.
pub const REDIRECT: &str = "tura://pair";
const BYTES: usize = 32;
const ANSWER_LIMIT: usize = 8 * 1024;

fn random_token() -> Result<String> {
    let mut bytes = [0u8; BYTES];
    SystemRandom::new()
        .fill(&mut bytes)
        .map_err(|_| Error::Invalid)?;
    Ok(base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes))
}

fn challenge_of(verifier: &str) -> String {
    let hash = digest::digest(&digest::SHA256, verifier.as_bytes());
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(hash.as_ref())
}

/// A sign-in that has been started and not finished. It holds the two secrets of
/// the flow, which is why it has no `Display` and a `Debug` that says neither.
pub struct Pending {
    site: Url,
    allow_private: bool,
    verifier: String,
    state: String,
    /// Where the person is sent: the site's authorization page with the request.
    pub authorize_url: String,
}

impl std::fmt::Debug for Pending {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Pending(…)")
    }
}

/// What a finished sign-in leaves, and all of it: the secret is in the keychain
/// and is not here.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct Paired {
    pub origin: String,
    pub workspace: String,
    /// The device's name as the site recorded it, for the person to recognise.
    pub label: String,
    /// `keychain:<name>`, to be used wherever a credential file's path goes.
    pub token_file: String,
}

/// Start a sign-in at `site`, naming this device `label`.
pub fn begin(site: &str, label: &str, allow_private: bool) -> Result<Pending> {
    let site = address(site, allow_private)?;
    let label = label.trim();
    if label.is_empty() || label.chars().count() > 80 || label.chars().any(char::is_control) {
        return Err(Error::Invalid);
    }
    let verifier = random_token()?;
    let state = random_token()?;
    let mut url = site.join("tura/pair").map_err(|_| Error::Invalid)?;
    url.query_pairs_mut()
        .append_pair("client", "tura")
        .append_pair("challenge", &challenge_of(&verifier))
        .append_pair("challenge_method", "S256")
        .append_pair("state", &state)
        .append_pair("label", label)
        .append_pair("redirect", REDIRECT);
    Ok(Pending {
        site,
        allow_private,
        verifier,
        state,
        authorize_url: url.into(),
    })
}

/// What a redirect carries once it has been checked.
struct Code(String);

impl Pending {
    /// Read the address the browser was sent back to (`tura://pair?code=…&state=…`).
    ///
    /// Anything but exactly that address, a `state` that is not this request's, or
    /// a code of an unreasonable size is refused as invalid; the site saying the
    /// person declined is `Denied`.
    fn accept(&self, redirect: &str) -> Result<Code> {
        let redirect = redirect.trim();
        let url = Url::parse(redirect).map_err(|_| Error::Invalid)?;
        let here = format!("{}://{}", url.scheme(), url.host_str().unwrap_or_default());
        if here != REDIRECT
            || url.username() != ""
            || url.password().is_some()
            || url.fragment().is_some()
        {
            return Err(Error::Invalid);
        }
        let (mut code, mut state, mut error) = (None, None, None);
        for (k, v) in url.query_pairs() {
            match &*k {
                "code" if code.is_none() => code = Some(v.into_owned()),
                "state" if state.is_none() => state = Some(v.into_owned()),
                "error" if error.is_none() => error = Some(v.into_owned()),
                _ => return Err(Error::Invalid),
            }
        }
        // A different request's redirect, or none at all: dropped, whatever else it says.
        if state.as_deref() != Some(self.state.as_str()) {
            return Err(Error::Invalid);
        }
        if error.is_some() {
            return Err(Error::Denied);
        }
        let code = code.ok_or(Error::Invalid)?;
        let tidy = !code.is_empty()
            && code.len() <= 200
            && code
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~'));
        if tidy {
            Ok(Code(code))
        } else {
            Err(Error::Invalid)
        }
    }

    /// Finish the sign-in with the address the browser came back to: check it,
    /// trade the code for the credential, keep the credential in the keychain
    /// under `name`, and say where to connect. The code is single-use, so a
    /// failure here is a new sign-in, not a retry.
    pub fn finish(&self, redirect: &str, name: &str) -> Result<Paired> {
        let code = self.accept(redirect)?;
        // The name is checked before the site is asked for anything: a secret
        // that could not be kept is a credential minted for nothing.
        if crate::remote::credential_name(&format!("{KEYCHAIN_PREFIX}{name}")).is_none() {
            return Err(Error::Invalid);
        }
        let granted = self.exchange(&code)?;
        // All three, or none of it is stored: a half-trusted answer does not
        // overwrite whatever credential was there.
        let origin = address(&granted.origin, self.allow_private)?;
        let workspace_ok = !granted.workspace.is_empty()
            && granted.workspace.len() <= 64
            && granted
                .workspace
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-' || b == b'_');
        if !workspace_ok || !shaped_credential(&granted.credential) {
            return Err(Error::Protocol);
        }
        store_credential(name, &granted.credential)?;
        Ok(Paired {
            origin: origin.as_str().trim_end_matches('/').to_owned(),
            workspace: granted.workspace,
            label: granted.label,
            token_file: format!("{KEYCHAIN_PREFIX}{name}"),
        })
    }

    fn exchange(&self, code: &Code) -> Result<Granted> {
        let url = self
            .site
            .join("tura/pair/exchange")
            .map_err(|_| Error::Invalid)?;
        let (host, addresses) = resolved(&url, self.allow_private)?;
        let client = client(&host, &addresses, None)?;
        let response = client
            .post(url)
            .json(&serde_json::json!({ "code": code.0, "verifier": self.verifier }))
            .send()
            .map_err(|_| Error::Offline)?;
        let status = response.status().as_u16();
        let json = response
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.split(';').next())
            == Some("application/json");
        let mut bytes = vec![];
        response
            .take(ANSWER_LIMIT as u64 + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| Error::Offline)?;
        match status {
            200 if json && bytes.len() <= ANSWER_LIMIT => {
                serde_json::from_slice(&bytes).map_err(|_| Error::Protocol)
            }
            // One refusal for every way a code can be wrong (spent, expired, not
            // this verifier): the site does not say which, and neither does this.
            400 | 401 | 403 => Err(Error::Denied),
            429 | 503 => Err(Error::Busy),
            _ => Err(Error::Protocol),
        }
    }
}

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct Granted {
    origin: String,
    workspace: String,
    credential: String,
    label: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_challenge_is_the_sha256_of_the_verifier_as_rfc_7636_gives_it() {
        // RFC 7636 appendix B.
        assert_eq!(
            challenge_of("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn every_sign_in_has_its_own_verifier_and_state_and_they_are_long_enough() {
        let a = begin("https://site.example", "Pixel 8", false).unwrap();
        let b = begin("https://site.example", "Pixel 8", false).unwrap();
        assert_ne!(a.verifier, b.verifier);
        assert_ne!(a.state, b.state);
        assert_ne!(a.verifier, a.state);
        assert!(
            a.verifier.len() >= 43 && a.state.len() >= 43,
            "256 bits, as base64url"
        );
    }

    #[test]
    fn the_authorization_address_carries_the_challenge_and_never_the_verifier() {
        let p = begin("https://site.example/", "Pixel 8", false).unwrap();
        let url = Url::parse(&p.authorize_url).unwrap();
        assert_eq!(url.origin().ascii_serialization(), "https://site.example");
        assert_eq!(url.path(), "/tura/pair");
        let q: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
        assert_eq!(q["client"], "tura");
        assert_eq!(q["challenge_method"], "S256");
        assert_eq!(q["challenge"], challenge_of(&p.verifier));
        assert_eq!(q["state"], p.state);
        assert_eq!(q["label"], "Pixel 8");
        assert_eq!(q["redirect"], REDIRECT);
        assert!(!p.authorize_url.contains(&p.verifier));
        assert_eq!(format!("{p:?}"), "Pending(…)");
    }

    #[test]
    fn a_site_or_a_label_that_cannot_be_used_is_refused_before_anything_is_made() {
        assert!(
            begin("http://site.example", "x", false).is_err(),
            "plain http to the internet"
        );
        assert!(begin("https://site.example", "  ", false).is_err());
        assert!(begin("https://site.example", &"x".repeat(81), false).is_err());
        assert!(begin("https://site.example", "a\nb", false).is_err());
        assert!(begin("https://user:pw@site.example", "x", false).is_err());
    }

    fn pending() -> Pending {
        begin("https://site.example", "Pixel 8", false).unwrap()
    }

    #[test]
    fn only_this_requests_redirect_is_accepted() {
        let p = pending();
        let ok = format!("tura://pair?code=abc-DEF_1.2~3&state={}", p.state);
        assert_eq!(p.accept(&ok).unwrap().0, "abc-DEF_1.2~3");
        assert_eq!(
            p.accept(&format!("  {ok}\n")).unwrap().0,
            "abc-DEF_1.2~3",
            "pasted with spaces"
        );
        for bad in [
            format!("tura://pair?code=abc&state={}x", p.state),
            "tura://pair?code=abc".to_owned(),
            format!("tura://pair?state={}", p.state),
            format!("tura://other?code=abc&state={}", p.state),
            format!("https://pair?code=abc&state={}", p.state),
            format!("tura://pair?code=abc&state={}&extra=1", p.state),
            format!("tura://pair?code=a&code=b&state={}", p.state),
            format!("tura://pair?code=abc&state={}#frag", p.state),
            format!("tura://user@pair?code=abc&state={}", p.state),
            format!("tura://pair?code={}&state={}", "x".repeat(201), p.state),
            format!("tura://pair?code=a%20b&state={}", p.state),
            "not a link".to_owned(),
            String::new(),
        ] {
            assert!(p.accept(&bad).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn the_person_declining_is_denied_and_a_stranger_redirect_is_not_even_that() {
        let p = pending();
        assert!(matches!(
            p.accept(&format!(
                "tura://pair?error=access_denied&state={}",
                p.state
            )),
            Err(Error::Denied)
        ));
        assert!(matches!(
            p.accept("tura://pair?error=access_denied&state=someone-elses"),
            Err(Error::Invalid)
        ));
    }
}
