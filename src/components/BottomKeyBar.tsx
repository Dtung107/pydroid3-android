import React, { useState, useRef, useEffect } from 'react';
import {
  Settings2,
  Eye,
  EyeOff,
  RotateCcw,
  X,
  ChevronUp,
  ChevronDown,
  ArrowUpToLine,
  SlidersHorizontal,
  GripHorizontal,
  Save,
  Plus,
  Trash2,
  Check,
  Copy,
  Download,
  Upload,
  User,
  Sparkles,
  Search,
} from 'lucide-react';
import { KeyItem, KeySize } from '../types';
import {
  DEFAULT_MOBILE_KEYS,
  MATH_LOGIC_KEYS_PRESET,
  FLOW_CONTROL_KEYS_PRESET,
  MINIMAL_KEYS_PRESET,
  COMMON_CUSTOM_KEY_SUGGESTIONS,
} from '../constants/defaultKeys';

interface BottomKeyBarProps {
  keys: KeyItem[];
  onKeyPress: (value: string) => void;
  keySize: KeySize;
  onUpdateKeySize: (size: KeySize) => void;
  onUpdateKeys: (keys: KeyItem[]) => void;
  onResetKeys: () => void;
  onSaveConfig?: (keys: KeyItem[], keySize: KeySize) => void;
}

