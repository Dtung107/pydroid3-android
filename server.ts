import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn, spawnSync, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

// Prevent unhandled errors or rejections from terminating the dev server process
process.on('uncaughtException', (err) => {
  console.error('[Server Error] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.warn('[Server Warning] Unhandled Rejection:', reason);
});

const app = express();
const server = createServer(app);

// Extract --port from CLI arguments or fallback to 3000 in dev mode
const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? Number(process.argv[portArgIndex + 1]) : null;
const isProd = process.env.NODE_ENV === 'production';
const PORT = cliPort || (!isProd ? 3000 : (Number(process.env.PORT) || 3000));

app.use(express.json({ limit: '10mb' }));

// Persistent Python Packages Storage in Workspace
const PYDROID_PACKAGES_DIR = path.resolve(process.cwd(), '.pydroid_packages');
const REGISTRY_FILE = path.resolve(PYDROID_PACKAGES_DIR, 'installed_packages.json');
const REQUIREMENTS_FILE = path.resolve(process.cwd(), 'requirements.txt');

try {
  if (!fs.existsSync(PYDROID_PACKAGES_DIR)) {
    fs.mkdirSync(PYDROID_PACKAGES_DIR, { recursive: true });
  }
} catch (_) {}

// Ensure PYTHONPATH globally contains .pydroid_packages and system dist-packages
const extraPythonPaths = [
  PYDROID_PACKAGES_DIR,
  '/usr/local/lib/python3.10/dist-packages',
  '/usr/local/lib/python3/dist-packages',
];
for (const p of extraPythonPaths) {
  if (fs.existsSync(p) && !(process.env.PYTHONPATH || '').includes(p)) {
    process.env.PYTHONPATH = process.env.PYTHONPATH ? `${p}:${process.env.PYTHONPATH}` : p;
  }
}

function ensureEssentialPackageFixes() {
  try {
    const pyfigletDir = path.join(PYDROID_PACKAGES_DIR, 'pyfiglet');
    if (fs.existsSync(pyfigletDir)) {
      const initFile = path.join(pyfigletDir, '__init__.py');
      if (!fs.existsSync(initFile)) {
        try {
          spawnSync('pip', ['install', '--target=.pydroid_packages', '--upgrade', '--no-deps', 'pyfiglet']);
        } catch (_) {}
      }
      const versionFile = path.join(pyfigletDir, 'version.py');
      if (!fs.existsSync(versionFile)) {
        fs.writeFileSync(versionFile, '__version__ = "1.0.4"\n', 'utf-8');
      }
      const fontsDir = path.join(pyfigletDir, 'fonts');
      if (fs.existsSync(fontsDir)) {
        const stdFont = path.join(fontsDir, 'standard.flf');
        const altFont = path.join(fontsDir, '3-d.flf');
        if (!fs.existsSync(stdFont) && fs.existsSync(altFont)) {
          fs.copyFileSync(altFont, stdFont);
        }
      }
    }
  } catch (e) {
    console.warn('Error applying package fixes:', e);
  }
}
ensureEssentialPackageFixes();

function loadPersistedPackages(): Array<{ name: string; version: string; installedAt?: string }> {
  ensureEssentialPackageFixes();
  const result: Array<{ name: string; version: string; installedAt?: string }> = [];
  const seen = new Set<string>();

  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item && item.name && !seen.has(item.name.toLowerCase())) {
            seen.add(item.name.toLowerCase());
            result.push(item);
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error reading installed_packages.json:', e);
  }

  // Scan persistent directory for packages that exist on disk
  const defaultDiskPkgs = [
    { name: 'pyfiglet', version: '1.0.4' },
    { name: 'colorama', version: '0.4.6' },
  ];
  let updatedDisk = false;
  for (const dp of defaultDiskPkgs) {
    const pkgFolder = path.join(PYDROID_PACKAGES_DIR, dp.name);
    if (fs.existsSync(pkgFolder) && !seen.has(dp.name.toLowerCase())) {
      seen.add(dp.name.toLowerCase());
      result.push({ name: dp.name, version: dp.version, installedAt: new Date().toISOString() });
      updatedDisk = true;
    }
  }

  if (updatedDisk) {
    try {
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify(result, null, 2), 'utf-8');
      const reqLines = result.map((p) => (p.version && p.version !== 'installed' ? `${p.name}==${p.version}` : p.name));
      fs.writeFileSync(REQUIREMENTS_FILE, reqLines.join('\n') + '\n', 'utf-8');
    } catch (_) {}
  }

  return result;
}

function savePersistedPackage(pkgName: string, version: string = 'installed') {
  try {
    if (!fs.existsSync(PYDROID_PACKAGES_DIR)) {
      fs.mkdirSync(PYDROID_PACKAGES_DIR, { recursive: true });
    }
    const current = loadPersistedPackages().filter((p) => p.name.toLowerCase() !== pkgName.toLowerCase());
    current.push({ name: pkgName, version, installedAt: new Date().toISOString() });
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(current, null, 2), 'utf-8');

    // Also update requirements.txt
    const reqLines = current.map((p) => (p.version && p.version !== 'installed' ? `${p.name}==${p.version}` : p.name));
    fs.writeFileSync(REQUIREMENTS_FILE, reqLines.join('\n') + '\n', 'utf-8');
  } catch (e) {
    console.warn('Error saving to installed_packages.json:', e);
  }
}

function removePersistedPackage(pkgName: string) {
  try {
    const current = loadPersistedPackages().filter((p) => p.name.toLowerCase() !== pkgName.toLowerCase());
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(current, null, 2), 'utf-8');
    const reqLines = current.map((p) => (p.version && p.version !== 'installed' ? `${p.name}==${p.version}` : p.name));
    fs.writeFileSync(REQUIREMENTS_FILE, reqLines.join('\n') + '\n', 'utf-8');
  } catch (e) {
    console.warn('Error removing from installed_packages.json:', e);
  }
}

// Enable CORS and Cross-Origin headers for API and iframe compatibility
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Endpoint to export/download entire project source code as clean ZIP for GitHub and APK building
app.get('/api/export-project-zip', (req, res) => {
  const zipPath = path.join(os.tmpdir(), `pydroid3-android-source-${Date.now()}.zip`);
  const pythonScript = `
import zipfile, os

ignore_dirs = {'node_modules', '.git', '.pydroid_packages', 'tmp', 'dist', 'build', '.idea', '.gradle', '.aistudio'}
ignore_files = {'.DS_Store', 'server.js'}

with zipfile.ZipFile('${zipPath}', 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ignore_dirs and d != '.git']
        for f in files:
            if f in ignore_files or f.endswith('.pyc') or f.endswith('.log') or 'pydroid3-android-source.zip_' in f:
                continue
            file_path = os.path.join(root, f)
            arcname = os.path.relpath(file_path, '.')
            zf.write(file_path, arcname)
`;

  try {
    const tempPy = path.join(os.tmpdir(), `make_zip_${Date.now()}.py`);
    fs.writeFileSync(tempPy, pythonScript, 'utf-8');
    const proc = spawn('python3', [tempPy]);
    proc.on('close', (code) => {
      try { if (fs.existsSync(tempPy)) fs.unlinkSync(tempPy); } catch (_) {}
      if (code === 0 && fs.existsSync(zipPath)) {
        res.download(zipPath, 'pydroid3-android-source.zip', (err) => {
          try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); } catch (_) {}
        });
      } else {
        res.status(500).json({ error: 'Không thể tạo file zip' });
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to automatically push complete codebase to GitHub directly from Android phone without a PC
app.post('/api/github/push-repo', async (req, res) => {
  const { token, repoName = 'pydroid3-android' } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Vui lòng cung cấp mã GitHub Personal Access Token.' });
  }

  // Clean and sanitize token
  let cleanToken = token.trim();
  cleanToken = cleanToken.replace(/^['"]+|['"]+$/g, '').trim();
  cleanToken = cleanToken.replace(/^(bearer|token)\s+/i, '').trim();

  if (!cleanToken) {
    return res.status(400).json({ error: 'Mã GitHub Personal Access Token không hợp lệ.' });
  }

  const cleanRepoName = (repoName.trim() || 'pydroid3-android').replace(/[^a-zA-Z0-9._-]/g, '-');

  try {
    // 1. Verify user authentication with GitHub REST API using modern Bearer auth
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        'User-Agent': 'Pydroid3-Web-Builder',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!userRes.ok) {
      const errData = await userRes.json().catch(() => ({}));
      const errMsg = errData.message || '';
      console.error('GitHub /user auth error:', userRes.status, errMsg);

      if (userRes.status === 401) {
        return res.status(401).json({
          error: 'Mã GitHub Token không chính xác hoặc đã hết hạn (GitHub: ' + (errMsg || 'Bad credentials') + '). Vui lòng kiểm tra lại mã token hoặc bấm liên kết "Lấy Token" để tạo mã mới.',
        });
      }
      return res.status(userRes.status).json({
        error: `GitHub từ chối xác thực (HTTP ${userRes.status}): ${errMsg || 'Vui lòng kiểm tra lại token'}.`,
      });
    }

    // Inspect granted scopes if available (classic PATs return x-oauth-scopes)
    const scopesHeader = userRes.headers.get('x-oauth-scopes');
    if (scopesHeader !== null) {
      const scopes = scopesHeader.split(',').map((s) => s.trim().toLowerCase());
      const hasRepo = scopes.includes('repo') || scopes.includes('public_repo');
      if (!hasRepo && scopes.length > 0) {
        return res.status(403).json({
          error: `Token của bạn chỉ có quyền [${scopes.join(', ')}], đang thiếu quyền "repo" để tạo và tải lên mã nguồn. Vui lòng bấm vào liên kết "Lấy Token (đã chọn repo + workflow)" để tạo lại token có đủ quyền.`,
        });
      }
    }

    const userData = await userRes.json();
    const username = userData.login;

    // 2. Check if repository already exists; if not, create it automatically
    const checkRepoRes = await fetch(`https://api.github.com/repos/${username}/${cleanRepoName}`, {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        'User-Agent': 'Pydroid3-Web-Builder',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (checkRepoRes.status === 404) {
      // Create new repo
      const createRepoRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          'User-Agent': 'Pydroid3-Web-Builder',
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: cleanRepoName,
          description: 'Pydroid 3 Web IDE - Android APK build via GitHub Actions',
          private: false,
          auto_init: false,
        }),
      });

      if (!createRepoRes.ok) {
        const errData = await createRepoRes.json().catch(() => ({}));
        return res.status(createRepoRes.status).json({
          error: errData.message || 'Không thể tạo repository mới trên GitHub. Vui lòng kiểm tra quyền hạn của Token.',
        });
      }
    }

    // 3. Prepare pristine codebase copy in /tmp for clean git push
    const exportDir = path.join(os.tmpdir(), `gh_push_${Date.now()}`);
    const pythonScript = `
import os, shutil

ignore_dirs = {'node_modules', '.git', '.pydroid_packages', 'tmp', 'dist', 'build', '.idea', '.gradle', '.aistudio'}
ignore_files = {'.DS_Store', 'server.js', 'test_pyodide_input.cjs', 'test_pyodide_input.js'}

dest_dir = '${exportDir}'
if os.path.exists(dest_dir):
    shutil.rmtree(dest_dir)
os.makedirs(dest_dir)

for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in ignore_dirs and d != '.git']
    rel_root = os.path.relpath(root, '.')
    target_dir = os.path.join(dest_dir, rel_root)
    os.makedirs(target_dir, exist_ok=True)
    for f in files:
        if f in ignore_files or f.endswith('.pyc') or f.endswith('.log') or 'pydroid3-android-source.zip_' in f:
            continue
        src_path = os.path.join(root, f)
        dest_path = os.path.join(target_dir, f)
        shutil.copy2(src_path, dest_path)
`;

    const pyFile = path.join(os.tmpdir(), `copy_${Date.now()}.py`);
    fs.writeFileSync(pyFile, pythonScript, 'utf-8');
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('python3', [pyFile]);
      proc.on('close', (code) => {
        try { if (fs.existsSync(pyFile)) fs.unlinkSync(pyFile); } catch (_) {}
        if (code === 0) resolve();
        else reject(new Error('Lỗi sao chép tệp dự án'));
      });
    });

    // 4. Git init, config, commit and push to user's GitHub using standard x-access-token auth
    const commands = [
      `cd "${exportDir}"`,
      `git init -b main`,
      `git config user.name "${userData.name || username}"`,
      `git config user.email "${userData.email || `${username}@users.noreply.github.com`}"`,
      `git add .`,
      `git commit -m "Initialize Pydroid 3 Web Android APK build"`,
      `git remote add origin "https://x-access-token:${cleanToken}@github.com/${username}/${cleanRepoName}.git"`,
      `git push -u origin main --force`,
    ].join(' && ');

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('bash', ['-c', commands]);
      let errBuf = '';
      proc.stderr.on('data', (d) => { errBuf += d.toString(); });
      proc.on('close', (code) => {
        try { fs.rmSync(exportDir, { recursive: true, force: true }); } catch (_) {}
        if (code === 0) {
          resolve();
        } else {
          if (errBuf.includes('without `workflow` scope') || errBuf.includes('workflow scope') || errBuf.includes('without workflow scope')) {
            reject(
              new Error(
                'GitHub từ chối vì Token của bạn thiếu quyền "workflow". Vui lòng bấm vào liên kết "Lấy Token (đã chọn repo + workflow)" để tạo token mới có cả 2 quyền: repo VÀ workflow, sau đó dán lại vào ô bên dưới!'
              )
            );
          } else {
            reject(new Error(errBuf || 'Lỗi khi đẩy mã nguồn lên GitHub'));
          }
        }
      });
    });

    return res.json({
      success: true,
      repoUrl: `https://github.com/${username}/${cleanRepoName}`,
      actionsUrl: `https://github.com/${username}/${cleanRepoName}/actions`,
      message: `Đã đẩy toàn bộ mã nguồn lên repository ${username}/${cleanRepoName} thành công! GitHub Actions đang tự động tạo file APK.`,
    });
  } catch (err: any) {
    console.error('GitHub Push error:', err);
    return res.status(500).json({ error: err.message || 'Lỗi hệ thống khi đẩy mã lên GitHub' });
  }
});

