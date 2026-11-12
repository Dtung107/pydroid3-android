import { ExecutionResult } from '../types';

export interface RunCallbacks {
  onStdout: (text: string) => void;
  onStderr: (text: string) => void;
  onSystem: (text: string) => void;
  onExit: (result: ExecutionResult) => void;
  onError: (error: string) => void;
  onAwaitingInput?: () => void;
}

/**
 * High-performance CPython Runner with Dual-Engine:
 * 1. WebSocket (/api/python/ws) for real-time bidirectional streaming & instant input()
 * 2. Automatic Server-Sent Events (SSE) + REST fallback if WebSocket proxy is blocked
 */
export class PythonWebSocketRunner {
  private ws: WebSocket | null = null;
  private activeSessionId: string | null = null;
  private eventSource: EventSource | null = null;
  private isRunning: boolean = false;
  private mode: 'ws' | 'sse' = 'ws';

  public async checkStatus(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch('/api/python/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '# healthcheck', stdin: '' }),
      });
      if (res.ok) {
        const data = await res.json();
        // Clean up the healthcheck session
        if (data.sessionId) {
          fetch(`/api/python/session/${data.sessionId}/stop`, { method: 'POST' }).catch(() => {});
        }
        return { ok: true, message: 'CPython Native sẵn sàng' };
      }
      return { ok: false, message: `Máy chủ phản hồi mã ${res.status}` };
    } catch (err: any) {
      return { ok: false, message: 'Không thể kết nối máy chủ CPython' };
    }
  }

  public async run(code: string, stdin: string, callbacks: RunCallbacks): Promise<void> {
    this.stop();
    this.isRunning = true;

    // Try WebSocket first
    const supportsWs = typeof WebSocket !== 'undefined';
    if (supportsWs) {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/python/ws`;
        const ws = new WebSocket(wsUrl);
        this.ws = ws;
        this.mode = 'ws';

        let wsConnected = false;
        const connectTimeout = setTimeout(() => {
          if (!wsConnected && this.isRunning) {
            console.warn('WebSocket connection timed out, falling back to SSE...');
            ws.close();
            this.runViaSSE(code, stdin, callbacks);
          }
        }, 3000);

        ws.onopen = () => {
          wsConnected = true;
          clearTimeout(connectTimeout);
          ws.send(JSON.stringify({ type: 'run', code, stdin }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'stdout') {
              callbacks.onStdout(msg.data);
            } else if (msg.type === 'stderr') {
              callbacks.onStderr(msg.data);
            } else if (msg.type === 'exit') {
              this.isRunning = false;
              callbacks.onExit({
                exitCode: msg.code,
                executionTimeMs: msg.executionTimeMs || 0,
                stopped: msg.stopped,
              });
              this.cleanup();
            } else if (msg.type === 'error') {
              this.isRunning = false;
              callbacks.onError(msg.data);
              this.cleanup();
            }
          } catch (e) {
            console.warn('WS message parse error:', e);
          }
        };

        ws.onerror = () => {
          if (!wsConnected && this.isRunning) {
            clearTimeout(connectTimeout);
            console.warn('WebSocket failed to open, switching to SSE fallback...');
            this.runViaSSE(code, stdin, callbacks);
          }
        };

        ws.onclose = () => {
          if (this.isRunning && wsConnected) {
            this.isRunning = false;
            callbacks.onExit({ exitCode: 0, executionTimeMs: 0 });
            this.cleanup();
          }
        };

        return;
      } catch (e) {
        console.warn('WebSocket error, falling back to SSE:', e);
      }
    }

    // Fallback to SSE
    await this.runViaSSE(code, stdin, callbacks);
  }

  private async runViaSSE(code: string, stdin: string, callbacks: RunCallbacks): Promise<void> {
    this.mode = 'sse';
    callbacks.onSystem('⚡ Đang khởi động tiến trình CPython qua HTTP/SSE...');

    try {
      const res = await fetch('/api/python/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, stdin }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Lỗi máy chủ (${res.status})`);
      }

      const { sessionId } = await res.json();
      this.activeSessionId = sessionId;

      this.eventSource = new EventSource(`/api/python/session/${sessionId}/events`);

      this.eventSource.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'stdout') {
            callbacks.onStdout(msg.data);
          } else if (msg.type === 'stderr') {
            callbacks.onStderr(msg.data);
          } else if (msg.type === 'exit') {
            this.isRunning = false;
            callbacks.onExit({
              exitCode: msg.code,
              executionTimeMs: msg.executionTimeMs || 0,
              stopped: msg.stopped,
            });
            this.cleanup();
          } else if (msg.type === 'error') {
            this.isRunning = false;
            callbacks.onError(msg.data);
            this.cleanup();
          }
        } catch (e) {
          // ignore parse errors
        }
      };

      this.eventSource.onerror = () => {
        if (this.isRunning) {
          setTimeout(() => {
            if (this.isRunning) {
              this.isRunning = false;
              callbacks.onExit({ exitCode: 0, executionTimeMs: 0 });
              this.cleanup();
            }
          }, 400);
        }
      };
    } catch (err: any) {
      this.isRunning = false;
      callbacks.onError(`Không thể khởi chạy CPython: ${err.message}`);
      callbacks.onExit({ exitCode: 1, executionTimeMs: 0 });
    }
  }

  public async sendStdin(text: string): Promise<void> {
    if (this.mode === 'ws' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'stdin', data: text }));
      return;
    }

    if (this.activeSessionId) {
      try {
        await fetch(`/api/python/session/${this.activeSessionId}/input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: text }),
        });
      } catch (e) {
        console.warn('Failed to send stdin via HTTP:', e);
      }
    }
  }

  public stop(): void {
    if (this.mode === 'ws' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'kill' }));
      } catch (e) {
        // ignore
      }
    }

    if (this.activeSessionId) {
      fetch(`/api/python/session/${this.activeSessionId}/stop`, { method: 'POST' }).catch(() => {});
    }

    this.cleanup();
  }

  private cleanup(): void {
    this.isRunning = false;
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch (e) {
        // ignore
      }
      this.eventSource = null;
    }
    this.activeSessionId = null;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }
}

declare global {
  interface Window {
    loadPyodide?: any;
    pyodideInstance?: any;
  }
}

/**
 * Helper to ensure a specific script URL is loaded in DOM within a given timeout
 */
async function loadScriptWithTimeout(src: string, timeoutMs: number): Promise<void> {
  if (typeof window === 'undefined') return;

  return new Promise((resolve, reject) => {
    // If exact script tag exists and window.loadPyodide is available, resolve immediately
    const existingScript = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement;
    if (existingScript && typeof window.loadPyodide === 'function') {
      resolve();
      return;
    }

    // Clean up any stale pyodide script tags that failed or point to different URLs
    document.querySelectorAll('script[src*="pyodide"]').forEach((el) => {
      try {
        el.remove();
      } catch (_) {}
    });

    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.async = true;

    let timer: any = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
    };

    timer = setTimeout(() => {
      cleanup();
      try {
        script.remove();
      } catch (_) {}
      reject(new Error(`Tải tệp tin ${src} quá giới hạn ${timeoutMs / 1000}s`));
    }, timeoutMs);

    script.onload = () => {
      cleanup();
      if (typeof window.loadPyodide === 'function') {
        resolve();
      } else {
        // Quick verification poll in next tick
        setTimeout(() => {
          if (typeof window.loadPyodide === 'function') {
            resolve();
          } else {
            reject(new Error(`Tệp tin đã tải nhưng window.loadPyodide chưa sẵn sàng`));
          }
        }, 50);
      }
    };

    script.onerror = () => {
      cleanup();
      try {
        script.remove();
      } catch (_) {}
      reject(new Error(`Không thể tải tệp tin script từ ${src}`));
    };

    document.head.appendChild(script);
  });
}

// Cache successful WASM capability check to avoid redundant overhead on subsequent runs
let cachedWasmSupportResult: { ok: boolean; message: string; details?: string } | null = null;

/**
 * Highly robust, multi-phase verification of browser WebAssembly (WASM) capability:
 * 1. Environment & Global Object existence
 * 2. Standard API completeness (validate, instantiate, compile, Memory, Module, Instance)
 * 3. Bytecode validation test (\0asm\1\0\0\0)
 * 4. Memory allocation and dynamic memory expansion (.grow) test
 * 5. Security & CSP compilation test with safety timeout (detects wasm-unsafe-eval / sandbox blocks)
 */
export async function testBrowserWebAssemblySupport(
  forceCheck: boolean = false
): Promise<{ ok: boolean; message: string; details?: string }> {
  if (typeof window === 'undefined') {
    return { ok: false, message: 'Môi trường không có đối tượng window' };
  }

  // Return cached result if already verified successfully
  if (!forceCheck && cachedWasmSupportResult && cachedWasmSupportResult.ok) {
    return cachedWasmSupportResult;
  }

  // Phase 1: WebAssembly global object check
  if (typeof WebAssembly !== 'object' || WebAssembly === null) {
    return {
      ok: false,
      message: 'Trình duyệt không hỗ trợ WebAssembly (WASM)',
      details: 'Đối tượng toàn cục WebAssembly không tồn tại trên window.',
    };
  }

  // Phase 2: Essential API signature checks
  const requiredApis: Array<{ name: keyof typeof WebAssembly; fn: any }> = [
    { name: 'instantiate', fn: WebAssembly.instantiate },
    { name: 'compile', fn: WebAssembly.compile },
    { name: 'validate', fn: WebAssembly.validate },
    { name: 'Memory', fn: WebAssembly.Memory },
    { name: 'Module', fn: WebAssembly.Module },
    { name: 'Instance', fn: WebAssembly.Instance },
  ];

  const missingApis = requiredApis
    .filter((api) => typeof api.fn !== 'function')
    .map((api) => `WebAssembly.${api.name}`);

  if (missingApis.length > 0) {
    return {
      ok: false,
      message: 'Trình duyệt thiếu các API WebAssembly thiết yếu',
      details: `Thiếu các phương thức tiêu chuẩn: ${missingApis.join(', ')}.`,
    };
  }

  // Phase 3: Standard Bytecode Validation Test (\0asm\1\0\0\0)
  const minimalWasmBytes = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
  try {
    const isValid = WebAssembly.validate(minimalWasmBytes);
    if (!isValid) {
      return {
        ok: false,
        message: 'Mã nhị phân WebAssembly không vượt qua kiểm tra tính hợp lệ',
        details: 'Hàm WebAssembly.validate trả về false với bytecode chuẩn.',
      };
    }
  } catch (validateErr: any) {
    return {
      ok: false,
      message: 'Lỗi khi kiểm tra tính hợp lệ của WebAssembly',
      details: String(validateErr?.message || validateErr),
    };
  }

  // Phase 4: Memory Allocation and Dynamic Growth (.grow) Check
  try {
    const testMem = new WebAssembly.Memory({ initial: 1, maximum: 16 });
    if (!(testMem.buffer instanceof ArrayBuffer)) {
      return {
        ok: false,
        message: 'Không thể cấp phát bộ nhớ WebAssembly',
        details: 'Thuộc tính buffer của WebAssembly.Memory không phải ArrayBuffer hợp lệ.',
      };
    }
    // Verify memory growth
    const prevPages = testMem.grow(1);
    if (prevPages !== 1 || testMem.buffer.byteLength < 131072) {
      return {
        ok: false,
        message: 'Bộ nhớ WebAssembly không thể mở rộng động (grow)',
        details: 'Phương thức WebAssembly.Memory.grow() không mở rộng được trang bộ nhớ.',
      };
    }
  } catch (memErr: any) {
    return {
      ok: false,
      message: 'Không thể cấp phát hoặc quản lý bộ nhớ WebAssembly',
      details: `Lỗi WebAssembly.Memory: ${memErr?.message || memErr}. Thiết bị có thể bị giới hạn RAM hoặc chính sách bảo mật cấm cấp phát.`,
    };
  }

  // Phase 5: Security / CSP & Compilation Execution Check (with 3.5s safety timeout)
  try {
    const executionCheck = async () => {
      const module = await WebAssembly.compile(minimalWasmBytes);
      const instance = await WebAssembly.instantiate(module);
      return Boolean(instance && typeof instance === 'object');
    };

    const timeoutCheck = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error('Quá thời gian kiểm tra biên dịch WebAssembly (Timeout 3500ms)')), 3500);
    });

    await Promise.race([executionCheck(), timeoutCheck]);
  } catch (execErr: any) {
    const errStr = String(execErr?.message || execErr);
    let details = errStr;
    if (errStr.includes('CSP') || errStr.includes('Content Security Policy') || errStr.includes('unsafe-eval') || errStr.includes('wasm-unsafe-eval')) {
      details = 'Chính sách bảo mật (CSP) của trình duyệt hoặc khung nhúng iframe cấm thực thi WebAssembly (thiếu wasm-unsafe-eval).';
    } else if (errStr.includes('out of memory') || errStr.includes('RangeError') || errStr.includes('allocation')) {
      details = 'Thiết bị không đủ dung lượng RAM trống để cấp phát không gian máy ảo WebAssembly.';
    }
    return {
      ok: false,
      message: 'Khung nhúng hoặc trình duyệt chặn thực thi WebAssembly',
      details,
    };
  }

  const result = { ok: true, message: 'WebAssembly hoạt động đầy đủ và sẵn sàng' };
  cachedWasmSupportResult = result;
  return result;
}

/**
 * Sleep helper for asynchronous delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with randomized jitter:
 * delay = min(initialDelay * (multiplier ^ attempt), maxDelay) +/- jitter
 */
function calculateExponentialBackoff(
  attempt: number,
  initialDelayMs = 600,
  multiplier = 2.0,
  maxDelayMs = 4000,
  jitterRatio = 0.2
): number {
  const baseDelay = Math.min(initialDelayMs * Math.pow(multiplier, attempt), maxDelayMs);
  const jitterRange = baseDelay * jitterRatio;
  const jitter = (Math.random() * 2 - 1) * jitterRange;
  return Math.max(100, Math.round(baseDelay + jitter));
}

/**
 * Reset global Pyodide state and remove any failed script elements from DOM
 */
function resetPyodideGlobalState(): void {
  if (typeof window !== 'undefined') {
    try {
      delete (window as any)._createPyodideModule;
      delete (window as any).loadPyodide;
    } catch (_) {}
    document.querySelectorAll('script[src*="pyodide"]').forEach((el) => {
      try {
        el.remove();
      } catch (_) {}
    });
  }
}

// Standard library modules that are built-in and never require external package loading
const BUILTIN_STDLIB_MODULES = new Set([
  'time', 'math', 'random', 'sys', 'os', 're', 'json', 'datetime',
  'collections', 'itertools', 'functools', 'typing', 'string', 'hashlib',
  'base64', 'uuid', 'copy', 'io', 'pathlib', 'struct', 'binascii',
  'threading', 'queue', 'bisect', 'heapq', 'unicodedata', 'inspect',
  'types', 'traceback', 'calendar', 'dataclasses', 'enum', 'decimal',
  'fractions', 'cmath', 'operator', 'builtins', 'gc', 'weakref', 'abc',
  'contextlib', 'urllib', 'http', 'logging', 'csv', 'sqlite3', 'tempfile',
  'shutil', 'zipfile', 'tarfile', 'asyncio', 'socket', 'selectors',
  'ipaddress', 'ssl', 'warnings', 'pprint', 'platform', 'dis', 'codecs'
]);

function needsExternalPackageLoading(code: string): boolean {
  const importRegex = /(?:^|\n)\s*(?:import|from)\s+([a-zA-Z0-9_]+)/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(code)) !== null) {
    const mod = match[1];
    if (mod && !BUILTIN_STDLIB_MODULES.has(mod)) {
      return true;
    }
  }
  return false;
}

/**
 * Pyodide WebAssembly (WASM) in-browser runner for client-side offline execution
 */
export class PyodideRunner {
  private static globalInitPromise: Promise<any> | null = null;
  private isRunning: boolean = false;
  private currentStdinQueue: string[] = [];
  private isInitializing: boolean = false;
  private pendingInputResolve: ((val: string) => void) | null = null;
  private pendingInputReject: ((err: any) => void) | null = null;

  public async checkStatus(): Promise<{ ok: boolean; message: string; details?: string }> {
    return testBrowserWebAssemblySupport();
  }

  public async warmup(): Promise<void> {
    if (typeof window === 'undefined' || window.pyodideInstance || this.isInitializing) return;
    const wasmCheck = await testBrowserWebAssemblySupport();
    if (!wasmCheck.ok) return;

    this.isInitializing = true;
    try {
      await this.initializeWithRetries();
    } catch (e) {
      console.warn('Pyodide silent warmup error:', e);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Preload and initialize installed packages from localStorage into Pyodide runtime.
   * Ensures that packages like pyfiglet, numpy, colorama, etc. are pre-loaded in memory
   * and immediately ready for execution upon app startup.
   */
  /**
   * Safe Pyodide runtime warmup without triggering network errors for missing wheels.
   * Warms up WebAssembly engine and micropip silently.
   */
  public async preloadInstalledPackages(packageNames?: string[]): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const wasmCheck = await testBrowserWebAssemblySupport();
      if (!wasmCheck.ok) return;

      const pyodide = await this.initializeWithRetries();
      if (!pyodide) return;

      // Silently pre-load micropip so on-demand installs are fast
      try {
        if (typeof pyodide.loadPackage === 'function') {
          await pyodide.loadPackage('micropip');
        }
      } catch (_) {
        // Silently ignore if offline
      }
    } catch (_) {
      // Silently ignore warmup errors to prevent startup noise
    }
  }

  /**
   * Initialize Pyodide with multi-source fallback and exponential backoff retry mechanism.
   * - Sources: Local Server (from node_modules/pyodide), jsDelivr CDN, cdnjs CDN, unpkg CDN
   * - Singleton promise prevents duplicate colliding downloads
   */
  private async initializeWithRetries(callbacks?: RunCallbacks): Promise<any> {
    if (typeof window !== 'undefined' && window.pyodideInstance) {
      return window.pyodideInstance;
    }
    if (PyodideRunner.globalInitPromise) {
      return PyodideRunner.globalInitPromise;
    }

    PyodideRunner.globalInitPromise = (async () => {
      const origin = typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null'
        ? window.location.origin
        : '';
      const localIndex = origin ? `${origin}/pyodide/` : '/pyodide/';
      // Official Pyodide repository CDN hosting full pre-built wheels (numpy, pandas, scipy, matplotlib, etc.)
      const officialPyodideCdn = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

      const sources = [
        {
          name: 'Máy chủ nội bộ ứng dụng (Local Server)',
          scriptUrl: '/pyodide/pyodide.js',
          indexURL: officialPyodideCdn,
          stdLibURL: `${localIndex}python_stdlib.zip`,
          timeoutMs: 15000,
          label: 'Local Server',
        },
        {
          name: 'Máy chủ jsDelivr CDN chính thức',
          scriptUrl: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js',
          indexURL: officialPyodideCdn,
          stdLibURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/python_stdlib.zip',
          timeoutMs: 20000,
          label: 'jsDelivr CDN',
        },
        {
          name: 'Máy chủ unpkg CDN dự phòng',
          scriptUrl: 'https://unpkg.com/pyodide@0.26.4/pyodide.js',
          indexURL: 'https://unpkg.com/pyodide@0.26.4/',
          stdLibURL: 'https://unpkg.com/pyodide@0.26.4/python_stdlib.zip',
          timeoutMs: 20000,
          label: 'unpkg CDN',
        },
      ];

      const failureLogs: string[] = [];

      for (let sourceIdx = 0; sourceIdx < sources.length; sourceIdx++) {
        const source = sources[sourceIdx];

        try {
          // Step A: Load script tag with timeout
          await loadScriptWithTimeout(source.scriptUrl, source.timeoutMs);

          const w = typeof window !== 'undefined' ? (window as any) : {};
          const loaderFn = typeof w.loadPyodide === 'function'
            ? w.loadPyodide
            : typeof w.loadPyodide?.loadPyodide === 'function'
            ? w.loadPyodide.loadPyodide
            : null;

          if (!loaderFn) {
            throw new Error(`Tệp script đã tải nhưng hàm loadPyodide không khả dụng.`);
          }

          // Step B: Call loaderFn({ indexURL, stdLibURL })
          const initPromise = loaderFn({
            indexURL: source.indexURL,
            stdLibURL: source.stdLibURL,
          });

          const initTimeout = new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`Quá thời gian nạp bộ nhân Pyodide (${source.timeoutMs / 1000}s)`)),
              source.timeoutMs
            )
          );

          window.pyodideInstance = await Promise.race([initPromise, initTimeout]);
          return window.pyodideInstance;
        } catch (err: any) {
          const errDetail = err?.message || String(err);
          failureLogs.push(`[${source.label}]: ${errDetail}`);

          // Reset global module and script tags for clean next attempt
          resetPyodideGlobalState();

          if (sourceIdx < sources.length - 1) {
            await sleep(150);
          }
        }
      }

      throw new Error(
        `Không thể khởi tạo Pyodide sau khi thử qua ${sources.length} nguồn máy chủ:\n${failureLogs.join('\n')}`
      );
    })().catch((err) => {
      PyodideRunner.globalInitPromise = null;
      throw err;
    });

    return PyodideRunner.globalInitPromise;
  }

  public async run(
    code: string,
    initialStdin: string,
    callbacks: RunCallbacks,
    onFallbackToCpython?: (reason?: string) => Promise<void>
  ): Promise<void> {
    this.isRunning = true;
    const startTime = performance.now();

    try {
      // 1. WebAssembly capability check
      const wasmCheck = await testBrowserWebAssemblySupport();
      if (!wasmCheck.ok) {
        const reason = `${wasmCheck.message}${wasmCheck.details ? `: ${wasmCheck.details}` : ''}`;
        if (onFallbackToCpython) {
          callbacks.onStderr(`⚠️ ${wasmCheck.message}`);
          if (wasmCheck.details) {
            callbacks.onStderr(`🔍 Chi tiết: ${wasmCheck.details}`);
          }
          await onFallbackToCpython(reason);
          return;
        } else {
          throw new Error(reason);
        }
      }

      // 2. Initialize Pyodide silently without noisy banner logs
      let pyodide: any = null;
      try {
        pyodide = await this.initializeWithRetries(callbacks);
      } catch (initErr: any) {
        const reason = initErr?.message || String(initErr);
        if (onFallbackToCpython) {
          callbacks.onStderr(`⚠️ Không thể nạp Pyodide WASM: ${reason}`);
          await onFallbackToCpython(reason);
          return;
        } else {
          throw initErr;
        }
      }

      // Setup stdout callback
      pyodide.setStdout({
        batched: (text: string) => {
          callbacks.onStdout(text + '\n');
        },
      });

      // Setup stderr callback
      pyodide.setStderr({
        batched: (text: string) => {
          if (
            (typeof window !== 'undefined' && (window as any).__pyodideStopRequested) ||
            text.includes('KeyboardInterrupt') ||
            text.includes('dừng bởi người dùng')
          ) {
            // Silently suppress user stop interruption traceback from stderr
            return;
          }
          callbacks.onStderr(text + '\n');
        },
      });

      // Prepare STDIN queue
      this.currentStdinQueue = initialStdin ? initialStdin.split('\n') : [];
      let consecutiveEmptyInputs = 0;

      // Reset stop request flag
      if (typeof window !== 'undefined') {
        (window as any).__pyodideStopRequested = false;
      }
      this.pendingInputResolve = null;
      this.pendingInputReject = null;

      // Register interactive async input handler for Pyodide
      pyodide.registerJsModule('__pydroid_input', {
        ask_input: (promptText?: string) => {
          // Output prompt text to stdout if present
          if (promptText) {
            callbacks.onStdout(promptText);
          }

          // If stdin queue has pre-filled data (e.g. from preset STDIN drawer)
          if (this.currentStdinQueue.length > 0) {
            const nextVal = this.currentStdinQueue.shift() || '';
            callbacks.onStdout(nextVal + '\n');
            try {
              pyodide.runPythonAsync('if "_pydroid_watcher" in globals() and _pydroid_watcher: _pydroid_watcher.reset_timer()').catch(() => {});
            } catch (_) {}
            return Promise.resolve(nextVal);
          }

          // Wait for interactive input entered in Terminal bottom input bar
          return new Promise<string>((resolve, reject) => {
            this.pendingInputResolve = (val: string) => {
              this.pendingInputResolve = null;
              this.pendingInputReject = null;
              try {
                pyodide.runPythonAsync('if "_pydroid_watcher" in globals() and _pydroid_watcher: _pydroid_watcher.reset_timer()').catch(() => {});
              } catch (_) {}
              resolve(val);
            };
            this.pendingInputReject = (err: any) => {
              this.pendingInputResolve = null;
              this.pendingInputReject = null;
              reject(err);
            };
          });
        },
      });

      // Fallback synchronous setStdin
      pyodide.setStdin({
        stdin: () => {
          if (this.currentStdinQueue.length > 0) {
            consecutiveEmptyInputs = 0;
            const nextVal = this.currentStdinQueue.shift() || '';
            callbacks.onStdout(`${nextVal}\n`);
            return nextVal + '\n';
          }

          if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
            try {
              const userInput = window.prompt('📥 [Python] Nhập dữ liệu đầu vào cho input():');
              if (userInput !== null) {
                consecutiveEmptyInputs = 0;
                callbacks.onStdout(`${userInput}\n`);
                return userInput + '\n';
              }
            } catch (e) {
              // Ignore iframe prompt restrictions
            }
          }

          consecutiveEmptyInputs++;
          if (consecutiveEmptyInputs >= 3) {
            throw new Error('Dừng chương trình: input() không có dữ liệu đầu vào.');
          }

          return '\n';
        },
      });

      // Install builtins and AST Transformer in Python
      await pyodide.runPythonAsync(`
import builtins
import __pydroid_input
import ast
import sys
import time

builtins.__pydroid_input = __pydroid_input

class _PydroidLoopGuard(BaseException):
    pass

class _PydroidSafetyWatcher:
    def __init__(self, max_seconds=30.0):
        self.start_time = time.time()
        self.max_seconds = max_seconds
        self.step = 0

    def reset_timer(self):
        self.start_time = time.time()

    def trace(self, frame, event, arg):
        filename = getattr(frame.f_code, 'co_filename', '') or ''
        # Never interrupt internal pyodide or asyncio library files
        if '/lib/python' in filename or '_pyodide' in filename or 'pyodide' in filename or 'asyncio' in filename:
            return self.trace

        if event == 'line':
            self.step += 1
            if self.step % 150 == 0:
                try:
                    import js
                    if getattr(js.window, '__pyodideStopRequested', False):
                        raise KeyboardInterrupt("Tiến trình đã được dừng bởi người dùng (🛑 DỪNG)")
                except KeyboardInterrupt:
                    raise
                except Exception:
                    pass
                if time.time() - self.start_time > self.max_seconds:
                    raise _PydroidLoopGuard(
                        f"Phát hiện vòng lặp vô tận (while True) chạy quá {self.max_seconds}s. "
                        "Hệ thống tự động ngắt để bảo vệ trình duyệt không bị treo."
                    )
        return self.trace

_pydroid_watcher = _PydroidSafetyWatcher(max_seconds=30.0)
sys.settrace(_pydroid_watcher.trace)

def _pydroid_transform(user_code):
    try:
        tree = ast.parse(user_code)
    except Exception:
        return [user_code, False]

    def is_sleep_call(node):
        if not isinstance(node, ast.Call):
            return False
        if isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name) and node.func.value.id == "time" and node.func.attr == "sleep":
            return True
        if isinstance(node.func, ast.Name) and node.func.id == "sleep":
            return True
        return False

    def is_async_target(node):
        if not isinstance(node, ast.Call):
            return False
        if isinstance(node.func, ast.Name) and node.func.id == "input":
            return True
        return is_sleep_call(node)

    has_target = False
    has_sleep = False
    for node in ast.walk(tree):
        if is_async_target(node):
            has_target = True
            if is_sleep_call(node):
                has_sleep = True

    if not has_target:
        return [user_code, False]

    class FunctionScanner(ast.NodeVisitor):
        def __init__(self):
            self.async_funcs = set()
            self.changed = True

        def scan(self, tree):
            while self.changed:
                self.changed = False
                self.visit(tree)

        def visit_FunctionDef(self, node):
            self.generic_visit(node)
            if node.name.startswith("__") and node.name.endswith("__"):
                return
            for sub in ast.walk(node):
                if is_async_target(sub) or (isinstance(sub, ast.Call) and isinstance(sub.func, ast.Name) and sub.func.id in self.async_funcs):
                    if node.name not in self.async_funcs:
                        self.async_funcs.add(node.name)
                        self.changed = True

    scanner = FunctionScanner()
    scanner.scan(tree)

    class Transformer(ast.NodeTransformer):
        def visit_Call(self, node):
            self.generic_visit(node)
            if isinstance(node.func, ast.Name) and node.func.id == "input":
                new_call = ast.Call(
                    func=ast.Attribute(
                        value=ast.Name(id="__pydroid_input", ctx=ast.Load()),
                        attr="ask_input",
                        ctx=ast.Load()
                    ),
                    args=node.args,
                    keywords=node.keywords
                )
                return ast.Await(value=new_call)
            elif is_sleep_call(node):
                new_call = ast.Call(
                    func=ast.Attribute(
                        value=ast.Name(id="asyncio", ctx=ast.Load()),
                        attr="sleep",
                        ctx=ast.Load()
                    ),
                    args=node.args,
                    keywords=node.keywords
                )
                return ast.Await(value=new_call)
            elif isinstance(node.func, ast.Name) and node.func.id in scanner.async_funcs:
                return ast.Await(value=node)
            return node

        def visit_FunctionDef(self, node):
            self.generic_visit(node)
            if node.name in scanner.async_funcs:
                return ast.AsyncFunctionDef(
                    name=node.name,
                    args=node.args,
                    body=node.body,
                    decorator_list=node.decorator_list,
                    returns=node.returns,
                    type_comment=getattr(node, "type_comment", None)
                )
            return node

    try:
        new_tree = Transformer().visit(tree)
        if has_sleep:
            new_tree.body.insert(0, ast.Import(names=[ast.alias(name="asyncio", asname=None)]))
        ast.fix_missing_locations(new_tree)
        return [ast.unparse(new_tree), True]
    except Exception:
        return [user_code, False]
`);

      // Transform code if contains input() or time.sleep()
      pyodide.globals.set('__pydroid_raw_code', code);
      const transformRes = await pyodide.runPythonAsync('_pydroid_transform(__pydroid_raw_code)');
      const [codeToRun] = transformRes.toJs();
      if (typeof transformRes.destroy === 'function') {
        transformRes.destroy();
      }

      try {
        if (needsExternalPackageLoading(code)) {
          // 1. Let Pyodide load its built-in binary packages (numpy, pandas, matplotlib, scipy, etc.)
          if (typeof pyodide.loadPackagesFromImports === 'function') {
            try {
              await pyodide.loadPackagesFromImports(code, {
                messageCallback: (msg: string) => {
                  callbacks.onSystem(`⚡ ${msg}`);
                },
              });
            } catch (pkgErr: any) {
              const errStr = String(pkgErr?.message || pkgErr);
              console.warn('[Pyodide] loadPackagesFromImports warning:', pkgErr);
              if (
                errStr.includes('Failed to fetch') ||
                errStr.includes('NetworkError') ||
                errStr.includes('loading') ||
                errStr.includes('404')
              ) {
                throw new Error(`Không thể tải gói WASM từ mạng (${errStr}). Chuyển sang CPython Native.`);
              }
            }
          }

          // 2. Only for remaining pure-Python packages that are not yet installed, load via micropip
          const importMatches = Array.from(code.matchAll(/(?:^|\n)\s*(?:import|from)\s+([a-zA-Z0-9_]+)/g)).map((m) => m[1]);
          for (const mod of importMatches) {
            if (mod && !BUILTIN_STDLIB_MODULES.has(mod)) {
              try {
                // Check if module is already installed and importable
                const isAvailable = await pyodide.runPythonAsync(`
import importlib.util
importlib.util.find_spec('${mod}') is not None
`);
                if (!isAvailable) {
                  try {
                    await pyodide.loadPackage('micropip');
                    const micropip = pyodide.pyimport('micropip');
                    callbacks.onSystem(`⚡ Đang cài đặt ${mod} qua micropip...`);
                    await micropip.install(mod);
                    // Remember package in localStorage
                    try {
                      const saved = localStorage.getItem('pydroid3_installed_packages');
                      const parsed = saved ? JSON.parse(saved) : [];
                      if (!parsed.some((p: any) => p.name.toLowerCase() === mod.toLowerCase())) {
                        parsed.push({ name: mod, version: 'installed' });
                        localStorage.setItem('pydroid3_installed_packages', JSON.stringify(parsed));
                      }
                    } catch (_) {}
                  } catch (installErr) {
                    console.warn(`[Pyodide] Auto-install via micropip skipped for '${mod}':`, installErr);
                  }
                }
              } catch (_) {}
            }
          }
        }
        await pyodide.runPythonAsync(codeToRun);
      } finally {
        try {
          await pyodide.runPythonAsync(`
import sys
sys.settrace(None)
`);
        } catch (_) {}
      }

      const executionTimeMs = Math.round(performance.now() - startTime);
      callbacks.onExit({
        exitCode: 0,
        executionTimeMs,
      });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isInterrupted =
        (typeof window !== 'undefined' && (window as any).__pyodideStopRequested) ||
        errMsg.includes('KeyboardInterrupt') ||
        errMsg.includes('🛑 DỪNG') ||
        errMsg.includes('dừng bởi người dùng') ||
        errMsg.includes('Tiến trình đã được dừng');
      const isLoopTimeout = errMsg.includes('PydroidLoopGuard') || errMsg.includes('vòng lặp vô tận') || errMsg.includes('Timeout');

      const isPackageOrEngineError =
        errMsg.includes('Failed to fetch') ||
        errMsg.includes('loading') ||
        errMsg.includes('loadPackage') ||
        errMsg.includes('Không thể tải gói') ||
        errMsg.includes('ModuleNotFoundError') ||
        errMsg.includes('No module named') ||
        errMsg.includes('WASM') ||
        errMsg.includes('WebAssembly') ||
        errMsg.includes('loadPyodide');

      if (isInterrupted) {
        callbacks.onSystem('🛑 Tiến trình Python đã dừng an toàn theo yêu cầu.');
        callbacks.onExit({ exitCode: 130, executionTimeMs: Math.round(performance.now() - startTime), stopped: true });
        return;
      } else if (isLoopTimeout) {
        callbacks.onStderr(`⚠️ ${errMsg}`);
      } else if (onFallbackToCpython && isPackageOrEngineError) {
        const isModuleOrFetch =
          errMsg.includes('ModuleNotFoundError') ||
          errMsg.includes('No module named') ||
          errMsg.includes('Failed to fetch') ||
          errMsg.includes('loading');
        if (!isModuleOrFetch) {
          callbacks.onStderr(`⚠️ Sự cố Pyodide WASM: ${errMsg}`);
        } else {
          callbacks.onSystem('🔄 Đang tự động chuyển tiếp thực thi qua [CPython Native] để hỗ trợ gói đầy đủ...');
        }
        try {
          await onFallbackToCpython(errMsg);
          return;
        } catch (fallbackErr: any) {
          callbacks.onStderr(`❌ Lỗi CPython Native: ${fallbackErr?.message || fallbackErr}`);
        }
      } else {
        callbacks.onStderr(`❌ Lỗi: ${errMsg}`);
      }

      const executionTimeMs = Math.round(performance.now() - startTime);
      callbacks.onExit({
        exitCode: 1,
        executionTimeMs,
      });
    } finally {
      this.isRunning = false;
      this.pendingInputResolve = null;
      this.pendingInputReject = null;
    }
  }

  public sendStdin(data: string): void {
    if (this.pendingInputResolve) {
      const resolver = this.pendingInputResolve;
      this.pendingInputResolve = null;
      this.pendingInputReject = null;
      resolver(data);
    } else {
      this.currentStdinQueue.push(data);
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (typeof window !== 'undefined') {
      (window as any).__pyodideStopRequested = true;
    }
    if (this.pendingInputReject) {
      const rejecter = this.pendingInputReject;
      this.pendingInputResolve = null;
      this.pendingInputReject = null;
      rejecter(new Error('🛑 Tiến trình đã được dừng bởi người dùng'));
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }
}
