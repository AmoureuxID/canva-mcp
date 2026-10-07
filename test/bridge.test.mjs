import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createCanvaBridge } from '../src/bridge.mjs';

test('forwards tools and resources with their real SDK schemas', async () => {
  const upstream = new Server({ name: 'fake-canva', version: '1' }, { capabilities: { tools: {}, resources: {} } });
  upstream.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [{ name: 'echo', description: 'Echo', inputSchema: { type: 'object', properties: { value: { type: 'string' } } } }] }));
  upstream.setRequestHandler(CallToolRequestSchema, async request => ({ content: [{ type: 'text', text: request.params.arguments.value }] }));
  upstream.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [{ uri: 'canva://one', name: 'One' }] }));
  upstream.setRequestHandler(ReadResourceRequestSchema, async request => ({ contents: [{ uri: request.params.uri, text: 'resource text' }] }));
  const [upTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await upstream.connect(upTransport);
  const remote = new Client({ name: 'bridge-test', version: '1' });
  await remote.connect(clientTransport);
  const bridge = createCanvaBridge({ oauth: { getToken: async () => 'test' }, upstreamClient: remote });
  const [serverTransport, localTransport] = InMemoryTransport.createLinkedPair();
  await bridge.connect(serverTransport);
  const local = new Client({ name: 'local-test', version: '1' });
  await local.connect(localTransport);
  try {
    assert.equal((await local.listTools()).tools[0].name, 'echo');
    assert.equal((await local.callTool({ name: 'echo', arguments: { value: 'hello' } })).content[0].text, 'hello');
    assert.equal((await local.listResources()).resources[0].uri, 'canva://one');
    assert.equal((await local.readResource({ uri: 'canva://one' })).contents[0].text, 'resource text');
  } finally { await local.close(); await bridge.close(); await remote.close(); await upstream.close(); }
});
