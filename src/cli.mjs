import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createStore } from './store.mjs';
import { createOAuth } from './oauth.mjs';
import { createCanvaBridge } from './bridge.mjs';
import { openBrowser } from './browser.mjs';

export async function runCli(argv, { oauth = createOAuth({ store: createStore() }), bridgeFactory = createCanvaBridge, stdioFactory = () => new StdioServerTransport(), stderr = text => console.error(text), open = openBrowser } = {}) {
  const [command] = argv;
  switch (command) {
    case 'login':
      await oauth.authorize({ openBrowser: open, output: stderr });
      stderr('Canva connected. Add the stdio server to your MCP client.');
      return;
    case 'serve':
      await bridgeFactory({ oauth }).connect(stdioFactory());
      return;
    case 'status':
      stderr((await oauth.status()) ? 'Canva connected (local credentials).' : 'Canva not connected. Run `canva-mcp login`.');
      return;
    case 'logout':
      await oauth.logout();
      stderr('Local Canva credentials removed. Revoke app access separately in Canva settings if needed.');
      return;
    default:
      stderr('Usage: canva-mcp login|serve|status|logout');
      throw new Error('Unknown command');
  }
}
