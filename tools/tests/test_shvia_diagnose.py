#!/usr/bin/env python3
"""`tools/shvia-diagnose.py` keeps a record and never keeps the key.

A gateway on loopback plays the part: a catalogue of five profiles, a chat list
that accepts two of them, a refusal for the rest, and an `/api/auth/me` that
carries an email, which the log must not. What is checked is what someone
reading the log needs (the two lists, their difference, the refused call with
its request id) and what must not be in it (the key, the email).
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'tools/shvia-diagnose.py'
KEY = 'shvia_usr_7_0123456789abcdef0123456789abcdef'
EMAIL = 'someone@example.org'
PROFILES = ['llama3@local', 'anna@gpu1', 'claude-fable-5-1@anthropic', 'gpt-4o@openai', 'm2@minimax']
LISTED = ['anna@gpu1', 'm2@minimax']


class Gateway(BaseHTTPRequestHandler):
    seen = []
    redirect_me = False

    def log_message(self, *args):
        pass

    def reply(self, status, body):
        raw = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('X-Request-Id', 'req-%s' % status)
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        Gateway.seen.append(('GET', self.path, dict(self.headers)))
        if self.path == '/api/auth/me' and Gateway.redirect_me:
            self.send_response(307)
            self.send_header('Location', '/leak')
            self.send_header('Content-Length', '0')
            self.end_headers()
        elif self.path == '/api/auth/me':
            self.reply(200, {'user': {'email': EMAIL}, 'allowed_models': None, 'configured_providers': ['anthropic']})
        elif self.path == '/api/v1/profiles':
            self.reply(200, {'profiles': [{'name': n} for n in PROFILES], 'default_server': 'gpu1',
                             'servers': {'gpu1': {'driver': 'ollama', 'online': True}}})
        elif self.path == '/v1/models':
            self.reply(200, {'object': 'list', 'data': [{'id': n, 'object': 'model'} for n in LISTED]})
        else:
            self.reply(404, {})

    def do_POST(self):
        size = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(size))
        Gateway.seen.append(('POST', self.path, dict(self.headers), body))
        if body['model'] in LISTED:
            if self.path == '/v1/messages':
                self.reply(200, {'model': body['model'], 'content': [{'type': 'text', 'text': 'OK'}]})
            else:
                self.reply(200, {'model': body['model'], 'choices': [{'message': {'content': 'OK'}}]})
        else:
            self.reply(404, {'error': {'message': 'The model "%s" does not exist or is not available.' % body['model'],
                                       'type': 'invalid_request_error', 'code': 'model_not_found'}})


def run(*flags):
    Gateway.seen = []
    server = HTTPServer(('127.0.0.1', 0), Gateway)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / 'log.txt'
            env = dict(os.environ, SHVIA_KEY=KEY)
            r = subprocess.run(
                [sys.executable, '-I', str(SCRIPT), '--base', 'http://127.0.0.1:%d' % server.server_port,
                 '--out', str(out), *flags],
                env=env, capture_output=True, text=True, timeout=60)
            return r, out.read_text() if out.exists() else ''
    finally:
        server.shutdown()
        server.server_close()


class Diagnose(unittest.TestCase):
    def test_the_log_has_both_lists_their_difference_and_the_refused_call(self):
        r, log = run()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('5 profiles', log)
        self.assertIn('2 models', log)
        self.assertIn('in both: 2   only in the catalogue: 3', log)
        self.assertIn('claude-fable-5-1@anthropic is in the catalogue', log)
        self.assertIn('claude-fable-5-1@anthropic is NOT listed', log)
        self.assertIn('allowed_models: null', log)
        self.assertIn('configured_providers: ["anthropic"]', log)
        self.assertIn('HTTP 404', log)
        self.assertIn('X-Request-Id req-404', log)
        self.assertIn('does not exist or is not available', log)
        self.assertIn('the first model /v1/models lists (a control)', log)
        self.assertIn('POST /v1/messages', log)

    def test_the_key_and_the_email_are_not_in_the_log_nor_on_the_screen_and_the_key_is_sent(self):
        r, log = run()
        for text in (log, r.stdout, r.stderr):
            self.assertNotIn(KEY, text)
            self.assertNotIn(EMAIL, text)
        sent = {k.lower(): v for k, v in [s for s in Gateway.seen if s[0] == 'GET'][0][2].items()}
        self.assertEqual(sent.get('authorization'), 'Bearer ' + KEY)
        anthropic = [s for s in Gateway.seen if s[1] == '/v1/messages'][0][2]
        self.assertEqual({k.lower(): v for k, v in anthropic.items()}.get('x-api-key'), KEY)
        for entry in Gateway.seen:
            self.assertNotIn(KEY, entry[1], 'the key must never be in a URL')

    def test_no_chat_stops_after_the_lists_and_sends_no_post(self):
        r, log = run('--no-chat')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('2 models', log)
        self.assertNotIn('POST /v1/chat/completions', log)
        self.assertEqual([s for s in Gateway.seen if s[0] == 'POST'], [])

    def test_a_redirect_is_not_followed_with_the_key_in_hand(self):
        Gateway.redirect_me = True
        try:
            r, log = run('--no-chat')
        finally:
            Gateway.redirect_me = False
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('HTTP 307', log)
        self.assertEqual([s for s in Gateway.seen if s[1] == '/leak'], [])

    def test_an_address_with_a_path_or_plain_http_to_another_host_is_refused_before_any_request(self):
        for base in ('http://example.org', 'https://ai.shvia.org/v1', 'https://u:p@ai.shvia.org'):
            r = subprocess.run([sys.executable, '-I', str(SCRIPT), '--base', base],
                               env=dict(os.environ, SHVIA_KEY=KEY), capture_output=True, text=True, timeout=30)
            self.assertNotEqual(r.returncode, 0, base)
            self.assertNotIn(KEY, r.stdout + r.stderr)


if __name__ == '__main__':
    unittest.main()
