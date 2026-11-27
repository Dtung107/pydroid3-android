import React, { useState, useEffect, useRef } from 'react';
import { Trash2, AlertTriangle, Check } from 'lucide-react';
import { TopBar } from './components/TopBar';
import { Editor, EditorRef } from './components/Editor';
import { Terminal } from './components/Terminal';
import { BottomKeyBar } from './components/BottomKeyBar';
import { AiDebugModal } from './components/AiDebugModal';
import { StudyModal } from './components/StudyModal';
import { ColorPickerModal } from './components/ColorPickerModal';
import { SettingsModal } from './components/SettingsModal';
import { FileManagerModal } from './components/FileManagerModal';
import { AiAssistantModal } from './components/AiAssistantModal';
import { GoogleWorkspaceModal } from './components/GoogleWorkspaceModal';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { DEFAULT_LESSONS } from './constants/defaultLessons';
import { DEFAULT_MOBILE_KEYS, BoilerplateSnippet } from './constants/defaultKeys';
import { THEME_PALETTES, DEFAULT_CUSTOM_COLORS } from './constants/themes';
import { PythonWebSocketRunner, PyodideRunner, RunCallbacks } from './utils/pythonRunner';
import { sendGeminiDebug, diagnoseGeminiApi } from './utils/geminiClient';
import {
  initAuth,
  subscribeGoogleAuth,
  googleSignIn,
  formatGoogleAuthErrorMessage,
  GoogleAccountProfile,
} from './utils/googleAuth';
import {
  SyntaxColors,
  KeyItem,
  KeySize,
  LessonItem,
  TerminalEntry,
  ExecutionResult,
  AiDebugResult,
  SavedFile,
  OpenedDeviceFile,
  ExecutionEngine,
  AppTheme,
} from './types';

const INITIAL_CODE = `# ==========================================
# 🐍 Chào mừng bạn đến với Pydroid 3 Web!
# Môi trường IDE Python tối ưu cho Android
# ==========================================

import sys
import math

def main():
    print("✨ Đang khởi chạy Pydroid 3 trên Android...")
    print(f"Phiên bản Python: {sys.version.split()[0]}")
    print("-" * 40)
    
    # Kiểm tra tính năng input() tương tác thời gian thực
    ten = input("Nhập họ và tên của bạn: ")
    print(f"👋 Xin chào {ten}! Chúc bạn lập trình vui vẻ!")
    
    # Tính toán hình học
    ban_kinh = 7.5
    chu_vi = 2 * math.pi * ban_kinh
    dien_tich = math.pi * (ban_kinh ** 2)
    
    print(f"📐 Hình tròn bán kính r = {ban_kinh}:")
    print(f"   - Chu vi:    {chu_vi:.2f}")
    print(f"   - Diện tích: {dien_tich:.2f}")
    print("-" * 40)
    print("🎉 Hoàn tất chương trình thành công!")

if __name__ == "__main__":
    main()
`;

