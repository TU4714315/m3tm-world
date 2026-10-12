import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(root,path),'utf8');
const files = [
  '.cursor/skills/emil-design-eng/SKILL.md',
  '.cursor/skills/animation-performance/SKILL.md',
  '.cursor/rules/m3tm-sovereign-v7.mdc',
  'docs/DESIGN_TOOLKIT_V7.md',
  'docs/third-party/emil-skills-MIT.txt',
  'tools/design-v7/install-impeccable.ps1',
];
for (const file of files) {
  assert.ok(existsSync(resolve(root, file)), 'Missing design toolkit file: ' + file);
}
assert.match(read(files[0]), /^---\nname: emil-design-eng/m);
assert.match(read(files[1]), /^---\nname: animation-performance/m);
for (const file of files.slice(0, 2)) assert.match(read(file), /M3TM policy:/);
assert.match(read(files[2]), /alwaysApply:\s*true/);
assert.match(read(files[4]), /MIT License/);
const setup = read(files[5]);
assert.match(setup, /impeccable@4\.5\.2/);
assert.match(setup, /--no-hooks/);
assert.match(setup, /if \(-not \$Execute\)/);
assert.match(setup, /-in @\("main","master"\)/);
console.log('M3TM V7 design toolkit: files, provenance, and safe installer contract OK.');
