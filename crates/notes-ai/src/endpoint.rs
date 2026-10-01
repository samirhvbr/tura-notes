use crate::{Error, Result};
use reqwest::Url;

/// A provider's base URL, checked.
///
/// - `https` anywhere; `http` only for a loopback host, which is how a local
///   Ollama or LM Studio is reached. A key sent over plain `http` to a remote
///   host would cross the network readable.
/// - No user, password, query or fragment: a credential belongs in a header,
///   and a base URL that carries one would be copied into logs and errors.
///
/// The path is kept, because an OpenAI-compatible base ends in `/v1`, and its
/// trailing slash is normalised so a later `join` appends instead of replacing.
pub fn validate_base(base: &str) -> Result<Url> {
    let mut url = Url::parse(base.trim()).map_err(|_| Error::Endpoint("not a URL"))?;
    if !url.username().is_empty() || url.password().is_some() {
        return Err(Error::Endpoint("it carries a user or password"));
    }
    if url.query().is_some() || url.fragment().is_some() {
        return Err(Error::Endpoint("it carries a query or fragment"));
    }
    let host = url.host_str().ok_or(Error::Endpoint("it has no host"))?;
    match url.scheme() {
        "https" => {}
        "http" if is_loopback(host) => {}
        "http" => return Err(Error::Endpoint("plain http is only for this machine")),
        _ => return Err(Error::Endpoint("only https is accepted")),
    }
    if !url.path().ends_with('/') {
        let path = format!("{}/", url.path());
        url.set_path(&path);
    }
    Ok(url)
}

fn is_loopback(host: &str) -> bool {
    let host = host.trim_start_matches('[').trim_end_matches(']');
    host.eq_ignore_ascii_case("localhost")
        || host
            .parse::<std::net::IpAddr>()
            .is_ok_and(|ip| ip.is_loopback())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn https_is_accepted_and_a_slash_is_added_to_the_path() {
        assert_eq!(
            validate_base("https://api.anthropic.com").unwrap().as_str(),
            "https://api.anthropic.com/"
        );
        assert_eq!(
            validate_base("https://example.org/v1").unwrap().as_str(),
            "https://example.org/v1/"
        );
    }

    #[test]
    fn plain_http_is_only_for_loopback() {
        for ok in [
            "http://localhost:11434/v1",
            "http://127.0.0.1:8080",
            "http://[::1]:1234/v1",
            "HTTP://LocalHost",
        ] {
            assert!(validate_base(ok).is_ok(), "{ok}");
        }
        for bad in [
            "http://example.org",
            "http://192.168.1.10:11434",
            "http://localhost.evil.test",
        ] {
            assert!(validate_base(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn credentials_queries_and_other_schemes_are_refused() {
        for bad in [
            "https://user:pw@example.org",
            "https://user@example.org",
            "https://example.org/?key=1",
            "https://example.org/#x",
            "ftp://example.org",
            "file:///etc/passwd",
            "not a url",
            "",
        ] {
            assert!(validate_base(bad).is_err(), "{bad}");
        }
    }
}