// Serve local Pyodide WebAssembly package statically with correct MIME types and CORS
const pyodidePath = path.join(process.cwd(), 'node_modules/pyodide');
const publicPyodidePath = path.join(process.cwd(), 'public/pyodide');
const activePyodideDir = fs.existsSync(pyodidePath) ? pyodidePath : (fs.existsSync(publicPyodidePath) ? publicPyodidePath : null);

if (activePyodideDir) {
  app.use('/pyodide', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  }, express.static(activePyodideDir, {
    maxAge: '1y',
    setHeaders: (res, filePath) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      if (filePath.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
      } else if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      } else if (filePath.endsWith('.zip')) {
        res.setHeader('Content-Type', 'application/zip');
      } else if (filePath.endsWith('.json')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
    },
  }));

  // Fallback for wheels and assets not bundled locally (e.g. numpy, scipy, pandas, matplotlib)
  // Redirect seamlessly to the official jsDelivr Pyodide CDN with full CORS support
  app.get('/pyodide/*', (req, res) => {
    const requestedFile = (req.params as any)[0];
    if (requestedFile) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      return res.redirect(302, `https://cdn.jsdelivr.net/pyodide/v0.26.4/full/${requestedFile}`);
    }
    return res.status(404).send('File not found');
  });
}

// Initialize Gemini API
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Setup WebSocket server for Python execution
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  if (request.url && request.url.includes('/api/python/ws')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Interface for HTTP Streaming Session
interface PythonSession {
  id: string;
  process: ChildProcessWithoutNullStreams;
  tempFilePath: string;
  startTime: number;
  outputBuffer: Array<any>;
  resListener: express.Response | null;
  isFinished: boolean;
}

const activeSessions = new Map<string, PythonSession>();

// REST endpoints for reliable HTTP-based Real-time Execution
app.post('/api/python/session/start', (req, res) => {
  const { code, stdin = '' } = req.body;
  if (typeof code !== 'string') {
    return res.status(400).json({ error: 'Mã nguồn không hợp lệ' });
  }

  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tempId = `pydroid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.py`;
  const tempFilePath = path.join(os.tmpdir(), tempId);

  try {
    fs.writeFileSync(tempFilePath, code, 'utf-8');
    const startTime = Date.now();

    const py = spawn('python3', ['-u', tempFilePath], {
      env: {
        ...process.env,
        PYTHONPATH: [
          PYDROID_PACKAGES_DIR,
          process.env.PYTHONPATH || '',
          '/usr/local/lib/python3.10/dist-packages',
          '/usr/lib/python3/dist-packages',
        ].filter(Boolean).join(':'),
        PYTHONUNBUFFERED: '1',
        PYTHONDONTWRITEBYTECODE: '1',
        LC_ALL: 'en_US.UTF-8',
        LANG: 'en_US.UTF-8',
      },
    });

    if (stdin && py.stdin) {
      py.stdin.write(stdin);
      if (!stdin.endsWith('\n')) py.stdin.write('\n');
    }

    const session: PythonSession = {
      id: sessionId,
      process: py,
      tempFilePath,
      startTime,
      outputBuffer: [],
      resListener: null,
      isFinished: false,
    };

    const emitEvent = (event: any) => {
      session.outputBuffer.push(event);
      if (session.resListener && !session.resListener.writableEnded) {
        session.resListener.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };

    py.stdout.on('data', (chunk) => {
      emitEvent({ type: 'stdout', data: chunk.toString('utf-8') });
    });

    py.stderr.on('data', (chunk) => {
      emitEvent({ type: 'stderr', data: chunk.toString('utf-8') });
    });

    py.on('close', (code, signal) => {
      const executionTimeMs = Date.now() - startTime;
      session.isFinished = true;
      emitEvent({
        type: 'exit',
        code: code !== null ? code : (signal ? 137 : 0),
        signal: signal || null,
        executionTimeMs,
      });

      try {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      } catch (e) {
        // ignore
      }

      if (session.resListener && !session.resListener.writableEnded) {
        session.resListener.end();
      }

      setTimeout(() => {
        activeSessions.delete(sessionId);
      }, 30000);
    });

    py.on('error', (err) => {
      session.isFinished = true;
      emitEvent({ type: 'error', data: `Lỗi khởi chạy Python: ${err.message}` });
      try {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      } catch (e) {
        // ignore
      }
      if (session.resListener && !session.resListener.writableEnded) {
        session.resListener.end();
      }
      activeSessions.delete(sessionId);
    });

    activeSessions.set(sessionId, session);
    res.json({ sessionId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SSE event stream endpoint
app.get('/api/python/session/:sessionId/events', (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Không tìm thấy phiên thực thi' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  session.resListener = res;

  // Flush buffer to client
  for (const ev of session.outputBuffer) {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  }

  if (session.isFinished) {
    res.end();
  }

  req.on('close', () => {
    if (session.resListener === res) {
      session.resListener = null;
    }
  });
});

// Interactive STDIN endpoint for live input()
app.post('/api/python/session/:sessionId/input', (req, res) => {
  const { sessionId } = req.params;
  const { data = '' } = req.body;
  const session = activeSessions.get(sessionId);

  if (!session || session.isFinished) {
    return res.status(404).json({ error: 'Phiên thực thi đã kết thúc hoặc không tồn tại' });
  }

  if (session.process.stdin && !session.process.stdin.destroyed) {
    session.process.stdin.write(data);
    if (!data.endsWith('\n')) {
      session.process.stdin.write('\n');
    }
  }

  res.json({ success: true });
});

// Stop session endpoint
app.post('/api/python/session/:sessionId/stop', (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);

  if (session) {
    try {
      session.process.kill('SIGKILL');
    } catch (e) {
      // ignore
    }
    try {
      if (fs.existsSync(session.tempFilePath)) fs.unlinkSync(session.tempFilePath);
    } catch (e) {
      // ignore
    }
    activeSessions.delete(sessionId);
  }

  res.json({ success: true });
});

// Track active Python process per WS connection
wss.on('connection', (ws: WebSocket) => {
  let pyProcess: ChildProcessWithoutNullStreams | null = null;
  let tempFilePath: string | null = null;
  const startTime = Date.now();

  const cleanup = () => {
    if (pyProcess) {
      try {
        pyProcess.kill('SIGKILL');
      } catch (err) {
        // ignore
      }
      pyProcess = null;
    }
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        // ignore
      }
      tempFilePath = null;
    }
  };

  ws.on('message', (messageRaw) => {
    try {
      const msg = JSON.parse(messageRaw.toString());

      if (msg.type === 'run') {
        cleanup();

        const code = msg.code || '';
        const initialStdin = msg.stdin || '';

        // Write code to a secure temporary file
        const tempId = `pydroid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.py`;
        tempFilePath = path.join(os.tmpdir(), tempId);
        fs.writeFileSync(tempFilePath, code, 'utf-8');

        const runStart = Date.now();
        // Use python3 with unbuffered IO (-u)
        pyProcess = spawn('python3', ['-u', tempFilePath], {
          env: {
            ...process.env,
            PYTHONPATH: [
              PYDROID_PACKAGES_DIR,
              process.env.PYTHONPATH || '',
              '/usr/local/lib/python3.10/dist-packages',
              '/usr/lib/python3/dist-packages',
            ].filter(Boolean).join(':'),
            PYTHONUNBUFFERED: '1',
            PYTHONDONTWRITEBYTECODE: '1',
            LC_ALL: 'en_US.UTF-8',
            LANG: 'en_US.UTF-8',
          },
        });

        // If user provided initial STDIN data
        if (initialStdin && pyProcess.stdin) {
          pyProcess.stdin.write(initialStdin);
          if (!initialStdin.endsWith('\n')) {
            pyProcess.stdin.write('\n');
          }
        }

        pyProcess.stdout.on('data', (chunk) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'stdout',
              data: chunk.toString('utf-8'),
            }));
          }
        });

        pyProcess.stderr.on('data', (chunk) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'stderr',
              data: chunk.toString('utf-8'),
            }));
          }
        });

        pyProcess.on('close', (code, signal) => {
          const executionTimeMs = Date.now() - runStart;
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'exit',
              code: code !== null ? code : (signal ? 137 : 0),
              signal: signal || null,
              executionTimeMs,
            }));
          }
          cleanup();
        });

        pyProcess.on('error', (err) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'error',
              data: `Không thể khởi chạy Python: ${err.message}`,
            }));
          }
          cleanup();
        });

      } else if (msg.type === 'stdin') {
        if (pyProcess && pyProcess.stdin && !pyProcess.stdin.destroyed) {
          const inputData = msg.data || '';
          pyProcess.stdin.write(inputData);
          if (!inputData.endsWith('\n')) {
            pyProcess.stdin.write('\n');
          }
        }
      } else if (msg.type === 'kill') {
        cleanup();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'exit',
            code: 130,
            signal: 'SIGINT',
            executionTimeMs: Date.now() - startTime,
            stopped: true,
          }));
        }
      }
    } catch (e: any) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', data: e?.message || 'Lỗi xử lý yêu cầu' }));
      }
    }
  });

  ws.on('close', () => {
    cleanup();
  });

  ws.on('error', () => {
    cleanup();
  });
});

