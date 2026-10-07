import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.mjs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('Windows storage applies an explicit restrictive ACL before persisting tokens', async () => {
  const directory = join(await mkdtemp(join(tmpdir(), 'canva-acl-')), 'state');
  const calls = [];
  const store = createStore({ directory, platform: 'win32', secureWindowsPath: async path => { calls.push(path); } });
  await store.write({ tokens: { access_token: 'test' } });
  assert.ok(calls.includes(directory));
  assert.ok(calls.includes(join(directory, 'credentials.json')));
});
