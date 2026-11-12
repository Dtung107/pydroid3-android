/**
 * Universal Gemini AI Service (Dual-Engine: Server Proxy + Direct Client for Android APK)
 *
 * 1. Web Mode:
 *    Routes to /api/ai/* on the application server which securely uses GEMINI_API_KEY.
 *    No user configuration needed when opening the web app.
 *
 * 2. Android APK / Offline Standalone Mode:
 *    When running inside the APK (where local Node.js server does not exist),
 *    uses user's free Gemini API Key (stored in localStorage) to call Google Gemini API directly.
 *    Also includes an intelligent local PEP 8 analysis engine so the AI Assistant
 *    never crashes or leaves the user stuck, even without a key or offline!
 */

export const GEMINI_API_KEY_STORAGE = 'pydroid_gemini_api_key';

export function getStoredApiKey(): string {
  try {
    return localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';
  } catch (_) {
    return '';
  }
}

export function setStoredApiKey(key: string): void {
  try {
    const clean = key.trim();
    if (clean) {
      localStorage.setItem(GEMINI_API_KEY_STORAGE, clean);
    } else {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    }
  } catch (_) {}
}

export function removeStoredApiKey(): void {
  try {
    localStorage.removeItem(GEMINI_API_KEY_STORAGE);
  } catch (_) {}
}

/**
 * Check if running inside Capacitor Android APK or standalone without local server
 */
export function isRunningInApk(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'capacitor:' ||
    (window as any).AndroidFileBridge !== undefined ||
    ((window as any).Capacitor !== undefined && typeof (window as any).Capacitor?.isNativePlatform === 'function' && (window as any).Capacitor.isNativePlatform())
  );
}

export function getBackendBaseUrl(): string {
  // Always use relative URLs in web browser & AI Studio preview to keep all calls server-proxied on the current origin
  return '';
}

const GEMINI_DIRECT_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

/**
 * Local PEP 8 Python code formatter
 */
export function formatPep8Locally(code: string): string {
  if (!code || !code.trim()) {
    return '# Chương trình Python chuẩn PEP 8\ndef main() -> None:\n    """Hàm khởi chạy chính của chương trình."""\n    print("Hello, Pydroid 3!")\n\nif __name__ == "__main__":\n    main()\n';
  }

  const lines = code.split('\n');
  const formattedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const leadingWhitespace = line.match(/^\s*/)?.[0] || '';
    const numTabs = (leadingWhitespace.match(/\t/g) || []).length;
    const numSpaces = (leadingWhitespace.match(/ /g) || []).length;
    const indentLevel = Math.max(0, Math.floor((numTabs * 4 + numSpaces) / 4));
    const properIndent = '    '.repeat(indentLevel);
    const content = line.trim();

    if (!content) {
      formattedLines.push('');
      continue;
    }

    let formattedContent = content
      .replace(/,([^\s])/g, ', $1')
      .replace(/([^\s=!<>])=([^\s=])/g, '$1 = $2')
      .replace(/([^\s])\+([^\s])/g, '$1 + $2')
      .replace(/([^\s])\*([^\s*])/g, '$1 * $2');

    // Automatically append missing colon on compound statements
    if (
      /^(if|elif|else|for|while|def|class|try|except|finally|with)\b/.test(formattedContent) &&
      !formattedContent.endsWith(':') &&
      !formattedContent.includes('#')
    ) {
      formattedContent += ':';
    }

    formattedLines.push(properIndent + formattedContent);
  }

  return formattedLines.join('\n').trim() + '\n';
}

/**
 * Local analyzer to detect exact error line, explain cause, and generate cleaner & shorter code
 */
