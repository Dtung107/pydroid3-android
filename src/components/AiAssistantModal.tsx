import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Bot,
  User,
  Send,
  RotateCcw,
  X,
  Copy,
  Check,
  Code2,
  ArrowDownToLine,
  FileCode,
  BookOpen,
  CheckCircle,
  Bug,
  Save,
  Key,
  ExternalLink,
  Terminal,
} from 'lucide-react';
import { ChatMessage } from '../types';
import { getStoredApiKey, setStoredApiKey, isRunningInApk, sendGeminiChat, sendGeminiChatStream } from '../utils/geminiClient';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCode: string;
  currentFileName: string;
  onApplyCode: (code: string) => void;
  lastErrorText?: string;
}

const DEFAULT_FIX_ERROR_PROMPT =
  'Hãy kiểm tra kỹ toàn bộ mã nguồn, tìm tất cả các lỗi (cú pháp, logic, runtime) ở dòng nào, giải thích nguyên nhân và viết lại mã Python hoàn chỉnh ĐÃ SỬA LỖI 100% chuẩn PEP 8.';
const DEFAULT_EXPLAIN_PROMPT = 'Hãy giải thích chi tiết mã nguồn Python này, luồng thực thi và các điểm cần lưu ý.';
const DEFAULT_PEP8_PROMPT = 'Hãy tối ưu và chuẩn hóa mã nguồn này theo tiêu chuẩn PEP 8 của Python.';
const DEFAULT_ANALYZE_FIX_PROMPT =
  'Hãy phân tích lỗi code ở dòng nào và viết ra code mới ngắn gọn sạch sẽ hơn code hiện tại.';

const STORAGE_KEY_CUSTOM_PROMPT = 'pydroid_custom_default_prompt';

