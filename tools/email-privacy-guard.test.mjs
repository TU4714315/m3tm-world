import test from 'node:test';
import assert from 'node:assert/strict';
import { findAddedPrivateEmails } from './email-privacy-guard.mjs';

const privateEmail = ['private.person', 'gmail.com'].join('@');
const patch = (lines) => [
  'diff --git a/docs/example.md b/docs/example.md',
  '--- a/docs/example.md',
  '+++ b/docs/example.md',
  '@@ -0,0 +1,9 @@',
  ...lines,
].join('\n');

test('flags only newly added personal email without printing it', () => {
  const found = findAddedPrivateEmails(patch([
    '+A new private contact: ' + privateEmail,
    '+Public example: documentation@example.org',
  ]));
  assert.deepEqual(found, [{ path: 'docs/example.md', line: 1 }]);
});

test('accepts GitHub noreply and reserved example addresses', () => {
  assert.deepEqual(findAddedPrivateEmails(patch([
    '+noreply@github.com',
    '+123456+developer@users.noreply.github.com',
    '+documentation@example.com',
    '+git@github.com',
  ])), []);
});

test('ignores deleted lines and reports no email values', () => {
  assert.deepEqual(findAddedPrivateEmails(patch([
    '-' + privateEmail,
    '+There is no exposed address in this line',
  ])), []);
});

test('catches one-character email identifiers', () => {
  const shortEmail = ['a', 'gmail.com'].join('@');
  assert.equal(findAddedPrivateEmails(patch(['+' + shortEmail])).length, 1);
});