export default function App() {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<'editor' | 'terminal'>('editor');
  const [fileName, setFileName] = useState<string>('main.py');
  const [code, setCode] = useState<string>(() => {
    return localStorage.getItem('pydroid_current_code') || INITIAL_CODE;
  });

  // Editor configuration
  const [fontSize, setFontSize] = useState<number>(() => {
    return Number(localStorage.getItem('pydroid_font_size')) || 15;
  });
  const [fontFamily, setFontFamily] = useState<string>(() => {
    return localStorage.getItem('pydroid_font_family') || "'JetBrains Mono', monospace";
  });
  const [indentSpaces, setIndentSpaces] = useState<number>(() => {
    return Number(localStorage.getItem('pydroid_indent_spaces')) || 4;
  });
  const [engine, setEngine] = useState<ExecutionEngine>(() => {
    return (localStorage.getItem('pydroid_engine') as ExecutionEngine) || 'cpython';
  });
  const [theme, setTheme] = useState<AppTheme>(() => {
    return (localStorage.getItem('pydroid_theme') as AppTheme) || 'pydroid-dark';
  });
  const [customColors, setCustomColors] = useState<SyntaxColors>(() => {
    const saved = localStorage.getItem('pydroid_custom_colors');
    return saved ? JSON.parse(saved) : DEFAULT_CUSTOM_COLORS;
  });

  // Bottom Key Bar configuration
  const [keys, setKeys] = useState<KeyItem[]>(() => {
    const saved = localStorage.getItem('pydroid_keys');
    if (saved) {
      try {
        const parsed: KeyItem[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        return DEFAULT_MOBILE_KEYS;
      }
    }
    return DEFAULT_MOBILE_KEYS;
  });
  const [keySize, setKeySize] = useState<KeySize>(() => {
    return (localStorage.getItem('pydroid_key_size') as KeySize) || 'medium';
  });

  // Lessons and study progress
  const [lessons, setLessons] = useState<LessonItem[]>(() => {
    const saved = localStorage.getItem('pydroid_lessons');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_LESSONS;
      }
    }
    return DEFAULT_LESSONS;
  });

  // Saved files in storage
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>(() => {
    const saved = localStorage.getItem('pydroid_saved_files');
    return saved ? JSON.parse(saved) : [];
  });
  const [openedDeviceFile, setOpenedDeviceFile] = useState<OpenedDeviceFile | null>(null);

  // Terminal state
  const [terminalEntries, setTerminalEntries] = useState<TerminalEntry[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [stdinPreset, setStdinPreset] = useState<string>('');
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);

  // Modals state
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isStudyOpen, setIsStudyOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
  const [isGoogleWorkspaceOpen, setIsGoogleWorkspaceOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Google Auth & Workspace state (access token cached in memory only)
  const [googleProfile, setGoogleProfile] = useState<GoogleAccountProfile | null>(null);
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState<boolean>(true);
  const [apkBridgeReturnUrl, setApkBridgeReturnUrl] = useState<string | null>(null);
  const [apkBridgeError, setApkBridgeError] = useState<string | null>(null);
  const [isApkBridgeSigningIn, setIsApkBridgeSigningIn] = useState<boolean>(false);
  const isApkAuthBridgeMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('apk_auth') === '1';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 2500);
  };

  // AI Debugger state
  const [isAiDebugOpen, setIsAiDebugOpen] = useState(false);
  const [isAiDebugging, setIsAiDebugging] = useState(false);
  const [aiDebugResult, setAiDebugResult] = useState<AiDebugResult | null>(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Dynamic viewport height to adapt immediately to mobile keyboards (Gboard, Samsung Keyboard, Android WebView)
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  // Real-time Python Syntax Linter state
  const [isLinterEnabled, setIsLinterEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('pydroid_linter_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  // Refs
  const editorRef = useRef<EditorRef>(null);
  const cpythonRunnerRef = useRef<PythonWebSocketRunner | null>(null);
  const pyodideRunnerRef = useRef<PyodideRunner | null>(null);

  // Pre-initialize runners on mount and cleanup on unmount
  useEffect(() => {
    if (!cpythonRunnerRef.current) {
      cpythonRunnerRef.current = new PythonWebSocketRunner();
    }
    if (!pyodideRunnerRef.current) {
      const runner = new PyodideRunner();
      pyodideRunnerRef.current = runner;
      if (engine === 'pyodide') {
        runner.warmup().catch(() => {});
      }
    }

    return () => {
      cpythonRunnerRef.current?.stop();
      pyodideRunnerRef.current?.stop();
    };
  }, []);

  // Initialize Google Firebase Auth listener (in-memory token only)
  useEffect(() => {
    const unsubscribeAuth = initAuth(
      (profile) => {
        setGoogleProfile(profile);
        setNeedsGoogleAuth(false);
      },
      () => {
        setNeedsGoogleAuth(true);
      }
    );
    const unsubscribeSub = subscribeGoogleAuth((profile, token) => {
      setGoogleProfile(profile);
      setNeedsGoogleAuth(!token);
    });
    const handleApkAuthUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      if (detail?.profile && detail?.hasToken) {
        setGoogleProfile(detail.profile);
        setNeedsGoogleAuth(false);
        showToast(`✓ Đã đăng nhập Google (${detail.profile.email || detail.profile.displayName})`);
      }
    };
    window.addEventListener('pydroid:google-auth-updated', handleApkAuthUpdated);

    return () => {
      unsubscribeAuth();
      unsubscribeSub();
      window.removeEventListener('pydroid:google-auth-updated', handleApkAuthUpdated);
    };
  }, []);

  // Save code changes to localStorage
  useEffect(() => {
    localStorage.setItem('pydroid_current_code', code);
  }, [code]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('pydroid_font_size', String(fontSize));
    localStorage.setItem('pydroid_font_family', fontFamily);
    localStorage.setItem('pydroid_indent_spaces', String(indentSpaces));
    localStorage.setItem('pydroid_engine', engine);
    localStorage.setItem('pydroid_theme', theme);
    localStorage.setItem('pydroid_custom_colors', JSON.stringify(customColors));
    localStorage.setItem('pydroid_keys', JSON.stringify(keys));
    localStorage.setItem('pydroid_key_size', keySize);
    localStorage.setItem('pydroid_lessons', JSON.stringify(lessons));
    localStorage.setItem('pydroid_saved_files', JSON.stringify(savedFiles));
    localStorage.setItem('pydroid_linter_enabled', String(isLinterEnabled));
  }, [fontSize, fontFamily, indentSpaces, engine, theme, customColors, keys, keySize, lessons, savedFiles, isLinterEnabled]);

  // Compute active syntax colors
  const activeColors = theme === 'custom' ? customColors : (THEME_PALETTES[theme] || THEME_PALETTES['pydroid-dark']);

  // Handle Fullscreen toggle for Android browsers
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch((err) => {
        console.warn('Exit fullscreen failed:', err);
      });
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // 0. Theo dõi visualViewport & window resize để tự động co giãn chiều cao ứng dụng theo bàn phím điện thoại
  useEffect(() => {
    const handleViewportChange = () => {
      if (typeof window === 'undefined') return;
      const vvHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const nextHeight = Math.round(Math.min(window.innerHeight, vvHeight));
      if (nextHeight > 0) {
        setViewportHeight(nextHeight);
      }
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };

    handleViewportChange();

    window.addEventListener('resize', handleViewportChange);
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      if (typeof window !== 'undefined' && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
    };
  }, []);

  // 1. Tự động chuyển toàn màn hình khi mở trên trình duyệt web (bỏ qua trên bản APK để tránh phá cơ chế cuộn bàn phím Android)
  useEffect(() => {
    const isNativeApk =
      typeof window !== 'undefined' &&
      Boolean((window as any).Capacitor?.isNativePlatform?.() || (window as any).AndroidFileBridge);

    if (isNativeApk) return;

    const handleFirstTouchFullscreen = () => {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().then(() => {
          setIsFullscreen(true);
        }).catch(() => {
          // Bỏ qua nếu chính sách trình duyệt chặn
        });
      }
    };

    window.addEventListener('touchstart', handleFirstTouchFullscreen, { once: true, passive: true });
    window.addEventListener('click', handleFirstTouchFullscreen, { once: true, passive: true });

    return () => {
      window.removeEventListener('touchstart', handleFirstTouchFullscreen);
      window.removeEventListener('click', handleFirstTouchFullscreen);
    };
  }, []);

  // 2. Tự động đồng bộ, lưu trạng thái các thư viện vào localStorage lâu dài và tự động nạp lại khi khởi động ứng dụng
  useEffect(() => {
    // A. Danh sách các thư viện cốt lõi luôn được bảo toàn lâu dài trên thiết bị
    const CORE_PACKAGES = [
      { name: 'pyfiglet', version: '1.0.4' },
      { name: 'colorama', version: '0.4.6' },
      { name: 'certifi', version: '2026.10.23' },
      { name: 'charset-normalizer', version: '3.5.2' },
    ];

    // B. Đọc và hợp nhất ngay lập tức từ localStorage để đảm bảo dữ liệu không bị mất khi offline/APK
    const syncAndSavePackages = (extraPackages: Array<{ name: string; version?: string }> = []) => {
      const packageMap = new Map<string, { name: string; version: string }>();

      // 1. Nạp gói cốt lõi
      for (const p of CORE_PACKAGES) {
        packageMap.set(p.name.toLowerCase(), { name: p.name, version: p.version || '1.0.0' });
      }

      // 2. Nạp toàn bộ các gói đã từng lưu trong localStorage
      try {
        const saved = localStorage.getItem('pydroid3_installed_packages');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            for (const p of parsed) {
              if (p && p.name) {
                packageMap.set(p.name.toLowerCase(), {
                  name: p.name,
                  version: p.version || 'installed',
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('Lỗi đọc pydroid3_installed_packages từ localStorage:', err);
      }

      // 3. Hợp nhất thêm các gói từ server hoặc sự kiện mới
      for (const p of extraPackages) {
        if (p && p.name) {
          packageMap.set(p.name.toLowerCase(), {
            name: p.name,
            version: p.version || 'installed',
          });
        }
      }

      const consolidatedList = Array.from(packageMap.values());

      // 4. Lưu vĩnh viễn vào localStorage
      try {
        localStorage.setItem('pydroid3_installed_packages', JSON.stringify(consolidatedList));
      } catch (saveErr) {
        console.warn('Lỗi lưu pydroid3_installed_packages vào localStorage:', saveErr);
      }

      return consolidatedList;
    };

    // Thực hiện lưu và hợp nhất ngay khi mở app
    const initialList = syncAndSavePackages();
    const packageNamesToPreload = initialList.map((p) => p.name);

    // C. Khởi động an toàn môi trường Pyodide khi khởi động ứng dụng
    if (pyodideRunnerRef.current) {
      pyodideRunnerRef.current.preloadInstalledPackages().catch(() => {});
    }

    // D. Đồng bộ từ backend /api/python/packages (nếu có kết nối máy chủ)
    fetch('/api/python/packages')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.packages && Array.isArray(data.packages)) {
          syncAndSavePackages(data.packages);
        }
      })
      .catch(() => {
        // Hoạt động offline/APK hoàn toàn trơn tru với dữ liệu localStorage đã lưu
      });

    // E. Lắng nghe sự kiện cập nhật thư viện từ SettingsModal để lập tức lưu
    const handlePackagesUpdated = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detailPackages = Array.isArray(customEvent.detail) ? customEvent.detail : [];
      syncAndSavePackages(detailPackages);
    };

    window.addEventListener('pydroid:packages-updated', handlePackagesUpdated);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pydroid3_installed_packages') {
        syncAndSavePackages();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // F. Lắng nghe ghi log vào Terminal từ các công cụ chẩn đoán (Diagnostic Tools)
    const handleTerminalLog = (event: Event) => {
      const customEvent = event as CustomEvent<{
        type?: 'stdout' | 'stderr' | 'system' | 'stdin';
        text?: string;
        clear?: boolean;
        switchTab?: boolean;
      }>;
      if (!customEvent.detail) return;
      if (customEvent.detail.clear) {
        setTerminalEntries([]);
      }
      if (customEvent.detail.text !== undefined) {
        const entryText = customEvent.detail.text;
        const entryType = customEvent.detail.type || 'stdout';
        setTerminalEntries((prev) => [
          ...prev,
          {
            type: entryType,
            text: entryText,
          },
        ]);
      }
      if (customEvent.detail.switchTab !== false) {
        setActiveTab('terminal');
      }
    };
    window.addEventListener('pydroid:terminal-log', handleTerminalLog);

    // G. Lắng nghe yêu cầu kích hoạt chẩn đoán Gemini API từ bất kỳ đâu trong app
    const handleRunDiagnostic = () => {
      setActiveTab('terminal');
      diagnoseGeminiApi().catch((err) => {
        console.error('Lỗi khi chạy chẩn đoán Gemini:', err);
      });
    };
    window.addEventListener('pydroid:run-gemini-diagnostic', handleRunDiagnostic);

    return () => {
      window.removeEventListener('pydroid:packages-updated', handlePackagesUpdated);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('pydroid:terminal-log', handleTerminalLog);
      window.removeEventListener('pydroid:run-gemini-diagnostic', handleRunDiagnostic);
    };
  }, []);

  // Quick 1-click toggle between CPython Native and Pyodide WASM
  const handleToggleEngine = () => {
    const nextEngine: ExecutionEngine = engine === 'cpython' ? 'pyodide' : 'cpython';
    setEngine(nextEngine);
    localStorage.setItem('pydroid_engine', nextEngine);
    if (nextEngine === 'pyodide') {
      showToast('🌐 Đã kích hoạt: Pyodide WASM (Python WebAssembly)');
      pyodideRunnerRef.current?.warmup().catch(() => {});
    } else {
      showToast('⚡ Đã kích hoạt: CPython Native (Máy chủ Linux)');
    }
  };

  /**
   * Unified Validation Wrapper for Python Execution
   *
   * Verifies the integrity of the selected execution engine (CPython or Pyodide WASM),
   * performs pre-flight WebAssembly capability checks, and guarantees an automatic,
   * seamless fallback to CPython Native whenever Pyodide is unavailable or encounters
   * a runtime failure, keeping the user experience completely uninterrupted.
   */
  const executeWithEngineValidation = async (
    targetEngine: ExecutionEngine,
    codeToRun: string,
    stdinData: string,
    callbacks: RunCallbacks
  ): Promise<void> => {
    // 1. Ensure runner instances exist and are initialized
    if (!cpythonRunnerRef.current) {
      cpythonRunnerRef.current = new PythonWebSocketRunner();
    }
    if (!pyodideRunnerRef.current) {
      pyodideRunnerRef.current = new PyodideRunner();
    }

    const cpythonRunner = cpythonRunnerRef.current;
    const pyodideRunner = pyodideRunnerRef.current;

    // 2. Perform pre-flight integrity & capability validation on target engine
    let effectiveEngine: ExecutionEngine = targetEngine;
    let preFlightFallbackReason: string | null = null;

    if (targetEngine === 'pyodide') {
      try {
        const wasmStatus = await pyodideRunner.checkStatus();
        if (!wasmStatus.ok) {
          effectiveEngine = 'cpython';
          preFlightFallbackReason = wasmStatus.message + (wasmStatus.details ? ` (${wasmStatus.details})` : '');
        }
      } catch (checkErr: any) {
        effectiveEngine = 'cpython';
        preFlightFallbackReason = checkErr?.message || 'Lỗi kiểm tra môi trường WebAssembly';
      }
    } else {
      // Validate CPython runner integrity
      if (!cpythonRunner || typeof cpythonRunner.run !== 'function') {
        throw new Error('CPython WebSocket Runner chưa sẵn sàng.');
      }
    }

    // 3. If pre-flight validation detected WASM is unavailable, trigger seamless fallback to CPython
    if (preFlightFallbackReason) {
      console.warn('[Engine Validation] WASM unavailable, falling back to CPython Native:', preFlightFallbackReason);
      showToast('⚠️ Môi trường WebAssembly không khả dụng: Đang tự động chạy qua CPython Native.');
      setTerminalEntries((prev) => [
        ...prev,
        {
          type: 'stderr',
          text: `⚠️ Thiết bị không khả dụng WebAssembly: ${preFlightFallbackReason}`,
        },
        {
          type: 'system',
          text: '🔄 Đang tự động thực thi qua [CPython Native] để đảm bảo trải nghiệm liên tục...',
        },
      ]);
      await cpythonRunner.run(codeToRun, stdinData, callbacks);
      return;
    }

    // 4. Execute with the verified engine
    if (effectiveEngine === 'pyodide') {
      try {
        await pyodideRunner.run(
          codeToRun,
          stdinData,
          callbacks,
          async (runtimeReason?: string) => {
            // Automatic seamless fallback to CPython Native if runtime error/download failure occurs
            const isPackageFallback = runtimeReason && (
              runtimeReason.includes('ModuleNotFoundError') ||
              runtimeReason.includes('No module named') ||
              runtimeReason.includes('Failed to fetch') ||
              runtimeReason.includes('loading') ||
              runtimeReason.includes('Không thể tải gói')
            );
            console.warn('[Engine Validation] Pyodide runtime fallback triggered:', runtimeReason);
            if (!isPackageFallback) {
              setTerminalEntries((prev) => [
                ...prev,
                {
                  type: 'stderr',
                  text: `⚠️ Sự cố nạp động cơ Pyodide WASM${runtimeReason ? `: ${runtimeReason}` : ''}`,
                },
              ]);
            } else {
              setTerminalEntries((prev) => [
                ...prev,
                {
                  type: 'system',
                  text: '🔄 Đang tự động chuyển tiếp thực thi qua [CPython Native]...',
                },
              ]);
            }
            await cpythonRunner.run(codeToRun, stdinData, callbacks);
          }
        );
      } catch (pyodideErr: any) {
        const errMsg = pyodideErr?.message || String(pyodideErr || '');
        const isInterrupted =
          (typeof window !== 'undefined' && (window as any).__pyodideStopRequested) ||
          errMsg.includes('KeyboardInterrupt') ||
          errMsg.includes('🛑 DỪNG') ||
          errMsg.includes('dừng bởi người dùng') ||
          errMsg.includes('Tiến trình đã được dừng');

        if (isInterrupted) {
          // Intentional stop action by user: do not fallback, do not report as error
          return;
        }

        const isModuleMissing = errMsg.includes('ModuleNotFoundError') || errMsg.includes('No module named');
        if (!isModuleMissing) {
          console.warn('[Engine Validation] Caught unhandled Pyodide exception, initiating seamless fallback:', pyodideErr);
          setTerminalEntries((prev) => [
            ...prev,
            {
              type: 'stderr',
              text: `⚠️ Động cơ Pyodide gặp ngoại lệ: ${errMsg}`,
            },
          ]);
        }
        await cpythonRunner.run(codeToRun, stdinData, callbacks);
      }
    } else {
      // Direct CPython Native execution path
      await cpythonRunner.run(codeToRun, stdinData, callbacks);
    }
  };

  // Run execution with unified engine validation wrapper
  const handleRun = async () => {
    // 1. Verify code content is not empty
    if (!code.trim()) {
      showToast('⚠️ Vui lòng nhập mã Python trước khi bấm RUN!');
      setActiveTab('editor');
      editorRef.current?.focus();
      return;
    }

    // 2. Tactile feedback for mobile devices
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(35);
      }
    } catch (e) {
      // ignore
    }

    // 3. Stop previous execution if still running
    if (isRunning) {
      handleStop();
      await new Promise((r) => setTimeout(r, 120));
    }

    // 4. Initialize terminal state
    setIsRunning(true);
    setExecutionResult(null);
    setAiDebugResult(null);
    setTerminalEntries([]);
    setActiveTab('terminal');

    // 5. Define streaming callbacks
    const callbacks: RunCallbacks = {
      onStdout: (text: string) => {
        setTerminalEntries((prev) => [...prev, { type: 'stdout', text }]);
      },
      onStderr: (text: string) => {
        setTerminalEntries((prev) => [...prev, { type: 'stderr', text }]);
      },
      onSystem: (text: string) => {
        setTerminalEntries((prev) => [...prev, { type: 'system', text }]);
      },
      onExit: (result: ExecutionResult) => {
        setIsRunning(false);
        setExecutionResult(result);
      },
      onError: (err: string) => {
        setIsRunning(false);
        setTerminalEntries((prev) => [...prev, { type: 'stderr', text: `❌ Lỗi hệ thống: ${err}` }]);
        setExecutionResult({ exitCode: 1, executionTimeMs: 0 });
      },
    };

    // 6. Invoke unified validation wrapper for the execution path
    try {
      await executeWithEngineValidation(engine, code, stdinPreset, callbacks);
    } catch (err: any) {
      callbacks.onError(err?.message || 'Lỗi không xác định khi khởi chạy mã nguồn');
    }
  };

  // Stop execution across all runners
  const handleStop = () => {
    if (cpythonRunnerRef.current) {
      cpythonRunnerRef.current.stop();
    }
    if (pyodideRunnerRef.current) {
      pyodideRunnerRef.current.stop();
    }
    setIsRunning(false);
    setExecutionResult({
      exitCode: 130,
      executionTimeMs: 0,
      stopped: true,
    });
    setTerminalEntries((prev) => [...prev, { type: 'system', text: '🛑 Tiến trình Python đã được dừng an toàn.' }]);
  };

  // Send interactive stdin input to active engine
  const handleSendStdin = (inputData: string) => {
    setTerminalEntries((prev) => [...prev, { type: 'stdin', text: inputData }]);

    if (engine === 'cpython') {
      if (cpythonRunnerRef.current) {
        cpythonRunnerRef.current.sendStdin(inputData);
      }
    } else {
      if (pyodideRunnerRef.current) {
        pyodideRunnerRef.current.sendStdin(inputData);
      }
    }
  };

  // AI Debugger trigger
  const handleTriggerAiDebug = async (errorText: string, openModal = false) => {
    setIsAiDebugging(true);
    if (openModal) {
      setIsAiDebugOpen(true);
    }
    setAiDebugResult(null);

    try {
      const debugData = await sendGeminiDebug(code, errorText);
      setAiDebugResult(debugData);
    } catch (err: any) {
      setAiDebugResult({
        errorType: 'AI Error',
        vietnameseSummary: 'Không thể phân tích lỗi lúc này.',
        rootCause: err.message || 'Lỗi kết nối máy chủ Gemini AI.',
        tips: ['Kiểm tra kết nối mạng và thử chạy lại mã.'],
        fixedCode: code,
        diffExplanation: 'Không có thay đổi.',
      });
    } finally {
      setIsAiDebugging(false);
    }
  };

  // Quick clear code with confirmation
  const handleClearCode = () => {
    setIsConfirmClearOpen(true);
  };

  // Bottom key bar key insert
  const handleBottomKeyPress = (insertVal: string) => {
    editorRef.current?.insertTextAtCursor(insertVal);
  };

  // Lessons actions
  const handleSelectLesson = (lesson: LessonItem) => {
    setCode(lesson.starterCode);
    setFileName(`${lesson.id}.py`);
    if (lesson.sampleInput) {
      setStdinPreset(lesson.sampleInput);
    }
    setActiveTab('editor');
    showToast(`⚡ Đã nạp bài tập "${lesson.title}" vào Editor!`);
  };

  const handleSelectSolution = (lesson: LessonItem) => {
    setCode(lesson.solutionCode);
    setFileName(`${lesson.id}_solution.py`);
    if (lesson.sampleInput) {
      setStdinPreset(lesson.sampleInput);
    }
    setActiveTab('editor');
    showToast(`💡 Đã nạp đáp án mẫu của "${lesson.title}" vào Editor!`);
  };

  const handleToggleCompleteLesson = (id: string) => {
    setLessons((prev) =>
      prev.map((l) => (l.id === id ? { ...l, completed: !l.completed } : l))
    );
  };

  const handleAddNewLessons = (newLessons: LessonItem[]) => {
    setLessons((prev) => {
      const incomingIds = new Set(newLessons.map((l) => l.id));
      const remainingPrev = prev.filter((l) => !incomingIds.has(l.id));
      return [...newLessons, ...remainingPrev];
    });
    showToast(`✨ Đã thêm ${newLessons.length} bài tập mới vào kho bài học!`);
  };

  const handleDeleteCompletedLessons = () => {
    const completedCount = lessons.filter((l) => l.completed).length;
    if (completedCount === 0) {
      showToast('Không có bài tập nào được đánh dấu hoàn thành.');
      return;
    }
    setLessons((prev) => prev.filter((l) => !l.completed));
    showToast(`Đã xoá ${completedCount} bài tập đã hoàn thành khỏi kho!`);
  };

  const handleDeleteLesson = (id: string) => {
    setLessons((prev) => prev.filter((l) => l.id !== id));
    showToast('Đã xoá bài tập khỏi kho bài học!');
  };

  const handleRestoreDefaultLessons = () => {
    setLessons(DEFAULT_LESSONS);
    showToast('Đã khôi phục danh sách bài tập mẫu mặc định!');
  };

  // Listen for native Android SAF file open callback
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__handleApkOpenedFile = (payload: {
      uri?: string;
      name?: string;
      content?: string;
    }) => {
      if (!payload || typeof payload.content !== 'string') return;
      const openedName = (payload.name || 'untitled.py').trim() || 'untitled.py';
      setCode(payload.content);
      setFileName(openedName);
      setOpenedDeviceFile({
        source: 'android-saf',
        name: openedName,
        androidUri: payload.uri,
        openedAt: Date.now(),
      });
      setActiveTab('editor');
      setIsFileManagerOpen(false);
      showToast(`📂 Đã mở "${openedName}" từ bộ nhớ máy!`);
    };
    return () => {
      try {
        delete (window as any).__handleApkOpenedFile;
      } catch (_) {}
    };
  }, []);

  // File Manager actions
  const handleSaveCurrentFile = () => {
    const existing = savedFiles.find((f) => f.name === fileName);
    if (existing) {
      setSavedFiles((prev) =>
        prev.map((f) => (f.name === fileName ? { ...f, code, lastModified: Date.now() } : f))
      );
    } else {
      const newFile: SavedFile = {
        id: `file_${Date.now()}`,
        name: fileName,
        code,
        lastModified: Date.now(),
      };
      setSavedFiles((prev) => [newFile, ...prev]);
    }
    showToast(`Đã lưu "${fileName}" vào danh sách ứng dụng!`);
  };

  const handleNewFile = () => {
    setCode('# File Python mới\n\n');
    setFileName('untitled.py');
    setOpenedDeviceFile(null);
    setActiveTab('editor');
  };

  const handleLoadFile = (file: SavedFile) => {
    setCode(file.code);
    setFileName(file.name);
    setOpenedDeviceFile({
      source: 'local-memory',
      name: file.name,
      savedFileId: file.id,
      openedAt: Date.now(),
    });
    setActiveTab('editor');
  };

  const handleDeleteFile = (id: string) => {
    setSavedFiles((prev) => prev.filter((f) => f.id !== id));
    setOpenedDeviceFile((prev) => (prev?.savedFileId === id ? null : prev));
  };

  const handleUploadFile = (
    name: string,
    content: string,
    deviceMeta?: {
      source: OpenedDeviceFile['source'];
      handle?: any;
      androidUri?: string;
    }
  ) => {
    setCode(content);
    setFileName(name);
    setOpenedDeviceFile({
      source: deviceMeta?.source || 'readonly-upload',
      name,
      handle: deviceMeta?.handle,
      androidUri: deviceMeta?.androidUri,
      openedAt: Date.now(),
    });
    setActiveTab('editor');
    showToast(`📂 Đã mở "${name}" từ bộ nhớ máy!`);
  };

  const handleOverwriteOpenedFile = async (): Promise<{ ok: boolean; message: string }> => {
    if (!openedDeviceFile) {
      return {
        ok: false,
        message: 'Chưa có file nào được mở từ bộ nhớ máy trước đó để ghi đè.',
      };
    }

    const now = Date.now();
    const targetName = openedDeviceFile.name || fileName || 'untitled.py';

    // 1. Desktop / Modern Browser File System Access API (Direct handle overwrite)
    if (openedDeviceFile.source === 'fsa' && openedDeviceFile.handle) {
      try {
        const handle = openedDeviceFile.handle;
        if (typeof handle.queryPermission === 'function') {
          let perm = await handle.queryPermission({ mode: 'readwrite' });
          if (perm !== 'granted' && typeof handle.requestPermission === 'function') {
            perm = await handle.requestPermission({ mode: 'readwrite' });
          }
          if (perm !== 'granted') {
            return {
              ok: false,
              message: `Trình duyệt chưa cấp quyền ghi đè lên tệp "${targetName}".`,
            };
          }
        }
        const writable = await handle.createWritable();
        await writable.write(code);
        await writable.close();

        setOpenedDeviceFile((prev) => (prev ? { ...prev, lastOverwrittenAt: now } : prev));
        setSavedFiles((prev) =>
          prev.map((f) =>
            f.name === targetName ? { ...f, code, lastModified: now } : f
          )
        );
        const msg = `✓ Đã Save (ghi đè) lên file "${targetName}" trên máy!`;
        showToast(msg);
        return { ok: true, message: msg };
      } catch (err: any) {
        return {
          ok: false,
          message: err?.message || `Không thể ghi đè lên tệp "${targetName}".`,
        };
      }
    }

    // 2. Android APK Storage Access Framework (SAF URI overwrite)
    if (openedDeviceFile.source === 'android-saf' && openedDeviceFile.androidUri) {
      try {
        const bridge = (window as any).AndroidFileBridge;
        if (bridge && typeof bridge.overwriteUriFile === 'function') {
          const rawRes = bridge.overwriteUriFile(openedDeviceFile.androidUri, code);
          const parsed = typeof rawRes === 'string' ? JSON.parse(rawRes) : rawRes;
          if (parsed?.ok) {
            setOpenedDeviceFile((prev) => (prev ? { ...prev, lastOverwrittenAt: now } : prev));
            setSavedFiles((prev) =>
              prev.map((f) =>
                f.name === targetName ? { ...f, code, lastModified: now } : f
              )
            );
            const msg = `✓ Đã Save (ghi đè) lên file "${targetName}" trong bộ nhớ máy!`;
            showToast(msg);
            return { ok: true, message: msg };
          }
          return {
            ok: false,
            message: parsed?.error || `Không thể ghi đè trực tiếp lên "${targetName}".`,
          };
        }
        return {
          ok: false,
          message: 'Cầu nối Android không hỗ trợ ghi đè URI trực tiếp.',
        };
      } catch (err: any) {
        return {
          ok: false,
          message: err?.message || `Lỗi ghi đè lên tệp "${targetName}".`,
        };
      }
    }

    // 3. In-app saved files list ("Các file đã lưu")
    if (openedDeviceFile.source === 'local-memory' && openedDeviceFile.savedFileId) {
      const targetId = openedDeviceFile.savedFileId;
      const updatedName = fileName.trim() || targetName;
      const exists = savedFiles.some((f) => f.id === targetId);
      if (exists) {
        setSavedFiles((prev) =>
          prev.map((f) =>
            f.id === targetId ? { ...f, name: updatedName, code, lastModified: now } : f
          )
        );
      } else {
        setSavedFiles((prev) => [
          { id: targetId, name: updatedName, code, lastModified: now },
          ...prev,
        ]);
      }
      setOpenedDeviceFile((prev) =>
        prev ? { ...prev, name: updatedName, lastOverwrittenAt: now } : prev
      );
      const msg = `✓ Đã Save (ghi đè) lên "${updatedName}" trong danh sách đã lưu!`;
      showToast(msg);
      return { ok: true, message: msg };
    }

    // 4. Fallback for <input type="file"> opened files (upgrade to FSA handle or save/download)
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: targetName,
          types: [
            {
              description: 'Tập tin Python (*.py)',
              accept: { 'text/x-python': ['.py'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(code);
        await writable.close();
        const savedName = handle.name || targetName;
        setFileName(savedName);
        setOpenedDeviceFile({
          source: 'fsa',
          name: savedName,
          handle,
          openedAt: openedDeviceFile.openedAt,
          lastOverwrittenAt: now,
        });
        const msg = `✓ Đã Save (ghi đè) và liên kết file "${savedName}"!`;
        showToast(msg);
        return { ok: true, message: msg };
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return { ok: false, message: 'Đã hủy thao tác lưu tệp.' };
        }
      }
    }

    if (typeof window !== 'undefined' && (window as any).AndroidFileBridge?.saveFile) {
      try {
        const ok = (window as any).AndroidFileBridge.saveFile(targetName, code);
        if (ok) {
          setOpenedDeviceFile((prev) => (prev ? { ...prev, lastOverwrittenAt: now } : prev));
          const msg = `✓ Đã lưu "${targetName}" vào thư mục Download của điện thoại!`;
          showToast(msg);
          return { ok: true, message: msg };
        }
      } catch (_) {}
    }

    try {
      const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = targetName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (_) {}
      }, 1000);
      setOpenedDeviceFile((prev) => (prev ? { ...prev, lastOverwrittenAt: now } : prev));
      const msg = `✓ Đã xuất ghi đè "${targetName}" về thư mục Tải xuống!`;
      showToast(msg);
      return { ok: true, message: msg };
    } catch (err: any) {
      return {
        ok: false,
        message: err?.message || `Không thể lưu tệp "${targetName}".`,
      };
    }
  };

  // 🛠️ Kích hoạt Bộ sửa lỗi tự động AI (Chỉ rõ dòng lỗi, nguyên nhân & sửa code hoàn chỉnh)
  const handleOpenAutoFix = () => {
    const errorText =
      terminalEntries
        .filter((e) => e.type === 'stderr')
        .map((e) => e.text)
        .join('\n') ||
      (executionResult && executionResult.exitCode !== 0
        ? `Lỗi thực thi với mã thoát: ${executionResult.exitCode}`
        : '');
    handleTriggerAiDebug(errorText, true);
  };

  if (isApkAuthBridgeMode) {
    const handleBridgeSignIn = async () => {
      setIsApkBridgeSigningIn(true);
      setApkBridgeError(null);
      try {
        const res = await googleSignIn({ forcePopup: true });
        if (res?.accessToken) {
          const fragment = new URLSearchParams({
            access_token: res.accessToken,
            uid: res.profile.uid,
            name: res.profile.displayName,
            email: res.profile.email,
            photo: res.profile.photoURL,
          }).toString();
          const deepLink = `com.pydroid3.web://auth-callback#${fragment}`;
          setApkBridgeReturnUrl(deepLink);
          window.location.href = deepLink;
        }
      } catch (err: any) {
        setApkBridgeError(formatGoogleAuthErrorMessage(err));
      } finally {
        setIsApkBridgeSigningIn(false);
      }
    };

    return (
      <div className="min-h-screen w-screen bg-[#13131c] text-gray-100 flex items-center justify-center p-5">
        <div className="bg-[#1b1b29] border border-[#35344f] rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
          <h1 className="text-base font-bold text-amber-300">
            Đăng nhập Google cho Pydroid 3 APK
          </h1>
          <p className="text-xs text-gray-300 leading-relaxed">
            Nhấn nút bên dưới để xác thực tài khoản Google của bạn trên trình duyệt an toàn, sau đó quay lại ứng dụng APK để dùng Google Drive, Ghi chú Cloud và Google Tasks.
          </p>

          <div className="flex justify-center">
            <GoogleSignInButton
              onClick={handleBridgeSignIn}
              disabled={isApkBridgeSigningIn}
              label={isApkBridgeSigningIn ? 'Đang xác thực...' : 'Sign in with Google'}
            />
          </div>

          {apkBridgeError && (
            <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs text-left">
              {apkBridgeError}
            </div>
          )}

          {apkBridgeReturnUrl && (
            <div className="space-y-2 pt-2 border-t border-[#2d2c42]">
              <p className="text-xs text-emerald-300 font-semibold">
                Xác thực thành công! Nếu ứng dụng chưa tự mở lại, hãy bấm nút dưới đây:
              </p>
              <a
                href={apkBridgeReturnUrl}
                className="inline-block w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-xl text-xs"
              >
                Quay lại Pydroid 3 APK
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col w-screen overflow-hidden bg-[#181822] text-gray-100 font-sans select-none"
      style={{
        height: viewportHeight ? `${viewportHeight}px` : '100dvh',
        maxHeight: viewportHeight ? `${viewportHeight}px` : '100dvh',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      {/* 🎛️ Streamlined Top Bar */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isRunning={isRunning}
        onRun={handleRun}
        onStop={handleStop}
        onOpenFileManager={() => setIsFileManagerOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onClearCode={handleClearCode}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        onOpenAutoFix={handleOpenAutoFix}
        onOpenGoogleWorkspace={() => setIsGoogleWorkspaceOpen(true)}
        isGoogleSignedIn={!needsGoogleAuth && Boolean(googleProfile)}
        engine={engine}
        onToggleEngine={handleToggleEngine}
        onInsertBoilerplate={(snippetCode) => {
          if (activeTab !== 'editor') {
            setActiveTab('editor');
            setTimeout(() => {
              editorRef.current?.insertTextAtCursor(snippetCode);
            }, 30);
          } else {
            editorRef.current?.insertTextAtCursor(snippetCode);
          }
        }}
        onPinBoilerplate={(snippet: BoilerplateSnippet) => {
          const exists = keys.some(
            (k) => k.label === snippet.shortLabel || k.insertValue === snippet.code
          );
          if (exists) {
            return `Mẫu "${snippet.shortLabel}" đã có sẵn trên thanh phím tắt!`;
          }
          const newKey: KeyItem = {
            id: `bp_${snippet.id}_${Date.now().toString(36)}`,
            label: snippet.shortLabel,
            insertValue: snippet.code,
            visible: true,
            type: 'keyword',
            isCustom: true,
          };
          const updated = [newKey, ...keys];
          setKeys(updated);
          localStorage.setItem('pydroid_keys', JSON.stringify(updated));
          return `Đã ghim "${snippet.shortLabel}" lên đầu thanh phím tắt!`;
        }}
      />

      {/* Main Workspace (Editor or Terminal) */}
      <main className="flex-1 min-h-0 relative w-full overflow-hidden flex flex-col">
        {/* Editor Screen */}
        <div
          className={`flex-1 min-h-0 w-full h-full flex flex-col overflow-hidden ${
            activeTab === 'editor' ? 'flex' : 'hidden'
          }`}
        >
          <Editor
            ref={editorRef}
            code={code}
            onChange={setCode}
            colors={activeColors}
            fontSize={fontSize}
            fontFamily={fontFamily}
            indentSpaces={indentSpaces}
            isLinterEnabled={isLinterEnabled}
            onTriggerAiDebug={handleTriggerAiDebug}
          />
        </div>

        {/* Terminal Screen */}
        <div
          className={`flex-1 min-h-0 w-full h-full flex flex-col overflow-hidden ${
            activeTab === 'terminal' ? 'flex' : 'hidden'
          }`}
        >
          <Terminal
            entries={terminalEntries}
            isRunning={isRunning}
            onSendStdin={handleSendStdin}
            onStop={handleStop}
            onClear={() => setTerminalEntries([])}
            stdinPreset={stdinPreset}
            setStdinPreset={setStdinPreset}
            executionResult={executionResult}
            onTriggerAiDebug={handleTriggerAiDebug}
            isAiDebugging={isAiDebugging}
            aiDebugResult={aiDebugResult}
            onApplyCode={(fixed) => {
              setCode(fixed);
              setActiveTab('editor');
              showToast('Đã áp dụng mã đã sửa vào trình soạn thảo!');
            }}
            onApplyAndRun={(fixed) => {
              setCode(fixed);
              showToast('Đang áp dụng và chạy lại mã...');
              setTimeout(() => {
                handleRun();
              }, 150);
            }}
            onRunAgain={handleRun}
            engine={engine}
          />
        </div>
      </main>

      {/* 📱 Bottom Mobile Programming Key Bar (Always visible in editor mode, flush to keyboard) */}
      {activeTab === 'editor' && (
        <BottomKeyBar
          keys={keys}
          onKeyPress={handleBottomKeyPress}
          keySize={keySize}
          onUpdateKeySize={setKeySize}
          onUpdateKeys={(newKeys) => {
            setKeys(newKeys);
            localStorage.setItem('pydroid_keys', JSON.stringify(newKeys));
          }}
          onResetKeys={() => {
            setKeys(DEFAULT_MOBILE_KEYS);
            localStorage.setItem('pydroid_keys', JSON.stringify(DEFAULT_MOBILE_KEYS));
            showToast('🔄 Đã khôi phục phím tắt mặc định');
          }}
          onSaveConfig={(savedKeys, size) => {
            setKeys(savedKeys);
            setKeySize(size);
            localStorage.setItem('pydroid_keys', JSON.stringify(savedKeys));
            localStorage.setItem('pydroid_key_size', size);
            showToast('💾 Đã lưu cấu hình phím tắt người dùng!');
          }}
        />
      )}

      {/* Modals */}
      {/* 1. AI Debug Modal */}
      <AiDebugModal
        isOpen={isAiDebugOpen}
        onClose={() => setIsAiDebugOpen(false)}
        result={aiDebugResult}
        isLoading={isAiDebugging}
        onApplyCode={(fixed) => {
          setCode(fixed);
          setActiveTab('editor');
        }}
        onApplyAndRun={(fixed) => {
          setCode(fixed);
          setTimeout(() => {
            handleRun();
          }, 150);
        }}
      />

      {/* 2. Study & Curriculum Modal */}
      <StudyModal
        isOpen={isStudyOpen}
        onClose={() => setIsStudyOpen(false)}
        lessons={lessons}
        onSelectLesson={handleSelectLesson}
        onSelectSolution={handleSelectSolution}
        onToggleComplete={handleToggleCompleteLesson}
        onAddNewLessons={handleAddNewLessons}
        onResetProgress={() => {
          setLessons((prev) => prev.map((l) => ({ ...l, completed: false })));
          showToast('Đã đặt lại tiến trình học tập về 0%!');
        }}
        onDeleteCompletedLessons={handleDeleteCompletedLessons}
        onDeleteLesson={handleDeleteLesson}
        onRestoreDefaultLessons={handleRestoreDefaultLessons}
      />

      {/* 3. Custom Syntax Color Picker Modal */}
      <ColorPickerModal
        isOpen={isColorPickerOpen}
        onClose={() => setIsColorPickerOpen(false)}
        colors={customColors}
        onUpdateColors={(newColors) => {
          setCustomColors(newColors);
          setTheme('custom');
        }}
      />

      {/* 4. Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        fontSize={fontSize}
        setFontSize={setFontSize}
        fontFamily={fontFamily}
        setFontFamily={setFontFamily}
        indentSpaces={indentSpaces}
        setIndentSpaces={setIndentSpaces}
        engine={engine}
        setEngine={setEngine}
        onOpenColorPicker={() => setIsColorPickerOpen(true)}
        customColors={customColors}
        googleProfile={googleProfile}
        needsGoogleAuth={needsGoogleAuth}
        onOpenGoogleWorkspace={() => setIsGoogleWorkspaceOpen(true)}
      />

      {/* 5. File Manager Modal */}
      <FileManagerModal
        isOpen={isFileManagerOpen}
        onClose={() => setIsFileManagerOpen(false)}
        currentFileName={fileName}
        onRenameCurrentFile={setFileName}
        currentCode={code}
        onLoadFile={handleLoadFile}
        onSaveCurrentFile={handleSaveCurrentFile}
        onNewFile={handleNewFile}
        savedFiles={savedFiles}
        onDeleteFile={handleDeleteFile}
        onUploadFile={handleUploadFile}
        openedDeviceFile={openedDeviceFile}
        onOverwriteOpenedFile={handleOverwriteOpenedFile}
        onOpenGoogleWorkspace={() => setIsGoogleWorkspaceOpen(true)}
        onApplySnippet={(snippetCode) => {
          setCode(snippetCode);
          setActiveTab('editor');
          showToast('Đã nạp đoạn mã từ Kho Vault vào Editor!');
        }}
        onInsertSnippet={(snippetCode) => {
          if (editorRef.current?.insertTextAtCursor) {
            editorRef.current.insertTextAtCursor(snippetCode);
          } else {
            setCode((prev) => (prev ? prev + '\n\n' + snippetCode : snippetCode));
          }
          setActiveTab('editor');
          showToast('Đã chèn đoạn mã vào vị trí con trỏ!');
        }}
      />

      {/* 5.5 Google Workspace Modal (Drive, Cloud Notes, Google Tasks) */}
      <GoogleWorkspaceModal
        isOpen={isGoogleWorkspaceOpen}
        onClose={() => setIsGoogleWorkspaceOpen(false)}
        profile={googleProfile}
        needsAuth={needsGoogleAuth}
        currentFileName={fileName}
        currentCode={code}
        onLoadCodeToEditor={(loadedName, loadedCode) => {
          setFileName(loadedName);
          setCode(loadedCode);
          setActiveTab('editor');
          showToast(`Đã mở "${loadedName}" từ Google Drive!`);
        }}
        onInsertSnippetToEditor={(snippetCode) => {
          if (editorRef.current?.insertTextAtCursor) {
            editorRef.current.insertTextAtCursor(snippetCode);
          } else {
            setCode((prev) => (prev ? prev + '\n\n' + snippetCode : snippetCode));
          }
          setActiveTab('editor');
          showToast('Đã chèn nội dung từ Ghi chú Cloud vào Editor!');
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        onOpenAutoFix={handleOpenAutoFix}
      />

      {/* 6. Python AI Coding Assistant Chat Modal */}
      <AiAssistantModal
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        currentCode={code}
        currentFileName={fileName}
        lastErrorText={
          terminalEntries
            .filter((e) => e.type === 'stderr')
            .map((e) => e.text)
            .join('\n') || (executionResult && executionResult.exitCode !== 0 ? `Lỗi thực thi với mã thoát: ${executionResult.exitCode}` : '')
        }
        onApplyCode={(newCode) => {
          setCode(newCode);
          setActiveTab('editor');
          showToast('Đã áp dụng mã từ Trợ lý AI vào Editor!');
        }}
      />

      {/* 7. In-App Confirmation Modal: Xóa nhanh mã nguồn */}
      {isConfirmClearOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#1c1c27] border border-red-500/40 rounded-2xl w-full max-w-sm p-5 text-gray-200 shadow-2xl flex flex-col items-center text-center space-y-3.5">
            <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-500/50 flex items-center justify-center text-red-400 shadow-inner">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-gray-100">Xóa nhanh mã nguồn?</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Toàn bộ nội dung trong trình soạn thảo sẽ được xóa sạch. Thao tác này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center space-x-2.5 w-full pt-1">
              <button
                onClick={() => setIsConfirmClearOpen(false)}
                className="flex-1 py-2.5 bg-[#29293a] hover:bg-[#34344a] text-gray-300 font-semibold rounded-xl text-xs transition active:scale-95"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  setCode('');
                  setIsConfirmClearOpen(false);
                  editorRef.current?.focus();
                  showToast('Đã xóa sạch mã trong trình soạn thảo!');
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-red-900/50 active:scale-95 cursor-pointer"
              >
                Xóa sạch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[#252536] border border-amber-400/60 text-amber-200 text-xs font-medium rounded-full shadow-xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-2">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
