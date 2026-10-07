import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../src/store.mjs';
import { createOAuth } from '../src/oauth.mjs';

const metadata = { issuer: 'https://mcp.canva.com', authorization_endpoint: 'https://mcp.canva.com/authorize', registration_endpoint: 'https://mcp.canva.com/register', token_endpoint: 'https://mcp.canva.com/token', code_challenge_methods_supported: ['S256'] };

test('begin login cannot resurrect stale token after concurrent refresh', async () => {
  const store = createStore({ directory: await mkdtemp(join(tmpdir(), 'canva-race-')) });
  await store.write({ client: { client_id: 'old', redirect_uri: 'http://127.0.0.1:1/callback' }, tokens: { access_token: 'expired', refresh_token: 'old-refresh', expires_at: 1 } });
  let registrationStarted, resumeRegistration;
  const started = new Promise(resolve => { registrationStarted = resolve; });
  const resume = new Promise(resolve => { resumeRegistration = resolve; });
  const fetchImpl = async (url, options = {}) => {
    if (String(url).endsWith('/.well-known/oauth-authorization-server')) return Response.json(metadata);
    if (String(url).endsWith('/register')) { registrationStarted(); await resume; return Response.json({ client_id: 'new-client' }); }
    if (String(url).endsWith('/token')) return Response.json({ access_token: 'fresh', refresh_token: 'rotated', token_type: 'Bearer', expires_in: 3600 });
    throw Error('Unexpected URL');
  };
  const oauth = createOAuth({ store, fetchImpl, now: () => 100000 });
  const beginning = oauth.begin('http://127.0.0.1:2/callback');
  await started;
  assert.equal(await oauth.getToken(), 'fresh');
  resumeRegistration();
  await beginning;
  assert.equal((await store.read()).tokens.refresh_token, 'rotated');
});

test('revoked refresh token clears local credentials', async () => {
  const store = createStore({ directory: await mkdtemp(join(tmpdir(), 'canva-revoked-')) });
  await store.write({ client: { client_id: 'client' }, tokens: { access_token: 'expired', refresh_token: 'revoked', expires_at: 1 } });
  const oauth = createOAuth({ store, now: () => 100000, fetchImpl: async url => {
    if (String(url).endsWith('/.well-known/oauth-authorization-server')) return Response.json(metadata);
    return Response.json({ error: 'invalid_grant' }, { status: 400 });
  } });
  await assert.rejects(oauth.getToken(), /login required/i);
  assert.equal((await store.read()).tokens, undefined);
});

test('temporary refresh error keeps refresh token for retry', async () => {
  const store = createStore({ directory: await mkdtemp(join(tmpdir(), 'canva-retry-')) });
  await store.write({ client: { client_id: 'client' }, tokens: { access_token: 'expired', refresh_token: 'valid', expires_at: 1 } });
  const oauth = createOAuth({ store, now: () => 100000, fetchImpl: async url => {
    if (String(url).endsWith('/.well-known/oauth-authorization-server')) return Response.json(metadata);
    throw new Error('temporary network outage');
  } });
  await assert.rejects(oauth.getToken(), /network outage/);
  assert.equal((await store.read()).tokens.refresh_token, 'valid');
});
