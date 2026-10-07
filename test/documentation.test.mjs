import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('README contains the complete single-file setup guide', async () => {
  const readme = await readFile(resolve(root, 'README.md'), 'utf8');
  assert.ok((await stat(resolve(root, 'assets/canva-mcp-oauth-banner.svg'))).isFile());
  assert.match(readme, /src="assets\/canva-mcp-oauth-banner\.svg"[^>]*alt="[^"]+"/);
  for (const heading of [
    'Requirements', 'Install and sign in', 'Configure a stdio MCP client',
    'Commands', 'Permissions and credential storage', 'Give the setup task to an AI agent',
    'Troubleshooting', 'Local checks and npm release'
  ]) assert.ok(readme.includes(`## ${heading}`), `Missing README section: ${heading}`);
  assert.match(readme, /Both reading and writing must be confirmed by real tool results/);
  assert.match(readme, /read and edited text on an isolated test copy/i);
  assert.match(readme, /https:\/\/www\.npmjs\.com\/package\/canva-mcp/);
  assert.match(readme, /npm install --global canva-mcp\s+canva-mcp login\s+canva-mcp status/);
  assert.match(readme, /npm install --global \./);
  assert.doesNotMatch(readme, /GUIDE\.md|publication pending|not published|grant is read-only|read-only scopes|read-only OAuth/i);
  await assert.rejects(stat(resolve(root, 'GUIDE.md')), { code: 'ENOENT' });
});