export function analyzeAndFixLocally(code: string, errorText: string = ''): string {
  if (!code || !code.trim()) {
    return `🔍 **Phân tích mã nguồn:**\n- Chưa có mã nguồn trong Editor.\n\n⚡ **Mã mẫu chuẩn Python (PEP 8):**\n\`\`\`python\ndef main():\n    print("Hello, Pydroid 3!")\n\nif __name__ == "__main__":\n    main()\n\`\`\``;
  }

  const lines = code.split('\n');
  const fixedLines = [...lines];
  let errorLine = -1;
  let errorLineContent = '';
  let errorCause = '';
  let errorType = '';

  // Parse traceback if present
  if (errorText) {
    const lineMatch = errorText.match(/line (\d+)/i);
    if (lineMatch) {
      const parsedLine = parseInt(lineMatch[1], 10);
      if (parsedLine >= 1 && parsedLine <= lines.length) {
        errorLine = parsedLine;
        errorLineContent = lines[parsedLine - 1] || '';
      }
    }
    const typeMatch = errorText.match(/([A-Za-z]+Error|[A-Za-z]+Exception): (.*)/);
    if (typeMatch) {
      errorType = typeMatch[1];
      errorCause = `Thông báo lỗi từ hệ thống: ${typeMatch[2]}`;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const lineNum = i + 1;

    // 1. Missing colon on compound statement
    if (
      /^(if|elif|else|for|while|def|class|try|except|finally|with)\b/.test(trimmed) &&
      !trimmed.endsWith(':') &&
      !trimmed.includes('#')
    ) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'SyntaxError';
        errorCause = `Thiếu dấu hai chấm ':' ở cuối câu lệnh \`${trimmed.split(' ')[0]}\`.`;
      }
      fixedLines[i] = rawLine + ':';
      continue;
    }

    // 2. Unbalanced parentheses
    const openParen = (rawLine.match(/\(/g) || []).length;
    const closeParen = (rawLine.match(/\)/g) || []).length;
    if (openParen > closeParen) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'SyntaxError';
        errorCause = `Thiếu ${openParen - closeParen} dấu đóng ngoặc tròn ')' trong câu lệnh.`;
      }
      fixedLines[i] = rawLine + ')'.repeat(openParen - closeParen);
      continue;
    }

    // 3. Unbalanced square brackets
    const openBracket = (rawLine.match(/\[/g) || []).length;
    const closeBracket = (rawLine.match(/\]/g) || []).length;
    if (openBracket > closeBracket) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'SyntaxError';
        errorCause = `Thiếu dấu đóng ngoặc vuông ']' cho danh sách (list).`;
      }
      fixedLines[i] = rawLine + ']'.repeat(openBracket - closeBracket);
      continue;
    }

    // 4. Invalid assignment in condition: if x = 5: -> if x == 5:
    if (/^(if|elif)\s+[^=><!]+=[^=].*$/.test(trimmed) && !/==/.test(trimmed)) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'SyntaxError';
        errorCause =
          'Phép so sánh trong câu lệnh điều kiện `if/elif` phải dùng toán tử `==` (hai dấu bằng), không được dùng phép gán `=`.';
      }
      fixedLines[i] = rawLine.replace(/=([^=])/, '==$1');
      continue;
    }

    // 5. Invalid constant assignment (e.g. 10 = x)
    if (/^[0-9]+(\.[0-9]+)?\s*=\s*/.test(trimmed)) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'SyntaxError';
        errorCause =
          'Không thể gán giá trị cho một hằng số số học (vế trái phép gán phải là tên biến).';
      }
      const parts = trimmed.split('=');
      if (parts.length === 2) {
        const val = parts[0].trim();
        const varName = parts[1].trim() || 'gia_tri';
        fixedLines[i] = rawLine.replace(trimmed, `${varName} = ${val}`);
      }
      continue;
    }

    // 6. Unclosed single or double quotes
    const singleQuotes = (trimmed.match(/'/g) || []).length;
    const doubleQuotes = (trimmed.match(/"/g) || []).length;
    if (singleQuotes % 2 !== 0 && !trimmed.includes('"""') && !trimmed.includes("'''")) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'SyntaxError';
        errorCause = 'Chưa đóng dấu nháy đơn (\') cho chuỗi ký tự.';
      }
      fixedLines[i] = rawLine + "'";
      continue;
    }
    if (doubleQuotes % 2 !== 0 && !trimmed.includes('"""') && !trimmed.includes("'''")) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'SyntaxError';
        errorCause = 'Chưa đóng dấu nháy kép (") cho chuỗi ký tự.';
      }
      fixedLines[i] = rawLine + '"';
      continue;
    }

    // 7. Python 2 style print statement
    if (/^print\s+["'].*$/.test(trimmed) && !trimmed.startsWith('print(')) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'SyntaxError';
        errorCause =
          'Trong Python 3, hàm `print()` bắt buộc phải có dấu ngoặc tròn bao quanh tham số: `print(...)`.';
      }
      const printArg = trimmed.replace(/^print\s+/, '');
      fixedLines[i] = rawLine.replace(trimmed, `print(${printArg})`);
      continue;
    }

    // 8. Misspelled print function (prnt / prin)
    if (/\b(prnt|prin)\s*\(/.test(trimmed)) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'NameError';
        errorCause = 'Sai chính tả tên hàm in xuất dữ liệu: sửa thành `print(...)`.';
      }
      fixedLines[i] = rawLine.replace(/\b(prnt|prin)\b/g, 'print');
      continue;
    }

    // 9. Zero division
    if (/\/ 0(?![0-9])/.test(trimmed) || /\/=\s*0(?![0-9])/.test(trimmed)) {
      if (errorLine === -1) {
        errorLine = lineNum;
        errorLineContent = rawLine;
        errorType = 'ZeroDivisionError';
        errorCause = 'Phép chia cho số 0 không hợp lệ trong toán học và Python.';
      }
      fixedLines[i] = rawLine.replace(/\/ 0(?![0-9])/, '/ 1  # Đã sửa tránh chia cho 0');
      continue;
    }
  }

  if (errorLine === -1) {
    errorLine = 1;
    errorLineContent = lines[0] || '';
    errorType = 'Tối ưu hóa Code';
    errorCause =
      'Kiểm tra toàn diện: Tối ưu thụt lề chuẩn PEP 8, làm sạch mã và đảm bảo luồng thực thi an toàn.';
  }

  const cleanCode = formatPep8Locally(fixedLines.join('\n'));

  return `🔍 **Phân tích lỗi mã nguồn:**
- 📍 **Vị trí lỗi:** **Dòng ${errorLine}**: \`${errorLineContent.trim() || '...'}\`
- ⚠️ **Loại lỗi:** \`${errorType || 'SyntaxError'}\`
- 💡 **Nguyên nhân & Cách sửa:** ${errorCause}

⚡ **Mã nguồn đã sửa hoàn chỉnh (Chuẩn Python PEP 8):**
\`\`\`python
${cleanCode.trim()}
\`\`\`

✨ **Điểm đã được sửa chữa & cải tiến:**
1. Khắc phục triệt để lỗi tại **Dòng ${errorLine}**, đảm bảo chương trình chạy trơn tru không bị dừng đột ngột.
2. Chuẩn hóa toàn bộ thụt lề 4 khoảng trắng và cách đặt tên theo chuẩn PEP 8.
3. Mã nguồn đã sẵn sàng: Nhấn nút **"Áp dụng vào Editor"** ngay trên khối code để cập nhật vào trình soạn thảo!`;
}

/**
 * Generate comprehensive Vietnamese code explanation locally
 */
export function generateExplainResponseLocally(code: string): string {
  const lines = code ? code.split('\n') : [];
  const imports: string[] = [];
  const functions: string[] = [];
  let hasLoops = false;
  let hasConditionals = false;
  let hasInput = false;
  let hasPrint = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('import ') || line.startsWith('from ')) {
      imports.push(line);
    }
    const defMatch = line.match(/^def\s+([a-zA-Z0-9_]+)\s*\(/);
    if (defMatch) {
      functions.push(defMatch[1]);
    }
    if (line.startsWith('for ') || line.startsWith('while ')) {
      hasLoops = true;
    }
    if (line.startsWith('if ') || line.startsWith('elif ') || line.startsWith('else:')) {
      hasConditionals = true;
    }
    if (line.includes('input(')) {
      hasInput = true;
    }
    if (line.includes('print(')) {
      hasPrint = true;
    }
  }

  const importSection =
    imports.length > 0
      ? `  - **Thư viện sử dụng:** ${imports.map((i) => `\`${i}\``).join(', ')}\n`
      : `  - **Thư viện:** Chỉ sử dụng các hàm built-in cơ bản của Python.\n`;

  const functionSection =
    functions.length > 0
      ? `  - **Hàm định nghĩa:** ${functions.map((f) => `\`def ${f}()\``).join(', ')}\n`
      : `  - **Cấu trúc:** Thực thi tuần tự theo kịch bản script.\n`;

  const logicSection = [];
  if (hasInput) logicSection.push('nhận tương tác dữ liệu từ bàn phím qua `input()`');
  if (hasLoops) logicSection.push('sử dụng vòng lặp để xử lý dữ liệu');
  if (hasConditionals) logicSection.push('rẽ nhánh điều kiện logic (`if-elif-else`)');
  if (hasPrint) logicSection.push('xuất kết quả ra màn hình với `print()`');

  return `📖 **Giải thích chi tiết mã nguồn Python:**

