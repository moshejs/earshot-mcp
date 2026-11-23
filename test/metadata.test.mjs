// Offline checks that the version and identity live in one place: package.json.
// scripts/validate-server-json.mjs repeats the server.json checks together with the registry's schema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, VERSION } from '../src/server.mjs';

const read = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
const pkg = read('package.json');
const server = read('server.json');
const repoUrl = (u) => u.replace(/^git\+/, '').replace(/\.git$/, '');

test('the server reports the package.json version over MCP', async () => {
  assert.equal(VERSION, pkg.version);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const s = createServer();
  const client = new Client({ name: 'test', version: '0' });
  await Promise.all([s.connect(a), client.connect(b)]);
  assert.deepEqual(client.getServerVersion(), { name: 'earshot', version: pkg.version });
  await Promise.all([client.close(), s.close()]);
});

test('server.json agrees with package.json', () => {
  assert.equal(server.name, pkg.mcpName);
  assert.equal(server.version, pkg.version);
  for (const p of server.packages) {
    assert.equal(p.identifier, pkg.name);
    assert.equal(p.version, pkg.version);
  }
  assert.equal(server.repository.url, repoUrl(pkg.repository.url));
});

test('the package is MIT licensed and the LICENSE file says so', () => {
  assert.equal(pkg.license, 'MIT');
  assert.match(readFileSync(new URL('../LICENSE', import.meta.url), 'utf8'), /^MIT License\n\nCopyright \(c\) 2026 Moshe Malka\n/);
});
