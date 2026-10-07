import { mkdir, open, readFile, rename, unlink, writeFile, chmod, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { secureWindowsPath as defaultSecureWindowsPath } from './windows-acl.mjs';

export function dataDirectory({ platform = process.platform, home = homedir(), env = process.env } = {}) {
  if (platform === 'win32') return join(env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'canva-mcp-oauth');
  if (platform === 'darwin') return join(home, 'Library', 'Application Support', 'canva-mcp-oauth');
  return join(env.XDG_STATE_HOME || join(home, '.local', 'state'), 'canva-mcp-oauth');
}

export function createStore({ directory = dataDirectory(), lockTimeoutMs = 10_000, platform = process.platform, secureWindowsPath = defaultSecureWindowsPath } = {}) {
  const file = join(directory, 'credentials.json');
  const lock = join(directory, 'credentials.lock');
  async function ensure() {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if (platform === 'win32') await secureWindowsPath(directory);
    else await chmod(directory, 0o700);
  }
  async function read() {
    try { return JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, '')); }
    catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
  }
  async function write(value) {
    await ensure();
    const temporary = join(directory, `.credentials-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
      await rename(temporary, file);
      if (platform === 'win32') await secureWindowsPath(file);
      else await chmod(file, 0o600);
    } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
  async function withLock(fn) {
    await ensure();
    const started = Date.now();
    let handle;
    const nonce = randomUUID();
    while (!handle) {
      try { handle = await open(lock, 'wx', 0o600); await handle.writeFile(JSON.stringify({ pid: process.pid, nonce })); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        try {
          const age = Date.now() - (await stat(lock)).mtimeMs;
          if (age > 30_000) {
            const owner = JSON.parse(await readFile(lock, 'utf8'));
            let alive = true;
            if (Number.isSafeInteger(owner.pid) && owner.pid > 0) {
              try { process.kill(owner.pid, 0); }
              catch (failure) { if (failure.code === 'ESRCH') alive = false; }
            }
            if (!alive) await unlink(lock);
          }
        } catch (failure) { if (failure.code !== 'ENOENT' && !(failure instanceof SyntaxError)) throw failure; }
        if (Date.now() - started > lockTimeoutMs) throw new Error('Timed out waiting for credential lock');
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }
    try { return await fn(); }
    finally {
      await handle.close();
      try { if (JSON.parse(await readFile(lock, 'utf8')).nonce === nonce) await unlink(lock); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  return { read, write, withLock, directory };
}
