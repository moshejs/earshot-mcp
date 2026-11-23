# Earshot MCP server

> **Generated repository.** This repo is generated from a private source repository and contains only the MCP server package. Changes made here directly are overwritten by the next sync. Report problems and suggestions as [issues here](https://github.com/moshejs/earshot-mcp/issues).

An [MCP](https://modelcontextprotocol.io) server with one tool, `check_name`, so an assistant brainstorming names (Claude, Cursor or any MCP client) can screen each candidate across 25 languages without leaving the chat.

It runs the same engine as the website, [earshot.quentin.software](https://earshot.quentin.software), locally over stdio. Names are not sent anywhere, and there are no keys or accounts.

**What the results are.** Automated flags from a curated lexicon (107 entries in the current engine) and written per-language sound rules. They are not native-speaker judgments: a flag can be a false positive, and slang the lexicon lacks is missed. Not trademark clearance or legal advice. Every tool result says so.

## Install and use

> The npm package `earshot-mcp` is prepared but **not published yet**. Until it is, use "Install from a clone" below.

Add it to your MCP client's configuration. Claude Desktop keeps it in `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`, Windows: `%APPDATA%\Claude\`, Linux: `~/.config/Claude/`); Cursor, Windsurf and most other clients take the same `mcpServers` shape:

```json
{
  "mcpServers": {
    "earshot": {
      "command": "npx",
      "args": ["-y", "earshot-mcp"]
    }
  }
}
```

Claude Code: `claude mcp add earshot -- npx -y earshot-mcp`

Docker (stdio, so `-i`), from the repository root: `docker build -t earshot-mcp . && docker run -i --rm earshot-mcp`

**Tool.** `check_name(name, languages?)`: screens a proposed name in 25 languages for vulgar or unfortunate lookalike words, pronunciation friction and renderings in 6 non-Latin scripts, and returns a verdict (`Clear`, `Review`, `Rename`), a fit index and per-language flags. `name` is 1 to 40 characters with at least one letter or digit; `languages` optionally limits the per-language section to some of the 25 codes listed below. Details under "Tool: `check_name`".

**Environment variables.** None.

**What leaves your machine.** Nothing. The engine runs in the server process; it makes no network requests, reads no files after start-up and writes nothing. `npx` itself downloads the package and its two dependencies (`@modelcontextprotocol/sdk`, `zod`) from the npm registry the first time.

**Limits.** One name per call, 1 to 40 characters. The lexicon has 107 entries and written sound rules for 25 languages; a flag can be a false positive and slang it lacks is missed. Results are automated flags, not native-speaker judgments, and not trademark clearance or legal advice.

**Report a problem.** Open an issue at [github.com/moshejs/earshot-mcp/issues](https://github.com/moshejs/earshot-mcp/issues) with the name you checked and the result you expected.

## Install from a clone

Requires Node 22 or later. From a clone of [github.com/moshejs/earshot-mcp](https://github.com/moshejs/earshot-mcp):

```
npm install
```

### Claude Code

```
claude mcp add earshot -- node /absolute/path/to/earshot-mcp/src/server.mjs
```

### Claude Desktop, Cursor and other clients

Add to the client's MCP config (`claude_desktop_config.json`, `.cursor/mcp.json`, ...):

```json
{
  "mcpServers": {
    "earshot": {
      "command": "node",
      "args": ["/absolute/path/to/earshot-mcp/src/server.mjs"]
    }
  }
}
```

## Tool: `check_name`

| Input | Type | |
|---|---|---|
| `name` | string, 1 to 40 characters | The proposed name |
| `languages` | array of language codes, optional | Limit the per-language section. The verdict and fit index always cover all 25. |

Languages: `en` English, `de` German, `nl` Dutch, `sv` Swedish, `no` Norwegian, `da` Danish, `fr` French, `es` Spanish, `pt` Portuguese, `it` Italian, `ro` Romanian, `pl` Polish, `cs` Czech, `ru` Russian, `el` Greek, `hu` Hungarian, `fi` Finnish, `tr` Turkish, `ar` Arabic, `he` Hebrew, `hi` Hindi, `id` Indonesian, `zh` Mandarin, `ja` Japanese, `ko` Korean.

The result has a short text summary and structured content (declared as the tool's output schema):

- `verdict` (`Clear`, `Review`, `Rename`), `fitIndex` (0 to 100) and `summary`
- `highestRisk`: the 3 highest-risk languages; `flaggedLanguages`
- `languages[]`: `fit`, `band`, `pronounceability`, `flags[]` (severity, word with strong words masked, category, meaning, match type: exact, contains, starts with, sounds like, spelled aloud), `pronunciationNotes`, `likelyHeardAs`
- `myths[]`: naming legends attached to the name, graded (for example the Chevrolet Nova "no va" story, a myth)
- `scripts[]`: approximate renderings in Hebrew, Arabic, Cyrillic, Greek, katakana and hangul
- `method`: the automated-flags notice

Example text result for `MR2`:

```
MR2: Rename (fit index 45/100, 25 languages screened).
French: the name spelled aloud (èm-èr-deux) runs into “m***e”, "shit". Rename, or keep it out of French-speaking markets.

Automated flags:
- French [red] spelled aloud "m***e" (èm-èr-deux): "shit"
```

## Tests

```
npm test
```

Covers verdicts for known cases (Pajero, MR2 spelled aloud in French, Fitta, Nova with its myth), masking, the language filter, input validation, that the reported version and `server.json` match `package.json`, and the MCP protocol itself: a real MCP client lists the tool, calls it in memory, and runs the server over stdio.

## Licence

[MIT](LICENSE). Copyright (c) 2026 Moshe Malka.
