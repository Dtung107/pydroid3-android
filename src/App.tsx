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
import { DEFAULT_LESSONS } from './constants/defaultLessons';
import { DEFAULT_MOBILE_KEYS } from './constants/defaultKeys';
import { THEME_PALETTES, DEFAULT_CUSTOM_COLORS } from './constants/themes';
import { PythonWebSocketRunner, PyodideRunner, RunCallbacks } from './utils/pythonRunner';
import { getStoredApiKey, sendGeminiDebug } from './utils/geminiClient';
import {
  SyntaxColors,
  KeyItem,
  KeySize,
  LessonItem,
  TerminalEntry,
  ExecutionResult,
  AiDebugResult,
  SavedFile,
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
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  // 1. Tự động chuyển toàn màn hình khi người dùng chạm màn hình lần đầu
  useEffect(() => {
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

    return () => {
      window.removeEventListener('pydroid:packages-updated', handlePackagesUpdated);
      window.removeEventListener('storage', handleStorageChange);
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
    showToast(`Đã lưu "${fileName}" vào bộ nhớ thiết bị!`);
  };

  const handleNewFile = () => {
    setCode('# File Python mới\n\n');
    setFileName('untitled.py');
    setActiveTab('editor');
  };

  const handleLoadFile = (file: SavedFile) => {
    setCode(file.code);
    setFileName(file.name);
    setActiveTab('editor');
  };

  const handleDeleteFile = (id: string) => {
    setSavedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUploadFile = (name: string, content: string) => {
    setCode(content);
    setFileName(name);
    setActiveTab('editor');
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

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#181822] text-gray-100 font-sans select-none"
      style={{
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
        completedLessonsCount={lessons.filter((l) => l.completed).length}
        totalLessonsCount={lessons.length}
        onOpenFileManager={() => setIsFileManagerOpen(true)}
        onOpenStudy={() => setIsStudyOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onClearCode={handleClearCode}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        onOpenAutoFix={handleOpenAutoFix}
        engine={engine}
        onToggleEngine={handleToggleEngine}
      />

      {/* Main Workspace (Editor or Terminal) */}
      <main className="flex-1 relative w-full overflow-hidden flex flex-col">
        {/* Editor Screen */}
        <div
          className={`flex-1 w-full h-full flex flex-col overflow-hidden ${
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
          className={`flex-1 w-full h-full flex flex-col overflow-hidden ${
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
