import React, { useState, useEffect } from 'react';
import { FileCode2, Search, X, Check } from 'lucide-react';
import {
  PYTHON_BOILERPLATE_SNIPPETS,
  BoilerplateSnippet,
} from '../constants/defaultKeys';

interface BoilerplatePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertSnippet: (snippet: BoilerplateSnippet) => void;
  onPinSnippet: (snippet: BoilerplateSnippet) => { added: boolean; message: string };
}

export const BoilerplatePopover: React.FC<BoilerplatePopoverProps> = ({
  isOpen,
  onClose,
  onInsertSnippet,
  onPinSnippet,
}) => {
  const [category, setCategory] = useState<'all' | 'control' | 'structure' | 'loop_io'>('all');
  const [search, setSearch] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  if (!isOpen) return null;

  const filteredBoilerplates = PYTHON_BOILERPLATE_SNIPPETS.filter((item) => {
    if (category !== 'all' && item.category !== category) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px]"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label="Chèn nhanh đoạn mã Python mẫu"
        className="fixed top-12 left-2 right-2 sm:left-40 sm:right-auto sm:w-[440px] rounded-xl shadow-2xl z-40 overflow-hidden font-sans flex flex-col max-h-[72vh] animate-in fade-in slide-in-from-top-2"
        style={{
          backgroundColor: 'var(--ui-surface)',
          border: '1px solid var(--ui-border-strong)',
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.85), var(--ui-glow)',
          color: 'var(--ui-text)',
        }}
      >
        {/* Header & Search */}
        <div
          className="p-3 space-y-2.5 shrink-0"
          style={{
            backgroundColor: 'var(--ui-bar)',
            borderBottom: '1px solid var(--ui-border)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div
                className="p-1 rounded-md"
                style={{
                  backgroundColor: 'var(--ui-accent-2-soft)',
                  color: 'var(--ui-accent-2)',
                  border: '1px solid var(--ui-border)',
                }}
              >
                <FileCode2 className="w-4 h-4 shrink-0" />
              </div>
              <h4 className="text-xs font-bold tracking-wide" style={{ color: 'var(--ui-text)' }}>
                Chèn nhanh đoạn mã Python
              </h4>
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onClose}
              className="p-1 rounded-md hover:bg-white/10 transition cursor-pointer"
              style={{ color: 'var(--ui-text-muted)' }}
              aria-label="Đóng bảng mẫu mã"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 absolute left-2.5 top-2"
              style={{ color: 'var(--ui-text-muted)' }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm nhanh: try, __main__, def, class, with..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs focus:outline-none transition"
              style={{
                backgroundColor: 'var(--ui-inset)',
                border: '1px solid var(--ui-border)',
                color: 'var(--ui-text)',
              }}
            />
          </div>

          {/* Category filter tabs */}
          <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'control', label: 'Lỗi & Điều kiện' },
              { id: 'structure', label: 'Hàm & Lớp' },
              { id: 'loop_io', label: 'Vòng lặp & Tệp' },
            ].map((tab) => {
              const active = category === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setCategory(tab.id as any)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition shrink-0 cursor-pointer"
                  style={
                    active
                      ? {
                          backgroundColor: 'var(--ui-accent-2)',
                          color: '#07090e',
                          boxShadow: 'var(--ui-glow)',
                        }
                      : {
                          backgroundColor: 'var(--ui-surface-2)',
                          color: 'var(--ui-text-muted)',
                          border: '1px solid var(--ui-border-subtle)',
                        }
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {statusMessage && (
          <div className="px-3 py-1.5 bg-emerald-950/80 border-b border-emerald-500/30 text-[11px] text-emerald-300 flex items-center justify-between shrink-0">
            <span className="flex items-center gap-1.5 font-semibold truncate">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{statusMessage}</span>
            </span>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setStatusMessage(null)}
              className="text-emerald-300/70 hover:text-emerald-100 ml-2 shrink-0 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Snippet Items */}
        <div className="p-2.5 overflow-y-auto space-y-2 custom-scrollbar">
          {filteredBoilerplates.length === 0 ? (
            <div className="py-6 text-center text-xs" style={{ color: 'var(--ui-text-muted)' }}>
              Không tìm thấy đoạn mã phù hợp.
            </div>
          ) : (
            filteredBoilerplates.map((snippet) => (
              <div
                key={snippet.id}
                className="rounded-lg transition overflow-hidden"
                style={{
                  backgroundColor: 'var(--ui-surface-2)',
                  border: '1px solid var(--ui-border)',
                }}
              >
                <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1.5">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onInsertSnippet(snippet);
                      onClose();
                    }}
                    className="flex-1 text-left min-w-0 cursor-pointer group"
                  >
                    <div
                      className="text-xs font-bold font-mono truncate group-hover:underline"
                      style={{ color: 'var(--ui-accent-2)' }}
                    >
                      {snippet.title}
                    </div>
                    <div
                      className="text-[11px] truncate mt-0.5"
                      style={{ color: 'var(--ui-text-muted)' }}
                    >
                      {snippet.description}
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const res = onPinSnippet(snippet);
                        setStatusMessage(res.message);
                      }}
                      className="px-2 py-1 text-[10px] font-semibold rounded-md transition cursor-pointer hover:brightness-125"
                      style={{
                        backgroundColor: 'var(--ui-surface-3)',
                        color: 'var(--ui-accent)',
                        border: '1px solid var(--ui-border)',
                      }}
                      title="Ghim mẫu này thành phím bấm trực tiếp trên thanh phím tắt"
                    >
                      + Ghim
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onInsertSnippet(snippet);
                        onClose();
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer hover:brightness-110"
                      style={{
                        backgroundColor: 'var(--ui-accent)',
                        color: 'var(--ui-accent-contrast)',
                        boxShadow: 'var(--ui-accent-glow)',
                      }}
                    >
                      Chèn
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onInsertSnippet(snippet);
                    onClose();
                  }}
                  className="w-full text-left px-3 pb-2.5 cursor-pointer"
                >
                  <pre
                    className="p-2 rounded-md text-[11px] leading-snug font-mono overflow-x-auto whitespace-pre"
                    style={{
                      backgroundColor: 'var(--ui-inset)',
                      border: '1px solid var(--ui-border-subtle)',
                      color: 'var(--ui-text)',
                    }}
                  >
                    {snippet.code.trimEnd()}
                  </pre>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