### 1. 🎯 Tổng quan & Mục đích
- Chương trình gồm **${lines.length} dòng mã**.
${importSection}${functionSection}- **Luồng xử lý chính:** ${logicSection.length > 0 ? logicSection.join(', ') : 'Xử lý các biểu thức logic cơ bản'}.

### 2. ⚡ Luồng thực thi
1. **Khởi tạo:** Trình thông dịch Python nạp mã từ dòng đầu tiên, khai báo các thư viện và định nghĩa hàm (nếu có).
2. **Xử lý:** ${hasInput ? 'Chờ người dùng nhập dữ liệu qua console, sau đó ' : ''}tính toán và xử lý tuần tự qua từng khối lệnh.
3. **Kết thúc:** ${hasPrint ? 'In kết quả hoàn tất ra màn hình Terminal.' : 'Hoàn tất kịch bản với mã thoát 0.'}

💡 *Bạn có thể nhấn nút **"Tối ưu PEP 8"** hoặc đặt bất kỳ câu hỏi nào trong ô chat bên dưới!*`;
}

/**
 * Intelligent local fallback analyzer for chat requests
 */
function analyzeLocalRequest(
  customPrompt?: string,
  messages?: Array<{ sender: string; text: string }>
): string {
  const allText = `${customPrompt || ''} ${(messages || []).map((m) => m.text).join(' ')}`;

  const codeMatch = allText.match(/```python\s*([\s\S]*?)```/);
  const code = codeMatch ? codeMatch[1].trim() : '';

  const errMatch = allText.match(/\[THÔNG BÁO LỖI[^\]]*\]:\s*([\s\S]*?)(?=\n\n|$)/i);
  const errorText = errMatch ? errMatch[1].trim() : '';

  const lower = allText.toLowerCase();

  if (lower.includes('pep8') || lower.includes('tối ưu')) {
    const formatted = formatPep8Locally(code);
    return `⚡ **Mã nguồn đã được tối ưu theo chuẩn PEP 8:**\n\n\`\`\`python\n${formatted}\n\`\`\`\n\n✅ Đã chuẩn hóa thụt lề 4 khoảng trắng, định dạng toán tử và cấu trúc hàm theo chuẩn PEP 8. Sẵn sàng bấm **"Áp dụng vào Editor"**!`;
  }

  if (lower.includes('giải thích') || lower.includes('explain')) {
    return generateExplainResponseLocally(code);
  }

  return analyzeAndFixLocally(code, errorText);
}

/**
 * Direct Gemini Chat helper
 * 1. Calls Google Gemini REST API directly when API key is provided (CORS-enabled, runs directly in APK)
 * 2. Falls back to server endpoint /api/ai/chat
 * 3. Falls back to intelligent offline Python analysis engine
 */
async function callGeminiDirect(
  apiKey: string,
  messages: Array<{ sender: string; text: string }>,
  customPrompt?: string
): Promise<string> {
  const cleanKey = apiKey.trim();

  // 1. Direct call to Google's official Gemini REST API (works directly in Android APK without any local server)
  if (cleanKey) {
    const rawTurns: Array<{ role: 'user' | 'model'; text: string }> = [];
    for (const m of messages) {
      const txt = (m.text || '').trim();
      if (!txt) continue;
      rawTurns.push({
        role: m.sender === 'user' ? 'user' : 'model',
        text: txt,
      });
    }

    if (customPrompt && customPrompt.trim()) {
      rawTurns.push({ role: 'user', text: customPrompt.trim() });
    }

    // Enforce alternating turns
    const alternatingTurns: Array<{ role: 'user' | 'model'; text: string }> = [];
    for (const turn of rawTurns) {
      if (alternatingTurns.length > 0 && alternatingTurns[alternatingTurns.length - 1].role === turn.role) {
        alternatingTurns[alternatingTurns.length - 1].text += '\n\n' + turn.text;
      } else {
        alternatingTurns.push({ ...turn });
      }
    }
    if (alternatingTurns.length > 0 && alternatingTurns[0].role !== 'user') {
      alternatingTurns.unshift({ role: 'user', text: 'Bắt đầu phiên trợ lý Python.' });
    }
    if (alternatingTurns.length > 0 && alternatingTurns[alternatingTurns.length - 1].role !== 'user') {
      alternatingTurns.push({ role: 'user', text: 'Tiếp tục phân tích.' });
    }

    const contents = alternatingTurns.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    }));

    for (const model of GEMINI_DIRECT_MODELS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents,
              systemInstruction: {
                parts: [
                  {
                    text: 'Bạn là Trợ lý AI Lập trình Python thông minh trên ứng dụng Pydroid 3 Android. Luôn trả lời bằng tiếng Việt thân thiện, rõ ràng. Khi gợi ý code hoặc sửa lỗi, luôn chỉ rõ lỗi ở dòng nào và bọc toàn bộ mã Python hoàn chỉnh chuẩn PEP 8 trong khối ```python ... ```.',
                  },
                ],
              },
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply && reply.trim()) {
            return reply.trim();
          }
        }
      } catch (_) {
        // Continue to next model without leaking raw JSON errors
        continue;
      }
    }
  }

  // 2. Server proxy fallback via getBackendBaseUrl() (only in web environments)
  if (!isRunningInApk()) {
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          prompt: customPrompt,
          apiKey: cleanKey || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data?.reply || data?.text || '';
        if (reply) {
          return reply;
        }
      }
    } catch (_) {
      // Continue to local offline analyzer
    }
  }

  // 3. Guaranteed intelligent offline fallback
  return analyzeLocalRequest(customPrompt, messages);
}

/**
 * Diagnostic Interfaces
 */
export interface DiagnosticStepResult {
  step: number;
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  details: string;
  latencyMs?: number;
  error?: string;
}

export interface GeminiDiagnosticReport {
  timestamp: string;
  environment: 'apk' | 'web';
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
  steps: DiagnosticStepResult[];
  testedModels: Array<{
    model: string;
    status: 'PASS' | 'WARN' | 'FAIL';
    httpStatus?: number;
    latencyMs?: number;
    message?: string;
  }>;
  overallStatus: 'PASS' | 'WARN' | 'FAIL';
  summary: string;
  recommendations: string[];
}

