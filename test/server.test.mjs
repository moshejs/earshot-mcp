// Protocol-level tests: a real MCP client talks to the server, in memory and over stdio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createServer } from '../src/server.mjs';

async function connected() {
  const [a, b] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  const client = new Client({ name: 'test', version: '0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, close: () => Promise.all([client.close(), server.close()]) };
}

test('lists check_name with input and output schemas', async () => {
  const { client, close } = await connected();
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name), ['check_name']);
  const t = tools[0];
  assert.deepEqual(t.inputSchema.required, ['name']);
  assert.equal(t.inputSchema.properties.languages.items.enum.length, 25);
  assert.ok(t.outputSchema.properties.verdict);
  assert.equal(t.annotations.readOnlyHint, true);
  assert.match(t.description, /not native-speaker judgments/);
  await close();
});

test('check_name returns text and structured content that matches the output schema', async () => {
  const { client, close } = await connected();
  const res = await client.callTool({ name: 'check_name', arguments: { name: 'Pajero' } });
  assert.ok(!res.isError);
  assert.equal(res.structuredContent.verdict, 'Rename');
  assert.match(res.content[0].text, /^Pajero: Rename/);
  await close();
});

test('invalid language codes are rejected by the schema', async () => {
  const { client, close } = await connected();
  const res = await client.callTool({ name: 'check_name', arguments: { name: 'Brio', languages: ['xx'] } });
  assert.equal(res.isError, true);
  await close();
});

test('runs as a stdio server', async () => {
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../src/server.mjs', import.meta.url))] });
  const client = new Client({ name: 'stdio-test', version: '0' });
  await client.connect(transport);
  const res = await client.callTool({ name: 'check_name', arguments: { name: 'MR2', languages: ['fr'] } });
  assert.equal(res.structuredContent.languages[0].flags[0].match, 'spelled aloud');
  await client.close();
});
