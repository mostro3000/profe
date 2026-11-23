#!/usr/bin/env node
// Stand-in for a coding agent CLI in unit tests: "fixes" the app in the current
// folder by adding a marker that test/fake-kane.mjs treats as a passing build.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const prompt = process.argv.at(-1) ?? '';
if (!existsSync('profe-feedback.md') || !prompt.includes('profe-feedback.md')) {
  console.error('fake-agent: expected profe-feedback.md and a prompt that mentions it');
  process.exit(1);
}
const failing = [...readFileSync('profe-feedback.md', 'utf8').matchAll(/### ❌ (AC\d+)/g)].map((m) => m[1]);
appendFileSync('index.html', '\n<!-- fixed -->\n');
console.log(`Fixed ${failing.join(', ')}: patched index.html.`);
