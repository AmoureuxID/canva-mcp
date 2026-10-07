# Setup and usage guide

[Back to the project overview](README.md)

This guide covers the published [`canva-mcp@0.1.0`](https://www.npmjs.com/package/canva-mcp) and its source at [AmoureuxID/canva-mcp](https://github.com/AmoureuxID/canva-mcp).

## Requirements

- Node.js 20.11 or newer and npm.
- Windows, macOS, or Linux and a local MCP client that can start `stdio` servers. HTTP-only clients cannot use this bridge directly.
- A browser in the same OS environment where `login` runs, and a Canva account whose permissions you can approve.

## Install and sign in

Install the published package with:

```sh
npm install --global canva-mcp
canva-mcp login
canva-mcp status
```

To work from the repository instead:

```sh
git clone https://github.com/AmoureuxID/canva-mcp.git
cd canva-mcp
npm ci
npm install --global .
canva-mcp login
canva-mcp status
```

Run these commands as the same OS user who will run the MCP client. `npm install --global .` installs this checkout, not a package fetched from npm, and creates the `canva-mcp` command. Ensure npm's global bin directory is on your `PATH`. If you do not want a global installation, run `node bin/canva-mcp-stdio.mjs login` and `node bin/canva-mcp-stdio.mjs status` from the checkout instead.

`login` registers a redirect URI on a temporary `127.0.0.1` port, prints the authorization URL, and attempts to open it. If the browser does not open, use that URL on the same computer. Review and approve the requested Canva permissions yourself. A successful callback says `Canva connected. You can close this tab.` The attempt expires after ten minutes. Run `login` again instead of reusing an old URL. Do not send callback URLs, codes, or tokens to anyone.

`status` checks only for saved refresh credentials. It cannot confirm that Canva still accepts the grant; the next request may require login again.

## Configure a stdio MCP client

After an npm installation, configure your MCP client to run `canva-mcp` with the `serve` argument. For a source checkout, use the absolute path to the entry point instead:

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

This is a generic example, not a promise that every client uses this configuration schema. Use the client's own documentation for the location and structure of its MCP settings. On Windows, a JSON path can use escaped backslashes such as `C:\\Users\\you\\Projects\\canva-mcp\\bin\\canva-mcp-stdio.mjs`, or forward slashes. On macOS and Linux, use the corresponding absolute POSIX path. If the client cannot find Node in its `PATH`, supply the absolute Node executable path as `command`. Restart or reload the client and inspect its Canva tool list. Do not run `serve` as a human-facing interactive command; standard output carries MCP messages.

For a DSH client entry using `@deepseek-ai/dsh-mcp-client`, use `transport: stdio`, `command: node`, and `args` containing the absolute script path followed by `serve`. Do not replace an existing Canva connector without deciding to do so. This package never edits client settings automatically.

## Commands

After the local global installation, run `canva-mcp <command>` from any directory. Without it, run `node bin/canva-mcp-stdio.mjs <command>` from the repository:

| Command | What it does |
| --- | --- |
| `login` | Starts the OAuth browser flow for user approval. |
| `serve` | Starts the MCP stdio server for your client. |
| `status` | Reports whether local refresh credentials exist, without printing them. |
| `logout` | Removes local tokens and pending login state. |

```sh
canva-mcp status
canva-mcp logout
```

`logout` does not revoke the authorization on Canva's servers. If you want revocation, remove the application's access separately in your Canva account settings.

## Give the setup task to an AI agent

Copy this prompt to an AI agent that can inspect your local environment. Review any proposed configuration change before approving it. The agent may prepare the setup, but only you approve Canva access in the browser.

```text
Set up the open-source Canva MCP OAuth bridge from
https://github.com/AmoureuxID/canva-mcp.git for my local MCP client.

Verify the package is `canva-mcp` from AmoureuxID and that Node.js is 20.11
or newer. Ask before installing `canva-mcp` globally from npmjs.com.
If I prefer the repository instead, clone or use a local checkout, run
`npm ci`, then `npm install --global .` if I approve a global install.
Read README.md and GUIDE.md. Configure my MCP client according to its actual
stdio settings format, using `canva-mcp` as the command and `serve` as its
argument for an npm installation. For a source installation, use `node`,
the absolute path to `bin/canva-mcp-stdio.mjs`, and `serve`. Show the exact
settings change and get my approval before applying it.

Tell me how to run `canva-mcp login` myself after installation, or use the
source entry point without a global install. Do not request
or copy an OAuth URL, callback URL, authorization code, access token, refresh
token, or credentials.json into chat, logs, or a repository. I will approve
Canva access in a browser on the same computer. After I confirm login,
check `status` and verify MCP initialization or tool listing without opening
a private design. Ask before changing any design and test writes only on a
copy I have approved.
Report errors without secrets. Do not replace an existing Canva connector
without asking.
```

If the agent lacks access to your browser or MCP client's configuration, it should give you the commands and settings to apply yourself. It must not claim setup is complete before verification.

## Permissions and credential storage

The default OAuth request names `profile:read`, `design:meta:read`, `design:content:read`, and `folder:read`. Despite their names, a live test with this grant created a folder and saved a text edit on a copied design. The bridge does not filter write tools; Canva may still reject individual actions depending on account permissions. Both reading and writing must be confirmed by real tool results, not inferred from scope names or tool listings. Review each write before allowing an AI client to run it. The bridge contacts `https://mcp.canva.com` for OAuth and MCP and binds the temporary callback only to `127.0.0.1`. OAuth uses PKCE S256.

Credentials are stored outside the repository for the OS user running `login`:

| OS | Data directory |
| --- | --- |
| Windows | `%LOCALAPPDATA%\\canva-mcp-oauth`, falling back to `AppData\\Local` under the user home |
| macOS | `~/Library/Application Support/canva-mcp-oauth` |
| Linux | `${XDG_STATE_HOME:-~/.local/state}/canva-mcp-oauth` |

The file is `credentials.json`. On Unix, directory and file modes are restricted. On Windows, explicit permissions are applied for the signed-in user and SYSTEM; token persistence fails if that cannot be done. Other processes with your OS account can still read your credentials. Local permissions do not protect against malware running as you. Refresh-token writes use a per-user file lock. Never commit or upload credentials or log private tool results.

## Troubleshooting

- **Browser does not open:** Use the URL printed by the still-running login process on the same computer. Start a new login after ten minutes.
- **Callback cannot be reached:** Run `login` where the browser can reach the same `127.0.0.1` listener. A browser on another device or in a separate container cannot reach the listener on your machine.
- **`status` reports not connected:** Finish the browser callback under the same OS account as the MCP client. A pending authorization is not an access token.
- **The MCP client says login required:** The grant may be revoked, or the client may be running under another OS user. Run `login` again under that user's account.
- **No tools appear:** Check the client's actual stdio config, script path, Node version, and whether you restarted it. Standard output must remain reserved for MCP protocol messages.
- **A tool is listed but denied:** Canva may require permissions not granted to this account. A listed tool is not proof the action will succeed; check the actual response.
- **Cannot save credentials:** Check user data directory permissions. On Windows, do not bypass restrictive permissions by storing the token in your repository.

## Local checks and npm release

```sh
npm ci
npm test
npm pack --dry-run --json
npm audit --omit=dev --audit-level=high
```

The GitHub workflow tests Windows, macOS, and Ubuntu on Node 20, 22, and 24. Inspect its latest result rather than inferring success from a badge or an old run. Version `0.1.0` is published on npmjs.com; an isolated registry installation successfully ran `canva-mcp status`. A live connection listed tools, read text on a copied design, saved an edit, and read the new text back; the original design stayed unchanged. That confirms those specific read and write actions, not every listed tool or a clean-machine login.

To pin the published version, run `npm install --global canva-mcp@0.1.0`. The executable is `canva-mcp`. A client may also invoke `npx` with separate arguments `--yes`, `--package=canva-mcp@0.1.0`, `canva-mcp`, and `serve`; a local installation avoids repeated startup package resolution. Do not publish the older local DSH connector or any credentials.
