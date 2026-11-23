#!/usr/bin/env node
// Checks server.json against the official MCP Registry's published JSON Schema (the URL in its "$schema")
// and against the registry's own publishing rules for npm packages. Node built-ins only, no dependencies.
//
//   node scripts/validate-server-json.mjs                 fetch the schema named in server.json
//   node scripts/validate-server-json.mjs --schema f.json use a saved copy of the schema instead
//
// It covers the JSON Schema keywords that schema uses ($ref, allOf, anyOf, not, type, required, properties,
// additionalProperties, items, enum, const, pattern, minLength, maxLength, format "uri"). It is a pre-check;
// `mcp-publisher validate` remains the registry's own authority.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const server = JSON.parse(readFileSync(join(root, 'server.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const at = process.argv.indexOf('--schema');
const schema = at > 0
  ? JSON.parse(readFileSync(process.argv[at + 1], 'utf8'))
  : await (await fetch(server.$schema, { signal: AbortSignal.timeout(15000) })).json();

const errors = [];
const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : Number.isInteger(v) ? 'integer' : typeof v);
const resolve = (ref) => ref.replace(/^#\//, '').split('/').reduce((o, k) => o[k], schema);

function check(s, v, path, sink = errors) {
  if (s.$ref) return check(resolve(s.$ref), v, path, sink);
  const before = sink.length;
  if (s.type) {
    const t = typeOf(v);
    const ok = [].concat(s.type).some((x) => x === t || (x === 'number' && t === 'integer'));
    if (!ok) { sink.push(`${path}: expected ${s.type}, got ${t}`); return; }
  }
  if (s.enum && !s.enum.includes(v)) sink.push(`${path}: ${JSON.stringify(v)} not in ${JSON.stringify(s.enum)}`);
  if (s.const !== undefined && s.const !== v) sink.push(`${path}: must be ${JSON.stringify(s.const)}`);
  if (typeof v === 'string') {
    if (s.minLength !== undefined && v.length < s.minLength) sink.push(`${path}: shorter than ${s.minLength}`);
    if (s.maxLength !== undefined && v.length > s.maxLength) sink.push(`${path}: ${v.length} chars, max ${s.maxLength}`);
    if (s.pattern && !new RegExp(s.pattern, 'u').test(v)) sink.push(`${path}: does not match ${s.pattern}`);
    if (s.format === 'uri') { try { new URL(v); } catch { sink.push(`${path}: not a URI`); } }
  }
  if (typeOf(v) === 'object') {
    for (const k of s.required || []) if (!(k in v)) sink.push(`${path}: missing required "${k}"`);
    for (const [k, val] of Object.entries(v)) {
      if (s.properties && k in s.properties) check(s.properties[k], val, `${path}.${k}`, sink);
      else if (s.additionalProperties === false) sink.push(`${path}: unexpected property "${k}"`);
      else if (typeof s.additionalProperties === 'object') check(s.additionalProperties, val, `${path}.${k}`, sink);
    }
  }
  if (Array.isArray(v) && s.items) v.forEach((x, i) => check(s.items, x, `${path}[${i}]`, sink));
  for (const sub of s.allOf || []) check(sub, v, path, sink);
  if (s.anyOf && !s.anyOf.some((sub) => { const e = []; check(sub, v, path, e); return !e.length; })) sink.push(`${path}: matches none of anyOf`);
  if (s.not) { const e = []; check(s.not, v, path, e); if (!e.length) sink.push(`${path}: matches a "not" schema`); }
  return sink.length === before;
}

check(schema, server, 'server.json');

// The official registry's own rules (docs/modelcontextprotocol-io/package-types.mdx, versioning.mdx).
const rule = (ok, msg) => { if (!ok) errors.push(msg); };
rule(server.name === pkg.mcpName, `name "${server.name}" must equal package.json mcpName "${pkg.mcpName}"`);
rule(server.version === pkg.version, `version ${server.version} must equal package.json version ${pkg.version}`);
rule(!/[\^~<>*|x]|\s-\s/.test(server.version), 'version looks like a range, which the registry rejects');
// Not a registry rule: keeps the two files pointing at the same (mirror) repository.
const pkgRepo = (pkg.repository?.url || '').replace(/^git\+/, '').replace(/\.git$/, '');
rule(server.repository?.url === pkgRepo, `repository ${server.repository?.url} must equal package.json repository ${pkgRepo}`);
for (const p of server.packages || []) {
  if (p.registryType !== 'npm') continue;
  rule(p.identifier === pkg.name, `package identifier "${p.identifier}" must equal package.json name "${pkg.name}"`);
  rule(p.version === pkg.version, `package version ${p.version} must equal package.json version ${pkg.version}`);
  rule(!p.registryBaseUrl || p.registryBaseUrl === 'https://registry.npmjs.org', 'npm packages must use https://registry.npmjs.org');
}

if (errors.length) {
  console.error(`server.json: ${errors.length} problem(s)\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`server.json is valid against ${schema.$id || server.$schema} and the registry's npm rules (name ${server.name}, version ${server.version}).`);