export const BottomKeyBar: React.FC<BottomKeyBarProps> = ({
  keys,
  onKeyPress,
  keySize,
  onUpdateKeySize,
  onUpdateKeys,
  onResetKeys,
  onSaveConfig,
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'char' | 'keyword' | 'action' | 'custom'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);

  // New custom key form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyInsert, setNewKeyInsert] = useState('');
  const [newKeyType, setNewKeyType] = useState<'char' | 'keyword' | 'action'>('keyword');

  // JSON Export / Import state
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonString, setJsonString] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Drag and drop states
  const [draggedKeyId, setDraggedKeyId] = useState<string | null>(null);
  const [dropTargetKeyId, setDropTargetKeyId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Touch drag tracking ref (ZERO vibration, accurate gesture separation)
  const touchStateRef = useRef<{
    keyId: string | null;
    startX: number;
    startY: number;
    startTime: number;
    isDragging: boolean;
    hasMoved: boolean;
    timer: any;
  }>({
    keyId: null,
    startX: 0,
    startY: 0,
    startTime: 0,
    isDragging: false,
    hasMoved: false,
    timer: null,
  });

  // Timestamp of the most recent swipe/scroll gesture to block accidental taps
  const lastScrollTimestampRef = useRef<number>(0);

  // Guard against duplicate event firing (touchend + synthetic click)
  const lastPressRef = useRef<{ value: string; timestamp: number }>({ value: '', timestamp: 0 });

  // Clear save message timeout on unmount
  useEffect(() => {
    if (saveStatusMessage) {
      const timer = setTimeout(() => setSaveStatusMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [saveStatusMessage]);

  // Height, padding, and font classes based on keySize
  const sizeClasses = {
    small: 'h-8 px-2 text-xs min-w-[36px]',
    medium: 'h-9 px-2.5 text-sm min-w-[42px]',
    large: 'h-11 px-3.5 text-base min-w-[48px] font-bold',
  }[keySize];

  // Save current configuration to localStorage and notify parent
  const handleSaveConfiguration = () => {
    try {
      localStorage.setItem('pydroid_keys', JSON.stringify(keys));
      localStorage.setItem('pydroid_key_size', keySize);
      if (onSaveConfig) {
        onSaveConfig(keys, keySize);
      }
      setSaveStatusMessage('Đã lưu cấu hình phím tắt người dùng thành công!');
    } catch (e) {
      setSaveStatusMessage('Lỗi khi lưu cấu hình');
    }
  };

  // Save as custom user personal profile
  const handleSaveUserProfile = () => {
    try {
      localStorage.setItem('pydroid_user_profile_keys', JSON.stringify(keys));
      localStorage.setItem('pydroid_user_profile_key_size', keySize);
      setSaveStatusMessage('Đã lưu cấu hình này vào "Hồ sơ phím tắt cá nhân" của bạn!');
    } catch (e) {
      setSaveStatusMessage('Không thể lưu hồ sơ cá nhân');
    }
  };

  // Load from custom user personal profile
  const handleLoadUserProfile = () => {
    const saved = localStorage.getItem('pydroid_user_profile_keys');
    const savedSize = localStorage.getItem('pydroid_user_profile_key_size') as KeySize | null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          onUpdateKeys(parsed);
          if (savedSize) onUpdateKeySize(savedSize);
          localStorage.setItem('pydroid_keys', JSON.stringify(parsed));
          if (savedSize) localStorage.setItem('pydroid_key_size', savedSize);
          setSaveStatusMessage('Đã nạp lại "Hồ sơ phím tắt cá nhân" của bạn thành công!');
          return;
        }
      } catch (e) {
        // ignore
      }
    }
    setSaveStatusMessage('Chưa có hồ sơ cá nhân nào được lưu trước đó.');
  };

  // Apply a preset
  const handleApplyPreset = (presetKeys: KeyItem[], presetName: string) => {
    onUpdateKeys(presetKeys);
    localStorage.setItem('pydroid_keys', JSON.stringify(presetKeys));
    setSaveStatusMessage(`Đã áp dụng mẫu: ${presetName}`);
  };

  // Reorder keys helper
  const reorderKeys = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const sourceIdx = keys.findIndex((k) => k.id === sourceId);
    const targetIdx = keys.findIndex((k) => k.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const newKeys = [...keys];
    const [moved] = newKeys.splice(sourceIdx, 1);
    newKeys.splice(targetIdx, 0, moved);
    onUpdateKeys(newKeys);
    localStorage.setItem('pydroid_keys', JSON.stringify(newKeys));
  };

  // Move key up/down (left/right in bar)
  const moveKey = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= keys.length) return;

    const newKeys = [...keys];
    const [moved] = newKeys.splice(index, 1);
    newKeys.splice(targetIndex, 0, moved);
    onUpdateKeys(newKeys);
    localStorage.setItem('pydroid_keys', JSON.stringify(newKeys));
  };

  // Move key to the very front
  const moveToFront = (index: number) => {
    if (index === 0) return;
    const newKeys = [...keys];
    const [moved] = newKeys.splice(index, 1);
    newKeys.unshift(moved);
    onUpdateKeys(newKeys);
    localStorage.setItem('pydroid_keys', JSON.stringify(newKeys));
  };

  // Toggle key visibility
  const toggleKeyVisibility = (id: string) => {
    const updated = keys.map((k) => (k.id === id ? { ...k, visible: !k.visible } : k));
    onUpdateKeys(updated);
    localStorage.setItem('pydroid_keys', JSON.stringify(updated));
  };

  // Delete a key
  const handleDeleteKey = (id: string) => {
    const updated = keys.filter((k) => k.id !== id);
    onUpdateKeys(updated);
    localStorage.setItem('pydroid_keys', JSON.stringify(updated));
    setSaveStatusMessage('Đã xóa phím tắt khỏi thanh.');
  };

  // Add a new custom key
  const handleAddNewCustomKey = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const label = newKeyLabel.trim();
    const insertVal = newKeyInsert;
    if (!label) return;

    const newKey: KeyItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      label,
      insertValue: insertVal || label,
      visible: true,
      type: newKeyType,
      isCustom: true,
    };

    const updated = [newKey, ...keys];
    onUpdateKeys(updated);
    localStorage.setItem('pydroid_keys', JSON.stringify(updated));
    setNewKeyLabel('');
    setNewKeyInsert('');
    setShowAddForm(false);
    setSaveStatusMessage(`Đã thêm phím tắt "${label}" vào đầu thanh!`);
  };

  // Quick suggestion click to add
  const handleAddSuggestion = (sug: { label: string; insertValue: string; type: 'char' | 'keyword' | 'action' }) => {
    const exists = keys.some((k) => k.label === sug.label);
    if (exists) {
      setSaveStatusMessage(`Phím "${sug.label}" đã có sẵn trong danh sách!`);
      return;
    }
    const newKey: KeyItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      label: sug.label,
      insertValue: sug.insertValue,
      visible: true,
      type: sug.type,
      isCustom: true,
    };
    const updated = [newKey, ...keys];
    onUpdateKeys(updated);
    localStorage.setItem('pydroid_keys', JSON.stringify(updated));
    setSaveStatusMessage(`Đã thêm nhanh phím "${sug.label}"!`);
  };

  // Export JSON configuration
  const handleOpenExportJson = () => {
    setJsonString(JSON.stringify(keys, null, 2));
    setJsonError(null);
    setShowJsonModal(true);
  };

  // Import JSON configuration
  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].label) {
        onUpdateKeys(parsed);
        localStorage.setItem('pydroid_keys', JSON.stringify(parsed));
        setShowJsonModal(false);
        setSaveStatusMessage('Đã nhập và lưu cấu hình JSON thành công!');
      } else {
        setJsonError('Định dạng JSON không hợp lệ (cần danh sách các phím có id, label, insertValue)');
      }
    } catch (e: any) {
      setJsonError(`Lỗi cú pháp JSON: ${e?.message || 'Không thể đọc dữ liệu'}`);
    }
  };

  // Check if a key is a mathematical or logical operator
  const isOperatorKey = (label: string) => {
    return [
      '\\',
      '>=',
      '<=',
      '==',
      '!=',
      '->',
      '**',
      '//',
      '+=',
      '-=',
      '+',
      '-',
      '*',
      '/',
      '%',
      '<',
      '>',
      '&',
      '|',
      '^',
      '~',
    ].includes(label);
  };

  // Get distinct border and background styling per key type
  const getKeyStyle = (k: KeyItem) => {
    if (k.isCustom) {
      return 'border-2 border-emerald-400 bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-300 font-extrabold shadow-[0_2px_0_0_#062315] hover:border-emerald-300';
    }
    if (k.type === 'action') {
      return 'border-2 border-amber-400 bg-amber-500/25 hover:bg-amber-500/40 text-amber-300 font-extrabold shadow-[0_2px_0_0_#1a1407] hover:border-amber-300';
    }
    if (k.type === 'keyword') {
      return 'border-2 border-purple-500/60 bg-[#251c33] hover:bg-[#322547] text-purple-200 font-semibold shadow-[0_2px_0_0_#150e20] hover:border-purple-400';
    }
    if (isOperatorKey(k.label)) {
      return 'border-2 border-amber-500/50 bg-[#262016] hover:bg-[#352a1b] text-amber-300 font-bold shadow-[0_2px_0_0_#161108] hover:border-amber-400';
    }
    return 'border-2 border-[#474563] bg-[#201f2e] hover:bg-[#2c2a40] text-gray-100 font-bold shadow-[0_2px_0_0_#12111b] hover:border-amber-400';
  };

  /* ------------------- TOUCH DRAG & DROP FOR MOBILE (NO VIBRATION) ------------------- */
  const handleTouchStart = (e: React.TouchEvent, keyId: string) => {
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    const startTime = Date.now();

    if (touchStateRef.current.timer) {
      clearTimeout(touchStateRef.current.timer);
    }

    // Activate drag reorder only after holding steady for 350ms (Completely NO vibration)
    const timer = setTimeout(() => {
      if (!touchStateRef.current.hasMoved) {
        touchStateRef.current.isDragging = true;
        setDraggedKeyId(keyId);
      }
    }, 350);

    touchStateRef.current = {
      keyId,
      startX,
      startY,
      startTime,
      isDragging: false,
      hasMoved: false,
      timer,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStateRef.current.startX);
    const dy = Math.abs(touch.clientY - touchStateRef.current.startY);

    // If moved (>= 5px), immediately flag hasMoved = true & record scroll timestamp
    if (dx >= 5 || dy >= 5) {
      touchStateRef.current.hasMoved = true;
      lastScrollTimestampRef.current = Date.now();

      // Cancel drag reorder timer so user can smoothly swipe/scroll the bar
      if (!touchStateRef.current.isDragging && touchStateRef.current.timer) {
        clearTimeout(touchStateRef.current.timer);
        touchStateRef.current.timer = null;
      }
    }

    // If dragging is active (long press reorder): prevent browser scroll & track element under finger
    if (touchStateRef.current.isDragging && touchStateRef.current.keyId) {
      if (e.cancelable) {
        e.preventDefault();
      }

      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      const keyElem = elem?.closest('[data-key-id]');
      if (keyElem) {
        const targetId = keyElem.getAttribute('data-key-id');
        if (targetId && targetId !== touchStateRef.current.keyId) {
          setDropTargetKeyId(targetId);
        }
      }
    }
  };

  const executeKeyPress = (insertValue: string) => {
    const now = Date.now();
    // NEVER insert key if user was just swiping / scrolling the bar within 350ms
    if (now - lastScrollTimestampRef.current < 350) {
      return;
    }
    // Guard against duplicate event triggers within 280ms
    if (now - lastPressRef.current.timestamp < 280 && lastPressRef.current.value === insertValue) {
      return;
    }
    lastPressRef.current = { value: insertValue, timestamp: now };
    onKeyPress(insertValue);
  };

  const handleTouchEnd = (e: React.TouchEvent, k: KeyItem) => {
    if (touchStateRef.current.timer) {
      clearTimeout(touchStateRef.current.timer);
      touchStateRef.current.timer = null;
    }

    const wasDragging = touchStateRef.current.isDragging;
    const wasMoved = touchStateRef.current.hasMoved;
    const sourceId = touchStateRef.current.keyId;
    const targetId = dropTargetKeyId;

    // Reset touch state
    touchStateRef.current.isDragging = false;
    touchStateRef.current.hasMoved = false;
    touchStateRef.current.keyId = null;

    if (wasDragging) {
      if (sourceId && targetId && sourceId !== targetId) {
        reorderKeys(sourceId, targetId);
      }

      setDraggedKeyId(null);
      setDropTargetKeyId(null);
      lastScrollTimestampRef.current = Date.now();
      return;
    }

    // CRITICAL: If the user swiped / scrolled the shortcut bar, DO NOT INSERT CHARACTER!
    if (wasMoved || Date.now() - lastScrollTimestampRef.current < 350) {
      lastScrollTimestampRef.current = Date.now();
      return;
    }

    // Quick tap: insert key exactly once and cancel synthetic click event (NO vibration)
    if (e.cancelable) {
      e.preventDefault();
    }
    executeKeyPress(k.insertValue);
  };

  /* ------------------- HTML5 DRAG & DROP FOR DESKTOP ------------------- */
  const handleDragStart = (e: React.DragEvent, keyId: string) => {
    setDraggedKeyId(keyId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', keyId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedKeyId && draggedKeyId !== targetId) {
      setDropTargetKeyId(targetId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedKeyId && targetId && draggedKeyId !== targetId) {
      reorderKeys(draggedKeyId, targetId);
    }
    setDraggedKeyId(null);
    setDropTargetKeyId(null);
  };

  const handleDragEnd = () => {
    setDraggedKeyId(null);
    setDropTargetKeyId(null);
  };

  const visibleKeys = keys.filter((k) => k.visible);

  const filteredKeysForConfig = keys.filter((k) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchLabel = k.label.toLowerCase().includes(q);
      const matchVal = k.insertValue.toLowerCase().includes(q);
      if (!matchLabel && !matchVal) return false;
    }
    if (filterType === 'all') return true;
    if (filterType === 'custom') return !!k.isCustom;
    if (filterType === 'char') return k.type === 'char';
    if (filterType === 'keyword') return k.type === 'keyword';
    if (filterType === 'action') return k.type === 'action';
    return true;
  });

  return (
    <>
      {/* 📱 Bottom Horizontal Keyboard Bar: 
          - NO vibration
          - NO < or > buttons at start or end
          - Keys stretch cleanly and scroll horizontally with swipe / mouse wheel */}
      <div className="h-12 bg-[#14141e] border-t-2 border-[#2b2a3d] flex items-center px-2 py-1 z-20 shrink-0 select-none shadow-xl relative">
        {/* Scrollable list of keys with Dual Touch + Mouse Drag & Drop & Mouse Wheel support */}
        <div
          ref={scrollContainerRef}
          onScroll={() => {
            lastScrollTimestampRef.current = Date.now();
          }}
          onWheel={(e) => {
            lastScrollTimestampRef.current = Date.now();
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollLeft += e.deltaY;
            }
          }}
          className="flex-1 flex items-center gap-2 overflow-x-auto overflow-y-hidden scroll-smooth py-1 px-1 touch-pan-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {visibleKeys.map((k) => {
            const isBeingDragged = draggedKeyId === k.id;
            const isDropTarget = dropTargetKeyId === k.id;

            return (
              <button
                key={k.id}
                data-key-id={k.id}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, k.id)}
                onDragOver={(e) => handleDragOver(e, k.id)}
                onDrop={(e) => handleDrop(e, k.id)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleTouchStart(e, k.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={(e) => handleTouchEnd(e, k)}
                onMouseDown={(e) => {
                  // Prevent blurring the editor textarea
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  // Desktop mouse click: only if not dragging and not scrolling/swiping
                  if (!draggedKeyId && Date.now() - lastScrollTimestampRef.current >= 350) {
                    executeKeyPress(k.insertValue);
                  }
                }}
                className={`relative flex items-center justify-center rounded-lg font-mono transition-all duration-100 shrink-0 cursor-grab active:cursor-grabbing select-none ${sizeClasses} ${getKeyStyle(
                  k
                )} ${
                  isBeingDragged
                    ? 'scale-110 -translate-y-1 ring-2 ring-amber-400 bg-amber-400 text-black border-amber-300 shadow-2xl z-30 opacity-90'
                    : ''
                } ${
                  isDropTarget && !isBeingDragged
                    ? 'ring-2 ring-emerald-400 border-emerald-400 bg-emerald-500/30 scale-105 shadow-lg'
                    : ''
                } active:translate-y-0.5 active:shadow-none active:bg-amber-400 active:text-black active:border-amber-400`}
                title={`Kéo thả để đổi vị trí, hoặc bấm để chèn: ${k.insertValue.replace(/\n/g, '\\n')}`}
              >
                <span>{k.label}</span>
              </button>
            );
          })}
        </div>

        {/* Key Config Button (Settings & Save configuration) */}
        <button
          onClick={() => setShowConfig(true)}
          className="ml-2 p-2 bg-[#222132] hover:bg-[#302e48] text-gray-300 hover:text-amber-400 rounded-lg border-2 border-[#3d3b55] hover:border-amber-400/80 shrink-0 transition active:scale-95 shadow-sm cursor-pointer relative"
          title="Cấu hình & Lưu danh sách phím tắt người dùng"
          aria-label="Cấu hình phím tắt"
        >
          <Settings2 className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
        </button>
      </div>

      {/* 🛠️ Key Configuration & User Save Modal */}
      {showConfig && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
          <div className="bg-[#1c1b27] border-2 border-[#3e3b59] rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col text-gray-200 shadow-2xl overflow-hidden font-sans">
            {/* Header with Save Button & Status */}
            <div className="h-16 border-b border-[#302e46] px-4 flex items-center justify-between shrink-0 bg-[#232133]">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-gradient-to-tr from-amber-500 to-yellow-400 text-black rounded-xl shadow-md">
                  <SlidersHorizontal className="w-4 h-4 font-extrabold" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-amber-300 flex items-center gap-1.5">
                    <span>Cấu hình & Lưu Phím tắt</span>
                  </h3>
                  <p className="text-[10px] text-gray-400">
                    Tùy biến vị trí, thêm phím mới & lưu cấu hình của bạn
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* Header Save Button */}
                <button
                  onClick={handleSaveConfiguration}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold rounded-xl text-xs transition shadow-md active:scale-95 cursor-pointer"
                  title="Lưu lại cấu hình phím tắt hiện tại của bạn"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Lưu cấu hình</span>
                </button>

                <button
                  onClick={() => setShowConfig(false)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#302e46] transition cursor-pointer"
                  title="Đóng bảng cấu hình"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Notification Banner when saved or updated */}
            {saveStatusMessage && (
              <div className="bg-emerald-950/80 border-b border-emerald-600/50 px-4 py-2 flex items-center justify-between text-xs text-emerald-300 animate-in fade-in">
                <div className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold">{saveStatusMessage}</span>
                </div>
                <button
                  onClick={() => setSaveStatusMessage(null)}
                  className="text-emerald-400/70 hover:text-emerald-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs divide-y divide-[#2d2b40]/60">
              {/* Section 1: Key Size & Profile Presets */}
              <div className="space-y-3 pb-3">
                {/* Key Size Selector */}
                <div>
                  <label className="block text-gray-300 font-bold mb-1.5">
                    Kích thước phím (Độ cao & Vùng bấm):
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['small', 'medium', 'large'] as KeySize[]).map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          onUpdateKeySize(size);
                          localStorage.setItem('pydroid_key_size', size);
                        }}
                        className={`py-2 rounded-xl font-bold border-2 text-center transition cursor-pointer ${
                          keySize === size
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md'
                            : 'bg-[#161520] border-[#313045] text-gray-400 hover:text-gray-200 hover:bg-[#252436]'
                        }`}
                      >
                        {size === 'small'
                          ? 'Nhỏ (Tiết kiệm)'
                          : size === 'medium'
                          ? 'Vừa (Chuẩn Pydroid)'
                          : 'Lớn (Dễ bấm)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shortcut Presets & Personal Profile */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-gray-300 font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Bộ phím mẫu & Hồ sơ người dùng:</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <button
                      onClick={() => handleApplyPreset(DEFAULT_MOBILE_KEYS, 'Mặc định Pydroid')}
                      className="px-2 py-1.5 bg-[#171624] hover:bg-[#242236] border border-[#35334d] hover:border-amber-400 rounded-lg text-left transition text-gray-300 text-[11px] font-semibold cursor-pointer"
                    >
                      🌟 Mặc định Pydroid
                    </button>
                    <button
                      onClick={() => handleApplyPreset(MATH_LOGIC_KEYS_PRESET, 'Toán học & Lôgic')}
                      className="px-2 py-1.5 bg-[#171624] hover:bg-[#242236] border border-[#35334d] hover:border-amber-400 rounded-lg text-left transition text-gray-300 text-[11px] font-semibold cursor-pointer"
                    >
                      🔢 Toán học & Lôgic
                    </button>
                    <button
                      onClick={() => handleApplyPreset(FLOW_CONTROL_KEYS_PRESET, 'Hàm & Cấu trúc')}
                      className="px-2 py-1.5 bg-[#171624] hover:bg-[#242236] border border-[#35334d] hover:border-amber-400 rounded-lg text-left transition text-gray-300 text-[11px] font-semibold cursor-pointer"
                    >
                      ⚡ Hàm & Cấu trúc
                    </button>
                    <button
                      onClick={() => handleApplyPreset(MINIMAL_KEYS_PRESET, 'Tối giản (14 phím)')}
                      className="px-2 py-1.5 bg-[#171624] hover:bg-[#242236] border border-[#35334d] hover:border-amber-400 rounded-lg text-left transition text-gray-300 text-[11px] font-semibold cursor-pointer"
                    >
                      🎯 Tối giản (14 phím)
                    </button>
                  </div>

                  {/* Personal Profile Actions */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#29283d]">
                    <button
                      onClick={handleSaveUserProfile}
                      className="flex-1 flex items-center justify-center space-x-1 py-1.5 px-2 bg-[#1f1d30] hover:bg-[#2b2844] text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold transition cursor-pointer"
                      title="Lưu bản sao cấu hình hiện tại thành hồ sơ cá nhân riêng"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Lưu vào Hồ sơ của tôi</span>
                    </button>
                    <button
                      onClick={handleLoadUserProfile}
                      className="flex-1 flex items-center justify-center space-x-1 py-1.5 px-2 bg-[#1f1d30] hover:bg-[#2b2844] text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-bold transition cursor-pointer"
                      title="Tải lại hồ sơ cá nhân đã lưu"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải Hồ sơ của tôi</span>
                    </button>
                    <button
                      onClick={handleOpenExportJson}
                      className="flex items-center space-x-1 py-1.5 px-2.5 bg-[#171624] hover:bg-[#262438] text-gray-300 border border-[#383652] rounded-lg text-[11px] transition cursor-pointer"
                      title="Xuất hoặc nhập cấu hình bằng JSON"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">JSON</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 2: Add Custom Key Form */}
              <div className="pt-3 pb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 font-bold">Thêm phím tắt tùy chỉnh:</span>
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center space-x-1 text-xs text-amber-400 hover:text-amber-300 font-bold bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showAddForm ? 'Đóng tạo phím' : '+ Thêm phím mới'}</span>
                  </button>
                </div>

                {showAddForm && (
                  <form
                    onSubmit={handleAddNewCustomKey}
                    className="p-3 bg-[#161522] border border-[#36344e] rounded-xl space-y-3 animate-in fade-in"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-gray-400 text-[10px] mb-1 font-semibold">
                          Nhãn hiển thị trên phím:
                        </label>
                        <input
                          type="text"
                          value={newKeyLabel}
                          onChange={(e) => {
                            setNewKeyLabel(e.target.value);
                            if (!newKeyInsert) setNewKeyInsert(e.target.value);
                          }}
                          placeholder="Ví dụ: len(), try:, range()"
                          maxLength={12}
                          className="w-full px-2.5 py-1.5 bg-[#201f2e] border border-[#3a3854] rounded-lg text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 text-[10px] mb-1 font-semibold">
                          Giá trị chèn vào code:
                        </label>
                        <input
                          type="text"
                          value={newKeyInsert}
                          onChange={(e) => setNewKeyInsert(e.target.value)}
                          placeholder="Ví dụ: len( hoặc try:\n    "
                          className="w-full px-2.5 py-1.5 bg-[#201f2e] border border-[#3a3854] rounded-lg text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] text-gray-400">Kiểu phím:</span>
                        {(['keyword', 'char', 'action'] as const).map((t) => (
                          <button
                            type="button"
                            key={t}
                            onClick={() => setNewKeyType(t)}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              newKeyType === t
                                ? 'bg-amber-400 text-black border-amber-300'
                                : 'bg-[#222132] text-gray-400 border-[#383652]'
                            }`}
                          >
                            {t === 'keyword' ? 'Từ khóa' : t === 'char' ? 'Ký tự' : 'Hành động'}
                          </button>
                        ))}
                      </div>

                      <button
                        type="submit"
                        className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold rounded-lg text-xs transition shadow-sm active:scale-95 cursor-pointer"
                      >
                        Thêm vào thanh phím
                      </button>
                    </div>

                    {/* Quick Suggestions to add with 1 click */}
                    <div className="pt-2 border-t border-[#29283e]">
                      <span className="text-[10px] text-gray-400 font-semibold block mb-1.5">
                        Gợi ý chèn nhanh 1-chạm:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {COMMON_CUSTOM_KEY_SUGGESTIONS.map((sug) => (
                          <button
                            key={sug.label}
                            type="button"
                            onClick={() => handleAddSuggestion(sug)}
                            className="px-2 py-1 bg-[#201f2e] hover:bg-[#2e2c44] border border-[#383652] hover:border-amber-400/80 rounded-md text-[10px] font-mono text-amber-200 transition cursor-pointer"
                            title={`Thêm phím ${sug.label}`}
                          >
                            + {sug.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </form>
                )}
              </div>

              {/* Section 3: Filter & Search */}
              <div className="pt-3 pb-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  {/* Search box */}
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm phím nhanh..."
                      className="w-full pl-8 pr-2.5 py-1.5 bg-[#171624] border border-[#313047] rounded-lg text-gray-200 text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center space-x-1 shrink-0 overflow-x-auto">
                    {[
                      { id: 'all', label: `Tất cả (${keys.length})` },
                      { id: 'custom', label: 'Tùy chỉnh' },
                      { id: 'char', label: 'Ký tự' },
                      { id: 'keyword', label: 'Từ khóa' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setFilterType(tab.id as any)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer shrink-0 ${
                          filterType === tab.id
                            ? 'bg-amber-400 text-black shadow-sm'
                            : 'bg-[#181724] text-gray-400 hover:text-gray-200 hover:bg-[#252436]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visible count indicator */}
                <div className="flex items-center justify-between text-[11px] text-gray-400 font-semibold px-0.5">
                  <span>Kéo thả hoặc bấm ▲ ▼ để sắp xếp thứ tự:</span>
                  <span className="text-amber-300 font-bold">
                    {visibleKeys.length}/{keys.length} đang hiển thị trên thanh
                  </span>
                </div>
              </div>

              {/* Section 4: Key Items List */}
              <div className="pt-2">
                <div className="space-y-1.5 max-h-64 sm:max-h-72 overflow-y-auto pr-1">
                  {filteredKeysForConfig.map((k) => {
                    const originalIndex = keys.findIndex((item) => item.id === k.id);
                    const isConfigDragged = draggedKeyId === k.id;
                    const isConfigDropTarget = dropTargetKeyId === k.id;

                    return (
                      <div
                        key={k.id}
                        data-key-id={k.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, k.id)}
                        onDragOver={(e) => handleDragOver(e, k.id)}
                        onDrop={(e) => handleDrop(e, k.id)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center justify-between p-2 rounded-xl border-2 transition select-none ${
                          isConfigDragged
                            ? 'opacity-40 border-amber-400 bg-amber-500/10'
                            : isConfigDropTarget
                            ? 'border-emerald-400 bg-emerald-500/20'
                            : k.visible
                            ? 'bg-[#181724] border-[#373550]'
                            : 'bg-[#13121d] border-[#252436] opacity-60'
                        }`}
                      >
                        {/* Drag Handle & Key Info */}
                        <div className="flex items-center space-x-2 font-mono cursor-grab active:cursor-grabbing min-w-0 flex-1">
                          <GripHorizontal className="w-4 h-4 text-gray-500 hover:text-amber-400 shrink-0" />
                          <span
                            className={`min-w-[38px] text-center font-bold px-2 py-0.5 rounded-lg border-2 shrink-0 ${getKeyStyle(
                              k
                            )}`}
                          >
                            {k.label}
                          </span>
                          <div className="flex flex-col font-sans truncate">
                            <span className="text-xs font-semibold text-gray-200 truncate flex items-center gap-1">
                              <span>{k.label === '\\' ? 'Gạch chéo ngược (\\)' : k.label}</span>
                              {k.isCustom && (
                                <span className="px-1 py-0.2 text-[9px] bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 font-mono">
                                  Tùy chỉnh
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono truncate max-w-[160px]">
                              <code>{JSON.stringify(k.insertValue)}</code>
                            </span>
                          </div>
                        </div>

                        {/* Controls: Move to Front, Move Up, Move Down, Delete (if custom), Visibility */}
                        <div className="flex items-center space-x-1 font-sans shrink-0">
                          {/* Move to Front */}
                          <button
                            onClick={() => moveToFront(originalIndex)}
                            disabled={originalIndex === 0}
                            className="p-1 text-gray-400 hover:text-amber-400 hover:bg-[#252438] rounded-lg transition disabled:opacity-20 cursor-pointer"
                            title="Đưa phím này lên đầu thanh phím"
                          >
                            <ArrowUpToLine className="w-3.5 h-3.5" />
                          </button>

                          {/* Move Up */}
                          <button
                            onClick={() => moveKey(originalIndex, 'up')}
                            disabled={originalIndex === 0}
                            className="p-1 text-gray-400 hover:text-amber-400 hover:bg-[#252438] rounded-lg transition disabled:opacity-20 cursor-pointer"
                            title="Dời phím sang trái (Lên trước)"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>

                          {/* Move Down */}
                          <button
                            onClick={() => moveKey(originalIndex, 'down')}
                            disabled={originalIndex === keys.length - 1}
                            className="p-1 text-gray-400 hover:text-amber-400 hover:bg-[#252438] rounded-lg transition disabled:opacity-20 cursor-pointer"
                            title="Dời phím sang phải (Xuống sau)"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete if custom */}
                          {k.isCustom && (
                            <button
                              onClick={() => handleDeleteKey(k.id)}
                              className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                              title="Xóa phím tùy chỉnh này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Visibility toggle */}
                          <button
                            onClick={() => toggleKeyVisibility(k.id)}
                            className={`p-1 rounded-lg transition cursor-pointer ml-0.5 ${
                              k.visible
                                ? 'text-emerald-400 hover:bg-emerald-950/50 bg-emerald-950/20 border border-emerald-500/40'
                                : 'text-gray-500 hover:bg-gray-800 bg-gray-900 border border-gray-700'
                            }`}
                            title={k.visible ? 'Nhấn để ẩn phím này' : 'Nhấn để hiện phím này'}
                          >
                            {k.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer with Explicit Save Configuration Button */}
            <div className="h-16 border-t border-[#302e46] px-4 flex items-center justify-between shrink-0 bg-[#232133]">
              <button
                onClick={() => {
                  if (window.confirm('Bạn có chắc muốn khôi phục lại toàn bộ danh sách phím tắt mặc định?')) {
                    onResetKeys();
                    setSaveStatusMessage('Đã khôi phục phím tắt về mặc định!');
                  }
                }}
                className="flex items-center space-x-1.5 text-xs text-gray-400 hover:text-red-400 transition cursor-pointer py-1.5 px-2 rounded-lg hover:bg-red-950/20"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Khôi phục mặc định</span>
                <span className="sm:hidden">Mặc định</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSaveConfiguration}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-extrabold rounded-xl text-xs transition shadow-md shadow-emerald-700/20 active:scale-95 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu cấu hình</span>
                </button>

                <button
                  onClick={() => {
                    handleSaveConfiguration();
                    setShowConfig(false);
                  }}
                  className="px-5 py-2 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-black font-extrabold rounded-xl text-xs transition shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
                >
                  Hoàn tất
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JSON Export / Import Submodal */}
      {showJsonModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-[#1c1b27] border-2 border-[#3e3b59] rounded-2xl w-full max-w-lg flex flex-col text-gray-200 shadow-2xl p-4 space-y-3 font-sans">
            <div className="flex items-center justify-between border-b border-[#313047] pb-2">
              <h4 className="font-bold text-sm text-amber-300 flex items-center gap-1.5">
                <Copy className="w-4 h-4" />
                <span>Sao lưu & Nhập cấu hình phím tắt (JSON)</span>
              </h4>
              <button
                onClick={() => setShowJsonModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-gray-400">
              Bạn có thể sao chép đoạn JSON dưới đây để lưu trữ hoặc dán cấu hình từ thiết bị khác để áp dụng ngay:
            </p>

            <textarea
              value={jsonString}
              onChange={(e) => setJsonString(e.target.value)}
              rows={9}
              className="w-full p-2.5 bg-[#12111b] border border-[#373550] rounded-xl font-mono text-[11px] text-gray-200 focus:outline-none focus:border-amber-400"
            />

            {jsonError && (
              <p className="text-red-400 text-[11px] bg-red-950/30 p-2 rounded-lg border border-red-500/30">
                {jsonError}
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(jsonString);
                  setSaveStatusMessage('Đã sao chép cấu hình JSON vào Clipboard!');
                  setShowJsonModal(false);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#252438] hover:bg-[#32304d] text-amber-300 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Sao chép vào Clipboard</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowJsonModal(false)}
                  className="px-3 py-1.5 text-gray-400 hover:text-white text-xs cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={handleImportJson}
                  className="flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Áp dụng JSON</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
