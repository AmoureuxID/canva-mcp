<p align="center">
  <img src="assets/canva-mcp-oauth-banner.svg" alt="Canva MCP OAuth: a local bridge from an MCP client to Canva" width="100%" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-192C30" alt="MIT license" /></a>
  <a href="https://github.com/AmoureuxID/canva-mcp/actions/workflows/ci.yml"><img src="https://github.com/AmoureuxID/canva-mcp/actions/workflows/ci.yml/badge.svg" alt="GitHub Actions CI status" /></a>
</p>

<h1 align="center">Canva MCP OAuth</h1>

<p align="center">
  A local OAuth bridge from a stdio-capable MCP client to Canva's official MCP server.<br />
  Your Canva account. Your browser approval. Credentials stay with your OS user.
</p>

This independent project is not affiliated with Canva. It forwards MCP tool and resource requests, including write calls, but does not install itself into your AI client or edit a design on its own.

## Requirements

- Node.js 20.11 or newer and npm.
- Windows, macOS, or Linux with an MCP client that can start `stdio` servers. HTTP-only clients cannot use this bridge directly.
- A Canva account and a browser that can reach the temporary `127.0.0.1` callback on the computer running `login`. A browser on another device, including a laptop connecting to a VPS, cannot reach that callback without a suitable tunnel.

## Install and sign in