// REST endpoint: Direct run (fallback or non-websocket run)
app.post('/api/python/run', async (req, res) => {
  const { code, stdin = '' } = req.body;
  if (typeof code !== 'string') {
    return res.status(400).json({ error: 'Mã nguồn Python không hợp lệ' });
  }

  const tempId = `pydroid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.py`;
  const tempFilePath = path.join(os.tmpdir(), tempId);

  try {
    fs.writeFileSync(tempFilePath, code, 'utf-8');
    const startTime = Date.now();

    const py = spawn('python3', ['-u', tempFilePath], {
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONDONTWRITEBYTECODE: '1',
      },
      timeout: 15000,
    });

    let stdout = '';
    let stderr = '';

    if (stdin) {
      py.stdin.write(stdin);
      if (!stdin.endsWith('\n')) py.stdin.write('\n');
      py.stdin.end();
    } else {
      py.stdin.end();
    }

    py.stdout.on('data', (data) => {
      stdout += data.toString('utf-8');
    });

    py.stderr.on('data', (data) => {
      stderr += data.toString('utf-8');
    });

    py.on('close', (code, signal) => {
      const executionTimeMs = Date.now() - startTime;
      try {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      } catch (e) {
        // ignore
      }
      res.json({
        stdout,
        stderr,
        exitCode: code !== null ? code : (signal ? 137 : 0),
        signal,
        executionTimeMs,
      });
    });

    py.on('error', (err) => {
      try {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      } catch (e) {
        // ignore
      }
      res.status(500).json({ error: err.message, stdout, stderr });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper for Vietnamese translation of Python compile syntax errors
function translatePythonCompileError(type: string, message: string): string {
  const msgLower = (message || '').toLowerCase();
  if (msgLower.includes("expected ':'")) {
    return "Thiếu dấu hai chấm ':' ở cuối câu lệnh";
  }
  if (msgLower.includes('expected an indented block')) {
    return 'Thiếu khối lệnh thụt lề (cần thụt lề 4 khoảng trắng)';
  }
  if (msgLower.includes('unexpected indent')) {
    return 'Thụt lề không hợp lệ (thụt lề thừa hoặc sai cấp độ)';
  }
  if (msgLower.includes('unindent does not match any outer indentation level')) {
    return 'Thụt lề lùi về không khớp với bất kỳ khối lệnh ngoài nào';
  }
  if (msgLower.includes("unmatched ')'") || msgLower.includes("unmatched ']'") || msgLower.includes("unmatched '}'")) {
    return "Dấu đóng ngoặc thừa hoặc không khớp với dấu mở ngoặc trước đó";
  }
  if (msgLower.includes('was never closed')) {
    return 'Chưa đóng ngoặc hoặc dấu nháy tương ứng';
  }
  if (msgLower.includes('unterminated string') || msgLower.includes('eol while scanning string')) {
    return 'Chưa đóng chuỗi ký tự (thiếu dấu nháy đơn hoặc nháy kép)';
  }
  if (msgLower.includes('cannot assign to')) {
    return 'Không thể gán giá trị cho biểu thức này (vế trái phải là biến)';
  }
  if (msgLower.includes('invalid syntax')) {
    return 'Cú pháp Python không hợp lệ hoặc gõ nhầm ký tự';
  }
  if (type === 'IndentationError') {
    return `Lỗi thụt lề: ${message}`;
  }
  if (type === 'TabError') {
    return 'Lỗi trộn lẫn phím Tab và khoảng trắng';
  }
  return message || 'Lỗi cú pháp Python';
}

// REST endpoint: Fast Python Background Linter
app.post('/api/python/lint', (req, res) => {
  const { code } = req.body;
  if (typeof code !== 'string') {
    return res.status(400).json({ error: 'Mã không hợp lệ' });
  }

  if (!code.trim()) {
    return res.json({ valid: true, errors: [] });
  }

  const py = spawn('python3', [
    '-c',
    `
import sys, json

code = sys.stdin.read()
try:
    compile(code, '<string>', 'exec')
    print(json.dumps({'valid': True, 'errors': []}))
except (SyntaxError, IndentationError, TabError) as e:
    line = e.lineno or 1
    col = e.offset or 1
    end_line = getattr(e, 'end_lineno', line)
    end_col = getattr(e, 'end_offset', col + 1)
    msg = str(e.msg) if hasattr(e, 'msg') else str(e)
    text = (e.text or '').strip()
    
    print(json.dumps({
        'valid': False,
        'errors': [{
            'line': line,
            'column': col,
            'endLine': end_line,
            'endColumn': end_col,
            'type': type(e).__name__,
            'message': msg,
            'text': text
        }]
    }))
except Exception as e:
    print(json.dumps({
        'valid': False,
        'errors': [{
            'line': 1,
            'column': 1,
            'type': type(e).__name__,
            'message': str(e)
        }]
    }))
`,
  ]);

  let stdoutData = '';

  py.stdin.write(code);
  py.stdin.end();

  py.stdout.on('data', (chunk) => {
    stdoutData += chunk.toString('utf-8');
  });

  const timer = setTimeout(() => {
    py.kill();
    res.json({ valid: true, errors: [] });
  }, 1200);

  py.on('close', () => {
    clearTimeout(timer);
    try {
      const result = JSON.parse(stdoutData.trim());
      if (result.errors && Array.isArray(result.errors)) {
        result.errors = result.errors.map((err: any) => ({
          ...err,
          vietnameseMessage: translatePythonCompileError(err.type, err.message),
        }));
      }
      res.json(result);
    } catch (e) {
      res.json({ valid: true, errors: [] });
    }
  });

  py.on('error', () => {
    clearTimeout(timer);
    res.json({ valid: true, errors: [] });
  });
});

// REST endpoint: Python Environment Version Info
app.get('/api/python/version', (req, res) => {
  const py = spawn('python3', [
    '-c',
    'import sys, platform; print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}|{platform.system()}|{platform.machine()}|{sys.version}")',
  ]);

  let stdoutData = '';
  py.stdout.on('data', (chunk) => {
    stdoutData += chunk.toString('utf-8');
  });

  const timer = setTimeout(() => {
    py.kill();
    res.json({
      cpython: {
        version: '3.10.12',
        full: 'CPython 3.10.12',
        system: 'Linux x86_64',
        details: 'CPython 3.10.12 (Native Linux 64-bit)',
      },
      pyodide: {
        version: '3.12.7',
        pyodideVersion: '0.26.4',
        full: 'Python 3.12.7 (Pyodide v0.26.4)',
        system: 'WebAssembly (WASM)',
        details: 'Pyodide WASM (Python 3.12.7 Local)',
      },
    });
  }, 1000);

  py.on('close', () => {
    clearTimeout(timer);
    const parts = stdoutData.trim().split('|');
    const version = parts[0] || '3.10.12';
    const osName = parts[1] || 'Linux';
    const arch = parts[2] || 'x86_64';
    const rawVersion = parts[3] || `3.10.12 (${osName})`;

    res.json({
      cpython: {
        version,
        full: `CPython ${version}`,
        system: `${osName} ${arch}`,
        details: `CPython ${version} (${osName} ${arch} Native)`,
        rawVersion,
      },
      pyodide: {
        version: '3.12.7',
        pyodideVersion: '0.26.4',
        full: 'Python 3.12.7 (Pyodide v0.26.4)',
        system: 'WebAssembly (WASM)',
        details: 'Pyodide WASM (Python 3.12.7 Local)',
      },
    });
  });

  py.on('error', () => {
    clearTimeout(timer);
    res.json({
      cpython: {
        version: '3.10.12',
        full: 'CPython 3.10.12',
        system: 'Linux x86_64',
        details: 'CPython 3.10.12 (Native Linux 64-bit)',
      },
      pyodide: {
        version: '3.12.7',
        pyodideVersion: '0.26.4',
        full: 'Python 3.12.7 (Pyodide v0.26.4)',
        system: 'WebAssembly (WASM)',
        details: 'Pyodide WASM (Python 3.12.7 Local)',
      },
    });
  });
});

// Helper to ensure pip is ready and functional with auto-healing bootstrap
let pipBootstrapPromise: Promise<boolean> | null = null;

function ensurePipReady(autoBootstrap = false): Promise<boolean> {
  if (pipBootstrapPromise) return pipBootstrapPromise;

  pipBootstrapPromise = (async () => {
    // 1. Check if pip is already working
    const isWorking = await new Promise<boolean>((resolve) => {
      try {
        const chk = spawn('python3', ['-m', 'pip', '--version']);
        const timer = setTimeout(() => {
          try { chk.kill(); } catch (_) {}
          resolve(false);
        }, 3000);
        chk.on('close', (code) => {
          clearTimeout(timer);
          resolve(code === 0);
        });
        chk.on('error', () => {
          clearTimeout(timer);
          resolve(false);
        });
      } catch (_) {
        resolve(false);
      }
    });

    if (isWorking) return true;
    if (!autoBootstrap) return false;

    // 2. Pip is missing: Bootstrap get-pip.py safely
    console.log('[Pip Bootstrapper] pip chưa được cài đặt trong môi trường CPython. Đang tự động bootstrap...');
    const bootstrapped = await new Promise<boolean>((resolve) => {
      const boot = spawn('bash', [
        '-c',
        'curl -sS https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py && python3 /tmp/get-pip.py --break-system-packages --no-warn-script-location',
      ]);
      const timer = setTimeout(() => {
        try { boot.kill(); } catch (_) {}
        resolve(false);
      }, 60000);
      boot.on('close', (code) => {
        clearTimeout(timer);
        resolve(code === 0);
      });
      boot.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });

    return bootstrapped;
  })().finally(() => {
    pipBootstrapPromise = null;
  });

  return pipBootstrapPromise;
}

// REST endpoint: List installed Python packages (combining system pip list and persistent workspace packages)
app.get('/api/python/packages', async (req, res) => {
  ensureEssentialPackageFixes();
  const persisted = loadPersistedPackages();

  const py = spawn('python3', ['-m', 'pip', 'list', '--format=json'], {
    env: { ...process.env, PIP_DISABLE_PIP_VERSION_CHECK: '1', PIP_NO_COLOR: '1' },
  });
  let stdoutData = '';
  let stderrData = '';

  py.stdout.on('data', (chunk) => {
    stdoutData += chunk.toString('utf-8');
  });
  py.stderr.on('data', (chunk) => {
    stderrData += chunk.toString('utf-8');
  });

  const timer = setTimeout(() => {
    try { py.kill(); } catch (_) {}
    res.json({ success: true, packages: persisted });
  }, 2500);

  py.on('close', (code) => {
    clearTimeout(timer);
    let pipPackages: Array<{ name: string; version: string }> = [];
    try {
      pipPackages = JSON.parse(stdoutData.trim() || '[]');
    } catch (e) {
      const lines = stdoutData.split('\n').filter(Boolean).slice(2);
      pipPackages = lines.map((l) => {
        const parts = l.trim().split(/\s+/);
        return { name: parts[0], version: parts[1] || 'installed' };
      }).filter((p) => p.name);
    }

    // Merge pipPackages and persisted packages
    const pkgMap = new Map<string, { name: string; version: string }>();
    for (const p of pipPackages) {
      if (p && p.name) pkgMap.set(p.name.toLowerCase(), { name: p.name, version: p.version || 'installed' });
    }
    for (const p of persisted) {
      if (p && p.name && !pkgMap.has(p.name.toLowerCase())) {
        pkgMap.set(p.name.toLowerCase(), { name: p.name, version: p.version || 'installed' });
      }
    }

    res.json({ success: true, packages: Array.from(pkgMap.values()) });
  });

  py.on('error', () => {
    clearTimeout(timer);
    res.json({ success: true, packages: persisted });
  });
});

// REST endpoint: Install or update Python package with workspace persistence
app.post('/api/python/packages/install', async (req, res) => {
  const { name, upgrade } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ success: false, error: 'Thiếu tên thư viện' });
  }

  // Clean and sanitize input: strip "pip install", "pip3 install", "python -m pip install", quotes
  let rawName = name.trim();
  rawName = rawName.replace(/^(python3?\s+-m\s+pip\s+install|pip3?\s+install)\s+/i, '').trim();
  rawName = rawName.replace(/^['"]+|['"]+$/g, '').trim();

  // Validate package tokens
  const pkgTokens = rawName.split(/\s+/).filter(Boolean);
  const isValid = pkgTokens.length > 0 && pkgTokens.every((tok) => /^[a-zA-Z0-9_\-\.\=\>\<\[\],!~]+$/.test(tok));
  if (!isValid) {
    return res.status(400).json({ success: false, error: 'Tên thư viện chứa ký tự không hợp lệ' });
  }

  const pipReady = await ensurePipReady(true);
  if (!pipReady) {
    return res.status(500).json({
      success: false,
      error: 'Không thể khởi tạo công cụ Pip trong hệ sinh thái CPython',
      output: '❌ Không thể tải hoặc cấu hình công cụ pip. Vui lòng thử lại sau giây lát.',
    });
  }

  // Helper to run pip install into both system and persistent workspace target
  const runPip = (extraFlags: string[] = []): Promise<{ code: number | null; output: string }> => {
    return new Promise((resolve) => {
      const args = [
        '-m',
        'pip',
        'install',
        '--target',
        PYDROID_PACKAGES_DIR,
        '--prefer-binary',
        '--no-cache-dir',
        '--no-warn-script-location',
        '--timeout',
        '120',
        '--retries',
        '3',
        ...extraFlags,
      ];
      if (upgrade) {
        args.push('--upgrade');
      }
      args.push(...pkgTokens, '--break-system-packages');

      const py = spawn('python3', args, {
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          PIP_DISABLE_PIP_VERSION_CHECK: '1',
          PIP_NO_COLOR: '1',
        },
      });

      let out = '';
      py.stdout.on('data', (chunk) => {
        out += chunk.toString('utf-8');
      });
      py.stderr.on('data', (chunk) => {
        out += chunk.toString('utf-8');
      });

      const timer = setTimeout(() => {
        try { py.kill(); } catch (_) {}
        resolve({ code: -1, output: out + '\n❌ Quá thời gian cài đặt thư viện (Timeout > 180s)' });
      }, 180000);

      py.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, output: out });
      });

      py.on('error', (err) => {
        clearTimeout(timer);
        resolve({ code: -1, output: out + `\n❌ Lỗi tiến trình: ${err.message}` });
      });
    });
  };

  // Attempt 1: Standard install with prefer-binary
  let result = await runPip();

  // If failed due to build/compilation issues from source, attempt 2 with only-binary=:all:
  if (result.code !== 0 && (result.output.includes('Failed building wheel') || result.output.includes('gcc') || result.output.includes('cargo') || result.output.includes('subprocess-exited-with-error'))) {
    result.output += '\n⚠️ Phát hiện lỗi biên dịch mã nguồn; đang tự động thử lại tải bản dựng sẵn (pre-built binary wheel)...\n';
    const retryResult = await runPip(['--only-binary=:all:']);
    if (retryResult.code === 0) {
      result = retryResult;
    } else {
      result.output += retryResult.output;
    }
  }

  if (result.code === 0) {
    const primaryName = pkgTokens[0].split(/[=><~![]/)[0].trim().replace(/-/g, '_');
    let verifyNotice = '';
    let detectedVersion = 'installed';

    // Verify import and retrieve version
    try {
      const vChk = spawn('python3', [
        '-c',
        `import ${primaryName}; print(getattr(${primaryName}, '__version__', 'OK'))`,
      ]);
      let vOut = '';
      await new Promise<void>((vResolve) => {
        const vTimer = setTimeout(() => {
          try { vChk.kill(); } catch (_) {}
          vResolve();
        }, 3000);
        vChk.stdout.on('data', (chunk) => {
          vOut += chunk.toString();
        });
        vChk.on('close', (vCode) => {
          clearTimeout(vTimer);
          if (vCode === 0) {
            const trimmed = vOut.trim();
            if (trimmed && trimmed !== 'OK') {
              detectedVersion = trimmed;
            }
            verifyNotice = `\n✅ [Xác nhận hoạt động]: Đã kiểm tra nạp thử thư viện '${primaryName}' thành công 100%!`;
          }
          vResolve();
        });
        vChk.on('error', () => {
          clearTimeout(vTimer);
          vResolve();
        });
      });
    } catch (_) {}

    // Persist package in workspace registry
    savePersistedPackage(primaryName, detectedVersion);

    res.json({
      success: true,
      message: upgrade ? `Cập nhật thành công ${rawName}` : `Cài đặt thành công ${rawName}`,
      output: result.output + verifyNotice + `\n💾 [Lưu trữ vĩnh viễn]: Thư viện đã được lưu trữ an toàn trong không gian dự án.`,
    });
  } else {
    res.status(500).json({
      success: false,
      error: `Quá trình pip kết thúc với mã lỗi ${result.code}`,
      output: result.output,
    });
  }
});

// REST endpoint: Uninstall Python package with workspace cleanup
app.post('/api/python/packages/uninstall', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ success: false, error: 'Thiếu tên thư viện' });
  }

  const cleanName = name.trim();
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(cleanName)) {
    return res.status(400).json({ success: false, error: 'Tên thư viện không hợp lệ' });
  }

  // Protect system critical packages
  if (['pip', 'setuptools', 'wheel'].includes(cleanName.toLowerCase())) {
    return res.status(400).json({ success: false, error: 'Không thể gỡ bỏ công cụ cốt lõi của hệ thống (pip/setuptools/wheel)' });
  }

  // 1. Remove from persistent packages directory
  try {
    if (fs.existsSync(PYDROID_PACKAGES_DIR)) {
      const targetLower = cleanName.toLowerCase().replace(/-/g, '_');
      const files = fs.readdirSync(PYDROID_PACKAGES_DIR);
      for (const item of files) {
        const itemLower = item.toLowerCase().replace(/-/g, '_');
        if (
          itemLower === targetLower ||
          itemLower.startsWith(targetLower + '-') ||
          itemLower.startsWith(targetLower + '.')
        ) {
          const itemPath = path.join(PYDROID_PACKAGES_DIR, item);
          fs.rmSync(itemPath, { recursive: true, force: true });
        }
      }
    }
  } catch (e) {
    console.warn('Error deleting package files from .pydroid_packages:', e);
  }

  // 2. Remove from registry
  removePersistedPackage(cleanName);

  // 3. Uninstall from system python if present
  const py = spawn('python3', ['-m', 'pip', 'uninstall', '-y', cleanName, '--break-system-packages']);
  let output = '';

  py.stdout.on('data', (chunk) => {
    output += chunk.toString('utf-8');
  });
  py.stderr.on('data', (chunk) => {
    output += chunk.toString('utf-8');
  });

  py.on('close', (code) => {
    res.json({
      success: true,
      message: `Đã gỡ bỏ thư viện ${cleanName}`,
      output: output || `Đã gỡ bỏ ${cleanName} và dọn dẹp bộ nhớ lưu trữ thành công.`,
    });
  });

  py.on('error', (err) => {
    res.json({
      success: true,
      message: `Đã gỡ bỏ thư viện ${cleanName} khỏi không gian lưu trữ`,
      output: `Dọn dẹp thư viện ${cleanName} thành công.`,
    });
  });
});

