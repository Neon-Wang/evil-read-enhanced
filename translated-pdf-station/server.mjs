import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || '18082');
const WORKSPACE_ROOT =
  process.env.EVILREAD_WORKSPACE || String.raw`C:\GitClient\windows\repos\evilread-workspace`;
const DOWNLOAD_BASE_URL =
  process.env.DOWNLOAD_BASE_URL || 'https://code-file.jiashengfan.space';
const MANIFEST_FIELDS = [
  'run_id',
  'date',
  'zotero_key',
  'title',
  'source_pdf',
  'zh_pdf',
  'zh_sha256',
  'size_bytes',
  'mtime_utc',
  'zip_path',
  'zip_sha256',
  'status',
];

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distRoot = resolve(__dirname, 'dist');
const manifestPath = resolve(WORKSPACE_ROOT, 'downloads', 'translated-pdfs', 'manifest.csv');

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function readManifestRows() {
  if (!existsSync(manifestPath)) return [];
  const content = readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '');
  const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    for (const field of MANIFEST_FIELDS) {
      const index = header.indexOf(field);
      row[field] = index >= 0 ? values[index] || '' : '';
    }
    return row;
  });
}

function summarizeRuns(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const runId = row.run_id;
    if (!runId) continue;
    if (!grouped.has(runId)) {
      grouped.set(runId, {
        run_id: runId,
        date: row.date,
        status: row.status || 'unknown',
        file_count: 0,
        zip_size_bytes: 0,
        zip_sha256: row.zip_sha256 || '',
        zip_path: row.zip_path || '',
        download_url: '',
      });
    }
    const run = grouped.get(runId);
    if (row.status === 'packaged') {
      run.status = 'packaged';
      run.file_count += 1;
      run.zip_path = run.zip_path || row.zip_path || '';
      run.zip_sha256 = run.zip_sha256 || row.zip_sha256 || '';
    } else if (run.status !== 'packaged') {
      run.status = row.status || run.status;
    }
  }
  const runs = Array.from(grouped.values()).map((run) => {
    if (run.zip_path && existsSync(run.zip_path)) {
      run.zip_size_bytes = statSync(run.zip_path).size;
    }
    if (run.status === 'packaged') {
      run.download_url = `${DOWNLOAD_BASE_URL.replace(/\/$/, '')}/downloads/${run.run_id}.zip`;
    }
    return run;
  });
  runs.sort((a, b) => {
    const dateOrder = String(b.date).localeCompare(String(a.date));
    return dateOrder || String(b.run_id).localeCompare(String(a.run_id));
  });
  return runs;
}

function runDetails(runId) {
  const rows = readManifestRows().filter((row) => row.run_id === runId);
  const runs = summarizeRuns(rows);
  const run = runs[0];
  if (!run) return null;
  return {
    run,
    items: rows.filter((row) => row.status === 'packaged'),
  };
}

function contentType(pathname) {
  switch (extname(pathname)) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

function sendStatic(req, res) {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const target = resolve(distRoot, requested);
  const fallback = join(distRoot, 'index.html');
  const filePath = target.startsWith(distRoot) && existsSync(target) && statSync(target).isFile() ? target : fallback;
  if (!existsSync(filePath)) {
    sendJson(res, 503, { error: 'frontend build missing', distRoot });
    return;
  }
  res.writeHead(200, { 'content-type': contentType(filePath) });
  createReadStream(filePath).pipe(res);
}

function sendDownload(runId, res) {
  const details = runDetails(runId);
  const zipPath = details?.run?.zip_path || '';
  if (!details || !zipPath || !existsSync(zipPath)) {
    sendJson(res, 404, { error: 'zip not found', run_id: runId });
    return;
  }
  const size = statSync(zipPath).size;
  res.writeHead(200, {
    'content-type': 'application/zip',
    'content-length': size,
    'content-disposition': `attachment; filename="${runId}.zip"`,
  });
  createReadStream(zipPath).pipe(res);
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  if (url.pathname === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      manifest_path: manifestPath,
      manifest_exists: existsSync(manifestPath),
      download_base_url: DOWNLOAD_BASE_URL,
    });
    return;
  }
  if (url.pathname === '/api/runs') {
    const rows = readManifestRows();
    sendJson(res, 200, {
      manifest_path: manifestPath,
      runs: summarizeRuns(rows),
    });
    return;
  }
  const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
  if (runMatch) {
    const details = runDetails(decodeURIComponent(runMatch[1]));
    if (!details) {
      sendJson(res, 404, { error: 'run not found' });
      return;
    }
    sendJson(res, 200, details);
    return;
  }
  const downloadMatch = url.pathname.match(/^\/downloads\/([^/]+)\.zip$/);
  if (downloadMatch) {
    sendDownload(decodeURIComponent(downloadMatch[1]), res);
    return;
  }
  sendStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`translated-pdf-station listening on http://${HOST}:${PORT}`);
  console.log(`manifest: ${manifestPath}`);
});
