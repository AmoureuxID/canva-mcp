import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stat } from 'node:fs/promises';

const run = promisify(execFile);
export async function secureWindowsPath(path) {
  const username = process.env.USERDOMAIN && process.env.USERNAME ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}` : process.env.USERNAME;
  if (!username) throw new Error('Cannot identify Windows user for credential ACL');
  try {
    const isDirectory = (await stat(path)).isDirectory();
    const rights = isDirectory ? '(OI)(CI)F' : 'F';
    await run('icacls.exe', [path, '/inheritance:r', '/grant:r', `${username}:${rights}`, `SYSTEM:${rights}`], { windowsHide: true });
  } catch { throw new Error('Cannot secure Canva credential permissions on Windows'); }
}
