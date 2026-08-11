# Bobo the Happy 3D Friend

This project creates a simple web page with a 3D character named Bobo. Bobo uses the webcam to guess your emotion and reacts:

- Happy: Bobo dances.
- Sad: Bobo sits and cries, then tries to cheer you up with a joke.
- Neutral: Bobo tells a joke to make you laugh.

## How to run

1. Open this folder in a browser with a local server.
2. If you have Python installed, run:

```powershell
cd "d:\Projects\Dancing bob"
python -m http.server 8000
```

3. If Python is not installed but Node.js is available, run:

```powershell
cd "d:\Projects\Dancing bob"
node -e "const http = require('http'), fs = require('fs'), path = require('path'); const port = 8000; const server = http.createServer((req, res) => { const filePath = path.join(process.cwd(), req.url === '/' ? '/index.html' : req.url); const ext = path.extname(filePath); const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }; fs.readFile(filePath, (err, data) => { if (err) { res.writeHead(404); return res.end('Not found'); } res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' }); res.end(data); }); }); server.listen(port, () => console.log(`Server running at http://localhost:${port}`));"
```

4. Open `http://localhost:8000` in your browser.
4. Click **Start Bobo** and allow webcam access.

> Note: Webcam permission is required for Bobo to sense your mood.
