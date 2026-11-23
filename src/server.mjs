#!/usr/bin/env node
// Earshot MCP server (stdio). One tool, check_name, runs the same engine as
// https://earshot.quentin.software locally: nothing is sent over the network.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { checkName, summarize, LANGUAGES, LANGUAGE_CODES, LEXICON_SIZE } from './check.mjs';

// The version reported to clients is read from package.json (one source), which npm and the Dockerfile ship next to src/.
export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const flag = z.object({
  severity: z.enum(['red', 'amber']),
  word: z.string().describe('The flagged word; strong words are masked'),
  masked: z.boolean(),
  category: z.string(),
  meaning: z.string(),
  match: z.string().describe('exact match, contains, starts with, sounds like, or spelled aloud'),
  spokenAs: z.string().optional(),
  note: z.string().optional(),
});

const outputSchema = {
  name: z.string(),
  verdict: z.enum(['Clear', 'Review', 'Rename']),
  fitIndex: z.number().int().min(0).max(100),
  summary: z.string(),
  languagesChecked: z.number().int(),
  languagesReported: z.number().int(),
  highestRisk: z.array(z.string()),
  flaggedLanguages: z.array(z.string()),
  languages: z.array(z.object({
    code: z.string(),
    language: z.string(),
    fit: z.number().int(),
    band: z.enum(['clear', 'review', 'at risk']),
    pronounceability: z.number().int(),
    flags: z.array(flag),
    pronunciationNotes: z.array(z.string()),
    likelyHeardAs: z.string().optional(),
  })),
  myths: z.array(z.object({ title: z.string(), grade: z.string(), claim: z.string(), evidence: z.string(), take: z.string() })),
  scripts: z.array(z.object({ script: z.string(), code: z.string(), text: z.string(), direction: z.string(), note: z.string() })),
  method: z.string(),
  source: z.string(),
};

export function createServer() {
  const server = new McpServer({ name: 'earshot', version: VERSION });
  server.registerTool(
    'check_name',
    {
      title: 'Screen a brand name across 25 languages',
      description:
        'Screens a proposed brand or product name in 25 languages for vulgar or unfortunate lookalike words '
        + `(${LEXICON_SIZE}-entry lexicon: exact, contained, prefix, sound-alike and spelled-aloud matches), `
        + 'pronunciation friction, and renderings in 6 non-Latin scripts. Returns a verdict (Clear, Review, Rename), '
        + 'a fit index, and per-language flags. Results are automated flags, not native-speaker judgments, and not '
        + 'trademark clearance. Runs locally; the name is not sent anywhere. Languages: '
        + LANGUAGES.map((l) => `${l.code} ${l.name}`).join(', ') + '.',
      inputSchema: {
        name: z.string().min(1).max(40).describe('The proposed name, 1 to 40 characters'),
        languages: z.array(z.enum(LANGUAGE_CODES)).max(25).optional()
          .describe('Optional language codes to report on. The verdict always covers all 25.'),
      },
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ name, languages }) => {
      try {
        const result = checkName(name, languages);
        return { content: [{ type: 'text', text: summarize(result) }], structuredContent: result };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: err.message }] };
      }
    },
  );
  return server;
}

const isMain = (() => { try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } })();
if (isMain) {
  await createServer().connect(new StdioServerTransport());
}
