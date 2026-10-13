#!/usr/bin/env python3
"""Ask a SHVIA gateway what the Tura assistant asks it, and write the answers down.

The assistant offers the models that two lists agree on, `GET /api/v1/profiles`
and `GET /v1/models` (ADR-109), and chats through `POST /v1/chat/completions`.
When the list is not the one expected, or a chat is refused, the application
shows a sentence and keeps no record. This script makes the same requests, in
the same order, and keeps the record: status, `X-Request-Id` (the gateway's own
audit log can be searched for it), counts, the names in one list and not the
other, and what a tiny chat answered through the OpenAI route and through the
Anthropic one, which is what Claude Code speaks.

The key is read without echo, or from `SHVIA_KEY`. It travels only in the
request headers: it is never printed, never written to the log, and never put
in a URL. The log holds model names and request ids, and of `/api/auth/me` only
`allowed_models` and `configured_providers`.

    python3 tools/shvia-diagnose.py [--base https://ai.shvia.org]
                                    [--model claude-fable-5-1@anthropic]
                                    [--no-chat] [--out FILE]

`--no-chat` stops after the lists, so nothing is billed. Without it the script
sends at most three chats of about ten tokens each.
"""
import argparse
import datetime
import getpass
import json
import os
import platform
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_BASE = 'https://ai.shvia.org'
DEFAULT_MODEL = 'claude-fable-5-1@anthropic'
PROMPT = 'Reply with the single word OK.'
SHOW = 60  # names listed in full; beyond that, a count


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """The application never follows a redirect with a key in hand, nor does this."""

    def redirect_request(self, *args, **kwargs):
        return None


_OPENER = urllib.request.build_opener(_NoRedirect)


def call(method, url, headers, body=None, timeout=60):
    """One request. Never raises: a transport failure is a result with no status."""
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(url, data=data, method=method, headers=headers)
    started = time.monotonic()
    try:
        with _OPENER.open(request, timeout=timeout) as response:
            status, raw, sent = response.status, response.read(), response.headers
    except urllib.error.HTTPError as error:
        status, raw, sent = error.code, error.read(), error.headers
    except (urllib.error.URLError, OSError, ValueError) as error:
        reason = getattr(error, 'reason', error)
        return {'status': None, 'error': str(reason), 'ms': 0, 'headers': {}, 'raw': b'', 'json': None}
    parsed = None
    try:
        parsed = json.loads(raw)
    except ValueError:
        pass
    return {
        'status': status,
        'ms': round((time.monotonic() - started) * 1000),
        'headers': {k.lower(): v for k, v in sent.items()},
        'raw': raw,
        'json': parsed,
        'error': None,
    }


def server_of(name):
    """The suffix after the last `@`, which is the infrastructure; `local` when none."""
    return name.rsplit('@', 1)[1] if '@' in name else 'local'


def by_server(names):
    counts = {}
    for name in names:
        counts[server_of(name)] = counts.get(server_of(name), 0) + 1
    return ', '.join('%s=%d' % (k, v) for k, v in sorted(counts.items())) or '(none)'


def find(value, key, depth=2):
    """`key` at the top of a JSON object or one level in, else a marker."""
    if isinstance(value, dict):
        if key in value:
            return value[key]
        if depth > 0:
            for inner in value.values():
                if isinstance(inner, dict):
                    got = find(inner, key, depth - 1)
                    if got != '<absent>':
                        return got
    return '<absent>'


class Report:
    def __init__(self, key):
        self.key = key
        self.lines = []

    def say(self, text=''):
        # The key is not in any line by construction; this is the belt to that brace.
        text = text.replace(self.key, '<key>') if self.key else text
        self.lines.append(text)
        print(text, flush=True)

    def section(self, title):
        self.say()
        self.say('== ' + title)

    def result(self, r):
        if r['status'] is None:
            self.say('   no answer: %s' % r['error'])
            return
        rid = r['headers'].get('x-request-id', '-')
        self.say('   HTTP %s in %d ms, %d bytes, X-Request-Id %s' % (r['status'], r['ms'], len(r['raw']), rid))

    def text(self):
        return '\n'.join(self.lines) + '\n'


def names_of(r, field, name_key):
    body = r['json']
    items = body.get(field) if isinstance(body, dict) else None
    if not isinstance(items, list):
        return None
    return [i[name_key] for i in items if isinstance(i, dict) and isinstance(i.get(name_key), str)]


def chat_summary(report, r):
    report.result(r)
    body = r['json']
    for header in ('x-inference-model', 'x-inference-server'):
        if header in r['headers']:
            report.say('   %s: %s' % (header, r['headers'][header]))
    if not isinstance(body, dict):
        if r['raw']:
            report.say('   body (not JSON): %s' % r['raw'][:300].decode('utf-8', 'replace'))
        return
    if isinstance(body.get('error'), dict):
        e = body['error']
        report.say('   error: type=%s code=%s message=%s' % (e.get('type'), e.get('code'), str(e.get('message'))[:300]))
    elif isinstance(body.get('error'), str):
        report.say('   error: %s' % body['error'][:300])
    if 'model' in body:
        report.say('   model in the answer: %s' % body['model'])
    choices = body.get('choices')
    if isinstance(choices, list) and choices and isinstance(choices[0], dict):
        message = choices[0].get('message') or {}
        report.say('   answer: %r' % str(message.get('content'))[:80])
    content = body.get('content')
    if isinstance(content, list) and content and isinstance(content[0], dict):
        report.say('   answer: %r' % str(content[0].get('text'))[:80])