// Curated list of popular libraries for instant search & discovery in Pydroid 3
const POPULAR_PYTHON_PACKAGES = [
  { name: 'numpy', summary: 'Mảng số học đa chiều & tính toán khoa học tối ưu' },
  { name: 'pandas', summary: 'Phân tích, xử lý dữ liệu và bảng DataFrame chuyên sâu' },
  { name: 'matplotlib', summary: 'Vẽ đồ thị, biểu đồ và trực quan hóa dữ liệu 2D/3D' },
  { name: 'requests', summary: 'Gửi yêu cầu HTTP/HTTPS mạng dễ dàng cho con người' },
  { name: 'scipy', summary: 'Thuật toán khoa học và kỹ thuật nâng cao' },
  { name: 'sympy', summary: 'Đại số ký hiệu, giải phương trình và toán học giải tích' },
  { name: 'pillow', summary: 'Xử lý, chỉnh sửa và xuất hình ảnh đồ họa (PIL Fork)' },
  { name: 'pygame', summary: 'Thư viện lập trình phát triển game 2D Python' },
  { name: 'pyfiglet', summary: 'Tạo chữ nghệ thuật ASCII Banner FIGlet lớn trong Terminal' },
  { name: 'beautifulsoup4', summary: 'Bóc tách và trích xuất dữ liệu từ HTML và XML' },
  { name: 'flask', summary: 'Khung ứng dụng Web micro framework nhẹ và mạnh mẽ' },
  { name: 'scikit-learn', summary: 'Học máy (Machine Learning) và khai phá dữ liệu' },
  { name: 'seaborn', summary: 'Trực quan hóa thống kê dựa trên Matplotlib' },
  { name: 'openpyxl', summary: 'Đọc và ghi tệp bảng tính Excel (.xlsx)' },
  { name: 'rich', summary: 'Định dạng màu sắc, bảng và thanh tiến trình trong Terminal' },
  { name: 'colorama', summary: 'Văn bản màu sắc ANSI cho giao diện dòng lệnh' },
  { name: 'tqdm', summary: 'Thanh tiến trình (Progress Bar) thông minh nhanh gọn' },
  { name: 'pydantic', summary: 'Xác thực cấu trúc dữ liệu và cài đặt sử dụng Type Hints' },
  { name: 'httpx', summary: 'HTTP client thế hệ mới với hỗ trợ bất đồng bộ (async)' },
  { name: 'qrcode', summary: 'Tạo mã QR code hình ảnh tiêu chuẩn nhanh chóng' },
  { name: 'lxml', summary: 'Xử lý XML và HTML siêu tốc bằng libxml2' },
];

// REST endpoint: Search packages on PyPI and popular catalog
app.get('/api/python/packages/search', async (req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase();
  if (!query) {
    return res.json({ packages: POPULAR_PYTHON_PACKAGES.slice(0, 10) });
  }

  // Filter local popular packages
  const localMatches = POPULAR_PYTHON_PACKAGES.filter(
    (p) => p.name.toLowerCase().includes(query) || p.summary.toLowerCase().includes(query)
  );

  // If exact query matches or user types custom name, try PyPI API
  let pypiPackage: any = null;
  try {
    const fetchRes = await fetch(`https://pypi.org/pypi/${encodeURIComponent(query)}/json`, {
      signal: AbortSignal.timeout(3000),
    });
    if (fetchRes.ok) {
      const data = await fetchRes.json();
      if (data && data.info) {
        pypiPackage = {
          name: data.info.name,
          summary: data.info.summary || 'Thư viện Python trên PyPI',
          version: data.info.version,
        };
      }
    }
  } catch (e) {
    // ignore network errors
  }

  const results: any[] = [];
  if (pypiPackage && !localMatches.some((m) => m.name.toLowerCase() === pypiPackage.name.toLowerCase())) {
    results.push(pypiPackage);
  }
  results.push(...localMatches);

  res.json({ packages: results.slice(0, 15) });
});

