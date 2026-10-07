import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('npm test uses Node discovery rather than a shell glob', () => {
  assert.equal(manifest.scripts.test, 'node --test');
});
