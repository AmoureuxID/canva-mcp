import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
test('package allowlist excludes credentials and includes runnable files', async () => {
  const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  assert.deepEqual(manifest.files, ['bin/', 'src/', 'assets/', 'README.md', 'GUIDE.md', 'LICENSE']);
  assert.equal(manifest.name, 'canva-mcp');
  assert.equal(manifest.version, '0.1.0');
  assert.deepEqual(manifest.bin, { 'canva-mcp': './bin/canva-mcp-stdio.mjs' });
  assert.equal(Object.hasOwn(manifest, 'private'), false);
  assert.equal(manifest.repository.url, 'https://github.com/AmoureuxID/canva-mcp.git');
  assert.deepEqual(manifest.publishConfig, { access: 'public', registry: 'https://registry.npmjs.org/' });
  for (const name of ['bin/canva-mcp-stdio.mjs', 'README.md', 'LICENSE']) assert.ok((await stat(resolve(root, name))).isFile());
});