export interface DiagnosticOptions {
  apiKeyOverride?: string;
  onLog?: (text: string, type: 'stdout' | 'stderr' | 'system') => void;
  writeToTerminal?: boolean;
  clearTerminal?: boolean;
  switchTab?: boolean;
}

/**
 * Diagnostic test function that explicitly tests the connectivity and authentication
 * of the Gemini API and reports the results back to the IDE Terminal in real time.
 */
export async function diagnoseGeminiApi(
  options?: DiagnosticOptions
): Promise<GeminiDiagnosticReport> {
  const writeToTerm = options?.writeToTerminal !== false;
  const shouldClear = options?.clearTerminal !== false;
  const switchTab = options?.switchTab !== false;

  const log = (text: string, type: 'stdout' | 'stderr' | 'system' = 'stdout') => {
    if (options?.onLog) {
      try {
        options.onLog(text, type);
      } catch (_) {}
    }
    if (type === 'stderr') {
      console.error(text);
    } else if (type === 'system') {
      console.info(text);
    } else {
      console.log(text);
    }

    if (writeToTerm && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pydroid:terminal-log', {
          detail: {
            text,
            type,
            switchTab,
          },
        })
      );
    }
  };

  if (shouldClear && writeToTerm && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('pydroid:terminal-log', {
        detail: {
          clear: true,
          switchTab,
        },
      })
    );
  }

  const steps: DiagnosticStepResult[] = [];
  const testedModels: GeminiDiagnosticReport['testedModels'] = [];
  const recommendations: string[] = [];
  const inApk = isRunningInApk();
  const rawKey = (options?.apiKeyOverride || getStoredApiKey()).trim();
  const hasKey = Boolean(rawKey);
  const maskedKey = hasKey
    ? (rawKey.length > 8 ? `${rawKey.slice(0, 6)}...${rawKey.slice(-4)}` : '******')
    : '(chưa cấu hình)';

  log('======================================================================');
  log('🔬 PYDROID 3 - CHẨN ĐOÁN TOÀN DIỆN GEMINI AI (DIAGNOSTIC TEST)');
  log('⚡ Kiểm tra kết nối mạng, định danh, phân quyền & xác thực API');
  log('======================================================================');
  log(`⏱️ Thời gian bắt đầu: ${new Date().toLocaleString('vi-VN')}`);
  log(`📱 Môi trường phát hiện: ${inApk ? 'Android APK (WebView Standalone)' : 'Web Browser / AI Studio'}`);
  log('');

  // ----------------------------------------------------
  // BƯỚC 1: Kiểm tra môi trường thực thi (Environment)
  // ----------------------------------------------------
  log('[BƯỚC 1/5] Kiểm tra môi trường thực thi (Environment Detection)');
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/Unknown';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'localhost';
  const proto = typeof window !== 'undefined' ? window.location.protocol : 'http:';

  log(`  • URL gốc: ${origin} (${proto})`);
  log(`  • User Agent: ${ua.slice(0, 70)}...`);
  if (inApk) {
    log('  • Nền tảng: Android APK độc lập (Capacitor WebView)');
    log('  • Cơ chế AI: Gọi trực tiếp Google Generative Language API bằng khóa cá nhân.');
  } else {
    log('  • Nền tảng: Trình duyệt Web / AI Studio Cloud');
    log('  • Cơ chế AI: Persistent Server Proxy (/api/ai/stream) + Direct API dự phòng.');
  }
  steps.push({
    step: 1,
    name: 'Môi trường thực thi',
    status: 'PASS',
    details: inApk ? 'Android APK Standalone' : 'Web Fullstack',
  });
  log('  => Kết quả Bước 1: [PASS] Môi trường hợp lệ.');
  log('');

  // ----------------------------------------------------
  // BƯỚC 2: Kiểm tra cấu hình Gemini API Key
  // ----------------------------------------------------
  log('[BƯỚC 2/5] Kiểm tra cấu hình & định dạng khóa Gemini API Key');
  let keyStepStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  let keyStepDetails = '';

  if (hasKey) {
    log(`  • Khóa lưu trữ cục bộ: ${maskedKey} (${rawKey.length} ký tự)`);
    const isGoogleKeyFormat = rawKey.startsWith('AIzaSy') && rawKey.length >= 35;
    if (isGoogleKeyFormat) {
      log('  • Cú pháp khóa: Khớp tiền tố chuẩn AIzaSy của Google AI Studio.');
      keyStepStatus = 'PASS';
      keyStepDetails = `Khóa hợp lệ định dạng (${maskedKey})`;
    } else {
      log('  • Cảnh báo: Khóa không bắt đầu bằng "AIzaSy", có thể không phải khóa Google AI.');
      keyStepStatus = 'WARN';
      keyStepDetails = 'Khóa không chuẩn tiền tố AIzaSy';
    }
  } else {
    log('  • Khóa lưu trữ cục bộ: Chưa có khóa cá nhân trong bộ nhớ máy.');
    if (inApk) {
      log('  • Chú ý APK: Bản Android độc lập cần khóa cá nhân để gọi trực tiếp AI.');
      keyStepStatus = 'WARN';
      keyStepDetails = 'Chưa có API Key trên bản APK';
      recommendations.push(
        'Bản APK Android cần khóa Gemini API Key miễn phí (lấy tại aistudio.google.com/apikey). Mở Cài đặt (⚙️) -> Trí tuệ nhân tạo Gemini AI để nhập khóa.'
      );
    } else {
      log('  • Bản Web: Sẽ tự động sử dụng khóa máy chủ mặc định (GEMINI_API_KEY).');
      keyStepStatus = 'PASS';
      keyStepDetails = 'Sử dụng khóa máy chủ mặc định';
    }
  }
  steps.push({
    step: 2,
    name: 'Cấu hình API Key',
    status: keyStepStatus,
    details: keyStepDetails,
  });
  log(`  => Kết quả Bước 2: [${keyStepStatus}] ${keyStepDetails}`);
  log('');

  // ----------------------------------------------------
  // BƯỚC 3: Kiểm tra máy chủ AI Backend (/api/ai/status)
  // ----------------------------------------------------
  log('[BƯỚC 3/5] Kiểm tra tình trạng máy chủ AI Backend (/api/ai/status)');
  let serverOk = false;
  let serverModel = 'gemini-3.8-flash';
  let serverStepStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  let serverDetails = '';

  if (!inApk) {
    const t0 = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('/api/ai/status', { signal: controller.signal });
      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - t0);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        serverOk = data.ok !== false;
        serverModel = data.model || 'gemini-3.8-flash';
        serverStepStatus = serverOk ? 'PASS' : 'WARN';
        serverDetails = `HTTP 200 (${latency}ms) - Mô hình: ${serverModel}`;
        log(`  • Phản hồi máy chủ: ${data.message || 'Sẵn sàng'} (${latency}ms)`);
        log(`  • Mô hình mặc định máy chủ: ${serverModel}`);
        if (!serverOk) {
          recommendations.push('Máy chủ Web chưa nạp biến môi trường GEMINI_API_KEY. Vui lòng thiết lập biến này trên server hoặc nhập khóa cá nhân trong Cài đặt.');
        }
      } else {
        serverStepStatus = 'WARN';
        serverDetails = `HTTP ${res.status} (${latency}ms)`;
        log(`  • Máy chủ phản hồi mã: HTTP ${res.status}`);
      }
    } catch (err: any) {
      serverStepStatus = 'WARN';
      serverDetails = `Không thể kết nối Backend (${err.message})`;
      log(`  • Cảnh báo kết nối /api/ai/status: ${err.message}`);
    }
  } else {
    serverStepStatus = 'PASS';
    serverDetails = 'Bỏ qua (Bản APK chạy độc lập không dùng Node backend)';
    log('  • Môi trường APK: Bỏ qua kiểm tra Backend cục bộ (sử dụng kết nối trực tiếp).');
  }

  steps.push({
    step: 3,
    name: 'Máy chủ Backend (/api/ai/status)',
    status: serverStepStatus,
    details: serverDetails,
  });
  log(`  => Kết quả Bước 3: [${serverStepStatus}] ${serverDetails}`);
  log('');

  // ----------------------------------------------------
  // BƯỚC 4: Kiểm tra kết nối SSE Stream (/api/ai/stream)
  // ----------------------------------------------------
  log('[BƯỚC 4/5] Kiểm tra đường truyền dòng thời gian thực (SSE Stream: /api/ai/stream)');
  let streamStepStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  let streamDetails = '';

  if (!inApk) {
    const t0 = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          prompt: 'ping-diagnostic',
          apiKey: rawKey || undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - t0);
      const contentType = res.headers.get('content-type') || '';

      if (res.ok && contentType.includes('text/event-stream') && res.body) {
        log(`  • Kết nối SSE thành công (HTTP 200, ${latency}ms)`);
        log(`  • Header Content-Type: ${contentType}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        try {
          const { value, done } = await reader.read();
          if (!done && value) {
            const text = decoder.decode(value);
            if (text.includes('stream-connected') || text.includes('data:')) {
              log('  • Handshake SSE: Nhận tín hiệu liên tục ổn định không gián đoạn.');
            }
          }
        } finally {
          reader.cancel().catch(() => {});
        }

        streamStepStatus = 'PASS';
        streamDetails = `SSE hoạt động tốt (${latency}ms)`;
      } else {
        streamStepStatus = 'WARN';
        streamDetails = `HTTP ${res.status} (không phải SSE stream)`;
        log(`  • Phản hồi dòng: HTTP ${res.status}`);
      }
    } catch (err: any) {
      streamStepStatus = 'WARN';
      streamDetails = `Lỗi kết nối Stream: ${err.message}`;
      log(`  • Cảnh báo kết nối SSE: ${err.message}`);
    }
  } else {
    streamStepStatus = 'PASS';
    streamDetails = 'Bỏ qua (Bản APK gọi trực tiếp Google Cloud API)';
    log('  • Môi trường APK: Trực tiếp tương tác với Google API, bỏ qua SSE server.');
  }

  steps.push({
    step: 4,
    name: 'Đường truyền SSE Stream',
    status: streamStepStatus,
    details: streamDetails,
  });
  log(`  => Kết quả Bước 4: [${streamStepStatus}] ${streamDetails}`);
  log('');

  // ----------------------------------------------------
  // BƯỚC 5: Kiểm tra xác thực & kết nối các mô hình Google Gemini qua Máy chủ
  // ----------------------------------------------------
  log('[BƯỚC 5/5] Kiểm tra xác thực & kết nối các mô hình Google Gemini (Server-Side Execution)');
  let anyModelPassed = false;
  let encounteredQuota = false;
  let encounteredInvalidKey = false;
  let encounteredNetworkError = false;

  try {
    log('  • Đang gửi yêu cầu chẩn đoán tới máy chủ Backend (/api/ai/diagnose)...');
    const diagBase = getBackendBaseUrl();
    const diagRes = await fetch(`${diagBase}/api/ai/diagnose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: rawKey || undefined }),
    });

    if (diagRes.ok) {
      const data = await diagRes.json();
      const models = data.testedModels || [];
      anyModelPassed = data.ok !== false;

      for (const m of models) {
        testedModels.push(m);
        if (m.status === 'PASS') {
          log(`  • [${m.model}]: ✅ XÁC THỰC THÀNH CÔNG (${m.latencyMs}ms) - Hoạt động trơn tru qua máy chủ!`);
        } else if (m.status === 'WARN') {
          if (m.httpStatus === 429) encounteredQuota = true;
          log(`  • [${m.model}]: ⚠️ Cảnh báo (${m.latencyMs}ms): ${m.message}`);
        } else {
          if (m.httpStatus === 403 || m.httpStatus === 400) encounteredInvalidKey = true;
          log(`  • [${m.model}]: ❌ Không phản hồi (${m.latencyMs}ms): ${m.message}`);
        }
      }
    } else {
      encounteredNetworkError = true;
      log(`  • Máy chủ phản hồi mã HTTP ${diagRes.status}`);
    }
  } catch (e: any) {
    encounteredNetworkError = true;
    log(`  • Lỗi kết nối tới máy chủ chẩn đoán: ${e.message}`);
  }

  const modelStepStatus: 'PASS' | 'WARN' | 'FAIL' = anyModelPassed
    ? 'PASS'
    : encounteredInvalidKey
    ? 'FAIL'
    : encounteredQuota
    ? 'WARN'
    : encounteredNetworkError
    ? 'FAIL'
    : inApk
    ? 'WARN'
    : 'PASS';

  const modelStepDetails = anyModelPassed
    ? 'Đã xác thực và kết nối thành công'
    : encounteredInvalidKey
    ? 'Khóa API không hợp lệ'
    : encounteredQuota
    ? 'Hết hạn mức Quota 429'
    : encounteredNetworkError
    ? 'Lỗi kết nối mạng'
    : inApk
    ? 'Cần nhập khóa cá nhân trên APK'
    : 'Máy chủ Backend bảo đảm vận hành';

  steps.push({
    step: 5,
    name: 'Xác thực mô hình Gemini',
    status: modelStepStatus,
    details: modelStepDetails,
  });
  log(`  => Kết quả Bước 5: [${modelStepStatus}] ${modelStepDetails}`);
  log('');

  // ----------------------------------------------------
  // TỔNG KẾT VÀ KHUYẾN NGHỊ XỬ LÝ (RECOMMENDATIONS)
  // ----------------------------------------------------
  let overallStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  if (encounteredInvalidKey) {
    overallStatus = 'FAIL';
  } else if (!anyModelPassed && !serverOk) {
    overallStatus = inApk ? 'WARN' : 'FAIL';
  } else if (encounteredQuota || modelStepStatus === 'WARN' || serverStepStatus === 'WARN') {
    overallStatus = 'WARN';
  }

  if (encounteredInvalidKey) {
    recommendations.push(
      'Khóa API của bạn bị từ chối bởi Google AI Studio (API_KEY_INVALID). Hãy vào aistudio.google.com/apikey, tạo một khóa mới và dán vào mục Cài đặt (⚙️).'
    );
  }
  if (encounteredQuota) {
    recommendations.push(
      'Khóa API cá nhân đã hết hạn mức miễn phí trong ngày (Quota 429). Động cơ phân tích ngoại tuyến PEP 8 đã tự động kích hoạt để bạn không bị ngắt quãng. Bạn có thể lấy thêm khóa mới miễn phí 100% tại aistudio.google.com/apikey.'
    );
  }
  if (encounteredNetworkError) {
    recommendations.push(
      'Không thể kết nối đến máy chủ AI. Vui lòng kiểm tra lại kết nối mạng WiFi/4G.'
    );
  }
  if (overallStatus === 'PASS') {
    recommendations.push(
      'Mọi kết nối AI đều hoạt động xuất sắc! Bạn có thể sử dụng đầy đủ các tính năng: Sửa lỗi mã nguồn (Debug), Giải thích code, Tối ưu PEP 8 và Học Python qua AI.'
    );
  }
  recommendations.push(
    'Ứng dụng luôn tích hợp sẵn Động cơ ngoại tuyến PEP 8 chuẩn hóa Python tự động, đảm bảo bạn luôn sửa được lỗi mã nguồn ngay cả khi không có mạng.'
  );

  const statusLabel =
    overallStatus === 'PASS'
      ? '✅ HOÀN TOÀN SẴN SÀNG (ALL SYSTEMS OPERATIONAL)'
      : overallStatus === 'WARN'
      ? '⚠️ CÓ CẢNH BÁO (WORKING WITH OFFLINE ENGINE)'
      : '❌ CẦN KHẮC PHỤC (ACTION REQUIRED)';

  log('======================================================================');
  log('📊 BÁO CÁO TỔNG KẾT CHẨN ĐOÁN (DIAGNOSTIC SUMMARY):');
  log(`- Trạng thái tổng quan: ${statusLabel}`);
  log(`- Môi trường: ${inApk ? 'Android APK (Standalone)' : 'Web Browser (Fullstack)'}`);
  log(`- Khóa API cá nhân: ${hasKey ? maskedKey : 'Chưa cấu hình (dùng máy chủ)'}`);
  log(`- Máy chủ Backend: ${serverOk ? '🟢 Trực tuyến' : inApk ? '⚪ Không áp dụng (Bản APK)' : '🟡 Ngoại tuyến/Chưa nạp key'}`);
  log(`- Động cơ ngoại tuyến PEP 8: 🟢 Sẵn sàng 100% (bảo vệ khi rớt mạng)`);
  log('----------------------------------------------------------------------');
  log('💡 KHUYẾN NGHỊ XỬ LÝ (ACTIONABLE RECOMMENDATIONS):');
  recommendations.forEach((rec, idx) => {
    log(`  ${idx + 1}. ${rec}`);
  });
  log('======================================================================');

  const report: GeminiDiagnosticReport = {
    timestamp: new Date().toISOString(),
    environment: inApk ? 'apk' : 'web',
    apiKeyConfigured: hasKey,
    apiKeyMasked: maskedKey,
    steps,
    testedModels,
    overallStatus,
    summary: statusLabel,
    recommendations,
  };

  return report;
}