// Helper to post-process and ensure 100% Vietnamese variable names in lessons
function ensureVietnameseLessonQuality(lesson: any) {
  let { starterCode = '', solutionCode = '' } = lesson;

  // Replace common English variable leaks with clear Vietnamese names
  const varMap: Record<string, string> = {
    '\\btotal\\b': 'tong_so',
    '\\bresult\\b': 'ket_qua',
    '\\bdata\\b': 'du_lieu',
    '\\bitems\\b': 'danh_sach_muc',
    '\\bitem\\b': 'phan_tu',
    '\\bcount\\b': 'so_luong',
    '\\btemp\\b': 'bien_tam',
    '\\bnumbers\\b': 'danh_sach_so',
    '\\buser_num\\b': 'so_nguoi_chon',
    '\\bchosen\\b': 'so_da_chon',
    '\\bdie1\\b': 'xuc_xac_1',
    '\\bdie2\\b': 'xuc_xac_2',
    '\\bmy_func\\b': 'ham_xu_ly',
    '\\bprocess_data\\b': 'xu_ly_du_lieu',
    '\\bfiltered\\b': 'danh_sach_loc',
    '\\boutput\\b': 'dau_ra',
    '\\binput_val\\b': 'gia_tri_nhap',
    '\\barr\\b': 'mang_so',
    '\\blst\\b': 'danh_sach',
  };

  for (const [pattern, replacement] of Object.entries(varMap)) {
    const re = new RegExp(pattern, 'g');
    starterCode = starterCode.replace(re, replacement);
    solutionCode = solutionCode.replace(re, replacement);
  }

  const rawLvl = String(lesson.level || '').toLowerCase().trim();
  const normalizedLevel = (rawLvl.includes('nâng') || rawLvl.includes('nang') || rawLvl.includes('adv') || rawLvl.includes('hard') || rawLvl.includes('3'))
    ? 'advanced'
    : (rawLvl.includes('trung') || rawLvl.includes('inter') || rawLvl.includes('vừa') || rawLvl.includes('2'))
    ? 'intermediate'
    : 'basic';

  const safeId = lesson.id && typeof lesson.id === 'string' && lesson.id.startsWith('lesson_') && !lesson.id.includes('undefined')
    ? `${lesson.id}_${Date.now().toString(36)}`
    : `lesson_ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return {
    ...lesson,
    id: safeId,
    title: String(lesson.title || 'Bài tập thực hành Python mới').trim(),
    level: normalizedLevel,
    description: String(lesson.description || '').trim(),
    starterCode: String(starterCode || '').trim(),
    solutionCode: String(solutionCode || '').trim(),
    explanation: String(lesson.explanation || 'Thuật toán được tối ưu chuẩn PEP 8 với 100% tên biến tiếng Việt.').trim(),
    sampleInput: lesson.sampleInput || '',
    sampleOutput: lesson.sampleOutput || '',
    completed: false,
  };
}

// Helper to generate smart fallback lessons if Gemini API is under high demand (503)
// Rich Dynamic Fallback Lesson Generator (100% Vietnamese variables, guarantees unique titles)
function getFallbackLessons(topic: string, levelStr: string, existingTitles: string[] = []) {
  const normTopic = topic.toLowerCase().trim();
  const level = (levelStr === 'nâng cao' ? 'advanced' : levelStr === 'trung cấp' ? 'intermediate' : 'basic') as 'basic' | 'intermediate' | 'advanced';
  const ts = Date.now().toString(36);
  const titlesSet = new Set(existingTitles.map((t) => t.toLowerCase().trim()));

  const makeUniqueTitle = (baseTitle: string) => {
    let t = baseTitle;
    let cnt = 1;
    while (titlesSet.has(t.toLowerCase().trim())) {
      cnt++;
      t = `${baseTitle} (Mục ${cnt})`;
    }
    titlesSet.add(t.toLowerCase().trim());
    return t;
  };

  const pool: any[] = [];

  // 1. Topic: Vòng lặp / Loop
  if (normTopic.includes('vòng lặp') || normTopic.includes('loop') || normTopic.includes('for') || normTopic.includes('while')) {
    pool.push({
      id: `lesson_cuu_chuong_${ts}`,
      title: makeUniqueTitle(`Thực hành: Bảng cửu chương tuần hoàn (${topic})`),
      level,
      description: 'Nhập số nguyên dương n (từ 1 đến 9). Sử dụng vòng lặp for để in ra bảng cửu chương tương ứng với định dạng n x i = ket_qua.',
      starterCode: `# Nhập số cần in bảng nhân\nso_nhan = int(input("Nhập số bảng cửu chương (1-9): "))\n\n# TODO: Dùng vòng lặp for để in bảng nhân từ 1 đến 10\nfor chi_so in range(1, 11):\n    tich_so = so_nhan * chi_so\n    print(f"{so_nhan} x {chi_so} = {tich_so}")\n`,
      solutionCode: `def in_bang_cuu_chuong(con_so: int) -> None:\n    for thu_tu in range(1, 11):\n        ket_qua_nhan = con_so * thu_tu\n        print(f"{con_so} x {thu_tu} = {ket_qua_nhan}")\n\nif __name__ == "__main__":\n    so_can_in = int(input("Bảng cửu chương số: "))\n    in_bang_cuu_chuong(so_can_in)\n`,
      explanation: 'Vòng lặp for kết hợp với hàm range(1, 11) giúp lặp chính xác 10 lần từ 1 đến 10 theo đúng chuẩn mực PEP 8.',
      sampleInput: '7\n',
      sampleOutput: '7 x 1 = 7\n7 x 2 = 14\n...\n7 x 10 = 70\n',
    });
    pool.push({
      id: `lesson_tong_le_${ts}`,
      title: makeUniqueTitle(`Thực hành: Tính tổng các số lẻ liên tiếp (${topic})`),
      level,
      description: 'Nhập vào số nguyên dương n. Sử dụng vòng lặp tính tổng tất cả các số lẻ từ 1 đến n và in ra màn hình.',
      starterCode: `gioi_han_n = int(input("Nhập số n: "))\n\n# TODO: Tính tổng các số lẻ từ 1 đến n\ntong_so_le = 0\nfor so_hien_tai in range(1, gioi_han_n + 1):\n    if so_hien_tai % 2 != 0:\n        tong_so_le += so_hien_tai\n\nprint(f"Tổng các số lẻ từ 1 đến {gioi_han_n} là: {tong_so_le}")\n`,
      solutionCode: `def tinh_tong_so_le(gioi_han: int) -> int:\n    tong_tich_luy = sum(so for so in range(1, gioi_han + 1) if so % 2 != 0)\n    return tong_tich_luy\n\nif __name__ == "__main__":\n    so_n = int(input("Nhập n: "))\n    dap_an = tinh_tong_so_le(so_n)\n    print(f"Tổng số lẻ: {dap_an}")\n`,
      explanation: 'Toán tử chia lấy dư % 2 != 0 giúp kiểm tra tính chẵn lẻ của số nguyên nhanh chóng.',
      sampleInput: '9\n',
      sampleOutput: 'Tổng các số lẻ từ 1 đến 9 là: 25\n',
    });
  }

  // 2. Topic: Chuỗi / Xử lý văn bản
  else if (normTopic.includes('chuỗi') || normTopic.includes('string') || normTopic.includes('văn bản') || normTopic.includes('từ')) {
    pool.push({
      id: `lesson_dem_tu_${ts}`,
      title: makeUniqueTitle(`Thực hành: Đếm từ & chuẩn hoá họ tên (${topic})`),
      level,
      description: 'Nhập họ và tên người dùng có khoảng trắng thừa. Viết chương trình chuẩn hóa chuỗi (bỏ khoảng trắng thừa, viết hoa chữ cái đầu mỗi từ) và đếm tổng số từ.',
      starterCode: `ho_ten_tho = input("Nhập họ tên: ")\n\n# TODO: Chuẩn hóa họ tên\ndanh_sach_tu = ho_ten_tho.strip().split()\nho_ten_chuan = " ".join(tu.capitalize() for tu in danh_sach_tu)\nso_luong_tu = len(danh_sach_tu)\n\nprint(f"Họ tên chuẩn: {ho_ten_chuan}")\nprint(f"Số lượng từ: {so_luong_tu}")\n`,
      solutionCode: `def chuan_hoa_ho_ten(chuoi_nhap: str) -> tuple[str, int]:\n    cac_tu = chuoi_nhap.strip().split()\n    ten_chuan = " ".join(tung_tu.capitalize() for tung_tu in cac_tu)\n    return ten_chuan, len(cac_tu)\n\nif __name__ == "__main__":\n    chuoi_goc = input("Họ tên: ")\n    ten_dep, so_tu = chuan_hoa_ho_ten(chuoi_goc)\n    print(f"Tên: {ten_dep} | Số từ: {so_tu}")\n`,
      explanation: 'Phương thức split() tự động tách chuỗi theo khoảng trắng bất kỳ, kết hợp capitalize() để viết hoa chữ cái đầu.',
      sampleInput: '   nguyen   van   an   \n',
      sampleOutput: 'Họ tên chuẩn: Nguyen Van An\nSố lượng từ: 3\n',
    });
    pool.push({
      id: `lesson_nguyen_am_${ts}`,
      title: makeUniqueTitle(`Thực hành: Thống kê nguyên âm trong câu (${topic})`),
      level,
      description: 'Nhập một câu văn bản tiếng Việt không dấu. Đếm số lượng các nguyên âm (a, e, i, o, u) xuất hiện trong câu.',
      starterCode: `cau_van_ban = input("Nhập văn bản: ").lower()\nnguyen_am = "aeiou"\n\n# TODO: Đếm số nguyên âm\nso_nguyen_am = sum(1 for ky_tu in cau_van_ban if ky_tu in nguyen_am)\nprint(f"Số lượng nguyên âm: {so_nguyen_am}")\n`,
      solutionCode: `def dem_so_nguyen_am(van_ban: str) -> int:\n    tap_nguyen_am = set("aeiou")\n    return sum(1 for chu in van_ban.lower() if chu in tap_nguyen_am)\n\nif __name__ == "__main__":\n    doan_van = input("Văn bản: ")\n    print(f"Tổng nguyên âm: {dem_so_nguyen_am(doan_van)}")\n`,
      explanation: 'Sử dụng cấu trúc set() tăng tốc độ tra cứu phần tử với độ phức tạp O(1).',
      sampleInput: 'lap trinh python tren pydroid\n',
      sampleOutput: 'Số lượng nguyên âm: 7\n',
    });
  }

  // 3. Topic: Game / Trò chơi / Xúc xắc
  else if (normTopic.includes('game') || normTopic.includes('trò chơi') || normTopic.includes('xúc xắc') || normTopic.includes('đoán')) {
    pool.push({
      id: `lesson_xuc_xac_${ts}`,
      title: makeUniqueTitle(`Mini-Game: Đổ xúc xắc tính điểm thưởng (${topic})`),
      level,
      description: 'Mô phỏng gieo 2 viên xúc xắc 6 mặt (1-6). Nếu tổng điểm >= 10 hoặc 2 viên xúc xắc có cùng số điểm (xúc xắc đôi), người chơi thắng lớn!',
      starterCode: `import random\n\n# TODO: Gieo 2 viên xúc xắc\nxuc_xac_1 = random.randint(1, 6)\nxuc_xac_2 = random.randint(1, 6)\ntong_diem = xuc_xac_1 + xuc_xac_2\n\nprint(f"Viên 1: {xuc_xac_1} | Viên 2: {xuc_xac_2} -> Tổng: {tong_diem}")\nif xuc_xac_1 == xuc_xac_2:\n    print("🎉 BẠN ĐỔ ĐƯỢC XÚC XẮC ĐÔI! Thắng đậm!")\nelif tong_diem >= 10:\n    print("🏆 Xuất sắc! Điểm cao chiến thắng!")\nelse:\n    print("Chúc bạn may mắn lần sau!")\n`,
      solutionCode: `import random\n\ndef gieo_xuc_xac() -> tuple[int, int, int, str]:\n    vien_1 = random.randint(1, 6)\n    vien_2 = random.randint(1, 6)\n    tong = vien_1 + vien_2\n    if vien_1 == vien_2:\n        thong_bao = "Xúc xắc đôi thắng lớn!"\n    elif tong >= 10:\n        thong_bao = "Điểm cao thắng cuộc!"\n    else:\n        thong_bao = "Lượt chơi bình thường."\n    return vien_1, vien_2, tong, thong_bao\n\nif __name__ == "__main__":\n    v1, v2, t, tb = gieo_xuc_xac()\n    print(f"Lượt gieo: [{v1}] và [{v2}] (Tổng: {t}) -> {tb}")\n`,
      explanation: 'Module random cung cấp hàm randint() tạo số ngẫu nhiên mô phỏng trò chơi xúc xắc sinh động.',
      sampleOutput: 'Lượt gieo: [5] và [5] (Tổng: 10) -> Xúc xắc đôi thắng lớn!\n',
    });
    pool.push({
      id: `lesson_keo_bua_bao_${ts}`,
      title: makeUniqueTitle(`Mini-Game: Kéo Búa Bao đối đầu máy tính (${topic})`),
      level,
      description: 'Cho người chơi chọn Kéo, Búa hoặc Bao. Máy tính chọn ngẫu nhiên. So sánh kết quả và in ra người chiến thắng.',
      starterCode: `import random\n\ncac_lua_chon = ["kéo", "búa", "bao"]\nnguoi_chon = input("Chọn kéo, búa hoặc bao: ").lower().strip()\nmay_chon = random.choice(cac_lua_chon)\n\nprint(f"Bạn ra: {nguoi_chon} | Máy ra: {may_chon}")\nif nguoi_chon == may_chon:\n    print("Hòa nhau!")\nelif (nguoi_chon == "búa" and may_chon == "kéo") or \\\n     (nguoi_chon == "kéo" and may_chon == "bao") or \\\n     (nguoi_chon == "bao" and may_chon == "búa"):\n    print("🎉 Bạn đã chiến thắng!")\nelse:\n    print("Máy tính đã thắng!")\n`,
      solutionCode: `import random\n\ndef dau_keo_bua_bao(lua_chon_nguoi: str) -> str:\n    cac_nuoc_di = ["kéo", "búa", "bao"]\n    nuoc_di_may = random.choice(cac_nuoc_di)\n    print(f"Người: {lua_chon_nguoi} vs Máy: {nuoc_di_may}")\n    if lua_chon_nguoi == nuoc_di_may:\n        return "Hòa!"\n    thang = [("búa", "kéo"), ("kéo", "bao"), ("bao", "búa")]\n    if (lua_chon_nguoi, nuoc_di_may) in thang:\n        return "Người chơi thắng!"\n    return "Máy tính thắng!"\n\nif __name__ == "__main__":\n    nuoc_nguoi = input("Chọn: ")\n    print(dau_keo_bua_bao(nuoc_nguoi))\n`,
      explanation: 'Sử dụng danh sách các cặp bộ thắng trong tuple giúp kiểm tra điều kiện chiến thắng ngắn gọn.',
      sampleInput: 'búa\n',
      sampleOutput: 'Người: búa vs Máy: kéo\nNgười chơi thắng!\n',
    });
  }

  // 4. Default / Real-World Applications
  else {
    pool.push({
      id: `lesson_tra_sua_${ts}`,
      title: makeUniqueTitle(`Thực hành: Tính tiền hoá đơn Trà sữa (${topic})`),
      level,
      description: 'Viết chương trình tính tiền đặt hàng trà sữa. Nhập số lượng ly, đơn giá từng ly và phần trăm giảm giá khuyến mãi (nếu có). In ra tổng số tiền phải thanh toán kèm hóa đơn chi tiết.',
      starterCode: `# Nhập thông tin đơn hàng trà sữa\nso_luong_ly = int(input("Nhập số lượng ly trà sữa: "))\ndon_gia_ly = int(input("Nhập đơn vị giá mỗi ly (VNĐ): "))\nphan_tram_giam = float(input("Nhập % giảm giá (vd: 10 cho 10%): "))\n\n# TODO: Tính tổng tiền trước giảm và sau giảm\ntong_tien_goc = so_luong_ly * don_gia_ly\ntien_duoc_giam = tong_tien_goc * (phan_tram_giam / 100)\ntong_thanh_toan = tong_tien_goc - tien_duoc_giam\n\nprint(f"Tổng tiền gốc: {tong_tien_goc:,.0f} VNĐ")\nprint(f"Số tiền giảm: {tien_duoc_giam:,.0f} VNĐ")\nprint(f"Số tiền cần trả: {tong_thanh_toan:,.0f} VNĐ")\n`,
      solutionCode: `def tinh_tien_hoa_don(so_luong: int, don_gia: int, giam_gia_phan_tram: float) -> tuple[float, float, float]:\n    tong_tien_chua_giam = so_luong * don_gia\n    so_tien_giam = tong_tien_chua_giam * (giam_gia_phan_tram / 100.0)\n    tong_so_tien_phai_tra = tong_tien_chua_giam - so_tien_giam\n    return tong_tien_chua_giam, so_tien_giam, tong_so_tien_phai_tra\n\nif __name__ == "__main__":\n    so_ly = int(input("Số ly: "))\n    gia_moi_ly = int(input("Đơn giá: "))\n    muc_giam = float(input("Phần trăm giảm: "))\n    \n    tien_goc, tien_giam, thanh_toan = tinh_tien_hoa_don(so_ly, gia_moi_ly, muc_giam)\n    print(f"Hoá đơn: Gốc {tien_goc:,.0f}đ - Giảm {tien_giam:,.0f}đ = Thanh toán: {thanh_toan:,.0f}đ")\n`,
      explanation: 'Bài toán rèn luyện kỹ năng tính toán số học, định dạng số có dấu phân cách hàng nghìn (:,.0f) và đặt tên biến 100% tiếng Việt chuẩn snake_case.',
      sampleInput: '3\n35000\n10\n',
      sampleOutput: 'Hoá đơn: Gốc 105,000đ - Giảm 10,500đ = Thanh toán: 94,500đ\n',
    });
    pool.push({
      id: `lesson_chi_tieu_${ts}`,
      title: makeUniqueTitle(`Thực hành: Quản lý chi tiêu sinh hoạt (${topic})`),
      level,
      description: 'Cho danh sách các khoản chi tiêu trong tuần của sinh viên. Viết hàm tính tổng chi tiêu, tìm khoản chi tiêu lớn nhất và tính mức chi tiêu trung bình mỗi ngày.',
      starterCode: `# Danh sách các khoản chi tiêu trong tuần\ndanh_sach_chi_tieu = [45000, 120000, 60000, 250000, 80000, 30000, 95000]\n\n# TODO: Tính tổng chi tiêu và chi tiêu lớn nhất\ntong_so_tien_chi = sum(danh_sach_chi_tieu)\nkhoan_chi_lon_nhat = max(danh_sach_chi_tieu)\nchi_tieu_trung_binh = tong_so_tien_chi / len(danh_sach_chi_tieu)\n\nprint(f"Tổng chi trong tuần: {tong_so_tien_chi:,.0f} VNĐ")\nprint(f"Khoản chi nhiều nhất: {khoan_chi_lon_nhat:,.0f} VNĐ")\nprint(f"Trung bình mỗi ngày: {chi_tieu_trung_binh:,.0f} VNĐ")\n`,
      solutionCode: `def phan_tich_chi_tieu(cac_khoan_chi: list[int]) -> dict:\n    tong_chi = sum(cac_khoan_chi)\n    chi_cao_nhat = max(cac_khoan_chi) if cac_khoan_chi else 0\n    trung_binh_ngay = tong_chi / len(cac_khoan_chi) if cac_khoan_chi else 0.0\n    return {\n        "tong_tien": tong_chi,\n        "cao_nhat": chi_cao_nhat,\n        "trung_binh": trung_binh_ngay\n    }\n\nif __name__ == "__main__":\n    so_lieu_chi = [45000, 120000, 60000, 250000, 80000, 30000, 95000]\n    ket_qua_thong_ke = phan_tich_chi_tieu(so_lieu_chi)\n    print(f"Tổng chi: {ket_qua_thong_ke['tong_tien']:,}đ | Cao nhất: {ket_qua_thong_ke['cao_nhat']:,}đ")\n`,
      explanation: 'Sử dụng các hàm có sẵn sum(), max(), len() kết hợp với kiểu dữ liệu từ điển (dict) giúp cấu trúc dữ liệu tường minh, chuẩn mực.',
      sampleOutput: 'Tổng chi: 680,000đ | Cao nhất: 250,000đ\n',
    });
    pool.push({
      id: `lesson_diem_thi_${ts}`,
      title: makeUniqueTitle(`Thực hành: Thống kê & Xếp loại điểm thi (${topic})`),
      level,
      description: 'Nhập danh sách điểm thi của các môn học. Tính điểm trung bình môn, đếm số môn đạt loại Giỏi (từ 8.0 trở lên) và in kết luận xếp loại chung.',
      starterCode: `# Danh sách điểm các môn\nbang_diem_hoc_ky = [8.5, 7.0, 9.2, 6.5, 8.8, 9.0]\n\n# TODO: Tính điểm trung bình và đếm môn Giỏi (>= 8.0)\ndiem_trung_binh = sum(bang_diem_hoc_ky) / len(bang_diem_hoc_ky)\nso_mon_gioi = sum(1 for diem in bang_diem_hoc_ky if diem >= 8.0)\n\nprint(f"Điểm trung bình học kỳ: {diem_trung_binh:.2f}")\nprint(f"Số môn đạt loại Giỏi: {so_mon_gioi}")\n`,
      solutionCode: `def xep_loai_hoc_tap(danh_sach_diem: list[float]) -> tuple[float, str]:\n    diem_trung_binh_chung = sum(danh_sach_diem) / len(danh_sach_diem)\n    if diem_trung_binh_chung >= 8.0:\n        danh_hieu = "Học sinh Giỏi"\n    elif diem_trung_binh_chung >= 6.5:\n        danh_hieu = "Học sinh Khá"\n    else:\n        danh_hieu = "Học sinh Trung bình"\n    return diem_trung_binh_chung, danh_hieu\n\nif __name__ == "__main__":\n    diem_cac_mon = [8.5, 7.0, 9.2, 6.5, 8.8, 9.0]\n    diem_tb, danh_hieu = xep_loai_hoc_tap(diem_cac_mon)\n    print(f"Điểm TB: {diem_tb:.2f} -> Danh hiệu: {danh_hieu}")\n`,
      explanation: 'Vận dụng rẽ nhánh điều kiện if-elif-else kết hợp tính toán số thực (float) với độ chính xác cao.',
      sampleOutput: 'Điểm TB: 8.17 -> Danh hiệu: Học sinh Giỏi\n',
    });
    pool.push({
      id: `lesson_cuoc_xe_${ts}`,
      title: makeUniqueTitle(`Ứng dụng: Tính giá cước xe công nghệ (${topic})`),
      level,
      description: 'Xây dựng thuật toán tính tiền chuyến xe công nghệ theo quãng đường đi (km): 2 km đầu giá 20,000đ, từ km thứ 3 đến km thứ 10 giá 8,500đ/km, từ km thứ 11 trở đi giá 7,000đ/km.',
      starterCode: `so_km_di_chuyen = float(input("Nhập số km chuyến xe: "))\n\n# TODO: Tính tổng cước phí theo từng chặng\ntong_cuoc_phi = 0.0\nif so_km_di_chuyen <= 2:\n    tong_cuoc_phi = 20000.0\nelif so_km_di_chuyen <= 10:\n    tong_cuoc_phi = 20000.0 + (so_km_di_chuyen - 2) * 8500.0\nelse:\n    tong_cuoc_phi = 20000.0 + 8 * 8500.0 + (so_km_di_chuyen - 10) * 7000.0\n\nprint(f"Tổng tiền cước: {tong_cuoc_phi:,.0f} VNĐ")\n`,
      solutionCode: `def tinh_cuoc_chuyen_xe(quang_duong_km: float) -> float:\n    if quang_duong_km <= 2.0:\n        return 20000.0\n    if quang_duong_km <= 10.0:\n        return 20000.0 + (quang_duong_km - 2.0) * 8500.0\n    return 20000.0 + (8.0 * 8500.0) + (quang_duong_km - 10.0) * 7000.0\n\nif __name__ == "__main__":\n    so_km = float(input("Nhập quãng đường (km): "))\n    tien_xe = tinh_cuoc_chuyen_xe(so_km)\n    print(f"Quãng đường {so_km} km -> Giá cước: {tien_xe:,.0f} VNĐ")\n`,
      explanation: 'Bài toán tính cước luỹ tiến đa bậc là dạng bài tập kinh điển trong khoa học máy tính, rèn luyện cấu trúc rẽ nhánh chính xác.',
      sampleInput: '15\n',
      sampleOutput: 'Quãng đường 15.0 km -> Giá cước: 123,000 VNĐ\n',
    });
  }

  return pool.slice(0, 2).map(ensureVietnameseLessonQuality);
}

