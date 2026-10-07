import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../src/store.mjs';
import { createOAuth } from '../src/oauth.mjs';

async function setup({ badIssuer = false } = {}) {
  const store = createStore({ directory: await mkdtemp(join(tmpdir(), 'canva-oauth-')) });
  let now = 1_000_000;
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const address = String(url);
    calls.push({ address, options });
    if (address.endsWith('/.well-known/oauth-authorization-server')) return Response.json({ issuer: badIssuer ? 'https://evil.invalid' : 'https://mcp.canva.com', authorization_endpoint: 'https://mcp.canva.com/authorize', registration_endpoint: 'https://mcp.canva.com/register', token_endpoint: 'https://mcp.canva.com/token', code_challenge_methods_supported: ['S256'] });
    if (address.endsWith('/register')) return Response.json({ client_id: 'client-1' });
    if (address.endsWith('/token')) {
      const grant = new URLSearchParams(options.body).get('grant_type');
      return Response.json({ access_token: grant === 'refresh_token' ? 'new-access' : 'old-access', refresh_token: grant === 'refresh_token' ? 'rotated' : 'initial-refresh', expires_in: 120, token_type: 'Bearer' });
    }
    throw Error('Unexpected endpoint');
  };
  return { store, calls, oauth: createOAuth({ store, fetchImpl, now: () => now }), advance(ms) { now += ms; } };
}

test('authorization registers exact ephemeral redirect and uses PKCE S256', async () => {
  const f = await setup();
  const pending = await f.oauth.begin('http://127.0.0.1:38888/callback');
  const url = new URL(pending.url);
  const data = await f.store.read();
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(data.pending.verifier).digest('base64url'));
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.deepEqual(JSON.parse(f.calls.find(c => c.address.endsWith('/register')).options.body).redirect_uris, ['http://127.0.0.1:38888/callback']);
  await assert.rejects(f.oauth.complete('code', 'bad'), /state/i);
  await f.oauth.complete('code', pending.state);
  await assert.rejects(f.oauth.complete('code', pending.state), /state/i);
  assert.equal(await f.oauth.getToken(), 'old-access');
});

test('rejects untrusted OAuth discovery issuer', async () => {
  const f = await setup({ badIssuer: true });
  await assert.rejects(f.oauth.begin('http://127.0.0.1:38888/callback'), /issuer/i);
});

test('two instances coalesce refresh through persistent lock', async () => {
  const f = await setup();
  const { state } = await f.oauth.begin('http://127.0.0.1:38888/callback');
  await f.oauth.complete('code', state);
  f.advance(100_000);
  const another = createOAuth({ store: createStore({ directory: f.store.directory }), fetchImpl: async (url, options = {}) => {
    f.calls.push({ address: String(url), options });
    if (String(url).endsWith('/token')) return Response.json({ access_token: 'new-access', refresh_token: 'rotated', expires_in: 120, token_type: 'Bearer' });
    return Response.json({ issuer: 'https://mcp.canva.com', authorization_endpoint: 'https://mcp.canva.com/authorize', registration_endpoint: 'https://mcp.canva.com/register', token_endpoint: 'https://mcp.canva.com/token', code_challenge_methods_supported: ['S256'] });
  }, now: () => 1_100_000 });
  assert.deepEqual(await Promise.all([f.oauth.getToken(), another.getToken()]), ['new-access', 'new-access']);
  assert.equal(f.calls.filter(c => c.address.endsWith('/token')).length, 2);
  assert.equal((await f.store.read()).tokens.refresh_token, 'rotated');
});
