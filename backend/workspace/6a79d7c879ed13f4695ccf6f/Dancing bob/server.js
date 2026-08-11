const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 8000;
const root = process.cwd();
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let requestUrl = req.url.split('?')[0];
  if (requestUrl.endsWith('/')) requestUrl += 'index.html';
  const filePath = path.join(root, decodeURIComponent(requestUrl));

  if (!filePath.startsWith(root)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const ports = [8000, 8001, 8002];
let currentPortIndex = 0;

function startServer() {
  const activePort = ports[currentPortIndex];
  server.listen(activePort, () => {
    console.log(`Server running at http://localhost:${activePort}`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && currentPortIndex < ports.length - 1) {
    console.warn(`Port ${ports[currentPortIndex]} is busy. Trying port ${ports[currentPortIndex + 1]}...`);
    currentPortIndex += 1;
    startServer();
    return;
  }

  console.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});

startServer();
