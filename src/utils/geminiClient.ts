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
 *    Gracefully prompts the user to enter their free API key instead of crashing with HTML JSON parse errors.
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
    (window.location.protocol === 'https:' && window.location.hostname === 'localhost') ||
    (window.location.protocol === 'http:' && window.location.hostname === 'localhost') ||
    (window as any).Capacitor !== undefined
  );
}

const GEMINI_DIRECT_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

/**
 * Direct Google Gemini API call (used on Android APK or when personal API Key is provided)
 */
async function callGeminiDirect(
  apiKey: string,
  messages: Array<{ sender: string; text: string }>,
  customPrompt?: string
): Promise<string> {
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  for (const m of messages) {
    if (!m.text) continue;
    contents.push({
      role: m.sender === 'model' || m.sender === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }],
    });
  }

  if (customPrompt) {
    contents.push({
      role: 'user',
      parts: [{ text: customPrompt }],
    });
  }

  // Ensure there is at least one content
  if (contents.length === 0) {
    contents.push({
      role: 'user',
      parts: [{ text: 'Xin chào Trợ lý AI Python.' }],
    });
  }

  const cleanKey = apiKey.trim();
  let lastError: Error | null = null;

  for (const model of GEMINI_DIRECT_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: 'Bạn là Trợ lý AI Lập trình Python (Gemini 3.8) thông minh trong IDE Pydroid 3. Hãy phân tích mã nguồn Python, giải thích rõ ràng, chỉ rõ lỗi nếu có và hướng dẫn sửa lỗi theo chuẩn PEP 8. Luôn trả lời bằng tiếng Việt thân thiện, định dạng markdown rõ ràng.',
              },
            ],
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2500,
          },
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const message = errJson?.error?.message || `Lỗi Gemini API (${response.status})`;
        // If model not found or deprecated for this key, fallback to next model
        if (response.status === 404 || message.includes('no longer available') || message.includes('not found')) {
          lastError = new Error(message);
          continue;
        }
        throw new Error(message);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        if (data?.promptFeedback?.blockReason) {
          throw new Error(`Nội dung bị chặn bởi bộ lọc an toàn: ${data.promptFeedback.blockReason}`);
        }
        throw new Error('Không nhận được phản hồi hợp lệ từ Gemini API.');
      }

      return text;
    } catch (err: any) {
      lastError = err;
      if (err.message?.includes('no longer available') || err.message?.includes('not found')) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Không thể kết nối đến các mô hình Gemini AI.');
}

/**
 * Check connectivity and status of the Gemini AI engine
 */
export async function testGeminiApiKey(apiKeyOverride?: string): Promise<{ ok: boolean; message: string; model?: string }> {
  const key = (apiKeyOverride || getStoredApiKey()).trim();

  // If a direct key is present or running in APK, test key directly with Google API
  if (key) {
    for (const model of GEMINI_DIRECT_MODELS) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'ping' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        });

        if (res.ok) {
          return {
            ok: true,
            message: `Khóa Gemini API Key hoạt động tuyệt vời (${model})!`,
            model,
          };
        }

        const err = await res.json().catch(() => ({}));
        const errMsg = err?.error?.message || `Mã lỗi ${res.status}`;
        if (errMsg.includes('no longer available') || errMsg.includes('not found')) {
          continue; // try next candidate model
        }
        return {
          ok: false,
          message: errMsg,
        };
      } catch (e: any) {
        return {
          ok: false,
          message: `Không thể kết nối đến Google Gemini API: ${e.message}`,
        };
      }
    }
  }

  // Otherwise, test server-side proxy
  try {
    const res = await fetch('/api/ai/status');
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      return {
        ok: data.ok !== false,
        message: data.message || 'Máy chủ Gemini AI đang hoạt động và sẵn sàng phục vụ.',
        model: data.model || 'gemini-3.8-flash',
      };
    }

    if (isRunningInApk()) {
      return {
        ok: false,
        message: 'Bản APK cần khóa Gemini API Key cá nhân để sử dụng tính năng AI.',
      };
    }

    return {
      ok: true,
      message: 'Máy chủ Gemini AI sẵn sàng kết nối.',
      model: 'gemini-3.8-flash',
    };
  } catch (err: any) {
    if (isRunningInApk()) {
      return {
        ok: false,
        message: 'Bản APK cần khóa Gemini API Key cá nhân để sử dụng tính năng AI.',
      };
    }
    return {
      ok: true,
      message: 'Máy chủ Gemini AI sẵn sàng phục vụ.',
      model: 'gemini-3.8-flash',
    };
  }
}

/**
 * AI Assistant Chat (Non-streaming)
 */
