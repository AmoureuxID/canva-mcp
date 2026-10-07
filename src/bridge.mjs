import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const CANVA = 'https://mcp.canva.com/mcp';

export function createCanvaBridge({ oauth, upstreamClient, transportFactory } = {}) {
  const server = new Server({ name: 'canva-mcp', version: '0.1.0' }, { capabilities: { tools: {}, resources: {} } });
  let remote = upstreamClient;
  let connectedToken;
  let connecting;
  async function upstream() {
    let token;
    try { token = await oauth.getToken(); }
    catch { throw new McpError(ErrorCode.InvalidRequest, 'Canva login required. Run `canva-mcp login`.'); }
    if (upstreamClient) return upstreamClient;
    if (remote && connectedToken === token) return remote;
    if (connecting) return connecting;
    connecting = (async () => {
      const transport = transportFactory ? transportFactory(token) : new StreamableHTTPClientTransport(new URL(CANVA), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
      const next = new Client({ name: 'canva-mcp', version: '0.1.0' });
      const previousClose = transport.onclose;
      transport.onclose = () => {
        previousClose?.();
        if (remote === next) { remote = undefined; connectedToken = undefined; }
      };
      try { await next.connect(transport); }
      catch { await next.close().catch(() => {}); throw new McpError(ErrorCode.InternalError, 'Cannot connect to Canva MCP. Check login and network.'); }
      const previous = remote;
      remote = next;
      connectedToken = token;
      if (previous) await previous.close();
      return next;
    })().finally(() => { connecting = undefined; });
    return connecting;
  }
  server.setRequestHandler(ListToolsRequestSchema, async request => (await upstream()).listTools(request.params));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => (await upstream()).callTool(request.params, undefined, { signal: extra.signal }));
  server.setRequestHandler(ListResourcesRequestSchema, async request => (await upstream()).listResources(request.params));
  server.setRequestHandler(ReadResourceRequestSchema, async request => (await upstream()).readResource(request.params));
  return { connect: transport => server.connect(transport), async close() { await server.close(); if (remote && !upstreamClient) await remote.close(); } };
}