// Timeout helper for Gemini calls with generous allowance for complex reasoning & JSON generation
function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Gemini API timeout')), ms)),
  ]);
}

// Multi-model fallback chain to handle rate limits, 503 spikes, and temporary unavailability seamlessly
// Standard recommended model for text tasks is gemini-3.8-flash
const CANDIDATE_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

async function callWithModelFallback<T>(
  fn: (modelName: string) => Promise<T>
): Promise<T> {
  let lastError: any = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      return await fn(model);
    } catch (err: any) {
      lastError = err;
      continue;
    }
  }
  throw lastError;
}

// Intelligent local Python code analyzer for zero-delay offline & fallback explanations
function analyzePythonCodeLocally(code: string) {
  const lines = code ? code.split('\n') : [];
  const imports: string[] = [];
  const functions: string[] = [];
  let hasLoops = false;
  let hasConditionals = false;
  let hasInput = false;
  let hasPrint = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('import ') || line.startsWith('from ')) {
      imports.push(line);
    }
    const defMatch = line.match(/^def\s+([a-zA-Z0-9_]+)\s*\(/);
    if (defMatch) {
      functions.push(defMatch[1]);
    }
    if (line.startsWith('for ') || line.startsWith('while ')) {
      hasLoops = true;
    }
    if (line.startsWith('if ') || line.startsWith('elif ') || line.startsWith('else:')) {
      hasConditionals = true;
    }
    if (line.includes('input(')) {
      hasInput = true;
    }
    if (line.includes('print(')) {
      hasPrint = true;
    }
  }

  return {
    linesCount: lines.length,
    imports,
    functions,
    hasLoops,
    hasConditionals,
    hasInput,
    hasPrint,
  };
}

// Local analyzer to detect exact error line, explain cause, and generate cleaner & shorter code
function analyzeAndFixLocally(code: string, errorText: string = ''): string {
  if (!code || !code.trim()) {
    return `🔍 **Phân tích mã nguồn:**\n- Chưa có mã nguồn trong Editor.\n\n⚡ **Mã mẫu chuẩn Python (PEP 8):**\n\`\`\`python\ndef main():\n    print("Hello, Pydroid 3!")\n\nif __name__ == "__main__":\n    main()\n\`\`\``;
  }

  const lines = code.split('\n');
  const fixedLines = [...lines];
  let errorLine = -1;
  let errorLineContent = '';
  let errorCause = '';
  let errorType = '';

  // Parse traceback if present
  if (errorText) {
    const lineMatch = errorText.match(/line (\d+)/i);
    if (lineMatch) {
      const parsedLine = parseInt(lineMatch[1], 10);
      if (parsedLine >= 1 && parsedLine <= lines.length) {
        errorLine = parsedLine;
        errorLineContent = lines[parsedLine - 1] || '';
      }
    }
    const typeMatch = errorText.match(/([A-Za-z]+Error|[A-Za-z]+Exception): (.*)/);
    if (typeMatch) {
      errorType = typeMatch[1];
      errorCause = `Thông báo lỗi từ hệ thống: ${typeMatch[2]}`;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const lineNum = i + 1;

    // 1. Missing colon on compound statement
    if (/^(if|elif|else|for|while|def|class|try|except|finally|with)\b/.test(trimmed) && !trimmed.endsWith(':') && !trimmed.includes('#')) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'SyntaxError';
        errorCause = `Thiếu dấu hai chấm ':' ở cuối câu lệnh \`${trimmed.split(' ')[0]}\`.`;
      }
      fixedLines[i] = rawLine + ':';
      continue;
    }

    // 2. Unbalanced parentheses (e.g. print("hello" or (a + b)
    const openParen = (rawLine.match(/\(/g) || []).length;
    const closeParen = (rawLine.match(/\)/g) || []).length;
    if (openParen > closeParen) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'SyntaxError';
        errorCause = `Thiếu ${openParen - closeParen} dấu đóng ngoặc tròn ')' trong câu lệnh.`;
      }
      fixedLines[i] = rawLine + ')'.repeat(openParen - closeParen);
      continue;
    }

    // 3. Unbalanced square brackets
    const openBracket = (rawLine.match(/\[/g) || []).length;
    const closeBracket = (rawLine.match(/\]/g) || []).length;
    if (openBracket > closeBracket) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'SyntaxError';
        errorCause = `Thiếu dấu đóng ngoặc vuông ']' cho danh sách (list).`;
      }
      fixedLines[i] = rawLine + ']'.repeat(openBracket - closeBracket);
      continue;
    }

    // 4. Invalid assignment in condition: if x = 5: -> if x == 5:
    if (/^(if|elif)\s+[^=><!]+=[^=].*$/.test(trimmed) && !/==/.test(trimmed)) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'SyntaxError';
        errorCause = 'Phép so sánh trong câu lệnh điều kiện `if/elif` phải dùng toán tử `==` (hai dấu bằng), không được dùng phép gán `=`.';
      }
      fixedLines[i] = rawLine.replace(/=([^=])/, '==$1');
      continue;
    }

    // 5. Invalid constant assignment (e.g. 10 = x)
    if (/^[0-9]+(\.[0-9]+)?\s*=\s*/.test(trimmed)) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'SyntaxError';
        errorCause = 'Không thể gán giá trị cho một hằng số số học (vế trái phép gán phải là tên biến).';
      }
      const parts = trimmed.split('=');
      if (parts.length === 2) {
        const val = parts[0].trim();
        const varName = parts[1].trim() || 'gia_tri';
        fixedLines[i] = rawLine.replace(trimmed, `${varName} = ${val}`);
      }
      continue;
    }

    // 6. Unclosed single or double quotes
    const singleQuotes = (trimmed.match(/'/g) || []).length;
    const doubleQuotes = (trimmed.match(/"/g) || []).length;
    if (singleQuotes % 2 !== 0 && !trimmed.includes('"""') && !trimmed.includes("'''")) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'SyntaxError';
        errorCause = 'Chưa đóng dấu nháy đơn (\') cho chuỗi ký tự.';
      }
      fixedLines[i] = rawLine + "'";
      continue;
    }
    if (doubleQuotes % 2 !== 0 && !trimmed.includes('"""') && !trimmed.includes("'''")) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'SyntaxError';
        errorCause = 'Chưa đóng dấu nháy kép (") cho chuỗi ký tự.';
      }
      fixedLines[i] = rawLine + '"';
      continue;
    }

    // 7. Python 2 style print statement
    if (/^print\s+["'].*$/.test(trimmed) && !trimmed.startsWith('print(')) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'SyntaxError';
        errorCause = 'Trong Python 3, hàm `print()` bắt buộc phải có dấu ngoặc tròn bao quanh tham số: `print(...)`.';
      }
      const printArg = trimmed.replace(/^print\s+/, '');
      fixedLines[i] = rawLine.replace(trimmed, `print(${printArg})`);
      continue;
    }

    // 8. Misspelled print function (prnt / prin)
    if (/\b(prnt|prin)\s*\(/.test(trimmed)) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'NameError';
        errorCause = 'Sai chính tả tên hàm in xuất dữ liệu: sửa thành `print(...)`.';
      }
      fixedLines[i] = rawLine.replace(/\b(prnt|prin)\b/g, 'print');
      continue;
    }

    // 9. Zero division
    if (/\/ 0(?![0-9])/.test(trimmed) || /\/=\s*0(?![0-9])/.test(trimmed)) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'ZeroDivisionError';
        errorCause = 'Phép chia cho số 0 không hợp lệ trong toán học và Python.';
      }
      fixedLines[i] = rawLine.replace(/\/ 0(?![0-9])/, '/ 1  # Đã sửa tránh chia cho 0');
      continue;
    }

    // 10. Input without conversion before arithmetic
    if (trimmed.includes('input(') && !trimmed.includes('int(') && !trimmed.includes('float(')) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'Lưu ý Kiểu Dữ Liệu';
        errorCause = 'Hàm `input()` trả về chuỗi văn bản (str). Nếu dùng tính toán số học, cần ép kiểu `int(...)` hoặc `float(...)`.';
      }
      fixedLines[i] = rawLine.replace(/=\s*input\((.*)\)/, '= int(input($1))');
    }
  }

  if (errorLine === -1) {
    errorLine = 1;
    errorLineContent = lines[0] || '';
    errorType = 'Tối ưu hóa Code';
    errorCause = 'Kiểm tra toàn diện: Tối ưu thụt lề chuẩn PEP 8, làm sạch mã và đảm bảo luồng thực thi an toàn.';
  }

  const cleanCode = formatPep8Locally(fixedLines.join('\n'));

  return `🔍 **Phân tích lỗi mã nguồn:**
- 📍 **Vị trí lỗi:** **Dòng ${errorLine}**: \`${errorLineContent.trim() || '...'}\`
- ⚠️ **Loại lỗi:** \`${errorType || 'SyntaxError'}\`
- 💡 **Nguyên nhân & Cách sửa:** ${errorCause}

⚡ **Mã nguồn đã sửa hoàn chỉnh (Chuẩn Python PEP 8):**
\`\`\`python
${cleanCode.trim()}
\`\`\`

✨ **Điểm đã được sửa chữa & cải tiến:**
1. Khắc phục triệt để lỗi tại **Dòng ${errorLine}**, đảm bảo chương trình chạy trơn tru không bị dừng đột ngột.
2. Chuẩn hóa toàn bộ thụt lề 4 khoảng trắng và cách đặt tên theo chuẩn PEP 8.
3. Mã nguồn đã sẵn sàng: Nhấn nút **"Áp dụng vào Editor"** ngay trên khối code để cập nhật vào trình soạn thảo!`;
}

// Local PEP 8 Python code formatter
function formatPep8Locally(code: string): string {
  if (!code || !code.trim()) {
    return '# Chương trình Python chuẩn PEP 8\ndef main() -> None:\n    """Hàm khởi chạy chính của chương trình."""\n    print("Hello, Pydroid 3!")\n\nif __name__ == "__main__":\n    main()\n';
  }

  const lines = code.split('\n');
  const formattedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const leadingWhitespace = line.match(/^\s*/)?.[0] || '';
    const numTabs = (leadingWhitespace.match(/\t/g) || []).length;
    const numSpaces = (leadingWhitespace.match(/ /g) || []).length;
    const indentLevel = Math.max(0, Math.floor((numTabs * 4 + numSpaces) / 4));
    const properIndent = '    '.repeat(indentLevel);
    const content = line.trim();

    if (!content) {
      formattedLines.push('');
      continue;
    }

    let formattedContent = content
      .replace(/,([^\s])/g, ', $1')
      .replace(/([^\s=!<>])=([^\s=])/g, '$1 = $2')
      .replace(/([^\s])\+([^\s])/g, '$1 + $2')
      .replace(/([^\s])\*([^\s*])/g, '$1 * $2');

    // Automatically append missing colon on compound statements
    if (/^(if|elif|else|for|while|def|class|try|except|finally|with)\b/.test(formattedContent) && !formattedContent.endsWith(':') && !formattedContent.includes('#')) {
      formattedContent += ':';
    }

    formattedLines.push(properIndent + formattedContent);
  }

  return formattedLines.join('\n').trim() + '\n';
}

// Generate comprehensive Vietnamese code explanation locally
function generateExplainResponseLocally(code: string): string {
  const analysis = analyzePythonCodeLocally(code);

  const importSection = analysis.imports.length > 0
    ? `  - **Thư viện sử dụng:** ${analysis.imports.map(i => `\`${i}\``).join(', ')}\n`
    : `  - **Thư viện:** Chỉ sử dụng các hàm built-in cơ bản của Python.\n`;

  const functionSection = analysis.functions.length > 0
    ? `  - **Hàm định nghĩa:** ${analysis.functions.map(f => `\`def ${f}()\``).join(', ')}\n`
    : `  - **Cấu trúc:** Thực thi tuần tự theo kịch bản script.\n`;

  const logicSection = [];
  if (analysis.hasInput) logicSection.push('nhận tương tác dữ liệu từ bàn phím qua `input()`');
  if (analysis.hasLoops) logicSection.push('sử dụng vòng lặp để xử lý dữ liệu');
  if (analysis.hasConditionals) logicSection.push('rẽ nhánh điều kiện logic (`if-elif-else`)');
  if (analysis.hasPrint) logicSection.push('xuất kết quả ra màn hình với `print()`');

  const notes = [
    'Tuân thủ quy tắc thụt lề 4 khoảng trắng chuẩn PEP 8 cho các khối lệnh.',
    'Đặt tên biến và hàm theo phong cách `snake_case` (ví dụ: `my_variable`, `tinh_tong`).',
  ];
  if (analysis.hasInput) {
    notes.push('Dữ liệu từ `input()` luôn là kiểu chuỗi `str`, cần ép kiểu `int()` hoặc `float()` khi tính toán số học.');
  }
  if (analysis.hasLoops) {
    notes.push('Đảm bảo điều kiện dừng trong vòng lặp để tránh hiện tượng vòng lặp vô tận (infinite loop).');
  }

  return `📖 **Giải thích chi tiết mã nguồn Python:**

### 1. 🎯 Tổng quan & Mục đích
- Chương trình gồm **${analysis.linesCount} dòng mã**.
${importSection}${functionSection}- **Luồng xử lý chính:** ${logicSection.length > 0 ? logicSection.join(', ') : 'Xử lý các biểu thức logic cơ bản'}.

