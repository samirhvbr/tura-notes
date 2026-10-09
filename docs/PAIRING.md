# Signing in from the application: the pairing contract

> **Status:** `PROPOSED` · The application's half is built for the desktop (1.10.24:
> the keychain credential, the pairing client, and a sign-in section with a field to
> paste the address into; 1.10.38 to 1.10.39: the same section in Device sync, and the
> pairing there accepts a keychain name), and tested against a site that plays this
> contract. The site's three routes are written and open as a pull request on the site's
> repository (samirhvbr/samirhv-site#7, 08/10/2026), not merged or deployed; the
> `tura://` handler and the mobile application are not built. It moves to `ACTIVE` when a device has paired through a real site. Decision:
> [ADR-105](decisions.md#adr-105--a-device-gets-its-cloud-connection-by-signing-in-to-the-owners-site-not-by-typing-a-key).
> It is written first because **half of it is not in this repository**: the site
> that has the login is the owner's own, and this page is what that site implements
> and what the application consumes.

## The problem it solves

A device reaches the server with a credential, `nt_<id>.<secret>`, and today a
person gets it by minting one on the server (or on the site's administration
screen), downloading a file and pointing the application at its path. That is
workable at a desk and wrong on a phone: there is no file to point at, and typing a
60-character secret on a touch keyboard is how a credential ends up in a note, a
chat or a screenshot. The owner's ask: **signing in should bring the cloud
connection with it.**

## The flow

An OAuth 2.0 *authorization code* flow with PKCE, the shape RFC 8252 prescribes for
native applications, with the **site** as the authorization server and the
**notes server** never involved in the sign-in itself.

```
 App                          System browser                    Site (login)           notes-server
  | 1 verifier, challenge,        |                                 |                        |
  |   state; open the URL ------->| 2 GET /tura/pair?... --------->|                        |
  |                               |<-- login page (the site's own) -|                        |
  |                               | 3 the person signs in, and sees:|                        |
  |                               |   "Allow «Pixel 8» to read and  |                        |
  |                               |    write your notes?"  [Allow]  |                        |
  |                               | 4 Allow ------------------------>| mint a credential ---->|
  |                               |                                 |<-- secret (tura-credential create)
  |                               |<-- 302 tura://pair?code&state --| keeps secret under code |
  |<-- the OS hands the link over-|                                 |                        |
  | 5 POST /tura/pair/exchange {code, verifier} ------------------->| check, answer once     |
  |<-- {origin, workspace, credential, label} ----------------------|                        |
  | 6 keep the credential in the system keychain; configure the connection                    |
```

1. **The application** makes a random `verifier` (32 bytes from the system's secure
   generator, base64url), computes `challenge = base64url(SHA-256(verifier))`, a
   random `state`, and a device `label` (the device's name, which the person sees
   and can change). It opens the system browser (an in-app browser tab that shares
   the browser's sign-in: Custom Tabs on Android, `ASWebAuthenticationSession` on
   iOS; on desktop, the default browser).
2. **`GET https://<site>/tura/pair`**, query: `client=tura`, `challenge`,
   `challenge_method=S256`, `state`, `label`, `redirect=tura://pair`. The site
   refuses a `redirect` that is not exactly `tura://pair`, and a `challenge` that
   is not 43 base64url characters.
3. **The site shows its own login**, then a consent page naming the device label
   and the permissions below. Nothing about this page is the application's: the
   application never sees the password or the session.
4. **On Allow** the site asks the server for a credential
   (`tura-credential create <label> <workspace> read,create,update,move,delete,search`,
   the wrapper `docs/SERVER-0.5.md` already describes), keeps the secret **in its
   store, keyed by a fresh single-use `code`** (random, 32 bytes) together with the
   `challenge`, for **120 seconds**, and redirects to
   `tura://pair?code=<code>&state=<state>`. The secret is in no URL. **The page it
   lands on also shows that same address in a text box with a Copy button**, because
   a desktop browser with no handler for `tura://` shows nothing, and the application
   has a field to paste it into for exactly that case (what it does on desktop
   until a handler is registered).
5. **`POST https://<site>/tura/pair/exchange`**, JSON `{code, verifier}`. The site
   checks that the code exists, has not been used, has not expired, and that
   `base64url(SHA-256(verifier))` equals the stored challenge; it answers **once**
   and deletes the secret from its store whatever happens next. Any other outcome
   is the same `400 {"error":"invalid_grant"}`: it does not say which check failed.
6. **The answer** is `{ "origin": "https://tura.example.com", "workspace":
   "personal", "credential": "nt_…", "label": "Pixel 8" }`, `Cache-Control:
   no-store`. The application checks `state` before the exchange, keeps the
   credential in the **system keychain** (never a file, never `settings.json`), and
   configures the connection from `origin` and `workspace`.

## Why this shape, and what each part is for

- **The secret is not in a URL.** A `tura://` link can be claimed by another
  application on the device; whatever is in it is theirs. What is in it is a
  `code`, and a code is useless without the `verifier` that only the application that
  started the flow holds. That is the whole of PKCE, and the reason step 5 exists.
- **`state`** ties the redirect to the request that made it, so a link a different
  page produced is dropped.
- **One credential per device** (ADR-086): each sign-in mints its own, with the
  device's label, so it can be listed and revoked on its own (ADR-096, and the
  site's administration screen). Signing in again on the same device does not
  replace the old credential; the person revokes it, and the application says so.
- **The permissions are fixed by the site**, not asked for by the application: the
  six the remote folder needs. `devices` is not among them; a device that should
  manage the others is a credential the owner mints by hand.
- **The site owns authentication.** It is whatever the site already has (a
  password, a second factor, a session); this contract adds an *authorization*
  step and two routes to it. A site that cannot do consent for a signed-in person
  cannot implement this, and says so.

## What the site must do (the half outside this repository)

| | |
|---|---|
| `GET /tura/pair` | Validates the query as in step 2. Requires a signed-in session (redirects to login and comes back). Shows the consent page. Is not cacheable and is not framed (`X-Frame-Options: DENY`). |
| consent `POST` | CSRF-protected, as every state-changing form of the site is. Mints through `tura-credential`, stores `{secret, challenge, expires}` under the `code`, redirects. |
| `POST /tura/pair/exchange` | JSON only. Rate-limited by address (the notes server's own limits are the model: 60 a minute is far more than a person needs). Answers once, then deletes. `Cache-Control: no-store`. |
| Store | Anything that survives a request and not a day: a cache entry with a 120 s TTL is enough, and **the secret must not be written to a log, a queue payload or an error report.** |
| Audit | One line per mint and per exchange: who, which label, when, from where. Never the secret or the code. |

## What the application must do (this repository)

- **A credential kept in the system keychain**, which the remote folder and Device
  sync read as they read a credential file today (ADR-099: the bytes are read only
  in Rust). The file remains a way to configure them; it is no longer the only one.
  Where a platform has no keychain, signing in is unavailable and says so, with no
  fallback to a file, as for the AI assistant's key (ADR-100).
- **A pairing client in Rust**: the verifier and challenge, the authorization URL,
  the redirect's `state` check, the exchange, all through the transport policy
  every other connection uses (HTTPS only, no redirects followed, no proxy, the
  address rules). The exchange's address is the site's, which the person gave once.
- **A way to receive the redirect**: a deep link on mobile; on desktop the same
  link, and a field to paste the `tura://pair?…` address for a browser that will
  not hand it over. The desktop application opens no port for this (ADR-007).
- **The sign-in entry**: *Sign in with your site* on the remote folder's panel and
  on Device sync, beside the existing form, which stays for self-hosted servers
  without a site.

## What it does not do

- It does not replace the credential file for someone who has no site: that is the
  existing path, and stays.
- It does not give a server accounts. The notes server still knows credentials and
  nothing else; the *person* exists only on the site.
- It does not refresh or rotate a credential. A credential is revoked, and the
  person signs in again.
- Mobile itself (milestone 0.4) is not built; this is the contract it will use, and
  the same flow works on desktop before it.
