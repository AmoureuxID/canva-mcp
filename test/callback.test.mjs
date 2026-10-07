import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../src/store.mjs';
import { createOAuth } from '../src/oauth.mjs';

function discovery(url, options = {}) {
  if (String(url).endsWith('/.well-known/oauth-authorization-server')) return Promise.resolve(Response.json({ issuer: 'https://mcp.canva.com', authorization_endpoint: 'https://mcp.canva.com/authorize', registration_endpoint: 'https://mcp.canva.com/register', token_endpoint: 'https://mcp.canva.com/token', code_challenge_methods_supported: ['S256'] }));
  if (String(url).endsWith('/register')) return Promise.resolve(Response.json({ client_id: 'test-client' }));
  if (String(url).endsWith('/token')) return Promise.resolve(Response.json({ access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'Bearer', expires_in: 3600 }));
  throw Error(`Unexpected URL: ${url}`);
}

test('temporary callback accepts matching state and rejects replay', async () => {
  const store = createStore({ directory: await mkdtemp(join(tmpdir(), 'canva-callback-')) });
  const oauth = createOAuth({ store, fetchImpl: discovery });
  let callbackStatus;
  await oauth.authorize({ openBrowser: async url => {
    const authorization = new URL(url);
    const callback = new URL(authorization.searchParams.get('redirect_uri'));
    callback.searchParams.set('code', 'test-code');
    callback.searchParams.set('state', authorization.searchParams.get('state'));
    const response = await fetch(callback);
    callbackStatus = response.status;
  }, timeoutMs: 2000 });
  assert.equal(callbackStatus, 200);
  assert.equal(await oauth.getToken(), 'test-token');
  assert.equal((await store.read()).pending, undefined);
});

test('invalid callback cannot abort legitimate authorization', async () => {
  const store = createStore({ directory: await mkdtemp(join(tmpdir(), 'canva-callback-')) });
  const oauth = createOAuth({ store, fetchImpl: discovery });
  await oauth.authorize({ openBrowser: async url => {
    const authorization = new URL(url);
    const callback = new URL(authorization.searchParams.get('redirect_uri'));
    callback.searchParams.set('code', 'test-code');
    callback.searchParams.set('state', 'wrong');
    assert.equal((await fetch(callback)).status, 400);
    callback.searchParams.set('state', authorization.searchParams.get('state'));
    assert.equal((await fetch(callback)).status, 200);
  }, timeoutMs: 2000 });
  assert.equal(await oauth.getToken(), 'test-token');
});