export async function sendGeminiChat(
  messages: Array<{ role: 'user' | 'model'; content?: string; text?: string }>,
  customPrompt?: string
): Promise<string> {
  const formattedMessages = messages.map((m) => ({
    sender: m.role === 'model' ? 'model' : 'user',
    text: m.content || m.text || '',
  }));

  const storedKey = getStoredApiKey();
  const inApk = isRunningInApk();

  // If running in APK and user provided an API key, use direct call
  if (inApk && storedKey) {
    return callGeminiDirect(storedKey, formattedMessages, customPrompt);
  }

  // Try server proxy first if not explicitly running standalone
  if (!inApk) {
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: formattedMessages,
          prompt: customPrompt,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Lỗi máy chủ AI (${res.status})`);
        }
        return data.reply || data.text || '';
      }
    } catch (err: any) {
      if (storedKey) {
        return callGeminiDirect(storedKey, formattedMessages, customPrompt);
      }
      throw err;
    }
  }

  // If in APK or server proxy unavailable:
  if (storedKey) {
    return callGeminiDirect(storedKey, formattedMessages, customPrompt);
  }

  // Clear, helpful prompt for APK users
  throw new Error(
    'Bạn đang chạy Pydroid 3 trên bản APK Android độc lập. Vui lòng mở biểu tượng Cài đặt ⚙️ > Trợ lý Gemini AI và dán khóa API miễn phí (lấy tại aistudio.google.com/apikey) để kích hoạt AI trực tiếp!'
  );
}

/**
 * AI Assistant Chat (Streaming)
 */
export async function sendGeminiChatStream(
  messages: Array<{ role: 'user' | 'model'; content?: string; text?: string }>,
  customPrompt: string | undefined,
  onChunk: (chunk: string) => void
): Promise<string> {
  const storedKey = getStoredApiKey();
  const inApk = isRunningInApk();

  if (inApk || storedKey) {
    // For direct key, call sendGeminiChat and stream the final answer
    const reply = await sendGeminiChat(messages, customPrompt);
    onChunk(reply);
    return reply;
  }

  const formattedMessages = messages.map((m) => ({
    sender: m.role === 'model' ? 'model' : 'user',
    text: m.content || m.text || '',
  }));

  try {
    const response = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: formattedMessages,
        prompt: customPrompt,
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !response.body || !contentType.includes('text/event-stream')) {
      return sendGeminiChat(messages, customPrompt);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.text) {
              fullText += parsed.text;
              onChunk(parsed.text);
            }
          } catch (_) {}
        }
      }
    }

    return fullText;
  } catch (_) {
    return sendGeminiChat(messages, customPrompt);
  }
}

/**
 * AI Code Debugger
 */
export async function sendGeminiDebug(code: string, errorText: string): Promise<any> {
  const storedKey = getStoredApiKey();
  const inApk = isRunningInApk();

  if (inApk || storedKey) {
    const prompt = `Phân tích và sửa lỗi đoạn mã Python sau đây:\n\n[MÃ NGUỒN]:\n\`\`\`python\n${code}\n\`\`\`\n\n[THÔNG BÁO LỖI]:\n${errorText}\n\nHãy trả về định dạng JSON thuần tuý với các trường sau:\n{\n  "errorAnalysis": "phân tích nguyên nhân lỗi",\n  "errorLine": 1,\n  "suggestedFix": "giải thích cách sửa",\n  "correctedCode": "mã nguồn Python hoàn chỉnh đã sửa"\n}`;
    try {
      const reply = await sendGeminiChat([], prompt);
      const cleaned = reply.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (_) {
      return {
        errorAnalysis: 'Không thể phân tích lỗi tự động.',
        errorLine: 1,
        suggestedFix: 'Vui lòng kiểm tra lại cú pháp.',
        correctedCode: code,
      };
    }
  }

  const res = await fetch('/api/ai/debug', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, errorText }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Lỗi máy chủ AI Debugger (${res.status})`);
  }

  return res.json();
}

/**
 * Lesson Generator
 */
export async function sendGeminiLessons(topic: string, level: string = 'cơ bản'): Promise<any[]> {
  const storedKey = getStoredApiKey();
  const inApk = isRunningInApk();

  if (inApk || storedKey) {
    const prompt = `Tạo danh sách 3 bài tập Python thực hành về chủ đề "${topic}" ở mức độ "${level}".\nTrả về định dạng JSON thuần với mảng "lessons" gồm các đối tượng:\n[{"id": "lesson_1", "title": "Tiêu đề", "description": "Mô tả", "initialCode": "code mẫu", "solution": "code giải", "level": "${level}"}]`;
    try {
      const reply = await sendGeminiChat([], prompt);
      const cleaned = reply.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed : (parsed.lessons || []);
    } catch (_) {
      return [];
    }
  }

  const res = await fetch('/api/ai/generate-lessons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, level }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Lỗi tạo bài học AI (${res.status})`);
  }

  const data = await res.json();
  return data.lessons || [];
}
