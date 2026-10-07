import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createCanvaBridge } from '../src/bridge.mjs';

test('simultaneous initial requests share one upstream connection', async () => {
  let connections = 0;
  const upstream = new Server({ name: 'remote', version: '1' }, { capabilities: { tools: {} } });
  upstream.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
  const bridge = createCanvaBridge({ oauth: { getToken: async () => 'same-token' }, transportFactory: () => {
    connections++;
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    setTimeout(() => upstream.connect(serverTransport).catch(() => {}), 25);
    return clientTransport;
  } });
  const [serverTransport, localTransport] = InMemoryTransport.createLinkedPair();
  await bridge.connect(serverTransport);
  const local = new Client({ name: 'local', version: '1' });
  await local.connect(localTransport);
  try {
    await Promise.all([local.listTools(), local.listTools()]);
    assert.equal(connections, 1);
  } finally { await local.close(); await bridge.close(); await upstream.close(); }
});
