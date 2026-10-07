import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createCanvaBridge } from '../src/bridge.mjs';

test('reconnects after upstream transport unexpectedly closes', async () => {
  const upstream = new Server({ name: 'remote', version: '1' }, { capabilities: { tools: {} } });
  upstream.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
  const connections = [];
  const bridge = createCanvaBridge({ oauth: { getToken: async () => 'same-token' }, transportFactory: () => {
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    connections.push({ serverTransport, clientTransport });
    setTimeout(() => upstream.connect(serverTransport).catch(() => {}), 0);
    return clientTransport;
  } });
  const [serverTransport, localTransport] = InMemoryTransport.createLinkedPair();
  await bridge.connect(serverTransport);
  const local = new Client({ name: 'local', version: '1' });
  await local.connect(localTransport);
  try {
    await local.listTools();
    await connections[0].clientTransport.close();
    await local.listTools();
    assert.equal(connections.length, 2);
  } finally { await local.close(); await bridge.close(); await upstream.close(); }
});
