import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, utimes, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../src/store.mjs';

test('does not steal old lock held by a live process', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'canva-live-lock-'));
  const lock = join(directory, 'credentials.lock');
  await writeFile(lock, JSON.stringify({ pid: process.pid, nonce: 'owner' }));
  const old = new Date(Date.now() - 31_000);
  await utimes(lock, old, old);
  const store = createStore({ directory, lockTimeoutMs: 80 });
  await assert.rejects(store.withLock(async () => {}), /Timed out/);
  assert.equal(JSON.parse(await readFile(lock, 'utf8')).nonce, 'owner');
});

test('recovers old lock whose process no longer exists', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'canva-dead-lock-'));
  const lock = join(directory, 'credentials.lock');
  await writeFile(lock, JSON.stringify({ pid: 2147483647, nonce: 'dead' }));
  const old = new Date(Date.now() - 31_000);
  await utimes(lock, old, old);
  const store = createStore({ directory, lockTimeoutMs: 200 });
  await store.withLock(async () => {});
  await assert.rejects(stat(lock), { code: 'ENOENT' });
});
