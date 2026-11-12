import React, { useRef, useState, useImperativeHandle, forwardRef, useEffect } from 'react';
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
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Line height constant to ensure pixel-perfect synchronization
  const lineHeightPx = Math.round(fontSize * 1.55);

  const [cursorPos, setCursorPos] = useState<number>(0);
  const [activeLine, setActiveLine] = useState<number>(1);
  const [currentScrollTop, setCurrentScrollTop] = useState<number>(0);

  // Auto-scroll tracking references according to the 3 specification rules
  const lastScrollLeftRef = useRef<number>(0);
  const isEnterKeyRef = useRef<boolean>(false);
  const prevCodeRef = useRef<string>(code);

  /**
   * 📐 Thuật toán tối ưu tự động cuộn thông minh theo 3 quy tắc:
   * 1-- Nhận diện isEnter: Chỉ cuộn về mép trái (scrollLeft = 0) khi vừa gõ phím Enter (\n)
   * 2-- Khóa cứng vị trí trong vùng nhìn: Con trỏ trong tầm nhìn thì giữ nguyên 100% vị trí cuộn, tuyệt đối không reset về 0
   * 3-- Tự động cuộn sang phải theo từng ký tự gõ: Khi chạm mép phải, cuộn giữ khoảng đệm ~2.5 ký tự
   */
  const applyAutoScroll = (forcedIsEnter?: boolean) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const pos = textarea.selectionStart;
    const val = textarea.value;

    // 1. Nhận diện isEnter:
    const isEnter = forcedIsEnter ?? (
      isEnterKeyRef.current || (
        pos > 0 &&
        val[pos - 1] === '\n' &&
        val.length > prevCodeRef.current.length &&
        val.slice(0, pos - 1) === prevCodeRef.current.slice(0, pos - 1)
      )
    );

    // Reset cờ isEnter
    isEnterKeyRef.current = false;
    prevCodeRef.current = val;

    if (isEnter) {
      textarea.scrollLeft = 0;
      if (highlightRef.current) highlightRef.current.scrollLeft = 0;
      lastScrollLeftRef.current = 0;
      return;
    }

    // Tính toán tọa độ ngang (X) của con trỏ hiện tại
    const textBefore = val.slice(0, pos);
    const lastLineBreak = textBefore.lastIndexOf('\n');
    const lineTextBefore = lastLineBreak === -1 ? textBefore : textBefore.slice(lastLineBreak + 1);
    const col = lineTextBefore.length;

    const charWidth = getCharWidth(fontSize, fontFamily);
    const paddingLeft = 12; // pl-3
    const paddingRight = 24; // pr-6
    const cursorPixelX = paddingLeft + col * charWidth;

    const curScrollLeft = textarea.scrollLeft;
    const viewportWidth = textarea.clientWidth;
    if (viewportWidth <= 0) return;

    // Khoảng đệm mép phải: ~2.5 ký tự theo quy tắc 3
    const rightMargin = 2.5 * charWidth;
    const visibleLeft = curScrollLeft + paddingLeft;
    const visibleRight = curScrollLeft + viewportWidth - paddingRight - rightMargin;

    // 2. Khóa cứng vị trí khi đang làm việc trong vùng nhìn (Không giật lùi):
    // Con trỏ đang nằm trong tầm nhìn thấy rõ -> giữ nguyên 100% vị trí cuộn hiện tại, không reset về 0.
    if (cursorPixelX >= visibleLeft && cursorPixelX <= visibleRight) {
      textarea.scrollLeft = curScrollLeft;
      if (highlightRef.current) highlightRef.current.scrollLeft = curScrollLeft;
      lastScrollLeftRef.current = curScrollLeft;
      return;
    }

    // 3. Tự động cuộn sang phải theo từng ký tự gõ:
    // Khi gõ tiếp từ mép phải, màn hình tiếp tục cuộn sang phải theo từng ký tự, giữ con trỏ cách mép phải ~2.5 ký tự.
    if (cursorPixelX > visibleRight) {
      const targetScrollLeft = Math.round(cursorPixelX - viewportWidth + paddingRight + rightMargin);
      textarea.scrollLeft = Math.max(0, targetScrollLeft);
      if (highlightRef.current) highlightRef.current.scrollLeft = Math.max(0, targetScrollLeft);
      lastScrollLeftRef.current = targetScrollLeft;
      return;
    }

    // Nếu con trỏ nằm về bên trái của vùng nhìn thấy (ví dụ bấm mũi tên trái hoặc backspace)
    if (cursorPixelX < visibleLeft) {
      const targetScrollLeft = Math.max(0, Math.round(cursorPixelX - paddingLeft - (1.5 * charWidth)));
      textarea.scrollLeft = targetScrollLeft;
      if (highlightRef.current) highlightRef.current.scrollLeft = targetScrollLeft;
      lastScrollLeftRef.current = targetScrollLeft;
    }
  };

  const syncVerticalScroll = (st: number) => {
    if (highlightRef.current) highlightRef.current.scrollTop = st;
    if (gutterRef.current) gutterRef.current.scrollTop = st;
    setCurrentScrollTop(st);
  };

  /**
   * 📱 Tự động cuộn theo chiều dọc để đưa dòng đang gõ lên vùng hiển thị thoải mái,
   * đặc biệt khi bàn phím ảo điện thoại Android / iOS xuất hiện che khuất nửa dưới màn hình.
   */
  const scrollActiveLineIntoView = (lineNum = activeLine, paddingLines = 2.5) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const clientHeight = textarea.clientHeight;
    if (clientHeight <= 0) return;

    // Vị trí pixel đỉnh và đáy của dòng code hiện tại
    const lineTop = (lineNum - 1) * lineHeightPx + 12;
    const lineBottom = lineTop + lineHeightPx;

    const curScrollTop = textarea.scrollTop;
    const verticalPadding = Math.round(lineHeightPx * paddingLines);

    // Vùng nhìn thấy an toàn của textarea
    const visibleTop = curScrollTop;
    const visibleBottom = curScrollTop + clientHeight;

    if (lineBottom + verticalPadding > visibleBottom) {
      // Dòng bị che khuất ở cạnh đáy (bàn phím ảo đẩy lên hoặc gõ Enter tới cuối trang)
      const targetScrollTop = Math.max(0, lineBottom + verticalPadding - clientHeight);
      textarea.scrollTop = targetScrollTop;
      syncVerticalScroll(targetScrollTop);
    } else if (lineTop - verticalPadding < visibleTop) {
      // Dòng bị che khuất ở cạnh trên
      const targetScrollTop = Math.max(0, lineTop - verticalPadding);
      textarea.scrollTop = targetScrollTop;
      syncVerticalScroll(targetScrollTop);
    }
  };

  // Tự động lắng nghe thay đổi kích thước do bàn phím ảo điện thoại gây ra
  useEffect(() => {
    const handleViewportChange = () => {
      if (textareaRef.current && document.activeElement === textareaRef.current) {
        requestAnimationFrame(() => {
          scrollActiveLineIntoView();
        });
        setTimeout(() => {
          scrollActiveLineIntoView();
        }, 150);
        setTimeout(() => {
          scrollActiveLineIntoView();
        }, 350);
      }
    };

    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }

    return () => {
      if (typeof window !== 'undefined' && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
    };
  }, [activeLine, lineHeightPx]);

  // Expose methods to parent (e.g. for BottomKeyBar quick insert)
  useImperativeHandle(ref, () => ({
    insertTextAtCursor: (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      const isEnter = text.includes('\n');
      if (isEnter) {
        isEnterKeyRef.current = true;
      }

      const updated = val.substring(0, start) + text + val.substring(end);
      onChange(updated);

      setTimeout(() => {
        textarea.focus();
        const nextPos = start + text.length;
        textarea.setSelectionRange(nextPos, nextPos);
        setCursorPos(nextPos);
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

  // Synchronize scroll between textarea, pre, and gutter
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = target.scrollTop;
      highlightRef.current.scrollLeft = target.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = target.scrollTop;
    }
    setCurrentScrollTop(target.scrollTop);
  };

  // Calculate current active line based on cursor position
  const updateActiveLine = (text: string, pos: number): number => {
    const textBefore = text.slice(0, pos);
    const lineNum = textBefore.split('\n').length;
    setActiveLine(lineNum);
    return lineNum;
  };

  const handleSelectOrClick = (): number => {
    if (textareaRef.current) {
      const pos = textareaRef.current.selectionStart;
      setCursorPos(pos);
      return updateActiveLine(textareaRef.current.value, pos);
    }
    return activeLine;
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
        // Single cursor: insert indent spaces
        const updated = val.substring(0, start) + spaces + val.substring(end);
        onChange(updated);
        setTimeout(() => {
          textarea.setSelectionRange(start + indentSpaces, start + indentSpaces);
        }, 0);
      } else {
        // Multi-line selection: indent each selected line
        const beforeSelection = val.substring(0, start);
        const lineStart = beforeSelection.lastIndexOf('\n') + 1;
        const selectedText = val.substring(lineStart, end);
        const lines = selectedText.split('\n');

        if (e.shiftKey) {
          // Unindent
          const unindented = lines.map(line => line.startsWith(spaces) ? line.slice(indentSpaces) : line).join('\n');
          const updated = val.substring(0, lineStart) + unindented + val.substring(end);
          onChange(updated);
        } else {
          // Indent
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

      // If line ends with ':' (PEP 8 block opener)
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
        setCursorPos(nextPos);
        const nextLine = updateActiveLine(updated, nextPos);
        applyAutoScroll(true);
        scrollActiveLineIntoView(nextLine, 3);
      }, 0);
      return;
    }

    // Backspace: Smart un-indent 4 spaces if preceded by spaces
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
          setCursorPos(nextPos);
          const nextLine = updateActiveLine(updated, nextPos);
          scrollActiveLineIntoView(nextLine);
        }, 0);
        return;
      }
    }
  };

  const lineCount = Math.max(code.split('\n').length, 1);
  const linesArray = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div
      className="relative flex-1 w-full h-full flex flex-col overflow-hidden select-text"
      style={{
        backgroundColor: colors.background,
        color: colors.foreground,
      }}
    >
      {/* Editor Main Canvas (Gutter + Textarea) */}
      <div className="relative flex-1 w-full flex overflow-hidden">
        {/* Line Numbers Gutter */}
        <div
          ref={gutterRef}
          className="w-11 sm:w-13 h-full select-none overflow-hidden shrink-0 border-r border-[#262630] py-3 text-right pr-2 text-xs font-mono"
          style={{
            backgroundColor: colors.gutterBg,
            color: colors.gutterFg,
            lineHeight: `${lineHeightPx}px`,
            fontFamily,
            fontSize: `${fontSize * 0.85}px`,
          }}
        >
          {linesArray.map((num) => (
            <div
              key={num}
              className={`transition-colors flex items-center justify-end ${
                num === activeLine
                  ? 'font-bold text-amber-400'
                  : 'opacity-60'
              }`}
              style={{ height: `${lineHeightPx}px` }}
            >
              <span>{num}</span>
            </div>
          ))}
        </div>

        {/* Editor Content Area */}
        <div className="relative flex-1 h-full overflow-hidden">
          {/* Active Line Highlight Bar (đồng bộ chính xác theo độ cuộn màn hình) */}
          <div
            className="absolute left-0 right-0 pointer-events-none transition-all duration-75"
            style={{
              top: `${(activeLine - 1) * lineHeightPx + 12 - currentScrollTop}px`,
              height: `${lineHeightPx}px`,
              backgroundColor: colors.lineHighlight,
              opacity: 0.7,
              zIndex: 0,
            }}
          />

          {/* Syntax Highlighted Backdrop (<pre>) */}
          <pre
            ref={highlightRef}
            aria-hidden="true"
            className="absolute inset-0 m-0 py-3 pl-3 pr-6 overflow-hidden pointer-events-none whitespace-pre font-mono z-1"
            style={{
              lineHeight: `${lineHeightPx}px`,
              fontSize: `${fontSize}px`,
              fontFamily,
              color: colors.foreground,
            }}
            dangerouslySetInnerHTML={{
              __html: highlightPythonCode(code, colors, []) + '\n',
            }}
          />

          {/* Native Interactive Textarea với tự động cuộn lên theo bàn phím ảo */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => {
              const val = e.target.value;
              onChange(val);
              const pos = e.target.selectionStart;
              setCursorPos(pos);
              const lineNum = updateActiveLine(val, pos);
              requestAnimationFrame(() => {
                applyAutoScroll();
                scrollActiveLineIntoView(lineNum);
              });
            }}
            onFocus={() => {
              const line = handleSelectOrClick();
              requestAnimationFrame(() => scrollActiveLineIntoView(line));
              setTimeout(() => scrollActiveLineIntoView(line), 150);
              setTimeout(() => scrollActiveLineIntoView(line), 350);
            }}
            onKeyDown={handleKeyDown}
            onKeyUp={() => {
              const line = handleSelectOrClick();
              applyAutoScroll();
              scrollActiveLineIntoView(line);
            }}
            onClick={() => {
              const line = handleSelectOrClick();
              scrollActiveLineIntoView(line);
            }}
            onTouchStart={() => {
              setTimeout(() => {
                const line = handleSelectOrClick();
                scrollActiveLineIntoView(line);
              }, 80);
            }}
            onScroll={handleScroll}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            className="absolute inset-0 w-full h-full py-3 pl-3 pr-6 m-0 border-0 outline-none resize-none whitespace-pre font-mono z-2 bg-transparent overflow-auto"
            style={{
              color: 'transparent',
              caretColor: '#38bdf8',
              lineHeight: `${lineHeightPx}px`,
              fontSize: `${fontSize}px`,
              fontFamily,
            }}
          />
        </div>
      </div>
    </div>
  );
});

Editor.displayName = 'Editor';
