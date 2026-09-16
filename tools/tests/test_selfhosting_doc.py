"""Keep the self-hosting guide describing the interface the app actually has.

`docs/SELF-HOSTING.md` walks a user through fields by their on-screen labels.
Those labels are `i18n/en.json` values, and renaming one is an ordinary change
that leaves no trace in the guide — the reader is then told to fill in a field
that is not there, which is worse than no guide, because they will go looking.

So the labels the guide leans on are listed once, here, and checked from both
ends: each must still be a string the app ships, and each must still appear in
the guide. Renaming the string fails this suite; quietly dropping the field from
the guide fails it too.
"""
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]

# Every label the guide spells out for the reader to look for on screen.
LABELS = [
    'Device sync',
    'Pair or reconnect',
    'Local notes folder',
    'Private sync queue folder (outside notes)',
    'Credential file (outside notes)',
    'Server address',
    'Server workspace',
    'Subfolder scope (optional)',
    'Pairing mode',
    'Send local folder to empty inbox',
    'Receive into empty local folder',
    'Reconcile existing folders',
    'Create pairing and review',
    'Confirm this pairing',
    'Background transfer',
    'Save transfer settings',
    'Transfer now',
    'Apply received files',
    'Allow private network addresses for this server',
]


class SelfHostingGuide(unittest.TestCase):
    def setUp(self):
        # Prose wraps, and a label can land across a line break; the guide is
        # read reflowed, so it is compared reflowed.
        self.guide = re.sub(r'\s+', ' ', (ROOT / 'docs/SELF-HOSTING.md').read_text())
        self.en = json.loads((ROOT / 'apps/notes-app/src/i18n/en.json').read_text())
        self.pt = json.loads((ROOT / 'apps/notes-app/src/i18n/pt-BR.json').read_text())

    def test_every_label_is_a_string_the_app_ships(self):
        shipped = set(self.en.values())
        for label in LABELS:
            with self.subTest(label=label):
                self.assertIn(label, shipped, 'the app no longer says this')

    def test_every_label_still_appears_in_the_guide(self):
        for label in LABELS:
            with self.subTest(label=label):
                self.assertIn(label, self.guide, 'the guide dropped this field')

    def test_the_interval_bounds_match_the_control(self):
        # The guide tells the reader 120–3600; the input enforces it.
        panel = (ROOT / 'apps/notes-app/src/app/DeviceSync.tsx').read_text()
        self.assertIn('min={120}', panel)
        self.assertIn('max={3600}', panel)
        self.assertIn('120–3600', self.guide)

    def test_the_token_command_matches_the_server_usage_line(self):
        # Argument ORDER is the part a reader cannot recover from: a swapped
        # workspace and scope produces a credential that authenticates and
        # reaches nothing.
        usage = (ROOT / 'server/notes-server/src/main.rs').read_text()
        self.assertIn('notes-server token create LABEL WORKSPACE SCOPE PERMISSIONS OUTPUT', usage)
        self.assertIn('token create laptop personal . read,create,update,move,delete', self.guide)

    def test_the_guide_is_english_but_the_panel_is_translated(self):
        # The guide is repository content and stays English (US); the Portuguese
        # reader is served by the product copy on the site. That split only holds
        # while the panel itself is actually translated.
        for key, value in self.en.items():
            if key.startswith('device.') and value in LABELS:
                with self.subTest(key=key):
                    self.assertIn(key, self.pt)
                    self.assertNotEqual(self.pt[key], '', 'untranslated device string')


if __name__ == '__main__':
    unittest.main()