const getStoredDefaultPrompt = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_PROMPT);
    if (saved && saved.trim()) {
      return saved.trim();
    }
  } catch (e) {
    // Ignore error
  }
  return DEFAULT_EXPLAIN_PROMPT;
};

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  currentCode,
  currentFileName,
  onApplyCode,
  lastErrorText,
}) => {
  const [savedCustomPrompt, setSavedCustomPrompt] = useState<string>(() => getStoredDefaultPrompt());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>(() => getStoredDefaultPrompt());
  const [isLoading, setIsLoading] = useState(false);
  const [activeFeature, setActiveFeature] = useState<'fix_error' | 'explain' | 'pep8' | 'analyze_fix_clean'>('fix_error');
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  const [appliedSnippetId, setAppliedSnippetId] = useState<string | null>(null);
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);

  const inApk = isRunningInApk();
  const [currentApiKey, setCurrentApiKey] = useState<string>(() => getStoredApiKey());
  const [showKeyCard, setShowKeyCard] = useState<boolean>(() => isRunningInApk() && !getStoredApiKey());
  const [inlineKeyInput, setInlineKeyInput] = useState<string>('');
  const [keyNotice, setKeyNotice] = useState<string | null>(null);

  const handleSaveInlineKey = () => {
    const clean = inlineKeyInput.trim();
    if (!clean) return;
    setStoredApiKey(clean);
    setCurrentApiKey(clean);
    setInlineKeyInput('');
    setShowKeyCard(false);
    setKeyNotice('✓ Đã lưu khóa API Gemini vào ứng dụng!');
    setTimeout(() => setKeyNotice(null), 3500);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Lưu câu hỏi tùy chỉnh làm mặc định vào localStorage
  const handleSaveAsDefault = (textToSave?: string) => {
    const toSave = (textToSave ?? inputText).trim();
    if (!toSave) return;
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_PROMPT, toSave);
      setSavedCustomPrompt(toSave);
      setIsSavedFeedback(true);
      setTimeout(() => setIsSavedFeedback(false), 2500);
    } catch (e) {
      // Ignore error
    }
  };

  // Khôi phục câu hỏi mặc định nguyên bản của hệ thống
  const handleResetToSystemDefault = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_CUSTOM_PROMPT);
    } catch (e) {
      // Ignore error
    }
    setSavedCustomPrompt(DEFAULT_EXPLAIN_PROMPT);
    setInputText(DEFAULT_EXPLAIN_PROMPT);
    setIsSavedFeedback(true);
    setTimeout(() => setIsSavedFeedback(false), 2000);
  };

  // 🌟 MẶC ĐỊNH KHI BẤM VÀO NÚT TRỢ LÝ AI:
  // Nạp câu hỏi mặc định đã lưu (hoặc câu gốc) vào ô chat và lưu giữ mọi chỉnh sửa của người dùng
  useEffect(() => {
    if (isOpen) {
      setActiveFeature('explain');
      const activePrompt = getStoredDefaultPrompt();
      setSavedCustomPrompt(activePrompt);
      setInputText(activePrompt);

      // Hiển thị lời chào từ AI kèm hướng dẫn nếu chưa có tin nhắn
      if (messages.length === 0) {
        setMessages([
          {
            id: 'msg_initial_welcome',
            sender: 'assistant',
            text: `👋 **Xin chào! Mình là Trợ lý AI Lập trình Python (Gemini AI).**\n\nMình đã sẵn sàng phân tích file **\`${currentFileName}\`** (${currentCode.split('\n').filter(Boolean).length} dòng mã).\n\n💡 **Ô chat bên dưới đã điền câu hỏi mặc định của bạn:**  \n*"${activePrompt}"*  \n\n👉 Bạn có thể **tự do thay đổi nội dung**, bấm **💾 Lưu câu này** để ghi nhớ cho lần sau, hoặc nhấn **Gửi** ngay để bắt đầu!`,
            timestamp: Date.now(),
          },
        ]);
      }

      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Core function to send chat to backend API with streaming
  const triggerAiChat = async (userPrompt: string, instruction = '') => {
    if (!userPrompt.trim()) return;
    setIsLoading(true);

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      sender: 'user',
      text: userPrompt.trim(),
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    const assistantMsgId = `msg_${Date.now()}_a`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      sender: 'assistant',
      text: '',
      timestamp: Date.now(),
    };
    setMessages([...newMessages, initialAssistantMsg]);

    try {
      const historyForGemini = newMessages.map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('model' as const),
        content: m.text,
      }));
      let promptWithContext = userPrompt.trim();
      if (currentCode) {
        promptWithContext += `\n\n[MÃ PYTHON HIỆN TẠI TRONG BỘ SOẠN THẢO]:\n\`\`\`python\n${currentCode}\n\`\`\``;
      }
      if (lastErrorText) {
        promptWithContext += `\n\n[THÔNG BÁO LỖI GẦN NHẤT]:\n${lastErrorText}`;
      }

      await sendGeminiChatStream(historyForGemini, promptWithContext, (chunk) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, text: m.text + chunk } : m))
        );
      });
    } catch (err: any) {
      const errMsgText = err?.message || 'Không thể liên lạc với Gemini';
      const isDetailed = errMsgText.includes('Cài đặt') || errMsgText.includes('APK');
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                text: m.text
                  ? `${m.text}\n\n⚠️ *[Kết nối bị ngắt]:* ${errMsgText}`
                  : (isDetailed
                      ? `⚠️ ${errMsgText}`
                      : `⚠️ Lỗi kết nối AI: ${errMsgText}. Vui lòng thử lại.`),
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 🛠️ Kích hoạt Sửa lỗi code: Kiểm tra, chỉ rõ dòng lỗi và tạo code sửa hoàn chỉnh
  const handleTriggerFixError = (autoRun = true) => {
    setActiveFeature('fix_error');
    const prompt = lastErrorText?.trim()
      ? `Đoạn mã Python hiện tại đang gặp lỗi sau:\n\`\`\`\n${lastErrorText.trim()}\n\`\`\`\nHãy phân tích nguyên nhân lỗi, chỉ rõ lỗi ở dòng nào và viết lại mã Python hoàn chỉnh ĐÃ SỬA LỖI 100% chuẩn PEP 8 để chạy được ngay.`
      : DEFAULT_FIX_ERROR_PROMPT;
    setInputText(prompt);
    if (autoRun && !isLoading) {
      triggerAiChat(prompt, 'fix_error');
    } else {
      inputRef.current?.focus();
    }
  };

  // Kích hoạt giải thích mã nguồn: Phân tích và giải thích toàn diện mã nguồn bằng AI
  const handleTriggerExplainCode = (autoRun = true) => {
    setActiveFeature('explain');
    const activePrompt = getStoredDefaultPrompt();
    setInputText(activePrompt);
    if (autoRun && !isLoading) {
      triggerAiChat(activePrompt, 'explain_source_code');
    } else {
      inputRef.current?.focus();
    }
  };

  // Kích hoạt tối ưu chuẩn PEP 8: Điền câu hỏi vào ô chat để người dùng tự do sửa
  const handleTriggerOptimizePep8 = (autoRun = true) => {
    setActiveFeature('pep8');
    setInputText(DEFAULT_PEP8_PROMPT);
    if (autoRun && !isLoading) {
      triggerAiChat(DEFAULT_PEP8_PROMPT, 'optimize_pep8');
    } else {
      inputRef.current?.focus();
    }
  };

  // 🐞 Kích hoạt phân tích lỗi ở dòng nào: Điền câu hỏi vào ô chat để người dùng tự do sửa
  const handleTriggerAnalyzeFixClean = (autoRun = true) => {
    setActiveFeature('analyze_fix_clean');
    setInputText(DEFAULT_ANALYZE_FIX_PROMPT);
    if (autoRun && !isLoading) {
      triggerAiChat(DEFAULT_ANALYZE_FIX_PROMPT, 'analyze_fix_clean');
    } else {
      inputRef.current?.focus();
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const promptToSend = inputText.trim();
    if (!promptToSend || isLoading) return;

    // Tự động lưu câu hỏi này nếu người dùng đã thay đổi nó khác với DEFAULT
    // bảo đảm câu thay đổi của người dùng luôn được lưu lại an toàn
    if (promptToSend && promptToSend !== DEFAULT_EXPLAIN_PROMPT && promptToSend !== DEFAULT_FIX_ERROR_PROMPT) {
      try {
        localStorage.setItem(STORAGE_KEY_CUSTOM_PROMPT, promptToSend);
        setSavedCustomPrompt(promptToSend);
      } catch (err) {}
    }

    setInputText('');

    const lower = promptToSend.toLowerCase();
    const isFixKeywords = /s[uư][aảã].*l[oô][iỉĩ]|l[oô][iỉĩ]|fix|bug|debug|g[oỡ].*l[oô][iỉĩ]|d[oò]ng.*m[aấ]y|kh[oô]ng.*ch[aạ]y/i.test(lower);

    let instructionToSend = 'explain_source_code';
    if (activeFeature === 'fix_error' || isFixKeywords) {
      instructionToSend = 'fix_error';
    } else if (activeFeature === 'analyze_fix_clean') {
      instructionToSend = 'analyze_fix_clean';
    } else if (activeFeature === 'pep8') {
      instructionToSend = 'optimize_pep8';
    }

    triggerAiChat(promptToSend, instructionToSend);
  };

  // Reset conversation to initial explanation state with editable prompt in chat box
  const handleResetChat = () => {
    setActiveFeature('explain');
    const activePrompt = getStoredDefaultPrompt();
    setInputText(activePrompt);
    setMessages([
      {
        id: `msg_welcome_${Date.now()}`,
        sender: 'assistant',
        text: `🔄 **Đã làm mới phiên trò chuyện.**\n\nÔ chat bên dưới đã được điền câu hỏi mặc định của bạn:  \n*"${activePrompt}"*\n\nBạn có thể **tự do thay đổi nội dung** trong ô chat trước khi gửi!`,
        timestamp: Date.now(),
      },
    ]);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleCopySnippet = (snippet: string, id: string) => {
    navigator.clipboard.writeText(snippet);
    setCopiedSnippetId(id);
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  const handleApplySnippet = (snippet: string, id: string) => {
    onApplyCode(snippet);
    setAppliedSnippetId(id);
    setTimeout(() => setAppliedSnippetId(null), 2500);
  };

  // Quick Chips List with full editable prompt text
  const quickChips = [
    {
      id: 'explain',
      label: '📖 Giải thích mã nguồn',
      prompt: savedCustomPrompt,
      instruction: 'explain_source_code',
    },
    {
      id: 'pep8',
      label: '✨ Tối ưu chuẩn PEP 8',
      prompt: DEFAULT_PEP8_PROMPT,
      instruction: 'optimize_pep8',
    },
    {
      id: 'analyze_fix_clean',
      label: '🐞 Lỗi ở dòng nào & Viết gọn lại',
      prompt: DEFAULT_ANALYZE_FIX_PROMPT,
      instruction: 'analyze_fix_clean',
    },
    {
      id: 'explain_line_by_line',
      label: '🔍 Chi tiết từng dòng',
      prompt: 'Hãy giải thích chi tiết từng dòng trong đoạn mã Python hiện tại của mình một cách dễ hiểu nhất.',
      instruction: 'explain_line_by_line',
    },
    {
      id: 'try_except',
      label: '🛡️ Bắt lỗi try...except',
      prompt: 'Hãy bổ sung khối bắt lỗi ngoại lệ try...except cho các vị trí có nguy cơ xảy ra lỗi trong mã này.',
      instruction: 'try_except',
    },
    {
      id: 'add_comments',
      label: '💬 Thêm chú thích tiếng Việt',
      prompt: 'Hãy thêm các chú thích tiếng Việt chi tiết, rõ ràng vào từng phần quan trọng của đoạn mã này.',
      instruction: 'add_comments',
    },
    {
      id: 'test_data',
      label: '🧪 Dữ liệu chạy thử',
      prompt: 'Hãy cho mình một số bộ ví dụ dữ liệu chạy thử (input và output mong đợi) kèm giải thích cho đoạn code này.',
      instruction: 'test_data',
    },
    {
      id: 'pythonic',
      label: '⚡ Viết ngắn hơn (Pythonic)',
      prompt: 'Hãy viết lại đoạn mã này theo phong cách Pythonic ngắn gọn, tối ưu và đẹp mắt nhất chuẩn PEP 8.',
      instruction: 'pythonic',
    },
  ];

  // Helper to parse message content and render code blocks with copy/apply buttons
  const renderMessageContent = (text: string, msgId: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        let lang = 'python';
        let codeSnippet = part.slice(3, -3).trim();

        if (lines[0] && /^[a-zA-Z0-9_-]+$/.test(lines[0].trim())) {
          lang = lines[0].trim();
          codeSnippet = lines.slice(1).join('\n');
        }

        const snippetKey = `${msgId}_${index}`;
        const isCopied = copiedSnippetId === snippetKey;
        const isApplied = appliedSnippetId === snippetKey;

        return (
          <div key={index} className="my-2.5 rounded-xl overflow-hidden border border-[#3b3558] bg-[#0c0b14] shadow-md font-mono">
            {/* Code Block Header */}
            <div className="bg-[#181628] px-3 py-1.5 flex items-center justify-between border-b border-[#2d2844] text-[11px] text-gray-300 font-sans">
              <span className="flex items-center space-x-1.5 text-amber-300 font-mono font-bold">
                <Code2 className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang}</span>
              </span>

              <div className="flex items-center space-x-1.5">
                {/* Sao chép mã */}
                <button
                  onClick={() => handleCopySnippet(codeSnippet, snippetKey)}
                  className="px-2 py-0.5 rounded bg-[#25223a] hover:bg-[#342f52] text-gray-200 transition cursor-pointer flex items-center space-x-1"
                  title="Sao chép khối mã này"
                >
                  {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
                  <span>{isCopied ? 'Đã sao chép' : 'Sao chép'}</span>
                </button>

                {/* Áp dụng vào Editor */}
                <button
                  onClick={() => handleApplySnippet(codeSnippet, snippetKey)}
                  className={`px-2.5 py-0.5 rounded transition cursor-pointer flex items-center space-x-1 font-bold ${
                    isApplied
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-black shadow-sm'
                  }`}
                  title="Cập nhật trực tiếp đoạn mã này vào Trình soạn thảo"
                >
                  {isApplied ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Đã áp dụng!</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine className="w-3 h-3" />
                      <span>Áp dụng vào Editor</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Code Body */}
            <pre className="p-3 text-xs sm:text-sm text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed select-text font-mono">
              {codeSnippet}
            </pre>
          </div>
        );
      }

      // Plain text formatting (headers, bold, bullet points)
      return (
        <div key={index} className="whitespace-pre-wrap leading-relaxed text-xs sm:text-sm font-sans space-y-1">
          {part}
        </div>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="bg-[#141320] border-2 border-[#3b3457] rounded-2xl w-full max-w-2xl h-[92vh] max-h-[820px] flex flex-col text-gray-200 shadow-2xl overflow-hidden font-sans">
        {/* Header - Thiết kế chống tràn co giãn linh hoạt trên mobile */}
        <div className="h-14 border-b border-[#2c2742] px-2.5 sm:px-4 flex items-center justify-between shrink-0 bg-[#1b192c] gap-1.5 overflow-hidden">
          <div className="flex items-center space-x-2 min-w-0 flex-1 overflow-hidden">
            <img
              src="/src/assets/images/pydroid_app_icon_1794475208432.jpg"
              alt="Pydroid 3 Icon"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-xl object-cover shadow-md border border-amber-400/50 shrink-0"
            />
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center space-x-1.5 min-w-0">
                <h3 className="font-extrabold text-xs sm:text-base text-amber-300 truncate">
                  Trợ lý AI Lập trình Python
                </h3>
                <span className="px-1.5 py-0.5 bg-purple-900/60 border border-purple-500/40 text-purple-300 text-[9px] sm:text-[10px] font-bold rounded-full shrink-0">
                  Gemini AI
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-gray-400 flex items-center space-x-1 min-w-0 truncate">
                <FileCode className="w-3 h-3 text-sky-400 shrink-0" />
                <span className="truncate">Đang đọc: <strong className="text-gray-200">{currentFileName}</strong> ({currentCode.split('\n').length} dòng)</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0 z-10">
            {/* Cài đặt khóa API cho APK */}
            <button
              onClick={() => setShowKeyCard((prev) => !prev)}
              className={`p-1.5 sm:p-2 rounded-xl transition cursor-pointer shrink-0 ${
                showKeyCard || (!currentApiKey && inApk)
                  ? 'text-amber-400 bg-[#28233d] ring-1 ring-amber-400/50'
                  : 'text-gray-400 hover:text-amber-300 hover:bg-[#28233d]'
              }`}
              title={currentApiKey ? 'Quản lý khóa Gemini API Key' : 'Nhập khóa Gemini API Key (cho APK)'}
            >
              <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Làm mới cuộc trò chuyện */}
            <button
              onClick={handleResetChat}
              className="p-1.5 sm:p-2 text-gray-400 hover:text-amber-300 hover:bg-[#28233d] rounded-xl transition cursor-pointer shrink-0"
              title="Làm mới cuộc trò chuyện (Bắt đầu phiên làm việc mới)"
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Nút Đóng tab nổi bật - Luôn cố định, hiển thị rõ ràng 100% không bị che */}
            <button
              onClick={onClose}
              className="px-2.5 sm:px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow-md active:scale-95 shrink-0"
              title="Đóng tab Trợ lý AI"
            >
              <X className="w-3.5 h-3.5 text-white" />
              <span>Đóng tab</span>
            </button>
          </div>
        </div>

        {/* 🌟 CÁC TAB CHỨC NĂNG: SỬA LỖI CODE | GIẢI THÍCH | TỐI ƯU PEP 8 | DÒNG LỖI & NÚT ĐÓNG TAB */}
        <div className="bg-[#171526] border-b border-[#2b2640] px-3.5 py-2 flex items-center justify-between gap-2 shrink-0 select-none">
          <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex-1 shrink min-w-0">
            {/* 1. 🛠️ Nút SỬA LỖI CODE (Nổi bật, khắc phục hoàn toàn lỗi người dùng phản ánh) */}
            <button
              onClick={() => handleTriggerFixError(true)}
              disabled={isLoading}
              className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition active:scale-95 cursor-pointer shadow-sm shrink-0 ${
                activeFeature === 'fix_error'
                  ? 'bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 text-white border border-rose-400/80 shadow-rose-950/70 ring-2 ring-rose-400/60 font-black'
                  : 'bg-[#251824] hover:bg-[#341e32] text-rose-300 border border-[#4d243a]'
              }`}
              title="Phát hiện và sửa toàn bộ lỗi trong code, tạo mã mới chuẩn 100% để nạp vào Editor"
            >
              <Bug className="w-3.5 h-3.5 text-yellow-300" />
              <span>Sửa lỗi code</span>
              {activeFeature === 'fix_error' && (
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse ml-0.5" />
              )}
            </button>

            {/* 2. Nút Giải thích mã nguồn */}
            <button
              onClick={() => handleTriggerExplainCode(true)}
              disabled={isLoading}
              className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition active:scale-95 cursor-pointer shadow-sm shrink-0 ${
                activeFeature === 'explain'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border border-purple-400/60 shadow-purple-950/60 ring-1 ring-purple-400/50'
                  : 'bg-[#221f36] hover:bg-[#2e2a48] text-purple-200 border border-[#3b3456]'
              }`}
              title="Giải thích chi tiết toàn bộ mã nguồn hiện tại bằng tiếng Việt"
            >
              <BookOpen className="w-3.5 h-3.5 text-yellow-300" />
              <span>Giải thích</span>
              {activeFeature === 'explain' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
              )}
            </button>

            {/* 3. Nút Tối ưu PEP 8 */}
            <button
              onClick={() => handleTriggerOptimizePep8(true)}
              disabled={isLoading}
              className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition active:scale-95 cursor-pointer shadow-sm shrink-0 ${
                activeFeature === 'pep8'
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-black border border-amber-300 shadow-amber-500/30 ring-1 ring-amber-400/50 font-black'
                  : 'bg-[#221f36] hover:bg-[#2e2a48] text-amber-300 border border-[#3b3456]'
              }`}
              title="Chuẩn hóa thụt lề, biến snake_case và tối ưu mã nguồn theo tiêu chuẩn PEP 8 của Python"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current text-amber-400" />
              <span>Tối ưu PEP 8</span>
              {activeFeature === 'pep8' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
              )}
            </button>

            {/* 4. 🐞 Nút Phân tích lỗi dòng nào */}
            <button
              onClick={() => handleTriggerAnalyzeFixClean(true)}
              disabled={isLoading}
              className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition active:scale-95 cursor-pointer shadow-sm shrink-0 ${
                activeFeature === 'analyze_fix_clean'
                  ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white border border-rose-300 shadow-rose-950/60 ring-1 ring-rose-400/50 font-black'
                  : 'bg-[#221f36] hover:bg-[#2e2a48] text-rose-300 border border-[#4a2432]'
              }`}
              title="Chỉ rõ lỗi ở dòng nào và viết ra code mới ngắn gọn, sạch sẽ hơn code hiện tại"
            >
              <Bug className="w-3.5 h-3.5 text-rose-300" />
              <span>Lỗi dòng nào</span>
              {activeFeature === 'analyze_fix_clean' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3.5 bg-[#0e0d17]">
          {/* Key Notice */}
          {keyNotice && (
            <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs px-3 py-2 rounded-xl flex items-center justify-between">
              <span>{keyNotice}</span>
            </div>
          )}

          {/* Inline Gemini API Key Setup Card for Android APK / Standalone */}
          {showKeyCard && (
            <div className="bg-[#1b172e] border border-amber-500/40 rounded-xl p-3 text-xs space-y-2 shadow-lg animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 flex items-center space-x-1.5">
                  <Key className="w-3.5 h-3.5" />
                  <span>Kích hoạt Gemini AI trực tuyến trên APK</span>
                </span>
                <button
                  onClick={() => setShowKeyCard(false)}
                  className="text-gray-400 hover:text-gray-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-gray-300 text-[11px] leading-relaxed">
                {currentApiKey
                  ? `Khóa hiện tại: ••••••••••••${currentApiKey.slice(-4)}. Bạn có thể dán khóa mới nếu khóa cũ đạt hạn mức (Quota 429):`
                  : 'Bản APK Android chạy trực tiếp trên thiết bị. Vui lòng dán khóa Gemini API Key miễn phí:'}
              </p>
              <div className="flex items-center space-x-1.5">
                <input
                  type="password"
                  value={inlineKeyInput}
                  onChange={(e) => setInlineKeyInput(e.target.value)}
                  placeholder="Dán AIzaSy... vào đây"
                  className="flex-1 bg-[#0f0d1b] border border-[#3b3558] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 font-mono"
                />
                <button
                  onClick={handleSaveInlineKey}
                  disabled={!inlineKeyInput.trim()}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-bold rounded-lg cursor-pointer transition shrink-0"
                >
                  Lưu
                </button>
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-400 hover:underline flex items-center space-x-1"
                >
                  <span>Lấy khóa Gemini miễn phí 100% tại AI Studio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span>Chế độ ngoại tuyến PEP 8 luôn sẵn sàng</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('pydroid:run-gemini-diagnostic'));
                  }
                }}
                className="w-full mt-1 py-1.5 px-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                <span>Chạy chẩn đoán API ra Terminal</span>
              </button>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                    isUser
                      ? 'bg-amber-400 text-black font-bold'
                      : 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 fill-current" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[88%] sm:max-w-[82%] rounded-2xl p-3 shadow-md ${
                    isUser
                      ? 'bg-[#2b2444] border border-purple-500/30 text-white rounded-tr-none'
                      : 'bg-[#181628] border border-[#342f4e] text-gray-100 rounded-tl-none'
                  }`}
                >
                  {renderMessageContent(msg.text, msg.id)}
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                <Bot className="w-4 h-4 fill-current" />
              </div>
              <div className="bg-[#181628] border border-[#342f4e] rounded-2xl rounded-tl-none p-3 text-xs text-amber-300 flex items-center space-x-2 shadow-md">
                <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>
                  {activeFeature === 'pep8'
                    ? 'Gemini AI đang tối ưu hóa mã nguồn theo tiêu chuẩn PEP 8...'
                    : activeFeature === 'analyze_fix_clean'
                    ? 'Gemini AI đang kiểm tra từng dòng, chỉ rõ dòng lỗi và viết lại code mới ngắn gọn, sạch sẽ...'
                    : 'Gemini AI đang phân tích và giải thích toàn diện mã nguồn...'}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Chips Bar (Gợi ý câu hỏi nhanh) */}
        <div className="bg-[#151322] px-3 py-2 border-t border-[#2a253e] flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden shrink-0 select-none">
          <span className="text-[10px] uppercase font-bold text-gray-400 shrink-0 mr-1 flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Mẫu câu hỏi:</span>
          </span>
          {quickChips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => {
                setInputText(chip.prompt);
                inputRef.current?.focus();
              }}
              className="px-2.5 py-1 rounded-full bg-[#201d33] hover:bg-[#302b4c] active:bg-amber-400 active:text-black text-gray-200 border border-[#3a3454] hover:border-amber-400/60 text-xs font-medium whitespace-nowrap transition cursor-pointer"
              title="Điền câu hỏi này vào ô chat để tự do chỉnh sửa hoặc gửi"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-[#191729] border-t border-[#2c2742] shrink-0 space-y-1.5">
          {/* Header thanh công cụ ô chat */}
          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-gray-400 px-1">
            <div className="flex items-center space-x-1.5 flex-wrap">
              <span className="flex items-center space-x-1 text-amber-300 font-medium">
                <span>✏️ Ô chat câu hỏi:</span>
              </span>
              {isSavedFeedback ? (
                <span className="px-2 py-0.5 rounded-md bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-[10px] font-bold flex items-center space-x-1 animate-in fade-in shadow-sm">
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Đã lưu câu mặc định!</span>
                </span>
              ) : savedCustomPrompt !== DEFAULT_EXPLAIN_PROMPT ? (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30">
                  Đã lưu câu riêng
                </span>
              ) : null}
            </div>

            <div className="flex items-center space-x-2 flex-wrap">
              {/* Nút bấm lưu câu hiện tại làm mặc định */}
              {inputText.trim() && inputText.trim() !== savedCustomPrompt && (
                <button
                  type="button"
                  onClick={() => handleSaveAsDefault()}
                  className="px-2.5 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-extrabold text-[10px] transition cursor-pointer flex items-center space-x-1 shadow-sm active:scale-95"
                  title="Lưu câu hỏi bạn vừa chỉnh sửa làm câu mặc định cho các lần sau"
                >
                  <Save className="w-3 h-3" />
                  <span>Lưu câu này</span>
                </button>
              )}

              {/* Nút khôi phục câu gốc hệ thống */}
              {savedCustomPrompt !== DEFAULT_EXPLAIN_PROMPT && (
                <button
                  type="button"
                  onClick={handleResetToSystemDefault}
                  className="text-gray-400 hover:text-amber-300 underline transition cursor-pointer text-[10px]"
                  title="Khôi phục câu hỏi ban đầu của hệ thống: Hãy giải thích chi tiết..."
                >
                  Khôi phục gốc
                </button>
              )}

              {/* Nút nạp lại câu đã lưu nếu đang gõ dở câu khác */}
              {inputText !== savedCustomPrompt && (
                <button
                  type="button"
                  onClick={() => {
                    setInputText(savedCustomPrompt);
                    inputRef.current?.focus();
                  }}
                  className="text-amber-400 hover:text-amber-300 underline transition cursor-pointer text-[10px]"
                  title="Nạp lại câu hỏi mặc định đã lưu của bạn"
                >
                  Nạp câu đã lưu
                </button>
              )}

              {/* Nút xóa trắng */}
              {inputText && (
                <button
                  type="button"
                  onClick={() => {
                    setInputText('');
                    inputRef.current?.focus();
                  }}
                  className="text-gray-400 hover:text-rose-300 transition cursor-pointer text-[10px] flex items-center space-x-0.5"
                  title="Xoá trắng nội dung ô chat"
                >
                  <X className="w-3 h-3" />
                  <span>Xoá</span>
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onBlur={() => {
                  if (inputText.trim() && inputText.trim() !== savedCustomPrompt) {
                    handleSaveAsDefault(inputText.trim());
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Nhập hoặc tự do chỉnh sửa câu hỏi cho Trợ lý AI (nhấn Enter để gửi)..."
                className="w-full bg-[#100f1a] text-gray-100 text-xs sm:text-sm p-2.5 pr-8 rounded-xl border border-[#36304f] focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition resize-none leading-relaxed"
              />
              {inputText && (
                <button
                  type="button"
                  onClick={() => {
                    setInputText('');
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-200 p-0.5 rounded transition cursor-pointer"
                  title="Xoá nhanh nội dung ô chat"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="px-4 py-2.5 h-[54px] bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-black font-extrabold rounded-xl text-xs transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-amber-500/20 flex flex-col items-center justify-center space-y-0.5 cursor-pointer shrink-0"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px]">Đang gửi</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span className="text-[10px]">Gửi (Enter)</span>
                </>
              )}
            </button>
          </form>

          <div className="flex items-center text-[10px] text-gray-400 px-1 pt-0.5">
            <span className="truncate">💡 Nhấn <kbd className="px-1 py-0.5 bg-[#25213b] text-gray-300 rounded text-[9px] font-mono">Enter</kbd> gửi, <kbd className="px-1 py-0.5 bg-[#25213b] text-gray-300 rounded text-[9px] font-mono">Shift+Enter</kbd> xuống dòng</span>
          </div>
        </div>
      </div>
    </div>
  );
};