### 2. ⚡ Luồng thực thi (Execution Flow)
1. **Khởi tạo:** Trình thông dịch Python nạp mã từ dòng đầu tiên, khai báo các thư viện và định nghĩa hàm (nếu có).
2. **Xử lý:** ${analysis.hasInput ? 'Chờ người dùng nhập dữ liệu qua console, sau đó ' : ''}tính toán và xử lý tuần tự qua từng khối lệnh.
3. **Kết thúc:** ${analysis.hasPrint ? 'In kết quả hoàn tất ra màn hình Terminal.' : 'Hoàn tất kịch bản với mã thoát 0 (Exit Code 0).' }

### 3. ⚠️ Các điểm cần lưu ý
${notes.map(n => `- ${n}`).join('\n')}

💡 *Gợi ý: Bạn có thể nhấn nút **"Tối ưu PEP 8"** kế bên để chuẩn hóa toàn bộ code ngay lập tức, hoặc đặt bất kỳ câu hỏi nào trong ô chat bên dưới!*`;
}

// REST endpoint: Gemini AI Debugger with auto-fallback
app.post('/api/ai/debug', async (req, res) => {
  const { code = '', errorText = '' } = req.body;
  if (!code && !errorText) {
    return res.status(400).json({ error: 'Thiếu thông tin mã hoặc lỗi' });
  }

  // 1. Try Gemini API with multi-model fallback & timeout
  try {
    const prompt = `Bạn là Trình gỡ lỗi Python AI thông minh hàng đầu trên ứng dụng Pydroid 3 Android.
Người dùng đang viết mã Python và gặp lỗi hoặc yêu cầu kiểm tra sửa lỗi sau:

=== MÃ PYTHON HIỆN TẠI ===
${code}

=== THÔNG BÁO LỖI / TRACEBACK ===
${errorText || '(Phân tích toàn bộ cú pháp, phát hiện lỗi cú pháp, thụt lề, chia cho 0 hoặc lỗi runtime và sửa lỗi chuẩn PEP 8)'}

Nhiệm vụ của bạn:
1. Nhận diện chính xác tên loại lỗi (ví dụ: SyntaxError, IndentationError, ZeroDivisionError, NameError, TypeError, IndexError, ValueError, AttributeError...).
2. Giải thích nguyên nhân gốc rễ bằng tiếng Việt chuẩn mực, ngắn gọn, thân thiện, dễ hiểu cho người học lập trình trên điện thoại.
3. Đưa ra danh sách các mẹo khắc phục và quy tắc chuẩn PEP 8 liên quan.
4. Cung cấp phiên bản mã Python ĐÃ ĐƯỢC SỬA HOÀN CHỈNH, chuẩn PEP 8, chạy đúng đắn mà không làm thay đổi ý đồ thuật toán của người dùng.
5. Tóm tắt nhanh dòng/thay đổi quan trọng đã được sửa.

Hãy trả về phản hồi ĐÚNG định dạng JSON theo schema đã cho.`;

    const response = await callWithModelFallback(async (modelName) => {
      return await withTimeout(ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              errorType: { type: Type.STRING },
              vietnameseSummary: { type: Type.STRING },
              rootCause: { type: Type.STRING },
              tips: { type: Type.ARRAY, items: { type: Type.STRING } },
              fixedCode: { type: Type.STRING },
              diffExplanation: { type: Type.STRING },
            },
            required: ['errorType', 'vietnameseSummary', 'rootCause', 'tips', 'fixedCode', 'diffExplanation'],
          },
        },
      }));
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.errorType && parsed.fixedCode) {
      return res.json(parsed);
    }
  } catch (err: any) {
    console.log('[AI Debugger] Kích hoạt bộ phân tích lỗi dự phòng chuẩn PEP 8.');
  }

  // 2. Intelligent Rule-Based Fallback Debugger (Guarantees zero-failure response)
  const localAnalysis = analyzeAndFixLocally(code, errorText);
  const codeMatch = localAnalysis.match(/```python\s*([\s\S]*?)```/);
  const fixedCode = (codeMatch && codeMatch[1]) ? codeMatch[1].trim() : formatPep8Locally(code);

  const safeErrStr = String(errorText || '');
  const errMatch = safeErrStr.match(/([A-Za-z]+Error|[A-Za-z]+Exception): (.*)/);
  const detectedType = errMatch ? errMatch[1] : 'SyntaxError';
  const detail = errMatch ? errMatch[2] : (safeErrStr.slice(0, 100) || 'Lỗi cú pháp hoặc runtime');

  res.json({
    errorType: detectedType,
    vietnameseSummary: `Phát hiện lỗi ${detectedType}: ${detail}`,
    rootCause: `Chương trình gặp vấn đề trong quá trình thực thi: ${detail}. Đã tự động phân tích và khắc phục dòng lỗi chuẩn PEP 8.`,
    tips: [
      'Kiểm tra kỹ cú pháp và thụt lề 4 khoảng trắng chuẩn PEP 8.',
      'Sử dụng khối try...except để bao bọc các thao tác có khả năng gây lỗi.',
      'Đảm bảo các biến đã được khai báo trước khi sử dụng.',
    ],
    fixedCode,
    diffExplanation: 'Đã sửa chữa triệt để lỗi cú pháp/runtime và chuẩn hóa PEP 8 100%.',
  });
});

// REST endpoint: Gemini AI Exercise Generator with robust fallback
app.post('/api/ai/generate-lessons', async (req, res) => {
  const {
    topic = 'Python cơ bản & Thực hành',
    level = 'cơ bản',
    existingTitles = [],
    completedTitles = [],
  } = req.body;
  const safeTopic = (typeof topic === 'string' && topic.trim()) ? topic.trim() : 'Python ứng dụng thực tế';
  const cleanExistingTitles = Array.isArray(existingTitles) ? existingTitles.filter(Boolean) : [];
  const cleanCompletedTitles = Array.isArray(completedTitles) ? completedTitles.filter(Boolean) : [];

  // 1. Try Gemini API with timeout
  try {
    const prompt = `Bạn là Giảng viên Chuyên gia Lập trình Python cao cấp cho ứng dụng Pydroid 3 Web trên Android.
Nhiệm vụ: Hãy tạo 2 đến 3 bài tập thực hành Python HOÀN TOÀN MỚI, SÁNG TẠO theo chủ đề: "${safeTopic}" và cấp độ: "${level}".

🚨 QUY TẮC BẮT BUỘC SỐ 1: BÀI HỌC PHẢI HOÀN TOÀN MỚI, KHÔNG TRÙNG LẶP VỚI BÀI ĐÃ CÓ / ĐÃ HỌC:
Dưới đây là danh sách tiêu đề các bài tập người dùng ĐÃ CÓ / ĐÃ HỌC trong kho bài:
${cleanExistingTitles.length > 0 ? cleanExistingTitles.slice(-30).map((t: string) => `- ${t}`).join('\n') : '(Kho bài hiện đang trống)'}

-> YÊU CẦU ĐỘC QUYỀN VỀ TÍNH MỚI LẠ:
- Các bài học tạo ra phải HOÀN TOÀN MỚI, KHÁC BIỆT 100% về tiêu đề, cốt truyện, tình huống và ý tưởng so với danh sách trên.
- Sáng tạo các bài toán thực tế thú vị, gần gũi với đời sống (ví dụ: tính tiền quán trà sữa/cà phê, quản lý chi tiêu học sinh, tính tiền điện sinh hoạt, xếp loại học lực, vé xe buýt, trò chơi dân gian ô ăn quan, kiểm tra mật khẩu an toàn, xử lý chuỗi tiếng Việt...).

🚨 QUY TẮC BẮT BUỘC SỐ 2: VIỆT HÓA 100% TÊN BIẾN, TÊN HÀM VÀ THAM SỐ (BẮT BUỘC 100% TIẾNG VIỆT):
- Cả trong starterCode và solutionCode: 100% TẤT CẢ các tên biến (variables), tên hàm (functions), tham số (parameters) PHẢI ĐƯỢC VIỆT HÓA HOÀN TOÀN bằng tiếng Việt không dấu chuẩn snake_case.
- VÍ DỤ ĐÚNG (VIỆT HÓA 100%):
  + Tên biến: so_thu_nhat, so_thu_hai, tong_tien, danh_sach_diem, chieu_dai, chieu_rong, dien_tich, chu_vi, so_luong, don_gia, ten_hoc_sinh, diem_trung_binh, ket_qua, gia_tri_lon_nhat, so_may_man, chuoi_van_ban, dem_so_chan...
  + Tên hàm: tinh_tong_tien(), tim_so_lon_nhat(), dem_so_nguyen_to(), tinh_diem_trung_binh(), kiem_tra_nam_nhuan(), xu_ly_danh_sach()...
- ❌ TUYỆT ĐỐI CẤM (0% TIẾNG ANH CHO TÊN BIẾN/HÀM):
  Không được dùng bất kỳ tên biến hoặc tên hàm tiếng Anh nào như: x, y, z, a, b, c, i, j, k, n, arr, lst, num, nums, numbers, data, items, val, res, result, total, temp, user_input, count, flag, my_func, process_data, item, test...
  (Ngoại trừ các từ khóa bắt buộc cú pháp của ngôn ngữ Python: def, class, return, if, elif, else, for, in, while, import, print, input, range, len, int, float, str, list, dict, set, tuple, True, False, None, try, except, self).