def run(base, model, key, chat, out):
    report = Report(key)
    bearer = {'authorization': 'Bearer ' + key, 'accept': 'application/json'}
    report.say('SHVIA gateway diagnostic')
    report.say('when:     %s' % datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC'))
    report.say('gateway:  %s' % base)
    report.say('model:    %s' % model)
    report.say('key:      %s (%d characters), sent only as a header' % ('shvia_usr_…' if key.startswith('shvia_usr_') else 'another form', len(key)))
    report.say('system:   Python %s on %s' % (platform.python_version(), platform.platform()))

    report.section('1. GET /api/auth/me  (only allowed_models and configured_providers are kept)')
    me = call('GET', base + '/api/auth/me', bearer)
    report.result(me)
    for field in ('allowed_models', 'configured_providers'):
        report.say('   %s: %s' % (field, json.dumps(find(me['json'], field))))

    report.section('2. GET /api/v1/profiles  (the catalogue the assistant read before 1.11.10)')
    prof = call('GET', base + '/api/v1/profiles', bearer)
    report.result(prof)
    profiles = names_of(prof, 'profiles', 'name')
    if profiles is None:
        report.say('   not a catalogue')
    else:
        report.say('   %d profiles: %s' % (len(profiles), by_server(profiles)))
        report.say('   default_server: %s' % json.dumps(find(prof['json'], 'default_server')))
        servers = prof['json'].get('servers') if isinstance(prof['json'], dict) else None
        if isinstance(servers, dict):
            for k, v in sorted(servers.items()):
                if isinstance(v, dict):
                    report.say('   server %s: driver=%s online=%s disabled=%s' % (
                        k, v.get('driver'), v.get('online'), v.get('disabled')))
        report.say('   %s is %s' % (model, 'in the catalogue' if model in profiles else 'NOT in the catalogue'))

    report.section('3. GET /v1/models  (what the OpenAI-compatible route lists)')
    listing = call('GET', base + '/v1/models', bearer)
    report.result(listing)
    listed = names_of(listing, 'data', 'id')
    if listed is None:
        report.say('   not a model list')
    else:
        report.say('   %d models: %s' % (len(listed), by_server(listed)))
        for name in listed[:SHOW]:
            report.say('     ' + name)
        if len(listed) > SHOW:
            report.say('     … and %d more' % (len(listed) - SHOW))
        report.say('   %s is %s' % (model, 'listed' if model in listed else 'NOT listed'))

    if profiles is not None and listed is not None:
        report.section('4. The two lists compared  (the assistant offers the models in both)')
        both = [n for n in profiles if n in set(listed)]
        only_profiles = [n for n in profiles if n not in set(listed)]
        only_listed = [n for n in listed if n not in set(profiles)]
        report.say('   in both: %d   only in the catalogue: %d (%s)   only in /v1/models: %d' % (
            len(both), len(only_profiles), by_server(only_profiles), len(only_listed)))

    asked = None
    if chat:
        body = {'model': model, 'messages': [{'role': 'user', 'content': PROMPT}], 'max_tokens': 16, 'stream': False}
        report.section('5. POST /v1/chat/completions  with %s' % model)
        asked = call('POST', base + '/v1/chat/completions', dict(bearer, **{'content-type': 'application/json'}), body)
        chat_summary(report, asked)

        control = next((n for n in (listed or []) if n != model), None)
        if control:
            report.section('6. The same chat with %s, the first model /v1/models lists (a control)' % control)
            chat_summary(report, call('POST', base + '/v1/chat/completions',
                                      dict(bearer, **{'content-type': 'application/json'}), dict(body, model=control)))

        report.section('7. POST /v1/messages  (the Anthropic dialect) with %s' % model)
        anthropic = {'x-api-key': key, 'anthropic-version': '2023-06-01', 'accept': 'application/json',
                     'content-type': 'application/json'}
        chat_summary(report, call('POST', base + '/v1/messages', anthropic,
                                  {'model': model, 'max_tokens': 16, 'messages': [{'role': 'user', 'content': PROMPT}]}))

    report.section('Reading')
    in_profiles = profiles is not None and model in profiles
    is_listed = listed is not None and model in listed
    report.say('   - %s is %s the catalogue and %s /v1/models.' % (
        model, 'in' if in_profiles else 'not in', 'in' if is_listed else 'not in'))
    if asked is not None and asked['status'] is not None:
        report.say('   - the chat answered HTTP %s.' % asked['status'])
    report.say('   Nothing here says why: it is the record to read. Send the X-Request-Id of a refused call to whoever')
    report.say("   reads the gateway's audit log.")

    text = report.text()
    with open(out, 'w', encoding='utf-8') as f:
        f.write(text)
    print('\nLog written to %s' % out)
    return 0


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--base', default=DEFAULT_BASE)
    ap.add_argument('--model', default=DEFAULT_MODEL)
    ap.add_argument('--no-chat', action='store_true', help='stop after the lists; nothing is billed')
    ap.add_argument('--out', default=None)
    args = ap.parse_args(argv)

    base = args.base.rstrip('/')
    parts = urllib.parse.urlsplit(base)
    local = parts.hostname in ('localhost', '127.0.0.1', '::1')
    if parts.scheme not in ('https', 'http') or (parts.scheme == 'http' and not local) or parts.path or parts.username:
        sys.exit('the address must be https (http only on this computer), alone, with no path or credentials')

    key = os.environ.get('SHVIA_KEY') or getpass.getpass('SHVIA key (shvia_usr_…, not shown): ')
    key = key.strip()
    if not key:
        sys.exit('no key given')
    out = args.out or 'shvia-diagnose-%s.log' % datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')
    return run(base, args.model, key, not args.no_chat, out)


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
