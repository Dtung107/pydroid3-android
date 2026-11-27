import React, { useRef, useState, useImperativeHandle, forwardRef, useEffect, useMemo } from 'react';
import { ArrowUpToLine } from 'lucide-react';
import { SyntaxColors } from '../types';
import { highlightPythonCode } from '../utils/highlighter';

/**
 * Measure character width for monospace font precisely using canvas
 */
const getCharWidth = (fontSize: number, fontFamily: string): number => {
  if (typeof document === 'undefined') return fontSize * 0.6;
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = `${fontSize}px ${fontFamily}`;
      const width = ctx.measureText('M').width;
      if (width > 0) return width;
    }
  } catch (e) {
    // fallback
  }
  return fontSize * 0.6;
};

export interface EditorRef {
  insertTextAtCursor: (text: string) => void;
  focus: () => void;
  getValue: () => string;
  setValue: (val: string) => void;
  getSelection: () => { start: number; end: number };
}

interface EditorProps {
  code: string;
  onChange: (newCode: string) => void;
  colors: SyntaxColors;
  fontSize: number;
  fontFamily: string;
  indentSpaces: number;
  isLinterEnabled?: boolean;
  onTriggerAiDebug?: (errorText: string, openModal?: boolean) => void;
}

export const Editor = forwardRef<EditorRef, EditorProps>(({
  code,
  onChange,
  colors,
  fontSize,
  fontFamily,
  indentSpaces,
  isLinterEnabled = false,
  onTriggerAiDebug,
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const verticalScrollRef = useRef<HTMLDivElement>(null);
  const horizontalScrollRef = useRef<HTMLDivElement>(null);

  // Line height constant to ensure pixel-perfect synchronization across gutter, backdrop, and textarea
  const lineHeightPx = Math.round(fontSize * 1.55);

  const [activeLine, setActiveLine] = useState<number>(1);
  const [isScrolledFar, setIsScrolledFar] = useState<boolean>(false);

  // Auto-scroll tracking references
  const isEnterKeyRef = useRef<boolean>(false);
  const prevCodeRef = useRef<string>(code);
  const lastSelectionStartRef = useRef<number>(0);
  const isUserDraggingTouchRef = useRef<boolean>(false);
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const focusTimersRef = useRef<number[]>([]);

  const clearPendingFocusTimers = () => {
    focusTimersRef.current.forEach((id) => window.clearTimeout(id));
    focusTimersRef.current = [];
  };

  /**
   * 📐 Thuật toán tự động cuộn ngang thông minh theo 3 quy tắc:
   * 1-- Nhận diện isEnter: Chỉ cuộn về mép trái (scrollLeft = 0) khi vừa gõ phím Enter (\n)
   * 2-- Khóa cứng vị trí trong vùng nhìn: Con trỏ trong tầm nhìn thì giữ nguyên 100% vị trí cuộn ngang
   * 3-- Tự động cuộn sang phải theo từng ký tự gõ: Giữ khoảng đệm ~2.5 ký tự
   */
  const applyAutoScroll = (forcedIsEnter?: boolean) => {
    const textarea = textareaRef.current;
    const hScroll = horizontalScrollRef.current;
    if (!textarea || !hScroll) return;

    const pos = textarea.selectionStart;
    const val = textarea.value;

    const isEnter = forcedIsEnter ?? (
      isEnterKeyRef.current || (
        pos > 0 &&
        val[pos - 1] === '\n' &&
        val.length > prevCodeRef.current.length &&
        val.slice(0, pos - 1) === prevCodeRef.current.slice(0, pos - 1)
      )
    );

    isEnterKeyRef.current = false;
    prevCodeRef.current = val;

    if (isEnter) {
      hScroll.scrollLeft = 0;
      return;
    }

    const textBefore = val.slice(0, pos);
    const lastLineBreak = textBefore.lastIndexOf('\n');
    const lineTextBefore = lastLineBreak === -1 ? textBefore : textBefore.slice(lastLineBreak + 1);
    const col = lineTextBefore.length;

    const charWidth = getCharWidth(fontSize, fontFamily);
    const paddingLeft = 12; // pl-3
    const paddingRight = 32; // pr-8
    const cursorPixelX = paddingLeft + col * charWidth;

    const curScrollLeft = hScroll.scrollLeft;
    const viewportWidth = hScroll.clientWidth;
    if (viewportWidth <= 0) return;

    const rightMargin = 2.5 * charWidth;
    const visibleLeft = curScrollLeft + paddingLeft;
    const visibleRight = curScrollLeft + viewportWidth - paddingRight - rightMargin;

    if (cursorPixelX >= visibleLeft && cursorPixelX <= visibleRight) {
      return;
    }

    if (cursorPixelX > visibleRight) {
      const targetScrollLeft = Math.round(cursorPixelX - viewportWidth + paddingRight + rightMargin);
      hScroll.scrollLeft = Math.max(0, targetScrollLeft);
      return;
    }

    if (cursorPixelX < visibleLeft) {
      const targetScrollLeft = Math.max(0, Math.round(cursorPixelX - paddingLeft - 1.5 * charWidth));
      hScroll.scrollLeft = targetScrollLeft;
    }
  };

  /**
   * 📱 Tự động cuộn theo chiều dọc để đưa dòng đang gõ lên vùng hiển thị rõ ràng,
   * đảm bảo dấu nháy con trỏ KHÔNG BAO GIỜ bị ẩn dưới bàn phím điện thoại hay thanh BottomKeyBar.
   */
  const scrollActiveLineIntoView = (forcedLineNum?: number) => {
    const vScroll = verticalScrollRef.current;
    const textarea = textareaRef.current;
    if (!vScroll || !textarea) return;

    const clientHeight = vScroll.clientHeight;
    if (clientHeight <= 0) return;

    const pos = textarea.selectionStart ?? 0;
    const liveLine = forcedLineNum ?? textarea.value.slice(0, pos).split('\n').length;

    const lineTop = (liveLine - 1) * lineHeightPx + 12;
    const lineBottom = lineTop + lineHeightPx;
    const curScrollTop = vScroll.scrollTop;

    // Khoảng đệm thích ứng để hoạt động mượt trên cả màn hình nhỏ khi bàn phím mở
    const margin = Math.min(Math.round(lineHeightPx * 1.8), Math.max(8, Math.floor(clientHeight * 0.22)));
    const maxScrollTop = Math.max(0, vScroll.scrollHeight - clientHeight);

    if (lineBottom + margin > curScrollTop + clientHeight) {
      const target = Math.min(maxScrollTop, Math.max(0, lineBottom + margin - clientHeight));
      vScroll.scrollTop = target;
    } else if (lineTop - margin < curScrollTop) {
      const target = Math.max(0, lineTop - margin);
      vScroll.scrollTop = target;
    }
  };

  // Theo dõi chính xác khi khung soạn thảo bị thu hẹp chiều cao (bàn phím Android bật lên)
  useEffect(() => {
    const vScroll = verticalScrollRef.current;
    if (!vScroll || typeof ResizeObserver === 'undefined') return;

    let prevHeight = vScroll.clientHeight;
    const observer = new ResizeObserver(() => {
      const nextHeight = vScroll.clientHeight;
      const shrunk = nextHeight > 0 && nextHeight < prevHeight - 16;
      prevHeight = nextHeight;

      if (shrunk && textareaRef.current && document.activeElement === textareaRef.current) {
        requestAnimationFrame(() => {
          scrollActiveLineIntoView();
          applyAutoScroll();
        });
      }
    });

    observer.observe(vScroll);
    return () => observer.disconnect();
  }, [lineHeightPx, fontSize, fontFamily]);

  // Dự phòng qua visualViewport & window.resize cho các trình duyệt/ROM Android khác nhau
  useEffect(() => {
    let prevVvHeight = typeof window !== 'undefined' ? (window.visualViewport?.height ?? window.innerHeight) : 0;

    const handleViewportChange = () => {
      if (typeof window === 'undefined') return;
      const curHeight = window.visualViewport?.height ?? window.innerHeight;
      const shrunk = curHeight > 0 && curHeight < prevVvHeight - 16;
      prevVvHeight = curHeight;

      if (shrunk && textareaRef.current && document.activeElement === textareaRef.current && !isUserDraggingTouchRef.current) {
        requestAnimationFrame(() => scrollActiveLineIntoView());
        const t = window.setTimeout(() => {
          if (!isUserDraggingTouchRef.current) {
            scrollActiveLineIntoView();
          }
        }, 120);
        focusTimersRef.current.push(t);
      }
    };

    window.addEventListener('resize', handleViewportChange);
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    }

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      if (typeof window !== 'undefined' && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      }
      clearPendingFocusTimers();
    };
  }, [lineHeightPx]);

  // Expose methods to parent (e.g. for BottomKeyBar quick insert)
  useImperativeHandle(ref, () => ({
    insertTextAtCursor: (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      // Preserve current line leading indentation across newlines for multi-line snippets
      let formattedText = text;
      if (text.includes('\n')) {
        const lineStart = val.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        const currentLineBeforeCursor = val.slice(lineStart, start);
        const leadingIndent = currentLineBeforeCursor.match(/^\s*/)?.[0] || '';
        if (leadingIndent) {
          const lines = text.split('\n');
          formattedText = lines
            .map((line, idx) => (idx === 0 || line.length === 0 ? line : leadingIndent + line))
            .join('\n');
        }
      }

      const isEnter = formattedText.includes('\n');
      if (isEnter) {
        isEnterKeyRef.current = true;
      }

      const updated = val.substring(0, start) + formattedText + val.substring(end);
      onChange(updated);

      setTimeout(() => {
        textarea.focus({ preventScroll: true });
        const nextPos = start + formattedText.length;
        textarea.setSelectionRange(nextPos, nextPos);
        lastSelectionStartRef.current = nextPos;
        const nextLine = updateActiveLine(updated, nextPos);
        applyAutoScroll(isEnter);
        scrollActiveLineIntoView(nextLine);
      }, 0);
    },
    focus: () => {
      textareaRef.current?.focus();
    },
    getValue: () => textareaRef.current?.value || '',
    setValue: (val: string) => {
      onChange(val);
    },
    getSelection: () => {
      const textarea = textareaRef.current;
      return {
        start: textarea?.selectionStart || 0,
        end: textarea?.selectionEnd || 0,
      };
    },
  }));

  // Calculate current active line based on cursor position
  const updateActiveLine = (text: string, pos: number): number => {
    const lineNum = text.slice(0, pos).split('\n').length;
    setActiveLine(lineNum);
    return lineNum;
  };

  const syncSelectionState = (): { line: number; changed: boolean } => {
    const textarea = textareaRef.current;
    if (!textarea) return { line: activeLine, changed: false };
    const pos = textarea.selectionStart;
    const changed = pos !== lastSelectionStartRef.current;
    lastSelectionStartRef.current = pos;
    const line = updateActiveLine(textarea.value, pos);
    return { line, changed };
  };

  // Keyboard navigation & PEP 8 Auto-indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;
    const spaces = ' '.repeat(indentSpaces);

    // Tab key: Insert spaces or indent selection
    if (e.key === 'Tab') {
      e.preventDefault();

      if (start === end) {
        const updated = val.substring(0, start) + spaces + val.substring(end);
        onChange(updated);
        setTimeout(() => {
          const nextPos = start + indentSpaces;
          textarea.setSelectionRange(nextPos, nextPos);
          lastSelectionStartRef.current = nextPos;
          const nextLine = updateActiveLine(updated, nextPos);
          applyAutoScroll(false);
          scrollActiveLineIntoView(nextLine);
        }, 0);
      } else {
        const beforeSelection = val.substring(0, start);
        const lineStart = beforeSelection.lastIndexOf('\n') + 1;
        const selectedText = val.substring(lineStart, end);
        const lines = selectedText.split('\n');

        if (e.shiftKey) {
          const unindented = lines.map(line => line.startsWith(spaces) ? line.slice(indentSpaces) : line).join('\n');
          const updated = val.substring(0, lineStart) + unindented + val.substring(end);
          onChange(updated);
        } else {
          const indented = lines.map(line => spaces + line).join('\n');
          const updated = val.substring(0, lineStart) + indented + val.substring(end);
          onChange(updated);
        }
      }
      return;
    }

    // Enter key: PEP 8 Auto-indentation
    if (e.key === 'Enter') {
      isEnterKeyRef.current = true;
      const textBeforeCursor = val.substring(0, start);
      const currentLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
      const currentLine = textBeforeCursor.substring(currentLineStart);

      const matchIndent = currentLine.match(/^\s*/);
      let currentIndent = matchIndent ? matchIndent[0] : '';

      if (currentLine.trim().endsWith(':')) {
        currentIndent += spaces;
      }

      e.preventDefault();
      const insertText = '\n' + currentIndent;
      const updated = val.substring(0, start) + insertText + val.substring(end);
      onChange(updated);

      setTimeout(() => {
        const nextPos = start + insertText.length;
        textarea.setSelectionRange(nextPos, nextPos);
        lastSelectionStartRef.current = nextPos;
        const nextLine = updateActiveLine(updated, nextPos);
        applyAutoScroll(true);
        scrollActiveLineIntoView(nextLine);
      }, 0);
      return;
    }

    // Backspace: Smart un-indent
    if (e.key === 'Backspace' && start === end && start > 0) {
      const textBeforeCursor = val.substring(0, start);
      const currentLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
      const lineUpToCursor = textBeforeCursor.substring(currentLineStart);

      if (/^\s+$/.test(lineUpToCursor) && lineUpToCursor.length >= indentSpaces && lineUpToCursor.length % indentSpaces === 0) {
        e.preventDefault();
        const updated = val.substring(0, start - indentSpaces) + val.substring(end);
        onChange(updated);
        setTimeout(() => {
          const nextPos = start - indentSpaces;
          textarea.setSelectionRange(nextPos, nextPos);
          lastSelectionStartRef.current = nextPos;
          const nextLine = updateActiveLine(updated, nextPos);
          scrollActiveLineIntoView(nextLine);
        }, 0);
        return;
      }
    }
  };

  const lineCount = Math.max(code.split('\n').length, 1);

  // Memoize highlighted HTML so scrolling NEVER triggers re-highlighting or DOM thrashing
  const highlightedHtml = useMemo(() => {
    if (!code) return ' ';
    return highlightPythonCode(code, colors, []);
  }, [code, colors]);

  return (
    <div
      className="relative flex-1 min-h-0 w-full h-full flex flex-col overflow-hidden select-text"
      style={{
        backgroundColor: colors.background,
        color: colors.foreground,
      }}
    >
      {/* Quick Jump to Line 1 when scrolled down on long files */}
      {isScrolledFar && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (verticalScrollRef.current) {
              verticalScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          className="absolute top-2.5 right-2.5 z-20 flex items-center space-x-1 px-2 py-1.5 rounded-lg backdrop-blur-md text-[11px] font-sans font-bold transition active:scale-95 cursor-pointer hover:brightness-125"
          style={{
            backgroundColor: 'var(--ui-surface-2)',
            color: 'var(--ui-accent)',
            border: '1px solid var(--ui-border-strong)',
            boxShadow: 'var(--ui-glow)',
          }}
          title="Cuộn nhanh về dòng 1"
        >
          <ArrowUpToLine className="w-3.5 h-3.5" />
          <span>Dòng 1</span>
        </button>
      )}

      {/* Unified Vertical Scroll Container (Gutter + Code scroll in 100% hardware lockstep, zero endless overscroll) */}
      <div
        ref={verticalScrollRef}
        onScroll={(e) => {
          const far = e.currentTarget.scrollTop > 180;
          setIsScrolledFar((prev) => (prev === far ? prev : far));
        }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) {
            touchStartPosRef.current = { x: t.clientX, y: t.clientY };
          }
          isUserDraggingTouchRef.current = false;
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (!t) return;
          const dx = Math.abs(t.clientX - touchStartPosRef.current.x);
          const dy = Math.abs(t.clientY - touchStartPosRef.current.y);
          if (dx > 6 || dy > 6) {
            // Người dùng đang vuốt cuộn màn hình -> hủy mọi timer snap để vuốt về đầu dòng mượt mà
            isUserDraggingTouchRef.current = true;
            clearPendingFocusTimers();
          }
        }}
        onTouchEnd={() => {
          window.setTimeout(() => {
            isUserDraggingTouchRef.current = false;
          }, 120);
        }}
        className="relative flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden ide-scroll-y"
      >
        <div className="flex w-full min-h-full items-stretch">
          {/* Line Numbers Gutter */}
          <div
            aria-hidden="true"
            className="w-11 sm:w-13 select-none shrink-0 py-3 text-right pr-2 text-xs font-mono"
            style={{
              backgroundColor: colors.gutterBg,
              color: colors.gutterFg,
              borderRight: '1px solid var(--ui-border-subtle)',
              lineHeight: `${lineHeightPx}px`,
              fontFamily,
              fontSize: `${fontSize * 0.85}px`,
            }}
          >
            {Array.from({ length: lineCount }, (_, idx) => {
              const num = idx + 1;
              const isCurrent = num === activeLine;
              return (
                <div
                  key={num}
                  className={`flex items-center justify-end ${
                    isCurrent ? 'font-bold' : 'opacity-60'
                  }`}
                  style={{
                    height: `${lineHeightPx}px`,
                    color: isCurrent ? 'var(--ui-accent)' : undefined,
                  }}
                >
                  <span>{num}</span>
                </div>
              );
            })}
          </div>

          {/* Horizontal Scroll Container for Code */}
          <div
            ref={horizontalScrollRef}
            className="relative flex-1 min-w-0 overflow-x-auto overflow-y-hidden ide-scroll-x"
          >
            {/* Exact-Sized Canvas Wrapper: sized cleanly by <pre> in normal flow so height never exceeds actual code */}
            <div className="relative w-max min-w-full min-h-full">
              {/* Active Line Highlight Bar (locked to content coordinates) */}
              <div
                aria-hidden="true"
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  top: `${(activeLine - 1) * lineHeightPx + 12}px`,
                  height: `${lineHeightPx}px`,
                  backgroundColor: colors.lineHighlight,
                  opacity: 0.7,
                  zIndex: 0,
                }}
              />

              {/* Syntax Highlighted Backdrop (<pre> in normal flow defines exact width & height) */}
              <pre
                aria-hidden="true"
                className="relative m-0 py-3 pl-3 pr-8 pointer-events-none select-none whitespace-pre font-mono z-1"
                style={{
                  lineHeight: `${lineHeightPx}px`,
                  fontSize: `${fontSize}px`,
                  fontFamily,
                  color: colors.foreground,
                }}
                dangerouslySetInnerHTML={{
                  __html: highlightedHtml,
                }}
              />

              {/* Native Interactive Textarea (overflow-hidden so all scrolling uses unified smooth container) */}
              <textarea
                ref={textareaRef}
                value={code}
                wrap="off"
                onChange={(e) => {
                  const val = e.target.value;
                  onChange(val);
                  const pos = e.target.selectionStart;
                  lastSelectionStartRef.current = pos;
                  const lineNum = updateActiveLine(val, pos);
                  requestAnimationFrame(() => {
                    applyAutoScroll();
                    scrollActiveLineIntoView(lineNum);
                  });
                }}
                onFocus={() => {
                  clearPendingFocusTimers();
                  requestAnimationFrame(() => {
                    const { line } = syncSelectionState();
                    scrollActiveLineIntoView(line);
                    applyAutoScroll();
                  });
                  // Bù trễ cho hiệu ứng trượt lên của bàn phím ảo trên Android APK
                  [180, 380].forEach((delay) => {
                    const t = window.setTimeout(() => {
                      if (!isUserDraggingTouchRef.current && document.activeElement === textareaRef.current) {
                        const { line } = syncSelectionState();
                        scrollActiveLineIntoView(line);
                      }
                    }, delay);
                    focusTimersRef.current.push(t);
                  });
                }}
                onKeyDown={handleKeyDown}
                onKeyUp={() => {
                  const { line } = syncSelectionState();
                  applyAutoScroll();
                  scrollActiveLineIntoView(line);
                }}
                onClick={() => {
                  const { line } = syncSelectionState();
                  scrollActiveLineIntoView(line);
                }}
                onSelect={() => {
                  if (!isUserDraggingTouchRef.current && document.activeElement === textareaRef.current) {
                    const { line, changed } = syncSelectionState();
                    if (changed) {
                      applyAutoScroll();
                      scrollActiveLineIntoView(line);
                    }
                  }
                }}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                className="absolute inset-0 w-full h-full py-3 pl-3 pr-8 m-0 border-0 outline-none resize-none whitespace-pre font-mono z-2 bg-transparent overflow-hidden"
                style={{
                  color: 'transparent',
                  caretColor: 'var(--ui-accent-2, #38bdf8)',
                  lineHeight: `${lineHeightPx}px`,
                  fontSize: `${fontSize}px`,
                  fontFamily,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

Editor.displayName = 'Editor';
