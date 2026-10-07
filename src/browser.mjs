import { spawn } from 'node:child_process';

export async function openBrowser(url, { platform = process.platform, spawnImpl = spawn } = {}) {
  const executable = platform === 'win32' ? 'explorer.exe' : platform === 'darwin' ? 'open' : 'xdg-open';
  await new Promise((resolve, reject) => {
    const child = spawnImpl(executable, [url], { shell: false, detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}
