import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../src/store.mjs';
import { createOAuth } from '../src/oauth.mjs';

const metadata = { issuer: 'https://mcp.canva.com', authorization_endpoint: 'https://mcp.canva.com/authorize', registration_endpoint: 'https://mcp.canva.com/register', token_endpoint: 'https://mcp.canva.com/token', code_challenge_methods_supported: ['S256'] };

test('hung refresh times out, releases lock and retains retryable credentials', async () => {
  const store = createStore({ directory: await mkdtemp(join(tmpdir(), 'canva-timeout-')), lockTimeoutMs: 500 });
  await store.write({ client: { client_id: 'client' }, tokens: { access_token: 'expired', refresh_token: 'valid', expires_at: 1 } });
  const fetchImpl = async (url, options = {}) => {
    if (String(url).endsWith('/.well-known/oauth-authorization-server')) return Response.json(metadata);
    return new Promise((_, reject) => {
      options.signal?.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    });
  };
  const oauth = createOAuth({ store, fetchImpl, now: () => 100_000, requestTimeoutMs: 40 });
  await assert.rejects(oauth.getToken(), /timed out/i);
  assert.equal((await store.read()).tokens.refresh_token, 'valid');
  assert.equal(await store.withLock(async () => 'released'), 'released');
});
