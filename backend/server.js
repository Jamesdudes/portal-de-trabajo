import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import { handleApiRoute } from './routes/router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

async function startServer() {
  // Conectar directamente a la base de datos MongoDB real (sin emulaciones ni fallbacks)
  try {
    await connectDB();
  } catch (err) {
    console.error('[SERVIDOR] Iniciado sin conexión activa a MongoDB. Las rutas de datos devolverán HTTP 503 hasta que mongod esté activo.');
  }

  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Handle REST API routes
    if (pathname.startsWith('/api/')) {
      return handleApiRoute(req, res);
    }

    // Serve Frontend Static Assets
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') {
      safePath = '/index.html';
    }

    let filePath = path.join(FRONTEND_DIR, safePath);

    // If file doesn't exist in frontend/, check public/ for assets
    if (!fs.existsSync(filePath)) {
      const publicPath = path.join(ROOT_DIR, 'public', safePath);
      if (fs.existsSync(publicPath)) {
        filePath = publicPath;
      } else {
        // Fallback to frontend/index.html for client-side routing
        filePath = path.join(FRONTEND_DIR, 'index.html');
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('404 Recurso No Encontrado');
        }
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(`Error del servidor: ${err.code}`);
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    });
  });

  server.listen(PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(`[SERVIDOR] Portal de Trabajo - Plataforma Profesional de Empleo`);
    console.log(`[URL] http://localhost:${PORT}`);
    console.log(`[ENTORNO] Node.js ${process.version} + MongoDB Driver Oficial`);
    console.log(`[FRONTEND] HTML5 + CSS3 + Vanilla JavaScript (SVG Icons)`);
    console.log(`=======================================================`);
  });
}

startServer().catch(err => {
  console.error('[FATAL] Error al iniciar el servidor:', err);
  process.exit(1);
});
