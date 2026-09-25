#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];
const checked = [];

function walk(dir, predicate = () => true) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out;
}

function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }

function checkJsSyntax(file) {
  const source = fs.readFileSync(file, 'utf8');
  try {
    new Function(source.replace(/^#![^\n]*\n/, ''));
  } catch (error) {
    failures.push(`JS syntax error: ${rel(file)} — ${error.message}`);
  }
  checked.push(rel(file));
}

function resolveRelativeRequire(fromFile, request) {
  if (!request.startsWith('.')) return true;
  const base = path.resolve(path.dirname(fromFile), request);
  const candidates = [
    base,
    base + '.js',
    base + '.json',
    path.join(base, 'index.js')
  ];
  return candidates.some(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}

for (const rootDir of [
  path.join(root, 'backend/src'),
  path.join(root, 'integrations/vexaaccount-node-backend/src'),
  path.join(root, 'scripts')
]) {
  for (const file of walk(rootDir, f => f.endsWith('.js'))) {
    checkJsSyntax(file);
    const source = fs.readFileSync(file, 'utf8');
    const requireSource = source.replace(/\`[\\s\\S]*?\`/g, '');
    for (const match of requireSource.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (!resolveRelativeRequire(file, match[1])) {
        failures.push(`Missing relative require: ${rel(file)} -> ${match[1]}`);
      }
    }
  }
}

for (const file of walk(path.join(root, 'frontend-VexaAccount-user/src'), f => f.endsWith('.js'))) {
  checkJsSyntax(file);
}
for (const file of walk(path.join(root, 'VexaMail-user'), f => f.endsWith('.js'))) {
  checkJsSyntax(file);
}

const routeDir = path.join(root, 'backend/src/routes');
for (const file of walk(routeDir, f => f.endsWith('.js'))) {
  const source = fs.readFileSync(file, 'utf8');
  const seen = new Map();
  for (const match of source.matchAll(/router\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g)) {
    const key = `${match[1].toUpperCase()} ${match[2]}`;
    if (seen.has(key)) failures.push(`Duplicate route in ${rel(file)}: ${key}`);
    seen.set(key, true);
  }
}

const backendIndex = fs.readFileSync(path.join(root, 'backend/src/index.js'), 'utf8');
if (!backendIndex.includes("app.get('/api/health'")) {
  failures.push('Backend health endpoint /api/health is missing.');
}

const userIndex = path.join(root, 'frontend-VexaAccount-user/index.html');
if (fs.existsSync(userIndex)) {
  const html = fs.readFileSync(userIndex, 'utf8');
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const ref = match[1].split('?')[0].split('#')[0];
    if (!ref || /^(https?:|data:|mailto:|javascript:)/i.test(ref)) continue;
    const target = path.resolve(path.dirname(userIndex), ref);
    if (!fs.existsSync(target)) failures.push(`Missing frontend asset: index.html -> ${ref}`);
  }
}

const migrations = walk(path.join(root, 'backend/database/migrations'), f => f.endsWith('.sql'));
if (!migrations.length) failures.push('No database migrations found.');

console.log(`Repository verification checked ${checked.length} JavaScript files and ${migrations.length} migrations.`);
if (failures.length) {
  console.error(failures.map(x => 'ERROR: ' + x).join('\n'));
  process.exit(1);
}
console.log('Repository verification passed.');