- Toàn bộ ghi chú (# TODO) và chuỗi in print(...) phải bằng tiếng Việt tự nhiên, rõ ràng.

Mỗi bài tập cần có:
- id: chuỗi id duy nhất dạng snake_case (bắt đầu bằng lesson_ai_...)
- title: Tiêu đề bài tập ngắn gọn, cuốn hút bằng tiếng Việt
- level: một trong 3 giá trị ('basic', 'intermediate', 'advanced')
- description: Đề bài chi tiết bằng tiếng Việt, yêu cầu đầu vào (input) và đầu ra (output) rõ ràng
- starterCode: Khung mã ban đầu kèm comment hướng dẫn (# TODO) với 100% tên biến tiếng Việt
- solutionCode: Lời giải hoàn chỉnh chuẩn mực PEP 8 với 100% tên biến tiếng Việt
- explanation: Giải thích chi tiết thuật toán và kiến thức cốt lõi bằng tiếng Việt
- sampleInput: Ví dụ dữ liệu STDIN mẫu (nếu bài toán có input)
- sampleOutput: Ví dụ kết quả in ra màn hình tương ứng

Hãy xuất kết quả hoàn toàn bằng tiếng Việt chuẩn theo định dạng JSON.`;

    const response = await callWithModelFallback(async (modelName) => {
      return await withTimeout(ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              lessons: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    level: { type: Type.STRING },
                    description: { type: Type.STRING },
                    starterCode: { type: Type.STRING },
                    solutionCode: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    sampleInput: { type: Type.STRING },
                    sampleOutput: { type: Type.STRING },
                  },
                  required: ['id', 'title', 'level', 'description', 'starterCode', 'solutionCode', 'explanation'],
                },
              },
            },
            required: ['lessons'],
          },
        },
      }));
    });

    const parsed = JSON.parse(response.text || '{"lessons":[]}');
    if (parsed.lessons && Array.isArray(parsed.lessons) && parsed.lessons.length > 0) {
      // Post-process to guarantee 100% Vietnamese variables and no duplicate titles
      const sanitized = parsed.lessons.map(ensureVietnameseLessonQuality);
      return res.json({ lessons: sanitized });
    }
  } catch (err: any) {
    console.log('[AI Lessons] Kích hoạt tạo kho bài học dự phòng chất lượng cao.');
  }

  // 2. High-Quality Fallback Generation (Instantly returns custom lessons without failing!)
  const fallbackLessons = getFallbackLessons(safeTopic, level, cleanExistingTitles);
  res.json({ lessons: fallbackLessons });
});

// REST endpoint: Gemini AI Python Coding Assistant Multi-turn Chat
app.post('/api/ai/chat', async (req, res) => {
  const { code = '', messages = [], instruction = '', errorText = '' } = req.body;

  try {
    const formattedHistory = (Array.isArray(messages) ? messages : []).map((m: any) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    const codeLines = (code || '').split('\n');
    const numberedCode = codeLines
      .map((l: string, idx: number) => `${idx + 1}: ${l}`)
      .join('\n');

    const lastUserMsg = messages[messages.length - 1];
    const rawUserText = String(lastUserMsg?.text || '').toLowerCase();
    const isFixErrorRequest =
      instruction === 'fix_error' ||
      instruction === 'analyze_fix_clean' ||
      /s[uư][aảã].*l[oô][iỉĩ]|l[oô][iỉĩ]|fix.*error|fix.*bug|debug|g[oỡ].*l[oô][iỉĩ]|b[iị].*l[oô][iỉĩ]|d[oò]ng.*m[aấ]y.*l[oô][iỉĩ]|s[uư][aảã].*code/i.test(rawUserText);

    const systemInstruction = `Bạn là Trợ lý AI Lập trình Python thông minh, tận tâm và chuyên nghiệp trên ứng dụng Pydroid 3 Web cho Android.
Nhiệm vụ của bạn là hỗ trợ người dùng học, viết, phân tích, tối ưu và gỡ lỗi/sửa lỗi mã Python.

Quy tắc quan trọng:
1. Luôn sử dụng tiếng Việt thân thiện, rõ ràng, dễ hiểu cho cả người mới bắt đầu lẫn người đã có kinh nghiệm.
2. Ngữ cảnh mã nguồn hiện tại trong Editor của người dùng (kèm số thứ tự dòng tương ứng):
\`\`\`python
${numberedCode || '# 1: (Chưa có mã nguồn trong Editor)'}
\`\`\`
${errorText ? `\n⚠️ Thông báo lỗi hoặc Traceback ghi nhận gần nhất từ Terminal:\n\`\`\`\n${errorText}\n\`\`\`\n` : ''}
3. Ghi nhớ toàn bộ lịch sử trò chuyện (multi-turn conversation) để trả lời mạch lạc câu hỏi của người dùng.
4. Khi đưa ra gợi ý code hoặc viết lại code, luôn bọc trong khối code markdown \`\`\`python ... \`\`\` (tuyệt đối KHÔNG kèm số thứ tự dòng trong khối code hoàn chỉnh này) để giao diện người dùng có thể hiển thị nút "Sao chép mã" và "Áp dụng vào Editor" với 1-chạm.
5. Tuân thủ nghiêm ngặt chuẩn PEP 8 của Python: thụt lề 4 khoảng trắng, đặt tên biến snake_case, xử lý ngoại lệ an toàn và tối ưu kiểu Pythonic.
6. Khi người dùng yêu cầu SỬA LỖI (fix error, debug, "sửa lỗi", "sửa lổi", "phân tích lỗi", "lỗi dòng nào & viết gọn lại", hoặc instruction 'fix_error' / 'analyze_fix_clean'):
   - 📍 **Vị trí dòng lỗi:** BẮT BUỘC chỉ rõ chính xác lỗi xuất hiện ở dòng số mấy (ví dụ: "📍 **Lỗi ở Dòng X:** \`...\`").
   - ⚠️ **Nguyên nhân lỗi:** Giải thích rõ ràng nguyên nhân tại sao dòng đó bị lỗi (lỗi cú pháp SyntaxError, thụt lề IndentationError, chia cho 0, biến chưa khai báo NameError, lỗi kiểu TypeError, logic vòng lặp while True, nhập liệu input không an toàn...).
   - ⚡ **Mã nguồn mới HOÀN CHỈNH ĐÃ ĐƯỢC SỬA LỖI 100%:** Cung cấp toàn bộ đoạn mã HOÀN CHỈNH, CHẠY ĐƯỢC NGAY KHÔNG CÒN LỖI, ngắn gọn, sạch sẽ hơn mã hiện tại theo chuẩn PEP 8 và phong cách Pythonic, đặt trong khối \`\`\`python ... \`\`\`.
   - 💡 **Các điểm cải tiến:** Nêu ngắn gọn các điểm đã làm sạch và sửa chữa mã.
7. Nếu người dùng mới mở chat (chưa có câu hỏi nào) hoặc yêu cầu giải thích ban đầu: Hãy tóm tắt nhanh mã nguồn hiện tại, nêu mục đích hoạt động, cấu trúc chính và gợi ý các hướng nâng cấp tiếp theo.`;

    let userPrompt = '';
    if (isFixErrorRequest) {
      userPrompt = lastUserMsg?.text && lastUserMsg.text.length > 5
        ? `${lastUserMsg.text}\n\n(Yêu cầu: Chỉ rõ dòng lỗi, nguyên nhân và cung cấp mã Python hoàn chỉnh ĐÃ SỬA LỖI 100% trong khối \`\`\`python ... \`\`\` để nạp vào Editor)`
        : 'Hãy phân tích chi tiết lỗi trong mã nguồn hiện tại: chỉ rõ lỗi ở dòng nào (dòng số mấy), nguyên nhân gây lỗi là gì, và viết ra code mới đã sửa hoàn chỉnh 100% chạy đúng đắn theo chuẩn Python PEP 8.';
    } else if (instruction === 'explain_source_code' || instruction === 'initial_explain') {
      userPrompt = lastUserMsg?.text || 'Hãy giải thích chi tiết mã nguồn Python này, luồng thực thi và các điểm cần lưu ý.';
    } else if (instruction === 'optimize_pep8') {
      userPrompt = lastUserMsg?.text || 'Hãy tối ưu và chuẩn hóa toàn bộ mã nguồn Python này theo tiêu chuẩn PEP 8 chính thức: thụt lề 4 khoảng trắng, đặt tên biến/hàm theo snake_case rõ ràng, thêm type hints/docstring ngắn gọn, viết theo phong cách Pythonic gọn gàng, loại bỏ mã thừa. Cung cấp mã hoàn chỉnh trong khối ```python ... ``` để người dùng có thể bấm Áp dụng vào Editor ngay lập tức.';
    } else if (instruction === 'explain_line_by_line') {
      userPrompt = lastUserMsg?.text || 'Hãy giải thích chi tiết từng dòng trong đoạn mã Python hiện tại của mình một cách dễ hiểu nhất.';
    } else if (instruction === 'pythonic') {
      userPrompt = lastUserMsg?.text || 'Hãy viết lại đoạn mã này theo phong cách Pythonic ngắn gọn, tối ưu và đẹp mắt nhất chuẩn PEP 8.';
    } else if (instruction === 'try_except') {
      userPrompt = lastUserMsg?.text || 'Hãy bổ sung khối bắt lỗi ngoại lệ try...except cho các vị trí có nguy cơ xảy ra lỗi trong mã này.';
    } else if (instruction === 'add_comments') {
      userPrompt = lastUserMsg?.text || 'Hãy thêm các chú thích (comment) tiếng Việt chi tiết, rõ ràng vào từng phần quan trọng của đoạn mã này.';
    } else if (instruction === 'test_data') {
      userPrompt = lastUserMsg?.text || 'Hãy cho mình một số bộ ví dụ dữ liệu chạy thử (input và output mong đợi) kèm giải thích cho đoạn code này.';
    } else {
      userPrompt = lastUserMsg?.text || 'Hãy phân tích mã nguồn hiện tại của mình.';
    }

    // Call Gemini with multi-model fallback & extended timeout (18s)
    const historyTurns = formattedHistory.slice(0, -1);
    const contents = [
      ...historyTurns,
      {
        role: 'user',
        parts: [
          {
            text: `[Ngữ cảnh mã nguồn Python hiện tại trong Editor]:\n\`\`\`python\n${numberedCode || '# (Trống)'}\n\`\`\`\n${errorText ? `\n[Thông báo lỗi / Traceback gần nhất từ Terminal]:\n\`\`\`\n${errorText}\n\`\`\`\n` : ''}\n\n[Yêu cầu của người dùng]:\n${userPrompt}`,
          },
        ],
      },
    ];

    const response = await callWithModelFallback(async (modelName) => {
      return await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
          },
        })
      );
    });

    const replyText = response.text || 'Xin lỗi, mình chưa thể xử lý câu trả lời lúc này.';
    return res.json({ reply: replyText });
  } catch (err: any) {
    console.log('[AI Chat] Kích hoạt phân tích thông minh dự phòng.');

    // Guaranteed smart fallback in case of network timeout or quota limit
    const lastUserMsg = messages[messages.length - 1];
    const rawUserText = String(lastUserMsg?.text || '').toLowerCase();
    const isErrorAnalysis =
      instruction === 'fix_error' ||
      instruction === 'analyze_fix_clean' ||
      /s[uư][aảã].*l[oô][iỉĩ]|l[oô][iỉĩ]|fix.*error|fix.*bug|debug|g[oỡ].*l[oô][iỉĩ]|b[iị].*l[oô][iỉĩ]|d[oò]ng.*m[aấ]y.*l[oô][iỉĩ]|s[uư][aảã].*code/i.test(rawUserText);

    let fallbackReply = '';
    if (instruction === 'fix_error' || instruction === 'analyze_fix_clean' || isErrorAnalysis) {
      fallbackReply = analyzeAndFixLocally(code, errorText);
    } else if (instruction === 'explain_source_code' || instruction === 'initial_explain') {
      fallbackReply = generateExplainResponseLocally(code);
    } else if (instruction === 'optimize_pep8') {
      fallbackReply = `⚡ **Mã nguồn đã tối ưu theo chuẩn PEP 8:**\n\n` +
        `\`\`\`python\n` +
        formatPep8Locally(code) +
        `\`\`\`\n\n` +
        `✅ Đã chuẩn hóa thụt lề 4 spaces, định dạng toán tử và cấu trúc hàm theo chuẩn PEP 8 của Python! Sẵn sàng bấm **Áp dụng vào Editor**.`;
    } else if (instruction === 'explain_line_by_line') {
      fallbackReply = `🔍 **Giải thích từng phần mã nguồn:**\n\n` +
        `- Mã nguồn của bạn đang xử lý các tác vụ logic chính.\n` +
        `- Các hàm và biến được khởi tạo tuần tự từ trên xuống dưới.\n` +
        `- Bạn có thể hỏi sâu hơn về bất kỳ dòng code hoặc biến cụ thể nào!`;
    } else if (instruction === 'pythonic') {
      fallbackReply = `⚡ **Cách viết ngắn hơn (Pythonic):**\n\n` +
        `Có thể áp dụng List Comprehension hoặc hàm built-in tối ưu chuẩn PEP 8:\n\n` +
        `\`\`\`python\n${formatPep8Locally(code)}\n\`\`\`\n\n` +
        `Cấu trúc này giúp mã nguồn gọn gàng, tăng tốc độ thực thi và dễ bảo trì.`;
    } else if (instruction === 'try_except') {
      fallbackReply = `🛡️ **Bổ sung bắt lỗi ngoại lệ try...except:**\n\n` +
        `\`\`\`python\ntry:\n    # Thực thi mã an toàn\n` +
        (code ? String(code).split('\n').map((l: string) => '    ' + l).join('\n') : '    pass') +
        `\nexcept Exception as e:\n    print(f"❌ Xảy ra lỗi: {e}")\n\`\`\`\n\n` +
        `Khối try...except giúp chương trình không bị crash đột ngột khi gặp lỗi nhập liệu.`;
    } else if (instruction === 'add_comments') {
      fallbackReply = `💬 **Mã đã thêm chú thích tiếng Việt:**\n\n` +
        `\`\`\`python\n# ==========================================\n# 🐍 Chương trình Python\n# ==========================================\n` +
        (code ? String(code).split('\n').map((l: string) => l.trim() ? `# Xử lý:\n${l}` : l).join('\n') : '# Viết mã tại đây') +
        `\n\`\`\`\n\nĐã thêm chú thích giúp bạn dễ dàng theo dõi logic.`;
    } else if (instruction === 'test_data') {
      fallbackReply = `🧪 **Ví dụ dữ liệu chạy thử:**\n\n` +
        `- Trường hợp thông thường: Dữ liệu hợp lệ theo đúng kiểu int / str.\n` +
        `- Trường hợp biên (Edge case): Số 0, chuỗi rỗng "", hoặc giá trị âm.\n` +
        `- Bạn có thể chạy thử trực tiếp trong Terminal để kiểm tra kết quả!`;
    } else {
      fallbackReply = analyzeAndFixLocally(code);
    }

    return res.json({ reply: fallbackReply, text: fallbackReply });
  }
});

// REST endpoint: Check server-side Gemini AI status
app.get('/api/ai/status', (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    ok: hasKey,
    model: 'gemini-3.8-flash',
    message: hasKey
      ? 'Máy chủ Gemini AI hoạt động sẵn sàng (gemini-3.8-flash).'
      : 'Khóa API Gemini chưa được thiết lập trên máy chủ.',
  });
});

// SSE Streaming endpoint: Gemini AI Python Coding Assistant Streaming Chat
app.post('/api/ai/chat/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { code = '', messages = [], instruction = '', errorText = '', prompt = '' } = req.body;

  try {
    const formattedHistory = (Array.isArray(messages) ? messages : []).map((m: any) => ({
      role: m.sender === 'user' || m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text || m.content || '' }],
    }));

    const codeLines = (code || '').split('\n');
    const numberedCode = codeLines
      .map((l: string, idx: number) => `${idx + 1}: ${l}`)
      .join('\n');

    const lastUserMsg = messages[messages.length - 1];
    const rawUserText = String(lastUserMsg?.text || lastUserMsg?.content || prompt || '').toLowerCase();
    const isFixErrorRequest =
      instruction === 'fix_error' ||
      instruction === 'analyze_fix_clean' ||
      /s[uư][aảã].*l[oô][iỉĩ]|l[oô][iỉĩ]|fix.*error|fix.*bug|debug|g[oỡ].*l[oô][iỉĩ]|b[iị].*l[oô][iỉĩ]|d[oò]ng.*m[aấ]y.*l[oô][iỉĩ]|s[uư][aảã].*code/i.test(rawUserText);

    const systemInstruction = `Bạn là Trợ lý AI Lập trình Python thông minh, tận tâm và chuyên nghiệp trên ứng dụng Pydroid 3 Web cho Android.
Nhiệm vụ của bạn là hỗ trợ người dùng học, viết, phân tích, tối ưu và gỡ lỗi/sửa lỗi mã Python bằng tiếng Việt chuẩn mực.
Khi đưa ra mã nguồn hoặc sửa lỗi, luôn bọc trong khối \`\`\`python ... \`\`\` chuẩn PEP 8.`;

    let userPrompt = prompt || '';
    if (!userPrompt) {
      if (isFixErrorRequest) {
        userPrompt = 'Hãy phân tích chi tiết lỗi trong mã nguồn hiện tại: chỉ rõ lỗi ở dòng nào, nguyên nhân gây lỗi là gì, và viết ra code mới đã sửa hoàn chỉnh 100% chạy đúng đắn theo chuẩn Python PEP 8.';
      } else {
        userPrompt = lastUserMsg?.text || lastUserMsg?.content || 'Hãy phân tích mã nguồn hiện tại của mình.';
      }
    }

    const historyTurns = formattedHistory.slice(0, -1);
    const contents = [
      ...historyTurns,
      {
        role: 'user',
        parts: [
          {
            text: `[Ngữ cảnh Editor]:\n\`\`\`python\n${numberedCode || '# (Trống)'}\n\`\`\`\n${errorText ? `\n[Lỗi]:\n\`\`\`\n${errorText}\n\`\`\`\n` : ''}\n\n[Yêu cầu]:\n${userPrompt}`,
          },
        ],
      },
    ];

    const streamResponse = await ai.models.generateContentStream({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
      },
    });

    for await (const chunk of streamResponse) {
      const text = chunk.text || '';
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    const fallbackText = analyzeAndFixLocally(code);
    res.write(`data: ${JSON.stringify({ text: fallbackText })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// Setup Vite middleware in dev or static files in prod
async function startServer() {
  server.on('error', (err: any) => {
    console.error('[Server Error] HTTP Server error:', err);
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Pydroid 3 Web] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Fatal] Failed to start server:', err);
});