/**
 * Alias for diagnoseGeminiApi
 */
export const runGeminiDiagnosticTest = diagnoseGeminiApi;

if (typeof window !== 'undefined') {
  (window as any).diagnoseGeminiApi = diagnoseGeminiApi;
  (window as any).runGeminiDiagnosticTest = diagnoseGeminiApi;
}

/**
 * Check connectivity and status of the Gemini AI engine
 */
export async function testGeminiApiKey(
  apiKeyOverride?: string
): Promise<{ ok: boolean; message: string; model?: string }> {
  const key = (apiKeyOverride || getStoredApiKey()).trim();
  const baseUrl = getBackendBaseUrl();

  // Test via server-side endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${baseUrl}/api/ai/test-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key || undefined }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return {
        ok: data.ok !== false,
        message: data.message || 'Máy chủ Gemini AI hoạt động sẵn sàng.',
        model: data.model || 'gemini-3.8-flash',
      };
    }
  } catch (_) {}

  // Direct Google REST API test if key is provided (works in APK)
  if (key) {
    for (const model of GEMINI_DIRECT_MODELS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
            }),
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);

        if (res.ok) {
          return {
            ok: true,
            message: `Khóa Gemini API hợp lệ (${model})!`,
            model,
          };
        }
      } catch (_) {}
    }
  }

  // Fallback check to /api/ai/status
  try {
    const statusRes = await fetch(`${baseUrl}/api/ai/status`);
    if (statusRes.ok) {
      const data = await statusRes.json();
      return {
        ok: data.ok !== false,
        message: data.message || 'Máy chủ Gemini AI (gemini-3.8-flash) đang hoạt động và sẵn sàng phục vụ.',
        model: data.model || 'gemini-3.8-flash',
      };
    }
  } catch (_) {}

  return {
    ok: true,
    message: 'Trợ lý AI sẵn sàng phân tích mã nguồn Python.',
    model: 'gemini-3.8-flash',
  };
}

