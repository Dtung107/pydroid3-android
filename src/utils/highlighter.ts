import { SyntaxColors, LintError } from '../types';

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PYTHON_KEYWORDS = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
  'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from',
  'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not',
  'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
]);

const PYTHON_BUILTINS = new Set([
  'True', 'False', 'None', 'print', 'input', 'range', 'len', 'int', 'float',
  'str', 'bool', 'list', 'dict', 'set', 'tuple', 'open', 'type', 'sum',
  'min', 'max', 'abs', 'round', 'enumerate', 'zip', 'map', 'filter',
  'sorted', 'reversed', 'super', 'isinstance', 'issubclass', 'id', 'all', 'any',
  'repr', 'chr', 'ord', 'bin', 'hex', 'oct', 'pow', 'divmod', 'property',
  'classmethod', 'staticmethod',
]);

export function highlightPythonCode(
  code: string,
  colors: SyntaxColors,
  errors: LintError[] = []
): string {
  if (!code) return '';

  const errorLineMap = new Map<number, LintError>();
  for (const err of errors) {
    if (err.line) {
      errorLineMap.set(err.line, err);
    }
  }

  const lines = code.split('\n');
  const highlightedLines = lines.map((line, idx) => {
    const lineNum = idx + 1;
    const hasError = errorLineMap.has(lineNum);
    let i = 0;
    const len = line.length;
    let out = '';

    while (i < len) {
      // Check for comment
      if (line[i] === '#') {
        const comment = escapeHtml(line.slice(i));
        out += `<span style="color: ${colors.comment}; font-style: italic;">${comment}</span>`;
        break;
      }

      // Check for strings: triple quotes
      if (line.slice(i, i + 3) === '"""' || line.slice(i, i + 3) === "'''") {
        const quote = line.slice(i, i + 3);
        let endIdx = line.indexOf(quote, i + 3);
        if (endIdx === -1) endIdx = len;
        else endIdx += 3;
        const strVal = escapeHtml(line.slice(i, endIdx));
        out += `<span style="color: ${colors.string};">${strVal}</span>`;
        i = endIdx;
        continue;
      }

      // Check for single or double quote string
      if (line[i] === '"' || line[i] === "'") {
        const quote = line[i];
        let endIdx = i + 1;
        while (endIdx < len) {
          if (line[endIdx] === '\\') {
            endIdx += 2;
            continue;
          }
          if (line[endIdx] === quote) {
            endIdx++;
            break;
          }
          endIdx++;
        }
        const strVal = escapeHtml(line.slice(i, endIdx));
        out += `<span style="color: ${colors.string};">${strVal}</span>`;
        i = endIdx;
        continue;
      }

      // Check for f-string or raw string prefix: f"...", r"...", b"..."
      if ((line[i] === 'f' || line[i] === 'r' || line[i] === 'b') && (line[i + 1] === '"' || line[i + 1] === "'")) {
        const prefix = line[i];
        const quote = line[i + 1];
        let endIdx = i + 2;
        while (endIdx < len) {
          if (line[endIdx] === '\\') {
            endIdx += 2;
            continue;
          }
          if (line[endIdx] === quote) {
            endIdx++;
            break;
          }
          endIdx++;
        }
        const strVal = escapeHtml(line.slice(i, endIdx));
        out += `<span style="color: ${colors.keyword};">${prefix}</span><span style="color: ${colors.string};">${escapeHtml(line.slice(i + 1, endIdx))}</span>`;
        i = endIdx;
        continue;
      }

      // Check for numbers: digits or hex/bin
      if (/\d/.test(line[i])) {
        let numEnd = i;
        while (numEnd < len && /[\d.a-fA-FxXoObB_]/.test(line[numEnd])) {
          numEnd++;
        }
        const numVal = escapeHtml(line.slice(i, numEnd));
        out += `<span style="color: ${colors.number};">${numVal}</span>`;
        i = numEnd;
        continue;
      }

      // Check for identifiers / words
      if (/[a-zA-Z_]/.test(line[i])) {
        let wordEnd = i;
        while (wordEnd < len && /[a-zA-Z0-9_]/.test(line[wordEnd])) {
          wordEnd++;
        }
        const word = line.slice(i, wordEnd);

        // Check if followed by ( -> function call
        let nextNonSpace = wordEnd;
        while (nextNonSpace < len && line[nextNonSpace] === ' ') nextNonSpace++;
        const isFunctionCall = nextNonSpace < len && line[nextNonSpace] === '(';

        if (PYTHON_KEYWORDS.has(word)) {
          out += `<span style="color: ${colors.keyword}; font-weight: 600;">${escapeHtml(word)}</span>`;
        } else if (PYTHON_BUILTINS.has(word)) {
          out += `<span style="color: ${colors.builtin}; font-weight: 500;">${escapeHtml(word)}</span>`;
        } else if (isFunctionCall) {
          out += `<span style="color: ${colors.function};">${escapeHtml(word)}</span>`;
        } else {
          out += `<span style="color: ${colors.variable};">${escapeHtml(word)}</span>`;
        }
        i = wordEnd;
        continue;
      }

      // Operators
      if (/[+\-*/%=<>!&|^~:]/.test(line[i])) {
        out += `<span style="color: ${colors.operator};">${escapeHtml(line[i])}</span>`;
        i++;
        continue;
      }

      // Other characters (spaces, brackets, punctuation)
      out += escapeHtml(line[i]);
      i++;
    }

    const finalContent = out || ' ';
    if (hasError) {
      const err = errorLineMap.get(lineNum);
      const errTitle = escapeHtml(err?.vietnameseMessage || err?.message || 'Lỗi cú pháp');
      return `<span class="syntax-error-squiggly" title="${errTitle}" style="text-decoration: underline wavy #ef4444; text-decoration-thickness: 2px; text-underline-offset: 3.5px; background-color: rgba(239, 68, 68, 0.12); border-radius: 2px;">${finalContent}</span>`;
    }

    return finalContent;
  });

  return highlightedLines.join('\n');
}
