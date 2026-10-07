import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore, dataDirectory } from '../src/store.mjs';

test('resolves private state directory on Windows, macOS and Linux', () => {
  assert.equal(dataDirectory({ platform: 'win32', home: '/home/a', env: { LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' } }), join('C:\\Users\\a\\AppData\\Local', 'canva-mcp-oauth'));
  assert.equal(dataDirectory({ platform: 'darwin', home: '/Users/a', env: {} }), join('/Users/a', 'Library', 'Application Support', 'canva-mcp-oauth'));
  assert.equal(dataDirectory({ platform: 'linux', home: '/home/a', env: { XDG_STATE_HOME: '/state/a' } }), join('/state/a', 'canva-mcp-oauth'));
  assert.equal(dataDirectory({ platform: 'linux', home: '/home/a', env: {} }), join('/home/a', '.local', 'state', 'canva-mcp-oauth'));
});

test('atomically persists JSON without temporary files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'canva-stdio-store-'));
  const store = createStore({ directory });
  assert.deepEqual(await store.read(), {});
  await store.write({ tokens: { access_token: 'test' } });
  assert.deepEqual(await store.read(), { tokens: { access_token: 'test' } });
  assert.deepEqual(await readdir(directory), ['credentials.json']);
});

test('separate instances serialize updates under shared lock', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'canva-stdio-lock-'));
  const stores = [createStore({ directory }), createStore({ directory })];
  await Promise.all(stores.map(store => store.withLock(async () => {
    const data = await store.read();
    await new Promise(resolve => setTimeout(resolve, 20));
    await store.write({ count: (data.count ?? 0) + 1 });
  })));
  assert.equal((await stores[0].read()).count, 2);
});
