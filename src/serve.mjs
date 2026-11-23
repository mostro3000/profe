// A tiny static file server for student submissions that live in a folder.
// Each submission gets its own ephemeral port, so every grading run starts on
// a fresh browser origin: no localStorage or cookies leak between students.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export function serveStatic(dir) {
  const root = resolve(dir);
  const server = createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, 'http://127.0.0.1');
      let file = resolve(root, `.${decodeURIComponent(pathname)}`);
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403, { 'content-type': 'text/plain' }).end('forbidden');
        return;
      }
      let info = await stat(file).catch(() => null);
      if (info?.isDirectory()) {
        file = join(file, 'index.html');
        info = await stat(file).catch(() => null);
      }
      if (!info?.isFile()) {
        res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(500, { 'content-type': 'text/plain' }).end('error');
    }
  });

  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      ok({
        url: `http://127.0.0.1:${port}/`,
        close: () =>
          new Promise((done) => {
            server.closeAllConnections?.();
            server.close(() => done());
          }),
      });
    });
  });
}
