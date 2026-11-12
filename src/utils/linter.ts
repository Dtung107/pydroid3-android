import { LintError } from '../types';

export function translatePythonErrorMessage(type: string, message: string): string {
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
  if (msgLower.includes('duplicate argument')) {
    return 'Trùng lặp tên tham số trong định nghĩa hàm';
  }
  if (type === 'IndentationError') {
    return `Lỗi thụt lề: ${message}`;
  }
  if (type === 'TabError') {
    return 'Lỗi trộn lẫn phím Tab và khoảng trắng';
  }
  return message || 'Lỗi cú pháp Python';
}

/**
 * Fast client-side Python syntax heuristic checker (runs synchronously in 0ms)
 * Catches unclosed brackets, missing colons, invalid indentation, unclosed strings.
 */
export function checkPythonSyntaxClient(code: string): LintError[] {
  if (!code || !code.trim()) return [];

  const errors: LintError[] = [];
  const lines = code.split('\n');

  // 1. Check brackets balance and track open positions
  const bracketStack: Array<{ char: string; line: number; col: number }> = [];
  const bracketPairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

  let inTripleString: string | null = null;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNum = lineIdx + 1;
    const rawLine = lines[lineIdx];
    const trimmed = rawLine.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Handle multiline triple strings
    if (inTripleString) {
      if (rawLine.includes(inTripleString)) {
        inTripleString = null;
      }
      continue;
    }

    if (rawLine.includes('"""') && (rawLine.match(/"""/g) || []).length % 2 === 1) {
      inTripleString = '"""';
      continue;
    }
    if (rawLine.includes("'''") && (rawLine.match(/'''/g) || []).length % 2 === 1) {
      inTripleString = "'''";
      continue;
    }

    // Skip comments
    if (trimmed.startsWith('#')) continue;

    // 2. Check for missing ':' after compound statements
    const compoundKeywordRegex = /^(if|elif|else|for|while|def|class|try|except|finally|with)\b/;
    if (compoundKeywordRegex.test(trimmed)) {
      // Remove trailing comments
      const codeWithoutComment = trimmed.split('#')[0].trim();
      // If it doesn't end with ':' and is not a multiline continuation
      if (!codeWithoutComment.endsWith(':') && !codeWithoutComment.endsWith('\\') && !codeWithoutComment.endsWith(',')) {
        // Only flag if parenthesis on this line are balanced or not open
        const openParenCount = (codeWithoutComment.match(/\(/g) || []).length;
        const closeParenCount = (codeWithoutComment.match(/\)/g) || []).length;
        if (openParenCount <= closeParenCount) {
          errors.push({
            line: lineNum,
            column: rawLine.length,
            endLine: lineNum,
            endColumn: rawLine.length + 1,
            type: 'SyntaxError',
            message: "expected ':'",
            vietnameseMessage: "Thiếu dấu hai chấm ':' ở cuối câu lệnh",
            text: rawLine,
          });
        }
      }
    }

    // 3. Check for single-line unclosed string
    const quoteMatches = rawLine.replace(/\\['"]/g, '');
    const doubleQuotes = (quoteMatches.match(/"/g) || []).length;
    const singleQuotes = (quoteMatches.match(/'/g) || []).length;
    if (doubleQuotes % 2 === 1 && !rawLine.includes('"""')) {
      errors.push({
        line: lineNum,
        column: rawLine.lastIndexOf('"') + 1,
        endLine: lineNum,
        endColumn: rawLine.length,
        type: 'SyntaxError',
        message: 'unterminated string literal',
        vietnameseMessage: 'Chưa đóng chuỗi ký tự (thiếu dấu ngoặc kép ")',
        text: rawLine,
      });
    } else if (singleQuotes % 2 === 1 && !rawLine.includes("'''")) {
      errors.push({
        line: lineNum,
        column: rawLine.lastIndexOf("'") + 1,
        endLine: lineNum,
        endColumn: rawLine.length,
        type: 'SyntaxError',
        message: 'unterminated string literal',
        vietnameseMessage: "Chưa đóng chuỗi ký tự (thiếu dấu nháy đơn ')",
        text: rawLine,
      });
    }

    // 4. Check for invalid indentation: mix of tabs and spaces
    const leadingWhitespace = rawLine.match(/^\s*/)?.[0] || '';
    if (leadingWhitespace.includes('\t') && leadingWhitespace.includes(' ')) {
      errors.push({
        line: lineNum,
        column: 1,
        endLine: lineNum,
        endColumn: leadingWhitespace.length,
        type: 'TabError',
        message: 'inconsistent use of tabs and spaces in indentation',
        vietnameseMessage: 'Lỗi thụt lề: Trộn lẫn phím Tab và phím cách Space',
        text: rawLine,
      });
    }

    // 5. Track brackets
    let inString = false;
    let stringChar = '';
    for (let c = 0; c < rawLine.length; c++) {
      const ch = rawLine[c];
      if ((ch === '"' || ch === "'") && rawLine[c - 1] !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = ch;
        } else if (stringChar === ch) {
          inString = false;
        }
      }
      if (inString || ch === '#') {
        if (ch === '#') break;
        continue;
      }

      if (ch === '(' || ch === '[' || ch === '{') {
        bracketStack.push({ char: ch, line: lineNum, col: c + 1 });
      } else if (ch === ')' || ch === ']' || ch === '}') {
        const last = bracketStack.pop();
        if (!last || last.char !== bracketPairs[ch]) {
          errors.push({
            line: lineNum,
            column: c + 1,
            endLine: lineNum,
            endColumn: c + 2,
            type: 'SyntaxError',
            message: `unmatched '${ch}'`,
            vietnameseMessage: `Dấu đóng ngoặc '${ch}' không khớp hoặc bị thừa`,
            text: rawLine,
          });
        }
      }
    }
  }

  // If there are unclosed brackets left
  if (bracketStack.length > 0 && errors.length === 0) {
    const unclosed = bracketStack[bracketStack.length - 1];
    errors.push({
      line: unclosed.line,
      column: unclosed.col,
      endLine: unclosed.line,
      endColumn: unclosed.col + 1,
      type: 'SyntaxError',
      message: `'${unclosed.char}' was never closed`,
      vietnameseMessage: `Chưa đóng ngoặc '${unclosed.char}'`,
      text: lines[unclosed.line - 1] || '',
    });
  }

  return errors;
}

// In-flight request controller to prevent stale results
let currentAbortController: AbortController | null = null;

/**
 * Async background linter that calls Python's CPython AST compiler via /api/python/lint
 * with fallback to client heuristics.
 */
export async function lintPythonCodeServer(code: string): Promise<LintError[]> {
  if (!code || !code.trim()) {
    return [];
  }

  if (currentAbortController) {
    currentAbortController.abort();
  }

  const controller = new AbortController();
  currentAbortController = controller;

  try {
    const res = await fetch('/api/python/lint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const data = await res.json();
    if (data.errors && Array.isArray(data.errors)) {
      return data.errors.map((err: any) => ({
        ...err,
        vietnameseMessage: err.vietnameseMessage || translatePythonErrorMessage(err.type, err.message),
      }));
    }
    return [];
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return [];
    }
    // Fallback to client-side heuristic checker
    return checkPythonSyntaxClient(code);
  }
}