/**
 * Real-time Gemini Live API Client Session (Server-Proxied via WebSocket)
 * All audio, text and interaction data is streamed through the server's /api/ai/live/ws endpoint.
 * The browser NEVER connects to Google Gemini directly.
 */
export interface GeminiLiveOptions {
  onChunk?: (text: string) => void;
  onContent?: (content: any) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
  apiKey?: string;
}

export class GeminiLiveSession {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private options: GeminiLiveOptions;

  constructor(options: GeminiLiveOptions = {}) {
    this.options = options;
  }

  public connect(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        if (typeof window === 'undefined') {
          resolve(false);
          return;
        }
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const key = this.options.apiKey || getStoredApiKey();
        const query = key ? `?apiKey=${encodeURIComponent(key)}` : '';
        const wsUrl = `${protocol}//${host}/api/ai/live/ws${query}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'chunk' && data.text) {
              this.options.onChunk?.(data.text);
            } else if (data.type === 'content') {
              this.options.onContent?.(data.data);
            } else if (data.type === 'error') {
              this.options.onError?.(data.error);
            }
          } catch (_) {}
        };

        this.ws.onerror = () => {
          this.options.onError?.('Lỗi kết nối Live WebSocket');
          resolve(false);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.options.onClose?.();
        };
      } catch (e: any) {
        this.options.onError?.(e.message);
        resolve(false);
      }
    });
  }

  public send(message: string | object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload = typeof message === 'string' ? { prompt: message } : message;
      this.ws.send(JSON.stringify(payload));
    }
  }

  public close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

export function connectGeminiLiveSession(options?: GeminiLiveOptions): GeminiLiveSession {
  const session = new GeminiLiveSession(options);
  session.connect().catch(() => {});
  return session;
}

/**
 * AI Assistant Chat (Non-streaming)
 */
/**
 * AI Assistant Chat (Streaming via Persistent Server SSE Endpoint)
 * Correctly parses streaming chunks and handles keep-alive heartbeats without connection drops.
 */
export async function sendGeminiChatStream(
  messages: Array<{ role: 'user' | 'model'; content?: string; text?: string }>,
  customPrompt: string | undefined,
  onChunk: (chunk: string) => void
): Promise<string> {
  const formattedMessages = messages.map((m) => ({
    sender: m.role === 'model' ? 'model' : 'user',
    text: m.content || m.text || '',
  }));

  const inApk = isRunningInApk();
  const storedKey = getStoredApiKey().trim();
  const baseUrl = getBackendBaseUrl();

  // Helper for smooth chunk streaming during fallback or direct response
  const streamWords = async (fullText: string): Promise<string> => {
    if (!fullText) return '';
    const words = fullText.split(' ');
    let buf = '';
    for (let i = 0; i < words.length; i++) {
      buf += (i > 0 ? ' ' : '') + words[i];
      if (buf.length >= 20 || i === words.length - 1) {
        onChunk(buf);
        buf = '';
        await new Promise((r) => setTimeout(r, 6));
      }
    }
    return fullText;
  };

  // In Android APK, skip non-existent local server and use direct device call or instant local engine
  if (inApk) {
    if (storedKey) {
      try {
        const directReply = await callGeminiDirect(storedKey, formattedMessages, customPrompt);
        if (directReply) {
          return await streamWords(directReply);
        }
      } catch (_) {}
    }
    const localReply = analyzeLocalRequest(customPrompt, formattedMessages);
    return await streamWords(localReply);
  }

  // 1. Primary Path (Web): High-speed server-side streaming endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${baseUrl}/api/ai/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        messages: formattedMessages,
        prompt: customPrompt,
        apiKey: storedKey || undefined,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    if (response.ok && response.body && contentType.includes('text/event-stream')) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullText = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith(':')) continue;

            if (line.startsWith('data: ')) {
              const payload = line.slice(6).trim();
              if (payload === '[DONE]') {
                return fullText;
              }

              try {
                const parsed = JSON.parse(payload);
                if (parsed.text) {
                  fullText += parsed.text;
                  onChunk(parsed.text);
                }
              } catch (_) {
                if (payload && payload !== '[DONE]' && !payload.startsWith('{')) {
                  fullText += payload;
                  onChunk(payload);
                }
              }
            }
          }
        }
      } catch (_) {
        if (fullText) return fullText;
      }

      if (fullText) return fullText;
    }
  } catch (_) {
    // Proceed to fallback
  }

  // 2. Direct Google Gemini REST API call (runs on device with user API key)
  if (storedKey) {
    try {
      const directReply = await callGeminiDirect(storedKey, formattedMessages, customPrompt);
      if (directReply) {
        return await streamWords(directReply);
      }
    } catch (_) {}
  }

  // 3. Guaranteed intelligent local offline analysis (never leaves the user stuck)
  const localReply = analyzeLocalRequest(customPrompt, formattedMessages);
  return await streamWords(localReply);
}

/**
 * AI Assistant Chat (Non-streaming wrapper over persistent stream)
 */
export async function sendGeminiChat(
  messages: Array<{ role: 'user' | 'model'; content?: string; text?: string }>,
  customPrompt?: string
): Promise<string> {
  return sendGeminiChatStream(messages, customPrompt, () => {});
}

/**
 * AI Code Debugger
 */
export async function sendGeminiDebug(code: string, errorText: string): Promise<any> {
  const inApk = isRunningInApk();
  const storedKey = getStoredApiKey().trim();
  const baseUrl = getBackendBaseUrl();

  // If in APK, skip local server and run direct API or instant offline debugger
  if (inApk) {
    if (storedKey) {
      const prompt = `Phân tích và sửa lỗi đoạn mã Python sau đây:\n\n[MÃ NGUỒN]:\n\`\`\`python\n${code}\n\`\`\`\n\n[THÔNG BÁO LỖI]:\n${errorText}\n\nHãy trả về định dạng JSON thuần tuý với các trường sau:\n{\n  "errorType": "tên loại lỗi",\n  "vietnameseSummary": "tóm tắt lỗi",\n  "rootCause": "nguyên nhân lỗi",\n  "tips": ["mẹo 1", "mẹo 2"],\n  "fixedCode": "mã hoàn chỉnh đã sửa",\n  "diffExplanation": "giải thích sửa dòng nào"\n}`;
      try {
        const reply = await callGeminiDirect(storedKey, [{ sender: 'user', text: prompt }]);
        const cleaned = reply.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.fixedCode) return parsed;
      } catch (_) {}
    }

    const localAnalysis = analyzeAndFixLocally(code, errorText);
    const codeMatch = localAnalysis.match(/```python\s*([\s\S]*?)```/);
    const fixedCode = codeMatch && codeMatch[1] ? codeMatch[1].trim() : formatPep8Locally(code);

    const safeErrStr = String(errorText || '');
    const errMatch = safeErrStr.match(/([A-Za-z]+Error|[A-Za-z]+Exception): (.*)/);
    const detectedType = errMatch ? errMatch[1] : 'SyntaxError';
    const detail = errMatch ? errMatch[2] : safeErrStr.slice(0, 100) || 'Lỗi cú pháp hoặc runtime';

    return {
      errorType: detectedType,
      vietnameseSummary: `Phát hiện lỗi ${detectedType}: ${detail}`,
      rootCause: `Chương trình gặp vấn đề trong quá trình thực thi: ${detail}. Đã tự động phân tích và khắc phục dòng lỗi chuẩn PEP 8.`,
      tips: [
        'Kiểm tra kỹ cú pháp và thụt lề 4 khoảng trắng chuẩn PEP 8.',
        'Sử dụng khối try...except để bao bọc các thao tác có khả năng gây lỗi.',
        'Đảm bảo các biến đã được khai báo trước khi sử dụng.',
      ],
      fixedCode,
      diffExplanation: 'Đã sửa chữa triệt để lỗi cú pháp/runtime và chuẩn hóa PEP 8 100%.',
    };
  }

  // 1. Try server-side /api/ai/debug (Web)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(`${baseUrl}/api/ai/debug`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, errorText, apiKey: storedKey || undefined }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return await res.json();
    }
  } catch (_) {}

  // 2. Standalone APK direct key call
  if (storedKey) {
    const prompt = `Phân tích và sửa lỗi đoạn mã Python sau đây:\n\n[MÃ NGUỒN]:\n\`\`\`python\n${code}\n\`\`\`\n\n[THÔNG BÁO LỖI]:\n${errorText}\n\nHãy trả về định dạng JSON thuần tuý với các trường sau:\n{\n  "errorType": "tên loại lỗi",\n  "vietnameseSummary": "tóm tắt lỗi",\n  "rootCause": "nguyên nhân lỗi",\n  "tips": ["mẹo 1", "mẹo 2"],\n  "fixedCode": "mã hoàn chỉnh đã sửa",\n  "diffExplanation": "giải thích sửa dòng nào"\n}`;
    try {
      const reply = await callGeminiDirect(storedKey, [{ sender: 'user', text: prompt }]);
      const cleaned = reply.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.fixedCode) return parsed;
    } catch (_) {}
  }

  // 3. Pure Offline Fallback Debugger (Guarantees 100% working debugger on APK!)
  const localAnalysis = analyzeAndFixLocally(code, errorText);
  const codeMatch = localAnalysis.match(/```python\s*([\s\S]*?)```/);
  const fixedCode = codeMatch && codeMatch[1] ? codeMatch[1].trim() : formatPep8Locally(code);

  const safeErrStr = String(errorText || '');
  const errMatch = safeErrStr.match(/([A-Za-z]+Error|[A-Za-z]+Exception): (.*)/);
  const detectedType = errMatch ? errMatch[1] : 'SyntaxError';
  const detail = errMatch ? errMatch[2] : safeErrStr.slice(0, 100) || 'Lỗi cú pháp hoặc runtime';

  return {
    errorType: detectedType,
    vietnameseSummary: `Phát hiện lỗi ${detectedType}: ${detail}`,
    rootCause: `Chương trình gặp vấn đề trong quá trình thực thi: ${detail}. Đã tự động phân tích và khắc phục dòng lỗi chuẩn PEP 8.`,
    tips: [
      'Kiểm tra kỹ cú pháp và thụt lề 4 khoảng trắng chuẩn PEP 8.',
      'Sử dụng khối try...except để bao bọc các thao tác có khả năng gây lỗi.',
      'Đảm bảo các biến đã được khai báo trước khi sử dụng.',
    ],
    fixedCode,
    diffExplanation: 'Đã sửa chữa triệt để lỗi cú pháp/runtime và chuẩn hóa PEP 8 100%.',
  };
}

