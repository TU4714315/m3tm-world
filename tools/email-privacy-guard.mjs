import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Prevent newly added personal email addresses in this public repository.
// Do not print matching addresses to CI logs.
const EMAIL_PATTERN = /[A-Z0-9_][A-Z0-9.!#$%&'*+/=?^`{|}~-]*@(?:[A-Z0-9-]+\.)+[A-Z]{2,}/gi;
const PLACEHOLDER_DOMAINS = new Set(['example.com', 'example.net', 'example.org', 'example.invalid']);
const SAFE_GIT_ADDRESSES = new Set(['noreply@github.com', 'git@github.com']);

function isPublicPlaceholder(address) {
  const normalized = address.toLowerCase();
  const domain = normalized.slice(normalized.lastIndexOf('@') + 1);
  return PLACEHOLDER_DOMAINS.has(domain)
    || domain.endsWith('.example')
    || domain.endsWith('.invalid')
    || domain.endsWith('.test')
    || normalized.endsWith('@users.noreply.github.com')
    || SAFE_GIT_ADDRESSES.has(normalized);
}

export function findAddedPrivateEmails(diff) {
  const findings = [];
  let filename = '';
  let lineNumber = 0;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) {
      filename = line.slice(6);
      continue;
    }
    if (line.startsWith('@@ ')) {
      const match = line.match(/\+(\d+)/);
      lineNumber = match ? Number(match[1]) : 0;
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++') && filename) {
      for (const match of line.slice(1).matchAll(EMAIL_PATTERN)) {
        if (!isPublicPlaceholder(match[0])) {
          findings.push({ path: filename, line: lineNumber });
        }
      }
      lineNumber++;
    } else if (line.startsWith(' ')) {
      lineNumber++;
    }
  }
  return findings;
}

function run() {
  const base = process.env.BASE_SHA;
  const head = process.env.HEAD_SHA;
  const validSha = /^[a-f0-9]{40}$/i;
  if (!validSha.test(base || '') || !validSha.test(head || '')) {
    throw new Error('Missing valid base/head SHAs; refusing to silently skip privacy scan');
  }
  const patch = execFileSync('git', ['diff', '--no-ext-diff', '--unified=0', base, head, '--'], {
    encoding: 'utf8', maxBuffer: 40 * 1024 * 1024,
  });
  const findings = findAddedPrivateEmails(patch);
  if (findings.length) {
    for (const f of findings) {
      // Path and line number only: never echo the sensitive value.
      console.error(`::error file=${f.path},line=${f.line}::Potential personal email added to public Git history. Replace it with a placeholder or private configuration.`);
    }
    console.error(`Privacy scan blocked ${findings.length} potential exposure(s); values are deliberately withheld.`);
    process.exitCode = 1;
  } else {
    console.log('Privacy scan passed: no newly added personal email addresses detected.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
