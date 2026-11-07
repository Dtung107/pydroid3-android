import React, { useState } from 'react';
import { Palette, X, RotateCcw, Check, Sparkles } from 'lucide-react';
import { SyntaxColors } from '../types';
import { highlightPythonCode } from '../utils/highlighter';
import { DEFAULT_CUSTOM_COLORS } from '../constants/themes';

interface ColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  colors: SyntaxColors;
  onUpdateColors: (newColors: SyntaxColors) => void;
}

const PREVIEW_CODE = `# Xem trước bộ màu Python tùy chỉnh
import math

class Calculator:
    def __init__(self, name: str):
        self.name = name  # Tên thiết bị

    def calc_circle(self, radius: float) -> float:
        """Tính diện tích hình tròn."""
        if radius <= 0:
            return 0.0
        return math.pi * (radius ** 2)

calc = Calculator("Pydroid 3")
result = calc.calc_circle(5.5)
print(f"Diện tích: {result:.2f}")
`;

// Quick color presets suitable for touch screen
const QUICK_PALETTE = [
  '#ff7b72', '#f43f5e', '#ef4444', '#f97316', '#fbbf24',
  '#eab308', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
  '#38bdf8', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#d946ef', '#ec4899', '#f8fafc', '#94a3b8', '#18181b',
];

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  isOpen,
  onClose,
  colors,
  onUpdateColors,
}) => {
  const [activeProperty, setActiveProperty] = useState<keyof SyntaxColors>('keyword');

  if (!isOpen) return null;

  const colorItems: { key: keyof SyntaxColors; label: string; desc: string }[] = [
    { key: 'keyword', label: 'Từ khóa (Keywords)', desc: 'def, class, if, for, import, return...' },
    { key: 'builtin', label: 'Hàm & Hằng có sẵn (Builtins)', desc: 'print, input, range, len, True, None...' },
    { key: 'string', label: 'Chuỗi văn bản (Strings)', desc: '"Hello", \'Python\', """docstring"""...' },
    { key: 'number', label: 'Số học (Numbers)', desc: '123, 3.14, 0xFF...' },
    { key: 'comment', label: 'Chú thích (Comments)', desc: '# Đây là dòng chú thích...' },
    { key: 'function', label: 'Tên hàm (Functions)', desc: 'my_func(), calculate()...' },
    { key: 'variable', label: 'Biến & Định danh (Variables)', desc: 'total, user_name, x, y...' },
    { key: 'operator', label: 'Toán tử (Operators)', desc: '+, -, *, /, =, ==, :, <, >...' },
    { key: 'background', label: 'Màu nền Editor (Background)', desc: 'Màu nền của trình soạn thảo' },
    { key: 'foreground', label: 'Văn bản thường (Foreground)', desc: 'Ký tự thông thường, dấu ngoặc' },
    { key: 'lineHighlight', label: 'Đường highlight dòng (Line Highlight)', desc: 'Vạch màu của dòng hiện tại' },
  ];

  const handleColorChange = (newColor: string) => {
    onUpdateColors({
      ...colors,
      [activeProperty]: newColor,
    });
  };

  const handleReset = () => {
    onUpdateColors({ ...DEFAULT_CUSTOM_COLORS });
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-3 animate-in fade-in">
      <div className="bg-[#1a1a26] border border-[#3b3858] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col text-gray-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-14 border-b border-[#302e48] px-4 flex items-center justify-between shrink-0 bg-[#222134]">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-gradient-to-tr from-amber-400 to-pink-500 rounded-lg text-black shadow-sm">
              <Palette className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-amber-300">
                Tô Màu Văn Bản (Custom Color Designer)
              </h2>
              <p className="text-[10px] text-gray-400">
                Tự do cá nhân hóa màu sắc từng thành phần mã Python
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
          {/* Live Preview Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-gray-300 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Khung Xem Trước Trực Tiếp (Live Preview):</span>
              </span>
              <span className="text-[11px] text-gray-400">Đổi màu tức thì theo thời gian thực</span>
            </div>

            <div
              className="p-3.5 rounded-xl border border-[#333348] font-mono text-xs overflow-auto max-h-48 whitespace-pre leading-relaxed shadow-inner"
              style={{
                backgroundColor: colors.background,
                color: colors.foreground,
              }}
              dangerouslySetInnerHTML={{
                __html: highlightPythonCode(PREVIEW_CODE, colors),
              }}
            />
          </div>

          {/* Active Property Color Controller */}
          <div className="p-3.5 bg-[#212030] rounded-xl border border-[#383652] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-gray-200 text-sm">
                  {colorItems.find((c) => c.key === activeProperty)?.label}
                </span>
                <p className="text-[11px] text-gray-400">
                  {colorItems.find((c) => c.key === activeProperty)?.desc}
                </p>
              </div>

              {/* Native HTML Color Input */}
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold text-amber-300">
                  {colors[activeProperty]}
                </span>
                <input
                  type="color"
                  value={colors[activeProperty]}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-9 h-9 rounded-lg border-2 border-[#4a476c] cursor-pointer bg-transparent"
                />
              </div>
            </div>

            {/* Quick Touch Color Palette */}
            <div>
              <span className="text-[11px] text-gray-400 block mb-1.5 font-medium">
                Bảng màu nhanh 1 chạm (Quick Swatches):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PALETTE.map((hex, idx) => (
                  <button
                    key={`${hex}-${idx}`}
                    onClick={() => handleColorChange(hex)}
                    className={`w-6 h-6 rounded-md border transition-transform active:scale-90 ${
                      colors[activeProperty].toLowerCase() === hex.toLowerCase()
                        ? 'ring-2 ring-white scale-110'
                        : 'border-black/30'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Property Selector Grid */}
          <div>
            <label className="block text-gray-300 font-semibold mb-2">
              Chọn thành phần cần đổi màu:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {colorItems.map((item) => {
                const isSelected = activeProperty === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveProperty(item.key)}
                    className={`p-2 rounded-xl text-left border flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm'
                        : 'bg-[#181824] border-[#2c2b3e] text-gray-300 hover:bg-[#222132]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="font-semibold truncate text-[11px]">{item.label}</div>
                      <div className="text-[10px] text-gray-400 font-mono truncate">
                        {colors[item.key]}
                      </div>
                    </div>
                    <div
                      className="w-5 h-5 rounded-md border border-white/20 shrink-0 ml-1 shadow-sm"
                      style={{ backgroundColor: colors[item.key] }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-14 border-t border-[#302e48] px-4 flex items-center justify-between shrink-0 bg-[#222134]">
          <button
            onClick={handleReset}
            className="flex items-center space-x-1.5 text-xs text-gray-400 hover:text-red-400 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khôi phục mặc định</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-black font-extrabold rounded-xl text-xs transition shadow-md"
          >
            Xong & Lưu
          </button>
        </div>
      </div>
    </div>
  );
};
