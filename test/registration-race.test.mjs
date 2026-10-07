import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../src/store.mjs';
import { createOAuth } from '../src/oauth.mjs';

const metadata = { issuer: 'https://mcp.canva.com', authorization_endpoint: 'https://mcp.canva.com/authorize', registration_endpoint: 'https://mcp.canva.com/register', token_endpoint: 'https://mcp.canva.com/token', code_challenge_methods_supported: ['S256'] };

test('refresh keeps original client ID when a new login registers another client', async () => {
  const store = createStore({ directory: await mkdtemp(join(tmpdir(), 'canva-registration-')) });
  await store.write({ client: { client_id: 'old-client', redirect_uri: 'http://127.0.0.1:1/callback' }, tokens: { access_token: 'expired', refresh_token: 'old-refresh', expires_at: 1, client_id: 'old-client' } });
  let refreshClientId;
  const fetchImpl = async (url, options = {}) => {
    if (String(url).endsWith('/.well-known/oauth-authorization-server')) return Response.json(metadata);
    if (String(url).endsWith('/register')) return Response.json({ client_id: 'new-client' });
    if (String(url).endsWith('/token')) {
      refreshClientId = new URLSearchParams(options.body).get('client_id');
      return Response.json({ access_token: 'fresh', refresh_token: 'rotated', token_type: 'Bearer', expires_in: 3600 });
    }
    throw Error('Unexpected endpoint');
  };
  const oauth = createOAuth({ store, fetchImpl, now: () => 100000 });
  await oauth.begin('http://127.0.0.1:2/callback');
  assert.equal(await oauth.getToken(), 'fresh');
  assert.equal(refreshClientId, 'old-client');
});
