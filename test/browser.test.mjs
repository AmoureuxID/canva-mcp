import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openBrowser } from '../src/browser.mjs';

test('opens browser without shell interpolation on Windows, macOS and Linux', async () => {
  for (const [platform, executable] of [['win32', 'explorer.exe'], ['darwin', 'open'], ['linux', 'xdg-open']]) {
    const invoked = [];
    await openBrowser('https://mcp.canva.com/authorize?state=test', { platform, spawnImpl: (command, args, options) => { invoked.push({ command, args, options }); return { once(event, callback) { if (event === 'spawn') queueMicrotask(callback); }, unref() {} }; } });
    assert.equal(invoked[0].command, executable);
    assert.deepEqual(invoked[0].args, ['https://mcp.canva.com/authorize?state=test']);
    assert.equal(invoked[0].options.shell, false);
  }
});
