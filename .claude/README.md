# Claude Code profile — Tura Notes

> **Status:** `ACTIVE`

`.claude/` in this repository follows the standard of the samirhvbr/Blue3 fleet:
an **effort level** plus a **permission posture**, both versioned. It does
**not** choose the model — see the next section.

Conduct rules for the agent are in [CLAUDE.md](../CLAUDE.md).

## Files

| File | Role |
|------|------|
| `settings.json` | The **active** profile — effort level and permissions — versioned. |
| `settings.local.json` | Machine-local override, **gitignored** — it may hold paths and tokens that belong to one machine. Never commit it. |

## The repository does not choose the model

**The model is the user's choice, made with `/model`, per session** — and a
subagent inherits the session's model. `settings.json` carries no `model`, no
`fallbackModel` and no `availableModels`, and its `env` carries no
`ANTHROPIC_MODEL`, no `ANTHROPIC_DEFAULT_*_MODEL` and no
`CLAUDE_CODE_SUBAGENT_MODEL`. There are no stand-by profiles to copy over
`settings.json` to swap the model — `/model` does that (repodocs ADR-027,
24/09/2026).

Why: every pin outlived the model it named. A repository pin also cannot outrank
the organization's managed settings, which only an org Owner edits.

`effortLevel` is not part of that decision and stays where it is.

## The deny-list beats the allow-list — always

`Bash(git push:*)` is allowed, and `git push --force` / `-f` is still blocked.
That asymmetry is the point: pushing is routine, rewriting published history is
not, and no allow-list entry can re-open a denied one. The same holds for
`git reset --hard` and `git clean -fd`.

Secret reads are denied by path (`.env`, `*.pem`, `*.key`, `*.p8`, `*.p12`,
`*.pfx`). A guard added after the first secret lands is a guard added too late.

## Granting a new permission is the owner's act

The skeleton grants **reading, writing and git, and nothing else**. Nothing for
your stack is granted yet — no build, no test, no package manager, no database
client. That is deliberate.

When a permission needs to exist, it is **written into `settings.json` together
with its reason and how to revert it** — never applied silently, and never left
as a promise in prose.

That last clause is not style. In a sibling repository the agent guide claimed
`git pull` was "pre-authorised (allow)" while no such rule existed in any
settings file; the norm and the artefact disagreed for weeks. A norm that does
not match the artefact is a defect.

<!-- Record each grant here as you make it: what, when, why, how to revert. -->

| Granted | When | Why | Revert by |
|---|---|---|---|
| `gh repo view`, `gh pr list`, `gh issue list`, `gh api repos/` — read-only | 05/09/2026 | ADR-019's guest clause requires reading an upstream's language and commit shape **before** writing into it, and a rule that prompts on every check is a rule that gets skipped. The four read; they change nothing | Delete those four lines from `permissions.allow`. The clause still applies — it just asks each time. `gh repo edit` and `gh repo delete` stay in `ask` regardless, and the deny-list still wins |

**This table said `_(nothing yet)_` until `1.6.39`, while that grant had been in
`settings.json` since 05/09** — carried in the file's `_comment`, with its reason
and its revert, but never surfaced here. Which is the defect described two
paragraphs above, in this repository rather than a sibling one: the norm said
"record each grant here", the artefact recorded it somewhere else, and the two
disagreed for two weeks.

**What is still not granted, checked against `settings.json` rather than
remembered:** no build, no test runner, no package manager, no database client,
no network fetch. `sudo`, `gh repo edit` and `gh repo delete` are in `ask`. The
deny-list covers secret file reads by extension, `rm -rf`, every spelling of a
force push, `reset --hard`, `clean -fd`, and piping a download into a shell.
