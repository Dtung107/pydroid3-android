import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Square,
  Sparkles,
  RotateCcw,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Play,
  Code,
  Lightbulb,
  Copy,
  Check,
  HelpCircle,
  Wand2,
} from 'lucide-react';
import { TerminalEntry, ExecutionResult, AiDebugResult, ExecutionEngine } from '../types';

interface TerminalProps {
  entries: TerminalEntry[];
  isRunning: boolean;
  onSendStdin: (data: string) => void;
  onStop: () => void;
  onClear: () => void;
  stdinPreset: string;
  setStdinPreset: (val: string) => void;
  executionResult: ExecutionResult | null;
  onTriggerAiDebug: (errorText: string) => void;
  isAiDebugging: boolean;
  aiDebugResult: AiDebugResult | null;
  onApplyCode: (code: string) => void;
  onApplyAndRun: (code: string) => void;
  onRunAgain: () => void;
  engine?: ExecutionEngine;
}

export const Terminal: React.FC<TerminalProps> = ({
  entries,
  isRunning,
  onSendStdin,
  onStop,
  onClear,
  stdinPreset,
  setStdinPreset,
  executionResult,
  onTriggerAiDebug,
  isAiDebugging,
  aiDebugResult,
  onApplyCode,
  onApplyAndRun,
  onRunAgain,
  engine = 'cpython',
}) => {
  const [currentInput, setCurrentInput] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showStdinDrawer, setShowStdinDrawer] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeAiTab, setActiveAiTab] = useState<'explain' | 'fix'>('explain');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aiSectionRef = useRef<HTMLDivElement>(null);

  // Check if the user is currently inputting data (typing or input focused)
  const isInputting = isInputFocused || Boolean(currentInput && currentInput.length > 0);

  // High-performance direct auto-scroll to latest output without animation lag
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [entries, isRunning, executionResult]);

  // Smooth scroll specifically when AI debugging report opens
  useEffect(() => {
    if (aiDebugResult || isAiDebugging) {
      aiSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiDebugResult, isAiDebugging]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentInput && !isRunning) return;

    onSendStdin(currentInput);
    setCurrentInput('');
  };

  // Filter out any startup/initialization logs from WASM, Pyodide, Python path, or CPython banners
  const visibleEntries = entries.filter((e) => {
    const text = e.text || '';
    const lower = text.toLowerCase().trim();

    // 1. Filter out Python internal path / standard library install diagnostics
    if (
      lower.startsWith('python path configuration:') ||
      lower.startsWith('pythonhome =') ||
      lower.startsWith('pythonpath =') ||
      lower.startsWith('program name =') ||
      lower.startsWith('isolated =') ||
      lower.startsWith('environment =') ||
      lower.startsWith('user site =') ||
      lower.startsWith('safe_path =') ||
      lower.startsWith('error occurred while installing the standard library') ||
      lower.includes('[pyodide] silent warmup') ||
      lower.includes('loading pyodide') ||
      lower.includes('loaded pyodide') ||
      (lower.includes('keyboardinterrupt') && (lower.includes('dừng') || lower.includes('người dùng')))
    ) {
      return false;
    }

    // 2. Filter out library detection notices and auto-forwarding messages
    if (
      lower.includes('phát hiện thư viện') ||
      lower.includes('thư viện hệ thống') ||
      lower.includes('chuyển tiếp') ||
      lower.includes('tự động chuyển')
    ) {
      return false;
    }

    // 3. Filter out system banners and startup connection text
    if (e.type === 'system') {
      if (
        lower.includes('wasm') ||
        lower.includes('webassembly') ||
        lower.includes('pyodide') ||
        lower.includes('bắt đầu thực thi') ||
        lower.includes('đã kết nối') ||
        lower.includes('khởi tạo') ||
        lower.includes('khởi chạy') ||
        lower.includes('đang nạp') ||
        lower.includes('đang kiểm tra') ||
        lower.includes('đang thực thi') ||
        lower.includes('tiến trình cpython') ||
        lower.includes('chuẩn bị môi trường') ||
        lower.includes('cpython native')
      ) {
        return false;
      }
    }
    return true;
  });

  // User interruption / stop (exit code 130 or stopped: true) is a normal user action, NOT an error
  const isStoppedByUser = Boolean(
    executionResult?.stopped ||
    executionResult?.exitCode === 130
  );

  // Detect if there's any traceback or error in entries
  const hasStderr = !isStoppedByUser && visibleEntries.some(
    (e) => e.type === 'stderr' && (e.text.includes('Error') || e.text.includes('Traceback') || e.text.includes('Exception') || e.text.includes('❌'))
  );
  const isErrorExit = executionResult !== null && executionResult.exitCode !== 0 && !isStoppedByUser;
  const hasError = !isRunning && !isStoppedByUser && (hasStderr || isErrorExit);

  const stderrText = visibleEntries
    .filter((e) => e.type === 'stderr')
    .map((e) => e.text)
    .join('\n') || (isErrorExit ? `Lỗi thực thi với mã thoát: ${executionResult?.exitCode}` : '');

  // Auto-recognize error type (e.g. SyntaxError, ZeroDivisionError, NameError...)
  const errorMatch = stderrText.match(/([A-Za-z]+Error|[A-Za-z]+Exception)/);
  const detectedErrorType = errorMatch ? errorMatch[1] : (hasError ? 'Lỗi thực thi Python' : null);

  const handleCopyCode = () => {
    if (aiDebugResult?.fixedCode) {
      navigator.clipboard.writeText(aiDebugResult.fixedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Trigger Explain Error action
  const handleExplainError = () => {
    setActiveAiTab('explain');
    if (!isAiDebugging) {
      onTriggerAiDebug(stderrText || 'Lỗi thực thi Python');
    }
    setTimeout(() => {
      aiSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  // Trigger Fix with AI action
  const handleFixWithAi = () => {
    setActiveAiTab('fix');
    if (!isAiDebugging) {
      onTriggerAiDebug(stderrText || 'Lỗi thực thi Python');
    }
    setTimeout(() => {
      aiSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-[#0b0c13] text-[#f8fafc] overflow-hidden font-mono select-text">
      {/* Terminal Slim Header: Tối ưu không gian để vùng hiển thị Terminal lớn nhất */}
      <div className="h-8 bg-[#13141f] border-b border-[#232435] px-3 flex items-center justify-between text-xs shrink-0 select-none">
        <div className="flex items-center space-x-2">
          <span className="flex items-center space-x-1.5 font-bold text-gray-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Terminal</span>
          </span>

          {isRunning ? (
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.2 rounded-full text-[10px] font-bold flex items-center space-x-1 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Đang chạy...</span>
            </span>
          ) : (
            <span className="text-[10px] text-gray-400 font-mono">
              {visibleEntries.length} dòng xuất
            </span>
          )}

          {/* Active Engine Badge */}
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border flex items-center space-x-1 ${
            engine === 'pyodide'
              ? 'bg-sky-950/70 border-sky-500/50 text-sky-300'
              : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${engine === 'pyodide' ? 'bg-sky-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span>{engine === 'pyodide' ? 'WASM' : 'CPython'}</span>
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          {/* STDIN Drawer Toggle */}
          <button
            onClick={() => setShowStdinDrawer(!showStdinDrawer)}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs transition border cursor-pointer ${
              showStdinDrawer || stdinPreset.trim()
                ? 'bg-amber-950/60 border-amber-500/60 text-amber-300 font-bold'
                : 'bg-[#1f202e] border-[#313248] text-gray-300 hover:bg-[#2b2c40]'
            }`}
            title="Ngăn nhập trước dữ liệu STDIN cho các bài toán nhiều input"
          >
            <FileText className="w-3 h-3 text-amber-400" />
            <span>STDIN</span>
            {stdinPreset.trim() && (
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
            )}
            {showStdinDrawer ? (
              <ChevronUp className="w-3 h-3 ml-0.5" />
            ) : (
              <ChevronDown className="w-3 h-3 ml-0.5" />
            )}
          </button>

          {/* Stop Button */}
          {isRunning && (
            <button
              onClick={onStop}
              className="flex items-center space-x-1 px-2 py-0.5 bg-red-600/90 hover:bg-red-700 text-white rounded font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer"
              title="Dừng tiến trình Python an toàn (🛑)"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Dừng</span>
            </button>
          )}

          {/* Clear Button */}
          <button
            onClick={onClear}
            className="p-1 bg-[#1f202e] hover:bg-[#2b2c40] text-gray-300 hover:text-white rounded border border-[#313248] transition cursor-pointer"
            title="Xóa sạch màn hình Terminal"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 🚨 THANH CÔNG CỤ PHỤ HIỂN THỊ KHI CÓ LỖI (SECONDARY ERROR TOOLBAR) */}
      {hasError && (
        <div className="bg-[#1a1122] border-b-2 border-red-500/60 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shadow-lg z-20 shrink-0 select-none animate-in fade-in">
          <div className="flex items-center space-x-2">
            <span className="p-1 bg-red-600 text-white rounded-md flex items-center justify-center animate-pulse shadow-sm">
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
            <div>
              <div className="text-xs font-bold text-red-200 flex items-center space-x-1.5">
                <span>Phát hiện lỗi:</span>
                <span className="font-mono text-amber-300 font-extrabold px-1.5 py-0.2 bg-red-950/90 rounded border border-red-500/40">
                  {detectedErrorType || 'Lỗi thực thi'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 font-sans">
            {/* Nút 1: Giải thích lỗi */}
            <button
              onClick={handleExplainError}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border font-bold text-xs transition active:scale-95 shadow-sm cursor-pointer ${
                activeAiTab === 'explain' && (aiDebugResult || isAiDebugging)
                  ? 'bg-purple-600 text-white border-purple-400 shadow-purple-900/50'
                  : 'bg-[#271f37] hover:bg-[#362b4c] text-purple-200 hover:text-white border-purple-400/50'
              }`}
              title="Gemini AI giải thích chi tiết nguyên nhân lỗi bằng tiếng Việt"
            >
              <HelpCircle className="w-3.5 h-3.5 text-yellow-400" />
              <span>Giải thích lỗi</span>
            </button>

            {/* Nút 2: Sửa bằng AI */}
            <button
              onClick={handleFixWithAi}
              className="flex items-center space-x-1 px-3 py-1 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-black font-extrabold text-xs rounded-lg transition active:scale-95 shadow-md shadow-amber-500/30 cursor-pointer"
              title="Kích hoạt Trình gỡ lỗi Gemini và tạo mã sửa chuẩn PEP 8"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>Sửa bằng AI</span>
            </button>
          </div>
        </div>
      )}

      {/* STDIN Drawer: Pre-configured multi-line input */}
      {showStdinDrawer && (
        <div className="bg-[#181926] border-b border-[#2b2c3d] p-2.5 shrink-0 transition-all select-none">
          <div className="flex items-center justify-between mb-1.5 text-xs text-gray-200">
            <span className="font-semibold text-amber-300 flex items-center space-x-1">
              <span>📥 Ngăn dữ liệu STDIN nạp sẵn (Mỗi dòng một giá trị):</span>
            </span>
            <button
              onClick={() => setStdinPreset('')}
              className="text-[11px] text-gray-400 hover:text-red-400 underline cursor-pointer"
            >
              Xóa trắng STDIN
            </button>
          </div>
          <textarea
            value={stdinPreset}
            onChange={(e) => setStdinPreset(e.target.value)}
            placeholder="Ví dụ:&#10;Nguyễn Văn An&#10;25&#10;1.75"
            rows={3}
            className="w-full bg-[#0f1018] border border-[#33344a] rounded p-2 text-xs font-mono text-[#f8fafc] focus:outline-none focus:border-amber-400 transition"
          />
        </div>
      )}

      {/* 🚀 Output Stream Canvas: Bắt đầu ngay dòng trên cùng, chữ sáng rõ nét */}
      <div
        ref={scrollContainerRef}
        className="flex-1 px-3 pt-1 pb-3 sm:px-4 sm:pt-1 sm:pb-4 overflow-y-auto overflow-x-auto text-sm leading-relaxed space-y-1 font-mono selection:bg-amber-400 selection:text-black"
      >
        {visibleEntries.length === 0 && !executionResult ? (
          <div className="text-gray-400 italic pt-1 select-none font-sans text-xs">
            Nhấn nút <span className="text-amber-400 font-extrabold">RUN</span> để bắt đầu thực thi mã Python...
          </div>
        ) : (
          visibleEntries.map((entry, idx) => {
            if (entry.type === 'stdout') {
              return (
                <div
                  key={idx}
                  className="text-slate-100 font-mono text-[13.5px] sm:text-sm font-normal leading-relaxed whitespace-pre-wrap break-words tracking-wide selection:bg-amber-400 selection:text-black"
                >
                  {entry.text}
                </div>
              );
            }
            if (entry.type === 'stderr') {
              return (
                <div
                  key={idx}
                  className="text-[#ff6b81] font-mono text-[13.5px] sm:text-sm font-semibold leading-relaxed whitespace-pre-wrap break-words bg-red-950/25 border-l-2 border-red-500/80 pl-2.5 py-1 rounded-r my-0.5 tracking-wide selection:bg-red-500 selection:text-white"
                >
                  {entry.text}
                </div>
              );
            }
            if (entry.type === 'stdin') {
              return (
                <div
                  key={idx}
                  className="text-amber-300 font-mono text-[13.5px] sm:text-sm font-bold leading-relaxed whitespace-pre-wrap break-words py-0.5 selection:bg-amber-300 selection:text-black"
                >
                  <span className="text-amber-400 font-extrabold select-none mr-1.5">&gt;&gt;&gt;</span>
                  {entry.text}
                </div>
              );
            }
            if (entry.type === 'system') {
              return (
                <div
                  key={idx}
                  className="text-sky-300 font-sans font-medium text-xs leading-normal whitespace-pre-wrap bg-sky-950/30 border border-sky-800/40 px-2.5 py-1 rounded-lg my-1"
                >
                  {entry.text}
                </div>
              );
            }
          })
        )}

        {/* ✨ TRÌNH GỠ LỖI THÔNG MINH GOOGLE GEMINI AI TRONG TERMINAL (NGAY TẠI CHỖ) */}
        {hasError && (
          <div
            ref={aiSectionRef}
            className="mt-4 p-4 bg-[#151221] border-2 border-purple-500/50 rounded-2xl space-y-3.5 shadow-2xl animate-in fade-in"
          >
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-purple-500/25">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-gradient-to-tr from-amber-400 to-yellow-500 text-black rounded-xl shadow-md">
                  <Sparkles className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-amber-300 flex items-center space-x-2">
                    <span>Trình gỡ lỗi Gemini AI (Ngay tại chỗ)</span>
                    {detectedErrorType && (
                      <span className="px-2 py-0.5 bg-red-600 text-white font-mono text-[11px] rounded-md font-bold shadow-sm">
                        {detectedErrorType}
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-gray-300 font-sans">
                    Phân tích nguyên nhân lỗi tiếng Việt & Đề xuất mã sửa chữa PEP 8
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1 bg-[#221c33] p-1 rounded-lg border border-[#3b3254] font-sans">
                <button
                  onClick={handleExplainError}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer flex items-center space-x-1 ${
                    activeAiTab === 'explain'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Lightbulb className="w-3 h-3 text-yellow-400" />
                  <span>Giải thích lỗi</span>
                </button>
                <button
                  onClick={handleFixWithAi}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer flex items-center space-x-1 ${
                    activeAiTab === 'fix'
                      ? 'bg-amber-400 text-black shadow-sm'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Wand2 className="w-3 h-3" />
                  <span>Sửa bằng AI</span>
                </button>
              </div>
            </div>

            {isAiDebugging ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-3 font-sans">
                <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-amber-300 text-xs font-bold animate-pulse">
                  Gemini AI đang phân tích Traceback và tạo mã sửa chữa chuẩn PEP 8...
                </span>
              </div>
            ) : aiDebugResult ? (
              <div className="space-y-3.5 text-xs font-sans">
                <div
                  className={`p-3 rounded-xl space-y-1.5 transition border ${
                    activeAiTab === 'explain'
                      ? 'bg-purple-950/40 border-purple-500/50 shadow-md ring-1 ring-purple-400/30'
                      : 'bg-[#1b172a] border-[#312a4a]'
                  }`}
                >
                  <div className="font-bold text-red-300 text-sm flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>Giải thích nguyên nhân lỗi (Tiếng Việt):</span>
                  </div>
                  <p className="text-gray-100 text-xs font-semibold leading-relaxed">
                    {aiDebugResult.vietnameseSummary}
                  </p>
                  <p className="text-gray-300 text-[12px] leading-relaxed">
                    {aiDebugResult.rootCause}
                  </p>
                </div>

                {aiDebugResult.tips && aiDebugResult.tips.length > 0 && (
                  <div className="p-3 bg-[#1c182c] border border-[#352f50] rounded-xl space-y-1.5">
                    <div className="font-bold text-amber-300 flex items-center space-x-1.5">
                      <Lightbulb className="w-4 h-4 text-yellow-400 shrink-0" />
                      <span>Mẹo sửa lỗi & quy tắc PEP 8:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-gray-200 text-xs pl-1">
                      {aiDebugResult.tips.map((tip, idx) => (
                        <li key={idx} className="leading-snug">{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div
                  className={`p-3 rounded-xl space-y-2 font-mono transition border ${
                    activeAiTab === 'fix'
                      ? 'bg-[#13111f] border-amber-400/60 shadow-lg ring-1 ring-amber-400/40'
                      : 'bg-[#151221] border-[#312a4a]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-gray-200 font-sans">
                    <span className="font-bold text-emerald-400 flex items-center space-x-1.5 text-sm">
                      <Code className="w-4 h-4" />
                      <span>Mã Python đã sửa chữa hoàn chỉnh:</span>
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="px-2.5 py-1 bg-[#252038] hover:bg-[#342e4d] text-gray-200 rounded-lg text-xs flex items-center space-x-1 transition cursor-pointer border border-[#3d3658]"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Đã sao chép' : 'Sao chép mã'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-[#0a0a10] border border-[#2b2742] rounded-xl text-emerald-300 font-mono text-xs sm:text-sm overflow-x-auto whitespace-pre leading-relaxed select-text max-h-48">
                    {aiDebugResult.fixedCode}
                  </pre>

                  <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5 font-sans">
                    <button
                      onClick={() => onApplyCode(aiDebugResult.fixedCode)}
                      className="px-3.5 py-2 bg-[#2d2545] hover:bg-[#3c325c] text-gray-100 font-bold rounded-xl text-xs transition border border-[#4d4170] active:scale-95 cursor-pointer shadow-sm"
                    >
                      📝 Áp dụng vào Trình soạn thảo
                    </button>
                    <button
                      onClick={() => onApplyAndRun(aiDebugResult.fixedCode)}
                      className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 active:bg-amber-500 text-black font-extrabold rounded-xl text-xs transition shadow-md shadow-amber-500/30 active:scale-95 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>⚡ Áp dụng & Chạy lại ngay</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 font-sans">
                <p className="text-xs text-gray-200 leading-relaxed">
                  Phát hiện lỗi <span className="text-red-400 font-bold">{detectedErrorType}</span>. Bấm nút dưới đây để Gemini AI phân tích nguyên nhân và tự động sửa mã ngay tại chỗ:
                </p>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={handleExplainError}
                    className="flex items-center space-x-1.5 px-3 py-2 bg-[#2c233e] hover:bg-[#3b2f54] text-purple-200 rounded-xl border border-purple-400/50 font-bold text-xs transition active:scale-95 cursor-pointer"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
                    <span>Giải thích lỗi</span>
                  </button>
                  <button
                    onClick={handleFixWithAi}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-black font-extrabold text-xs rounded-xl transition active:scale-95 shadow-md shadow-amber-500/20 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 fill-current" />
                    <span>Sửa bằng AI</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 📊 KHỐI TỔNG KẾT THỰC THI (ĐỒNG BỘ CÁC DÒNG TRẠNG THÁI Ở ĐÁY VÙNG HIỂN THỊ) */}
        {executionResult && !isRunning && (
          <div className="mt-3 pt-2.5 pb-1 border-t border-[#232438] text-xs font-mono select-none space-y-1.5 animate-in fade-in">
            {/* Dòng 1: Kết quả hoàn tất / mã lỗi */}
            <div className="flex items-center space-x-1.5 leading-normal">
              {executionResult.stopped || executionResult.exitCode === 130 ? (
                <span className="flex items-center space-x-1.5 text-amber-400 font-bold">
                  <Square className="w-3.5 h-3.5 shrink-0 fill-current" />
                  <span>Đã dừng theo yêu cầu (🛑 Dừng)</span>
                </span>
              ) : executionResult.exitCode === 0 ? (
                <span className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Hoàn tất thành công (Exit Code 0)</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1.5 text-red-400 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Kết thúc với mã lỗi: {executionResult.exitCode}</span>
                </span>
              )}
            </div>

            {/* Dòng 2 & 3: Đồng bộ Thời gian thực thi (Execution Time) & Nút Chạy lại (Restart) */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-[#1e2030]/60">
              <div className="flex items-center space-x-1.5 text-gray-300 leading-normal">
                <Clock className="w-3.5 h-3.5 text-amber-400/90 shrink-0" />
                <span>Thời gian:</span>
                <strong className="text-amber-300 font-bold font-mono">{executionResult.executionTimeMs} ms</strong>
              </div>

              <button
                onClick={onRunAgain}
                className="inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-400/15 hover:bg-amber-400/25 active:bg-amber-400/35 text-amber-300 hover:text-amber-200 border border-amber-400/40 hover:border-amber-400/70 rounded-md font-bold text-xs transition active:scale-95 cursor-pointer shadow-sm group"
                title="Nhấn để chạy lại mã nguồn Python (Restart)"
              >
                <Play className="w-3 h-3 fill-current text-amber-400 group-hover:scale-110 transition-transform" />
                <span>Chạy lại</span>
                <RotateCcw className="w-3 h-3 text-amber-400/80 group-hover:rotate-180 transition-transform duration-300" />
              </button>
            </div>
          </div>
        )}

        {/* Live execution indicator - Ẩn khi người dùng đang nhập liệu */}
        {isRunning && !isInputting && (
          <div className="mt-2 py-1 px-2.5 text-xs font-mono text-amber-300 flex items-center space-x-2 animate-pulse bg-amber-950/20 border border-amber-500/20 rounded-md">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>⚡ Đang thực thi mã Python...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Interactive Bottom Input Bar (Glowing Amber when awaiting input) */}
      <div
        className={`p-2 bg-[#12131d] border-t transition-all ${
          isRunning
            ? 'border-amber-400/90 shadow-[0_-3px_15px_rgba(251,191,36,0.2)] ring-1 ring-amber-400/50'
            : 'border-[#262738]'
        }`}
      >
        <form onSubmit={handleSend} className="flex items-center space-x-2">
          <div className="text-amber-400 font-bold text-xs select-none pl-1">
            &gt;&gt;&gt;
          </div>
          <input
            ref={inputRef}
            type="text"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            placeholder={
              isRunning
                ? 'Nhập dữ liệu cho input() rồi bấm Gửi (hoặc Enter)...'
                : 'Nhập lệnh hoặc tham số vào đây...'
            }
            className="flex-1 bg-[#181926] text-[#fef08a] text-sm px-3.5 py-2 rounded-lg border border-[#34354c] focus:outline-none focus:border-amber-400 font-mono transition"
          />
          <button
            type="submit"
            disabled={!isRunning && !currentInput}
            className={`flex items-center space-x-1 px-3.5 py-2 rounded-lg text-xs font-bold transition active:scale-95 ${
              isRunning || currentInput
                ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-md cursor-pointer'
                : 'bg-[#222332] text-gray-500 cursor-not-allowed'
            }`}
          >
            <span>Gửi</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
