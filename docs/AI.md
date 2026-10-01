# The AI assistant

> **Status:** `ACTIVE` · Built in 1.10.0 to 1.10.4 · Decision:
> [ADR-100](decisions.md#adr-100--an-opt-in-ai-assistant-calls-the-provider-from-rust-keeps-the-key-in-the-system-keychain-and-edits-the-open-note-through-the-editor).
> Owner acceptance, with a real key, is open:
> [ACCEPTANCE-AI.md](ACCEPTANCE-AI.md).

The assistant is a chat in the sidebar that can read the notes the user chooses
to share and write to them. It is **off until the user turns it on**, it talks to
a provider the user configured, and the only thing that changes a note is the
editor.

This page is the contract. [ARCHITECTURE.md](ARCHITECTURE.md) says where the code
sits, and [security.md §2](security.md#2-threat-model) lists what it adds to the
threat model.

## What the user sees

- **Settings → AI assistant.** An off switch (ADR-007), with a sentence that does
  not go away: *the text you send leaves this computer for the provider you
  choose.* Then up to twelve providers, each with a type, a server address, a
  model and an API key. **Test** lists the provider's models, which is also the
  check that the key works.
- **The chat** (rail icon, `Ctrl+Shift+A`, or "Ask the AI assistant" in the
  palette; all three exist only while the assistant is on). Above the box, every
  note and the selection that will be sent are chips the user can switch off.
  Under each question, the chat says what was sent and whether any of it was cut.
  The reply streams in, with **Stop**.
- **Cards.** Each change the assistant makes appears as a card naming the note,
  with **Undo**. A change it did not make appears too, with the reason.

## Providers

| Type | Endpoint | Key | Notes |
|---|---|---|---|
| Anthropic | `POST /v1/messages`, `GET /v1/models` on `https://api.anthropic.com` (or the address given) | required | `x-api-key`, `anthropic-version: 2023-06-01`; the default model is `claude-opus-5-5`; `effort` is sent as `medium` only to models that have it, because an older one rejects the field |
| OpenAI-compatible | `POST {base}/chat/completions`, `GET {base}/models` | optional | OpenAI, OpenRouter, and a local Ollama or LM Studio, which want none; `max_completion_tokens` goes only to `api.openai.com`, the others get `max_tokens` |

An address must be `https`; plain `http` is accepted only for this machine
(`localhost`, `127.0.0.1`, `::1`), and one with a user name, a password or a query
is refused. **A redirect is never followed**: it would hand the key to a host the
user did not name.

## The key

- It lives in the **system keychain** (Keychain, Credential Manager, Secret
  Service), under the service `br.com.samirhv.notes` and the account
  `ai:<provider id>`. Settings keep the type, address, model and a flag computed
  from the keychain, never the key.
- It crosses IPC **once, inward**, when it is set. Nothing returns it, so nothing
  can show it: a provider says "key saved" or "no key".
- **There is no fallback to a file.** Where the system has no keychain the
  assistant says so and cannot store a key.
- It is read on the worker thread, used to build the client, and is in no error,
  no event and no log. The type that holds it has no `Display` and a redacted
  `Debug`.

## What leaves the machine

Only what the chat's chips list, plus the question and the earlier turns of this
conversation:

- the notes the user shared (the current note, those attached), read **by the
  core** from paths, under the same root jail as any read, as text, and only
  notes; reading one gives it no identity and records no visit;
- the selection, which is the one text the page may supply, because it exists
  only in the editor;
- bounds, all checked before anything is built: 60 000 characters a note (cut at
  the start, and the chat says so), 200 000 a turn (over it, the turn is refused
  whole rather than half-sent), 40 messages, 30 000 characters a message.

A note on the server cannot be sent yet. The conversation is held in memory and
ends with the window; nothing is written to disk. Nothing is logged with its
content.

Text inside `<notes>` is marked as the user's reference material, not
instructions. That is a request to the model, not a guarantee, which is why the
rule below does not depend on it.

## How the assistant changes a note

The model is offered two tools. It can call them; it cannot do anything else.

| Tool | Arguments | Effect |
|---|---|---|
| `edit_note` | `path`, `operation` (`replace_selection`, `insert_at_cursor`, `replace_all`), `text` | Changes a note **the user shared in this turn** |
| `create_note` | `path`, `text` | Creates a note through the core's `create_note` (an existing folder, an unused name), opens it and writes the text |

**Nothing in `notes-ai` or the shell writes a file.** The path of a change is:

1. the provider hands the call back **whole**, after its argument has finished
   streaming; one that was cut off is not a call;
2. the shell **checks it again** (a schema is a request, not a guarantee): the
   path parses and names a note, the operation is one of the three, the text is
   at most 200 000 characters, at most eight calls a reply; what fails is sent as
   a rejection with its reason;
3. the page waits for the reply to **finish**, and applies nothing after Stop or a
   failure, saying so on each card;
4. all the edits to one note become **one CodeMirror transaction** with its own
   undo step, so one `Ctrl+Z` takes the turn back and it never merges with what
   the user typed before. It is not an external reload, so the ordinary save path
   (BaseRev, draft, conflict) sees a keystroke;
5. `replace_selection` acts on the selection that was sent, and only while it is
   still the one selected, because the model wrote its text for those words.

The turn ends at the tool call: nothing is sent back to the model. What it did is
remembered for the next question as a short bracket line (`[edited a.md]`).

**Undo on a card** works while that transaction is the last thing done in that
editor. After the user types, or opens another note, the card says to use the
note's own `Ctrl+Z`. A created note's undo removes its text and leaves the empty
note: deleting a file is the destructive act, and nobody asked for it.

A read-only note, a note held by a sync barrier, a note the user did not share,
and a name the core refuses are each a card with a reason, never a silent no-op
and never a write.

## Where it stops

- **Android is out**: the keychain crate does not cover it.
- Replies are plain text. Rendering model output as Markdown is a surface this
  version does not open.
- Edits to a note that is not the open one open it first, so the undo exists; the
  view changes.
- No Markdown preview of a change before it is made. The user chose "edit
  directly, undo after" (ADR-100); the cards and the single undo are what make
  that acceptable.

## Errors the user can read

Every failure has a sentence in both languages and no provider text except as
detail: `disabled`, `keychain_unavailable`, `keychain_failed`, `unknown_provider`,
`invalid_name`, `invalid_endpoint`, `invalid_model`, `invalid_key`, `no_key`,
`too_many_providers`, `unauthorized`, `rate_limited`, `offline`, `protocol`,
`provider`, `internal`, `invalid_request`, `no_provider`, `too_large`,
`unreadable_note`. A model that refuses and a reply that reached its length limit
are results with their own sentence, not errors.

## Tests, and what they cannot say

The providers are tested against a local fake server that plays back canned
streams, including the awkward ones: reads cut inside a character, a stream that
never ends, a redirect, a stop pressed while the provider is quiet, and a key that
must appear in no error. **No test touches a real provider and none spends.** What
only the owner can check, with a real key and a real model, is in
[ACCEPTANCE-AI.md](ACCEPTANCE-AI.md).
