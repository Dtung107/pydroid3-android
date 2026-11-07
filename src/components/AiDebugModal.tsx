import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Check,
  Play,
  Copy,
  AlertTriangle,
  Lightbulb,
  Code,
  ArrowRight,
} from 'lucide-react';
import { AiDebugResult } from '../types';

interface AiDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: AiDebugResult | null;
  isLoading: boolean;
  onApplyCode: (code: string) => void;
  onApplyAndRun: (code: string) => void;
}

export const AiDebugModal: React.FC<AiDebugModalProps> = ({
  isOpen,
  onClose,
  result,
  isLoading,
  onApplyCode,
  onApplyAndRun,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!result?.fixedCode) return;
    navigator.clipboard.writeText(result.fixedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 animate-in fade-in">
      <div className="bg-[#1b1b26] border border-[#3e3b5e] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col text-gray-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-14 border-b border-[#312f4c] px-4 flex items-center justify-between shrink-0 bg-gradient-to-r from-[#241f38] to-[#1e1c2e]">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-gradient-to-tr from-amber-400 to-yellow-500 rounded-lg text-black shadow-sm">
              <Sparkles className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-amber-300">
                Trình Gỡ Lỗi Thông Minh Gemini AI
              </h2>
              <p className="text-[10px] text-gray-400">
                Phân tích lỗi Traceback & Đề xuất chuẩn PEP 8
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-[#251f35] hover:bg-rose-950/90 text-rose-300 hover:text-white border border-rose-500/50 hover:border-rose-400 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-sm active:scale-95"
            title="Đóng tab Gỡ lỗi AI"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Đóng tab</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-amber-300 font-medium animate-pulse">
                Gemini AI đang phân tích Traceback và tạo mã sửa chữa...
              </p>
            </div>
          ) : result ? (
            <>
              {/* Error Badge & Summary */}
              <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl space-y-1.5">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 bg-red-600/80 text-white font-mono font-bold text-xs rounded">
                    {result.errorType || 'Lỗi Thực Thi'}
                  </span>
                  <span className="text-red-300 font-semibold text-xs">
                    {result.vietnameseSummary}
                  </span>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed pl-1">
                  {result.rootCause}
                </p>
              </div>

              {/* PEP 8 Tips */}
              {result.tips && result.tips.length > 0 && (
                <div className="p-3 bg-[#20202e] border border-[#373552] rounded-xl space-y-2">
                  <div className="flex items-center space-x-1.5 text-amber-400 font-bold text-xs">
                    <Lightbulb className="w-4 h-4" />
                    <span>Mẹo sửa lỗi & Chuẩn PEP 8:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-gray-300 text-xs pl-1">
                    {result.tips.map((tip, idx) => (
                      <li key={idx} className="leading-snug">{tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Diff Explanation */}
              {result.diffExplanation && (
                <div className="text-[11px] text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 p-2.5 rounded-lg">
                  <span className="font-bold">Điểm thay đổi quan trọng: </span>
                  <span>{result.diffExplanation}</span>
                </div>
              )}

              {/* Fixed Code Block */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-300 text-xs flex items-center space-x-1">
                    <Code className="w-3.5 h-3.5 text-sky-400" />
                    <span>Mã Python Đã Sửa Chuẩn (PEP 8):</span>
                  </span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center space-x-1 px-2 py-1 bg-[#28283a] hover:bg-[#34344c] text-gray-300 rounded text-[11px] transition"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3 bg-[#111118] border border-[#2d2d3e] rounded-xl font-mono text-xs text-sky-300 max-h-56 overflow-auto whitespace-pre leading-relaxed select-text">
                  {result.fixedCode}
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-gray-400">
              Không có dữ liệu gỡ lỗi. Vui lòng chạy mã và bấm Gỡ lỗi khi có lỗi xảy ra.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="h-16 border-t border-[#312f4c] px-4 flex items-center justify-between space-x-2 shrink-0 bg-[#201d30]">
          <button
            onClick={onClose}
            className="px-3.5 py-2 bg-[#2d2235] hover:bg-rose-950/80 text-rose-300 hover:text-white font-bold rounded-xl text-xs transition border border-rose-500/50 flex items-center space-x-1.5 cursor-pointer active:scale-95 shadow-sm"
          >
            <X className="w-4 h-4" />
            <span>Đóng tab</span>
          </button>

          {result && !isLoading && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  onApplyCode(result.fixedCode);
                  onClose();
                }}
                className="px-3.5 py-2 bg-[#2d2a45] hover:bg-[#393558] text-gray-200 font-medium rounded-xl text-xs transition border border-[#48436e] active:scale-95 cursor-pointer"
              >
                Áp dụng vào Soạn thảo
              </button>

              <button
                onClick={() => {
                  onApplyAndRun(result.fixedCode);
                  onClose();
                }}
                className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-extrabold rounded-xl text-xs transition shadow-md active:scale-95 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Áp dụng & Chạy lại ngay</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
