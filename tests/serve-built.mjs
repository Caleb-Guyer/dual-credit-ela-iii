import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
};
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const mount = ['/dual-credit-ela-iii/', '/dual-credit-ela-iii-game/'].find((m) =>
        pathname.startsWith(m),
      );
      if (!mount) {
        res.writeHead(404).end();
        return;
      }
      const rel = pathname.slice(mount.length) || 'index.html';
      const target = path.resolve(root, rel);
      if (!target.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      if (!(await stat(target)).isFile()) {
        res.writeHead(404).end();
        return;
      }
      const data = await readFile(target);
      res.writeHead(200, {
        'Content-Type': mime[path.extname(target)] ?? 'application/octet-stream',
      });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  })
  .listen(4174, '127.0.0.1', () =>
    console.log('GitHub Pages subpath simulation: http://127.0.0.1:4174/dual-credit-ela-iii/'),
  );
