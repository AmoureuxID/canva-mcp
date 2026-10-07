import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

const ISSUER = 'https://mcp.canva.com';
const DEFAULT_SCOPES = ['profile:read', 'design:meta:read', 'design:content:read', 'folder:read'];
const random = () => randomBytes(32).toString('base64url');

export function createOAuth({ store, fetchImpl = fetch, now = Date.now, scopes = DEFAULT_SCOPES, requestTimeoutMs = 8_000 }) {
  async function request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    try { return await fetchImpl(url, { ...options, signal: controller.signal }); }
    catch (error) { if (controller.signal.aborted) throw new Error('Canva authorization request timed out'); throw error; }
    finally { clearTimeout(timer); }
  }
  async function metadata() {
    const response = await request(`${ISSUER}/.well-known/oauth-authorization-server`);
    if (!response.ok) throw new Error('Canva authorization metadata unavailable');
    const value = await response.json();
    if (value.issuer !== ISSUER) throw new Error('Unexpected OAuth issuer');
    if (!value.code_challenge_methods_supported?.includes('S256')) throw new Error('Canva PKCE S256 unsupported');
    for (const endpoint of ['authorization_endpoint', 'registration_endpoint', 'token_endpoint']) {
      if (new URL(value[endpoint]).origin !== ISSUER) throw new Error(`Untrusted Canva ${endpoint}`);
    }
    return value;
  }
  async function tokenRequest(parameters) {
    const meta = await metadata();
    const response = await request(meta.token_endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(parameters) });
    if (!response.ok) {
      if (response.status === 400) {
        const body = await response.json().catch(() => ({}));
        if (body.error === 'invalid_grant') {
          const error = new Error('Canva authorization grant revoked');
          error.code = 'INVALID_GRANT';
          throw error;
        }
      }
      throw new Error(`Canva authorization failed (${response.status})`);
    }
    const token = await response.json();
    if (!token.access_token || token.token_type?.toLowerCase() !== 'bearer' || !(Number(token.expires_in) > 0)) throw new Error('Invalid Canva token response');
    return token;
  }
  async function begin(redirectUri) {
    const redirect = new URL(redirectUri);
    if (redirect.protocol !== 'http:' || redirect.hostname !== '127.0.0.1' || redirect.pathname !== '/callback') throw new Error('Invalid OAuth loopback redirect');
    const meta = await metadata();
    const data = await store.read();
    let client = data.client;
    if (!client || client.redirect_uri !== redirectUri) {
      const response = await request(meta.registration_endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'Canva MCP stdio connector', redirect_uris: [redirectUri], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }) });
      if (!response.ok) throw new Error(`Canva client registration failed (${response.status})`);
      client = { ...(await response.json()), redirect_uri: redirectUri };
      if (!client.client_id) throw new Error('Canva client registration returned no ID');
    }
    const verifier = random(), state = random();
    await store.withLock(async () => {
      const current = await store.read();
      await store.write({ ...current, client, pending: { verifier, state, redirectUri, expires_at: now() + 600_000, client_id: client.client_id } });
    });
    const url = new URL(meta.authorization_endpoint);
    for (const [key, value] of Object.entries({ response_type: 'code', client_id: client.client_id, redirect_uri: redirectUri, scope: scopes.join(' '), state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' })) url.searchParams.set(key, value);
    return { url: url.href, state };
  }
  async function complete(code, state) {
    return store.withLock(async () => {
      const data = await store.read();
      const pending = data.pending;
      if (!code || !state || !pending || pending.state !== state || pending.expires_at < now()) throw new Error('Invalid or expired OAuth state');
      const { pending: omitted, ...rest } = data;
      await store.write(rest);
      const token = await tokenRequest({ grant_type: 'authorization_code', client_id: pending.client_id, redirect_uri: pending.redirectUri, code, code_verifier: pending.verifier });
      await store.write({ ...rest, tokens: { ...token, client_id: pending.client_id, expires_at: now() + Number(token.expires_in) * 1000 } });
      return token;
    });
  }
  async function getToken() {
    const data = await store.read();
    if (!data.tokens?.access_token) throw new Error('Canva login required. Run `canva-mcp login`.');
    if (now() + 30_000 < data.tokens.expires_at) return data.tokens.access_token;
    return store.withLock(async () => {
      const latest = await store.read();
      if (now() + 30_000 < latest.tokens?.expires_at) return latest.tokens.access_token;
      if (!latest.tokens?.refresh_token) throw new Error('Canva login required.');
      try {
        const token = await tokenRequest({ grant_type: 'refresh_token', client_id: latest.tokens.client_id || latest.client.client_id, refresh_token: latest.tokens.refresh_token });
        const updated = { ...latest, tokens: { ...token, client_id: latest.tokens.client_id || latest.client.client_id, refresh_token: token.refresh_token || latest.tokens.refresh_token, expires_at: now() + Number(token.expires_in) * 1000 } };
        await store.write(updated);
        return updated.tokens.access_token;
      } catch (error) {
        if (error.code === 'INVALID_GRANT') {
          const { tokens, ...rest } = latest;
          await store.write(rest);
          throw new Error('Canva login required: refresh token revoked.');
        }
        throw error;
      }
    });
  }
  async function status() { return Boolean((await store.read()).tokens?.refresh_token); }
  async function logout() { await store.withLock(async () => { const { tokens, pending, ...rest } = await store.read(); await store.write(rest); }); }
  async function authorize({ openBrowser, output = () => {}, timeoutMs = 600_000 } = {}) {
    let finish, rejectFinish;
    const finished = new Promise((resolve, reject) => { finish = resolve; rejectFinish = reject; });
    finished.catch(() => {});
    let expectedState;
    const server = createServer(async (request, response) => {
      if (!/^127\.0\.0\.1:\d+$/.test(request.headers.host || '') || request.headers.origin || new URL(request.url, 'http://127.0.0.1').pathname !== '/callback') { response.writeHead(403).end('Forbidden'); return; }
      const query = new URL(request.url, 'http://127.0.0.1').searchParams;
      if (!expectedState || query.get('state') !== expectedState) { response.writeHead(400).end('Invalid authorization state.'); return; }
      try {
        if (query.has('error')) throw new Error('Canva authorization denied');
        await complete(query.get('code'), expectedState);
        response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end('Canva connected. You can close this tab.');
        finish();
      } catch (error) { response.writeHead(400).end('Authorization failed. Run login again.'); rejectFinish(error); }
    });
    await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
    const redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
    try {
      const { url, state } = await begin(redirectUri);
      expectedState = state;
      output(`Open this Canva authorization URL if your browser does not open:\n${url}`);
      try { await openBrowser?.(url); } catch { output('Browser could not open automatically. Use the URL above.'); }
      let timer;
      try { await Promise.race([finished, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Canva authorization timed out')), timeoutMs); })]); }
      finally { clearTimeout(timer); }
    } finally { await new Promise(resolve => server.close(resolve)); }
  }
  return { begin, complete, getToken, status, logout, authorize };
}
