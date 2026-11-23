import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../src/serve.mjs';

const dir = fileURLToPath(new URL('../examples/submissions/elena', import.meta.url));

test('serves index.html on an ephemeral localhost port', async () => {
  const server = await serveStatic(dir);
  try {
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
    const res = await fetch(server.url);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(await res.text(), /Course Enrollment/);
  } finally {
    await server.close();
  }
});

test('returns 404 for missing files and refuses to leave the folder', async () => {
  const server = await serveStatic(dir);
  try {
    assert.equal((await fetch(`${server.url}missing.js`)).status, 404);
    const escape = await fetch(`${server.url}..%2F..%2F..%2Fpackage.json`);
    assert.notEqual(escape.status, 200);
  } finally {
    await server.close();
  }
});

test('a missing favicon is a quiet 204, not a console error', async () => {
  const server = await serveStatic(dir);
  try {
    assert.equal((await fetch(`${server.url}favicon.ico`)).status, 204);
  } finally {
    await server.close();
  }
});

test('each server gets its own port (a fresh browser origin per run)', async () => {
  const a = await serveStatic(dir);
  const b = await serveStatic(dir);
  try {
    assert.notEqual(a.url, b.url);
  } finally {
    await a.close();
    await b.close();
  }
});
