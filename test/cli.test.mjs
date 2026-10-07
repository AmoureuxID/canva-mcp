import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from '../src/cli.mjs';

test('status reports login state to stderr without leaking tokens', async () => {
  const output = [];
  await runCli(['status'], { oauth: { status: async () => false }, stderr: text => output.push(text) });
  assert.match(output.join(' '), /not connected/i);
  assert.match(output.join(' '), /canva-mcp login/);
  assert.doesNotMatch(output.join(' '), /canva-mcp-oauth login/);
});

test('serve connects stdio transport without writing human output', async () => {
  const output = [];
  let connected = false;
  await runCli(['serve'], { oauth: { status: async () => true }, bridgeFactory: () => ({ connect: async () => { connected = true; } }), stdioFactory: () => ({}), stderr: text => output.push(text) });
  assert.equal(connected, true);
  assert.deepEqual(output, []);
});
