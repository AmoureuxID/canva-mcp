import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('repository overview links to a real banner and complete guide', async () => {
  const readme = await readFile(resolve(root, 'README.md'), 'utf8');
  const guide = await readFile(resolve(root, 'GUIDE.md'), 'utf8');
  assert.ok((await stat(resolve(root, 'assets/canva-mcp-oauth-banner.svg'))).isFile());
  assert.match(readme, /src="assets\/canva-mcp-oauth-banner\.svg"[^>]*alt="[^"]+"/);
  for (const anchor of ['configure-a-stdio-mcp-client', 'give-the-setup-task-to-an-ai-agent', 'troubleshooting', 'permissions-and-credential-storage', 'local-checks-and-npm-release']) {
    assert.ok(readme.includes(`GUIDE.md#${anchor}`));
  }
  assert.match(guide, /Both reading and writing must be confirmed by real tool results/);
  assert.match(readme, /read and edited text on an isolated test copy/i);
  assert.doesNotMatch(readme + guide, /grant is read-only|read-only scopes|read-only OAuth|do not request\s+write scopes or modify designs/i);
  assert.match(readme, /https:\/\/www\.npmjs\.com\/package\/canva-mcp/);
  assert.doesNotMatch(readme, /publication pending|not published/i);
  assert.doesNotMatch(guide, /publication is pending|before publication|after .* appears on npmjs\.com/i);
  assert.match(readme, /npm install --global canva-mcp\s+canva-mcp login\s+canva-mcp status/);
  assert.match(guide, /npm install --global canva-mcp\s+canva-mcp login\s+canva-mcp status/);
  assert.match(guide, /npm install --global \./);
  assert.doesNotMatch(readme, /canva-mcp-oauth@0\.1\.0/);
});
