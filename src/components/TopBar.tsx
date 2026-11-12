import React, { useRef } from 'react';
import {
  Play,
  Square,
  Terminal,
  Code2,
  FolderOpen,
  Trash2,
  GraduationCap,
  Settings,
  Sparkles,
  Cpu,
  Bug,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { ExecutionEngine } from '../types';

interface TopBarProps {
  activeTab: 'editor' | 'terminal';
  setActiveTab: (tab: 'editor' | 'terminal') => void;
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
  completedLessonsCount: number;
  totalLessonsCount: number;
  onOpenFileManager: () => void;
  onOpenStudy: () => void;
  onOpenSettings: () => void;
  onClearCode: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenAiAssistant: () => void;
  onOpenAutoFix?: () => void;
  engine?: ExecutionEngine;
  onToggleEngine?: () => void;
  isTopBarCollapsed?: boolean;
  onToggleCollapseTopBar?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  isRunning,
  onRun,
  onStop,
  completedLessonsCount,
  totalLessonsCount,
  onOpenFileManager,
  onOpenStudy,
  onOpenSettings,
  onClearCode,
  isFullscreen,
  onToggleFullscreen,
  onOpenAiAssistant,
  onOpenAutoFix,
  engine,
  onToggleEngine,
  isTopBarCollapsed,
  onToggleCollapseTopBar,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (isTopBarCollapsed) {
    return (
      <header className="h-7 bg-[#13131c]/95 backdrop-blur border-b border-[#262536] flex items-center justify-between px-2 text-xs text-gray-300 select-none z-30 shrink-0 shadow-sm">
        <div className="flex items-center space-x-1.5">
          {isRunning ? (
            <button
              onClick={onStop}
              className="h-5 px-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold text-[10px] flex items-center space-x-1 animate-pulse cursor-pointer shadow-sm"
              title="Dừng tiến trình Python (🛑)"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              <span>DỪNG</span>
            </button>
          ) : (
            <button
              onClick={onRun}
              className="h-5 px-2 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-black rounded font-black text-[10px] flex items-center space-x-1 cursor-pointer shadow-sm"
              title="Thực thi Python (⚡ RUN)"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>RUN</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab(activeTab === 'editor' ? 'terminal' : 'editor')}
            className={`h-5 px-2 rounded text-[10px] font-mono font-bold transition flex items-center space-x-1 cursor-pointer ${
              activeTab === 'editor'
                ? 'bg-blue-600/80 text-white'
                : 'bg-emerald-600/80 text-white'
            }`}
          >
            <span>{activeTab === 'editor' ? 'Editor' : 'Terminal'}</span>
            <span className="text-[9px] opacity-75">➔</span>
          </button>
        </div>

        {onToggleCollapseTopBar && (
          <button
            onClick={onToggleCollapseTopBar}
            className="flex items-center space-x-1 px-2 py-0.5 bg-[#20202e] hover:bg-[#2c2c40] text-amber-300 rounded text-[10px] font-bold border border-[#36354a] transition cursor-pointer"
            title="Mở rộng lại thanh công cụ đầy đủ"
          >
            <span>Hiện thanh công cụ</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        )}
      </header>
    );
  }

  return (
    <header className="h-11 bg-[#13131c] border-b-2 border-[#262536] flex items-center text-white select-none z-30 shrink-0 shadow-md overflow-hidden relative">
      {/* 📌 CỤM CỐ ĐỊNH BÊN TRÁI: Nút RUN/DỪNG + Cặp nút [Soạn thảo + Terminal] */}
      <div className="shrink-0 z-20 flex items-center space-x-1.5 pl-2 pr-2 h-full bg-[#13131c] border-r-2 border-[#262536] shadow-[4px_0_12px_rgba(0,0,0,0.5)]">
        {/* 1. Nút RUN / DỪNG (Kích thước h-8 có đường viền 2px bao quanh) */}
        {isRunning ? (
          <button
            onClick={onStop}
            className="w-[74px] h-8 flex items-center justify-center space-x-1 bg-gradient-to-b from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:bg-red-800 text-white rounded-lg font-black text-xs shadow-[0_2px_0_0_#450a0a] border-2 border-red-400 animate-pulse transition active:translate-y-0.5 active:shadow-none cursor-pointer shrink-0"
            title="Dừng tiến trình Python (🛑)"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>DỪNG</span>
          </button>
        ) : (
          <button
            onClick={onRun}
            className="w-[74px] h-8 flex items-center justify-center space-x-1 bg-gradient-to-b from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 active:bg-amber-500 text-black rounded-lg font-black text-xs shadow-[0_2px_0_0_#78350f] border-2 border-amber-300 transition active:translate-y-0.5 active:shadow-none cursor-pointer shrink-0"
            title="Thực thi Python (⚡ RUN)"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>RUN</span>
          </button>
        )}

        {/* 2. Cặp nút [Soạn thảo (36px) + Terminal (36px)] cao h-8 có đường viền 2px */}
        <div className="h-8 flex items-center bg-[#0c0c14] p-0.5 rounded-lg border-2 border-[#2e2d42] shrink-0 space-x-0.5 shadow-[0_2px_0_0_#08080d]">
          {/* Nút Soạn thảo */}
          <button
            onClick={() => setActiveTab('editor')}
            className={`w-[36px] h-full flex items-center justify-center rounded-md transition-all cursor-pointer ${
              activeTab === 'editor'
                ? 'bg-blue-600 text-white shadow-sm border border-blue-400 font-bold'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Trình soạn thảo mã (Soạn thảo)"
          >
            <Code2 className="w-4 h-4" />
          </button>

          {/* Nút Terminal */}
          <button
            onClick={() => setActiveTab('terminal')}
            className={`w-[36px] h-full flex items-center justify-center rounded-md transition-all relative cursor-pointer ${
              activeTab === 'terminal'
                ? 'bg-emerald-600 text-white shadow-sm border border-emerald-400 font-bold'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Màn hình kết quả (Terminal)"
          >
            <Terminal className="w-4 h-4" />
            {isRunning && (
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
            )}
          </button>
        </div>
      </div>

      {/* 🌊 CÁC NÚT THANH CÔNG CỤ TRÊN: Cuộn ngang mượt mà */}
      <div
        ref={scrollContainerRef}
        className="flex-1 h-full flex items-center px-2 space-x-2 overflow-x-auto overflow-y-hidden touch-pan-x scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex-nowrap"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* 1. ✨ Nút Trợ lý AI */}
        <button
          onClick={onOpenAiAssistant}
          className="h-8 min-w-[38px] px-2.5 flex items-center justify-center bg-gradient-to-b from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 active:bg-amber-500 text-black rounded-lg border-2 border-amber-300 shadow-[0_2px_0_0_#92400e] hover:border-amber-200 transition-all duration-100 active:translate-y-0.5 active:shadow-none shrink-0 cursor-pointer relative group"
          title="Trợ lý AI Lập trình Python (Gemini ✨)"
        >
          <Sparkles className="w-4 h-4 fill-current text-black group-hover:scale-110 transition-transform drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-950 rounded-full border border-amber-400 animate-pulse" />
        </button>

        {/* 🛠️ Nút Bộ sửa lỗi tự động AI */}
        {onOpenAutoFix && (
          <button
            onClick={onOpenAutoFix}
            className="h-8 min-w-[38px] px-2.5 flex items-center justify-center bg-gradient-to-b from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 active:bg-red-800 text-white rounded-lg border-2 border-red-400 shadow-[0_2px_0_0_#500717] hover:border-red-300 transition-all duration-100 active:translate-y-0.5 active:shadow-none shrink-0 cursor-pointer relative group"
            title="Bộ sửa lỗi tự động AI (Chỉ rõ dòng lỗi & tạo mã sửa PEP 8 hoàn chỉnh)"
          >
            <Bug className="w-4 h-4 text-yellow-300 group-hover:scale-110 transition-transform drop-shadow-[0_0_6px_rgba(253,224,71,0.8)]" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full border border-black animate-pulse" />
          </button>
        )}

        {/* 2. 🟢 Nút Kho bài tập & Kết quả học tập */}
        <button
          onClick={onOpenStudy}
          className="h-8 min-w-[38px] px-2.5 flex items-center justify-center bg-gradient-to-b from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 active:bg-emerald-700 text-white rounded-lg border-2 border-emerald-400 shadow-[0_2px_0_0_#064e3b] hover:border-emerald-300 transition-all duration-100 active:translate-y-0.5 active:shadow-none shrink-0 cursor-pointer relative group"
          title={`Kho bài tập & Kết quả học tập (${completedLessonsCount}/${totalLessonsCount} bài đã xong)`}
        >
          <GraduationCap className="w-4 h-4 text-white fill-current/20 group-hover:scale-110 transition-transform drop-shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          {completedLessonsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full border border-black shadow" />
          )}
        </button>

        {/* 3. 📁 Nút Quản lý tập tin .py */}
        <button
          onClick={onOpenFileManager}
          className="h-8 min-w-[38px] px-2.5 flex items-center justify-center bg-gradient-to-b from-[#113a60] to-[#0c2944] hover:from-[#174e82] hover:to-[#0f3659] text-sky-300 hover:text-white rounded-lg border-2 border-sky-400 shadow-[0_2px_0_0_#071b2d] hover:border-sky-300 transition-all duration-100 active:translate-y-0.5 active:shadow-none shrink-0 cursor-pointer group"
          title="Quản lý tập tin .py (Mở, Lưu, Tải lên, Tải xuống)"
        >
          <FolderOpen className="w-4 h-4 text-sky-400 group-hover:text-sky-200 group-hover:scale-110 transition-all drop-shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
        </button>

        {/* 4. 🚮 Nút Thùng rác xóa nhanh mã nguồn */}
        <button
          onClick={onClearCode}
          className="h-8 min-w-[38px] px-2.5 flex items-center justify-center bg-gradient-to-b from-[#4d1620] to-[#360e16] hover:from-[#661d2b] hover:to-[#47121c] text-rose-300 hover:text-white rounded-lg border-2 border-rose-500 shadow-[0_2px_0_0_#22060c] hover:border-rose-400 transition-all duration-100 active:translate-y-0.5 active:shadow-none shrink-0 cursor-pointer group"
          title="Xóa nhanh mã nguồn trong trình soạn thảo"
        >
          <Trash2 className="w-4 h-4 text-rose-400 group-hover:text-rose-200 group-hover:scale-110 transition-all drop-shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
        </button>

        {/* 6. ⚙️ Nút Bánh răng Cài đặt */}
        <button
          onClick={onOpenSettings}
          className="h-8 min-w-[38px] px-2.5 flex items-center justify-center bg-gradient-to-b from-[#482b13] to-[#331e0c] hover:from-[#613a1a] hover:to-[#452810] text-amber-300 hover:text-white rounded-lg border-2 border-amber-500 shadow-[0_2px_0_0_#211206] hover:border-amber-400 transition-all duration-100 active:translate-y-0.5 active:shadow-none shrink-0 cursor-pointer group"
          title="Cài đặt IDE & Giao diện màu sắc"
        >
          <Settings className="w-4 h-4 text-amber-400 group-hover:text-amber-200 group-hover:rotate-45 transition-all drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
        </button>

        {/* 7. ▴ Nút Thu gọn thanh công cụ (Nằm trong thanh trược) */}
        {onToggleCollapseTopBar && (
          <button
            onClick={onToggleCollapseTopBar}
            className="h-8 min-w-[38px] px-2 flex items-center justify-center rounded-lg border-2 border-[#36354a] bg-[#1a1928] hover:bg-[#252438] text-gray-300 hover:text-white hover:border-gray-400 transition-all duration-100 active:translate-y-0.5 active:shadow-none cursor-pointer shrink-0 shadow-[0_2px_0_0_#0f0f18]"
            title="Thu gọn thanh công cụ để có thêm không gian cho màn hình"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