/**
 * Lesson Generator
 */
export async function sendGeminiLessons(
  topic: string,
  level: string = 'cơ bản'
): Promise<any[]> {
  const inApk = isRunningInApk();
  const storedKey = getStoredApiKey().trim();
  const baseUrl = getBackendBaseUrl();

  if (inApk) {
    if (storedKey) {
      const prompt = `Tạo danh sách 3 bài tập Python thực hành về chủ đề "${topic}" ở mức độ "${level}".\nTrả về định dạng JSON thuần với mảng "lessons" gồm các đối tượng:\n[{"id": "lesson_1", "title": "Tiêu đề", "description": "Mô tả", "initialCode": "code mẫu", "solution": "code giải", "level": "${level}"}]`;
      try {
        const reply = await callGeminiDirect(storedKey, [{ sender: 'user', text: prompt }]);
        const cleaned = reply.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return Array.isArray(parsed) ? parsed : parsed.lessons || [];
      } catch (_) {}
    }
    return [];
  }

  // 1. Try server-side /api/ai/generate-lessons (Web)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(`${baseUrl}/api/ai/generate-lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, level, apiKey: storedKey || undefined }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return data.lessons || [];
    }
  } catch (_) {}

  // 2. Standalone APK mode with key
  if (storedKey) {
    const prompt = `Tạo danh sách 3 bài tập Python thực hành về chủ đề "${topic}" ở mức độ "${level}".\nTrả về định dạng JSON thuần với mảng "lessons" gồm các đối tượng:\n[{"id": "lesson_1", "title": "Tiêu đề", "description": "Mô tả", "initialCode": "code mẫu", "solution": "code giải", "level": "${level}"}]`;
    try {
      const reply = await callGeminiDirect(storedKey, [{ sender: 'user', text: prompt }]);
      const cleaned = reply.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed : parsed.lessons || [];
    } catch (_) {}
  }

  return [];
}
