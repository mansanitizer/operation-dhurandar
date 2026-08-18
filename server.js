import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

// Only these origins may read responses from this server via CORS.
const ALLOWED_ORIGINS = new Set([
  'https://operationdhurandar.ashar.site',
]);

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsedUrl.pathname;
  if (pathname === '/') pathname = '/index.html';

  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);
  const ext = path.extname(filePath).toLowerCase();

  console.log(`[REQ] ${req.method} ${pathname} from ${req.socket.remoteAddress}`);

  const origin = req.headers.origin;
  const corsHeaders = ALLOWED_ORIGINS.has(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : {};

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain', ...corsHeaders });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, corsHeaders);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        ...corsHeaders,
      });
      res.end(content);
    }
  });
});

// Only auto-start when run directly (`node server.js`), not when imported
// (e.g. by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 5173;
  const HOST = '0.0.0.0';

  server.listen(PORT, HOST, () => {
    console.log(`====================================================`);
    console.log(`[OPERATION DHURANDAR] Server active on 0.0.0.0:${PORT}`);
    console.log(`  > Local:   http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}

export { server, ALLOWED_ORIGINS };