[`canva-mcp@0.1.0`](https://www.npmjs.com/package/canva-mcp) is available on npmjs.com:

```sh
npm install --global canva-mcp
canva-mcp login
canva-mcp status
```

To install from the repository instead:

```sh
git clone https://github.com/AmoureuxID/canva-mcp.git
cd canva-mcp
npm ci
npm install --global .
canva-mcp login
canva-mcp status
```

The trailing `.` installs the checked-out source, not a registry package. Run installation, login, and your MCP client under the same OS user. Ensure npm's global executable directory is on your `PATH`. Without a global installation, use `node bin/canva-mcp-stdio.mjs login` and `node bin/canva-mcp-stdio.mjs status` from the checkout.

`login` registers a redirect URI on a temporary `127.0.0.1` port, prints the authorization URL, and tries to open it. If the browser does not open, use that URL on the same computer. Review and approve the requested permissions yourself. A successful callback says `Canva connected. You can close this tab.` The attempt expires after ten minutes. Start a new login instead of reusing an old URL. Never send authorization URLs, callback URLs, codes, or tokens to anyone.

`status` checks for saved refresh credentials. It cannot confirm that Canva still accepts the grant; the next request may require login again.

## Configure a stdio MCP client

After npm installation, configure your client to launch `canva-mcp` with `serve`:

```json
{
  "mcpServers": {
    "canva": {
      "command": "canva-mcp",
      "args": ["serve"]
    }
  }
}
```

This is a generic example, not a promise that every client uses this schema. Use the client's documentation to locate its MCP settings. If the client cannot find `canva-mcp` on its `PATH`, supply the absolute path to the installed executable.

For a source checkout, point your client's `stdio` configuration to Node and the **absolute** path to this repository's entry point:

```json
{
  "mcpServers": {
    "canva": {
      "command": "node",
      "args": ["/absolute/path/to/canva-mcp/bin/canva-mcp-stdio.mjs", "serve"]
    }
  }
}
```

On Windows, a JSON path can use escaped backslashes such as `C:\\Users\\you\\Projects\\canva-mcp\\bin\\canva-mcp-stdio.mjs`, or forward slashes. On macOS and Linux, use the corresponding absolute POSIX path. If the client cannot find Node in its `PATH`, supply the absolute Node executable path as `command`. Restart or reload the client and inspect its Canva tool list. `serve` writes MCP protocol messages to standard output, so launch it through the client rather than as a human-facing shell command.

For a DSH client using `@deepseek-ai/dsh-mcp-client`, use `transport: stdio`, `command: node`, and `args` containing the absolute script path followed by `serve`. Do not replace an existing Canva connector without deciding to do so. This package never edits client settings automatically.

## Commands

| Command | What it does |
| --- | --- |
| `login` | Starts the OAuth browser flow for user approval. |
| `serve` | Starts the MCP stdio server for your client. |
| `status` | Reports whether local refresh credentials exist, without printing them. |
| `logout` | Removes local tokens and pending login state. |

Run `canva-mcp <command>` after global installation. From a checkout without global installation, run `node bin/canva-mcp-stdio.mjs <command>`. `logout` does not revoke access on Canva's servers; revoke the application's access separately in your Canva account settings if needed.

## Permissions and credential storage

The default OAuth request names `profile:read`, `design:meta:read`, `design:content:read`, and `folder:read`. **Do not treat those scope names as a read-only guarantee:** with this grant, the upstream server created a folder and saved a text edit on a copied test design. This bridge does not filter write tools. Canva may still deny particular actions based on account permissions. Both reading and writing must be confirmed by real tool results, not inferred from scope names or tool listings. Review each proposed write before running it.

The bridge contacts `https://mcp.canva.com` for OAuth and MCP and binds the temporary callback only to `127.0.0.1`. OAuth uses PKCE S256. Credentials are stored outside the repository for the OS user running `login`:

| OS | Data directory |
| --- | --- |
| Windows | `%LOCALAPPDATA%\\canva-mcp-oauth`, falling back to `AppData\\Local` under the user home |
| macOS | `~/Library/Application Support/canva-mcp-oauth` |
| Linux | `${XDG_STATE_HOME:-~/.local/state}/canva-mcp-oauth` |

The file is `credentials.json`. On Unix, directory and file modes are restricted. On Windows, explicit permissions are applied for the signed-in user and SYSTEM; token persistence fails if that cannot be done. Other processes with your OS account can still read your credentials. Local permissions do not protect against malware running as you. Refresh-token writes use a per-user file lock. Never commit or upload credentials or log private tool results.

## Give the setup task to an AI agent

Copy this prompt to an agent that can inspect your environment. Review its proposed configuration change before approving it. Only you approve Canva access in the browser.

```text
Set up the open-source Canva MCP OAuth bridge from
https://github.com/AmoureuxID/canva-mcp.git for my local MCP client.

Verify the package is `canva-mcp` from AmoureuxID and Node.js is 20.11 or newer.
Ask before installing `canva-mcp` globally from npmjs.com. If I prefer the
repository, clone or use a checkout, run `npm ci`, and ask before installing
with `npm install --global .`.

Read README.md and inspect my client's actual MCP configuration format. For
an npm installation, use `canva-mcp` with argument `serve`. For a source
installation, use `node`, the absolute path to `bin/canva-mcp-stdio.mjs`,
and `serve`. Show the exact settings change and get my approval first.

Tell me how to run `canva-mcp login` myself. Do not copy an OAuth URL, callback
URL, authorization code, access token, refresh token, or credentials.json into
chat, logs, or a repository. I will approve Canva access in my browser. After
I confirm login, check `status` and verify MCP initialization or tool listing
without opening a private design. Ask before changing any design and test
writes only on a copy I have approved. Report errors without secrets. Do not
replace an existing Canva connector without asking.
```

If the agent cannot access your browser or the client's configuration, it should give you the commands and settings to apply yourself. It must not claim setup is complete before verification.

## Troubleshooting

- **Browser does not open:** Use the URL printed by the still-running login process on the same computer. Start a new login after ten minutes.
- **Callback cannot be reached:** Run `login` where the browser can reach its `127.0.0.1` listener. A browser on another device or in a separate container cannot reach it directly.
- **`status` reports not connected:** Finish the browser callback under the same OS account as the MCP client. A pending authorization is not an access token.
- **The MCP client says login required:** The grant may be revoked, or the client may be running under another OS user. Run `login` again under that user's account.
- **No tools appear:** Check the actual stdio settings, executable or script path, Node version, and whether the client was restarted. Standard output must remain reserved for MCP messages.
- **A tool is listed but denied:** Canva may require permissions not granted to this account. A listed tool is not proof the action will succeed; check the response.
- **Cannot save credentials:** Check user data directory permissions. On Windows, do not bypass restrictive permissions by storing the token in your repository.

## Local checks and npm release

The GitHub workflow tests Windows, macOS, and Ubuntu on Node 20, 22, and 24. Inspect its latest result rather than inferring success from a badge or old run. To test a checkout:

```sh
npm ci
npm test
npm pack --dry-run --json
npm audit --omit=dev --audit-level=high
```

An isolated install of the published `canva-mcp@0.1.0` ran `canva-mcp status`. A live connection listed tools, read and edited text on an isolated test copy, then read the saved text back; the original design stayed unchanged. This verifies those specific read and write operations, not every advertised Canva tool or a clean-machine login.

To pin the published version, run `npm install --global canva-mcp@0.1.0`. The executable is `canva-mcp`. A client may invoke `npx` with separate arguments `--yes`, `--package=canva-mcp@0.1.0`, `canva-mcp`, and `serve`; local installation avoids repeated startup package resolution. Do not publish the older local DSH connector or any credentials.

MIT license: [LICENSE](LICENSE).
