import React, { useState, useRef } from 'react';
import {
  GraduationCap,
  X,
  CheckCircle2,
  Circle,
  Play,
  Lightbulb,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  BookOpen,
  Copy,
  Check,
  Code2,
  ArrowRight,
  RotateCcw,
  Trash2,
  Filter,
} from 'lucide-react';
import { LessonItem } from '../types';
import { getStoredApiKey, sendGeminiLessons } from '../utils/geminiClient';

interface StudyModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessons: LessonItem[];
  onSelectLesson: (lesson: LessonItem) => void;
  onSelectSolution?: (lesson: LessonItem) => void;
  onToggleComplete: (id: string) => void;
  onAddNewLessons: (newLessons: LessonItem[]) => void;
  onResetProgress?: () => void;
  onDeleteCompletedLessons?: () => void;
  onDeleteLesson?: (id: string) => void;
  onRestoreDefaultLessons?: () => void;
}

// Helper: Safely normalize level info so it never crashes and always maps properly
export const getLevelInfo = (level?: string) => {
  const norm = String(level || '').toLowerCase().trim();
  if (norm === 'intermediate' || norm.includes('trung') || norm.includes('vừa') || norm.includes('2')) {
    return {
      key: 'intermediate' as const,
      label: '🟡 Trung cấp',
      color: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
    };
  }
  if (norm === 'advanced' || norm.includes('nâng') || norm.includes('nang') || norm.includes('3')) {
    return {
      key: 'advanced' as const,
      label: '🟣 Nâng cao',
      color: 'bg-purple-950/80 text-purple-300 border-purple-500/40',
    };
  }
  return {
    key: 'basic' as const,
    label: '🟢 Cơ bản',
    color: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
  };
};

export const StudyModal: React.FC<StudyModalProps> = ({
  isOpen,
  onClose,
  lessons,
  onSelectLesson,
  onSelectSolution,
  onToggleComplete,
  onAddNewLessons,
  onResetProgress,
  onDeleteCompletedLessons,
  onDeleteLesson,
  onRestoreDefaultLessons,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'basic' | 'intermediate' | 'advanced'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'uncompleted' | 'completed'>('all');
  const [expandedSolutionId, setExpandedSolutionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Gemini AI Generator state
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiLevel, setAiLevel] = useState<'cơ bản' | 'trung cấp' | 'nâng cao'>('cơ bản');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatorError, setGeneratorError] = useState('');
  const [generatorSuccess, setGeneratorSuccess] = useState('');
  const [newlyCreatedIds, setNewlyCreatedIds] = useState<string[]>([]);

  // Ref to scroll the lessons list to top when new items arrive
  const listContainerRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Progress stats per level with safe normalization
  const basicLessons = lessons.filter((l) => getLevelInfo(l.level).key === 'basic');
  const intermediateLessons = lessons.filter((l) => getLevelInfo(l.level).key === 'intermediate');
  const advancedLessons = lessons.filter((l) => getLevelInfo(l.level).key === 'advanced');

  const basicCompleted = basicLessons.filter((l) => l.completed).length;
  const intermediateCompleted = intermediateLessons.filter((l) => l.completed).length;
  const advancedCompleted = advancedLessons.filter((l) => l.completed).length;

  const totalCompleted = lessons.filter((l) => l.completed).length;
  const progressPercent = Math.round((totalCompleted / (lessons.length || 1)) * 100);

  // Filtering with safe level check
  const filteredLessons = lessons.filter((l) => {
    const itemLevelKey = getLevelInfo(l.level).key;
    const matchLevel = activeTab === 'all' || itemLevelKey === activeTab;
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'completed' && Boolean(l.completed)) ||
      (statusFilter === 'uncompleted' && !l.completed);
    const matchSearch =
      searchQuery.trim() === '' ||
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchLevel && matchStatus && matchSearch;
  });

  const handleCopyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerateAiLessons = async () => {
    const topicToUse = aiTopic.trim() || 'Python ứng dụng thực tế & giải thuật';
    setIsGenerating(true);
    setGeneratorError('');
    setGeneratorSuccess('');

    try {
      const generatedRawLessons = await sendGeminiLessons(topicToUse, aiLevel);

      if (generatedRawLessons && Array.isArray(generatedRawLessons) && generatedRawLessons.length > 0) {
        // Standardize each incoming lesson item
        const normalizedLessons: LessonItem[] = generatedRawLessons.map((item: any) => {
          const info = getLevelInfo(item.level || aiLevel);
          return {
            id: item.id || `lesson_ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            title: String(item.title || 'Bài tập thực hành mới').trim(),
            level: info.key,
            description: String(item.description || '').trim(),
            starterCode: String(item.starterCode || '').trim(),
            solutionCode: String(item.solutionCode || '').trim(),
            explanation: String(item.explanation || 'Đã chuẩn hoá PEP 8 với 100% tên biến tiếng Việt.').trim(),
            sampleInput: item.sampleInput || '',
            sampleOutput: item.sampleOutput || '',
            completed: false,
          };
        });

        // 1. Add to lessons state
        onAddNewLessons(normalizedLessons);

        // 2. CRUCIAL FIX: Reset all filter tabs so newly created lessons are ALWAYS immediately visible!
        setActiveTab('all');
        setStatusFilter('all');
        setSearchQuery('');

        // 3. Mark newly created IDs for high-visibility visual highlight
        const newIds = normalizedLessons.map((l) => l.id);
        setNewlyCreatedIds(newIds);

        // 4. Update generator messages
        setGeneratorSuccess(`✨ Đã thêm ${normalizedLessons.length} bài tập mới (100% tên biến Việt hoá, không trùng lặp)!`);
        setAiTopic('');

        // 5. Scroll smoothly to top of lesson list container so user sees them right away
        setTimeout(() => {
          if (listContainerRef.current) {
            listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }, 150);

        // Automatically close the generator form after short delay so screen isn't cluttered
        setTimeout(() => {
          setShowAiGenerator(false);
          setGeneratorSuccess('');
        }, 2500);
      } else {
        throw new Error('Dữ liệu bài tập trả về không hợp lệ');
      }
    } catch (err: any) {
      setGeneratorError(err.message || 'Không thể tạo bài học lúc này');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="bg-[#12121c] border border-[#2d2b44] rounded-2xl w-full max-w-4xl h-[92vh] max-h-[880px] flex flex-col text-gray-200 shadow-2xl overflow-hidden font-sans">
        
        {/* 1. Header Gọn Gàng (52px) */}
        <div className="h-13 border-b border-[#252438] px-4 flex items-center justify-between shrink-0 bg-[#161624]">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-extrabold text-sm sm:text-base text-gray-100">
                  Kho Bài Tập & Kết Quả Học Tập
                </h2>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.2 rounded-full">
                  Python PEP 8
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {/* Nút Tạo bài học mới AI */}
            <button
              onClick={() => setShowAiGenerator(!showAiGenerator)}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer active:scale-95 whitespace-nowrap shadow-sm ${
                showAiGenerator
                  ? 'bg-amber-400 text-black'
                  : 'bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-black shadow-amber-500/20'
              }`}
              title="Biên soạn thêm bài tập mới tự động với Gemini AI"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>Tạo bài mới</span>
            </button>

            {/* Nút Xoá những bài đã hoàn thành */}
            {totalCompleted > 0 && onDeleteCompletedLessons && (
              <button
                onClick={() => {
                  setDeleteTargetId(null);
                  setShowConfirmDelete(true);
                }}
                className="px-2.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                title={`Xoá toàn bộ ${totalCompleted} bài tập đã hoàn thành`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Xoá bài đã xong ({totalCompleted})</span>
                <span className="sm:hidden">Xoá ({totalCompleted})</span>
              </button>
            )}

            {/* Nút Đặt lại tiến trình */}
            {onResetProgress && totalCompleted > 0 && (
              <button
                onClick={onResetProgress}
                className="p-1.5 text-gray-400 hover:text-amber-300 hover:bg-[#202030] rounded-lg transition text-xs cursor-pointer"
                title="Đặt lại toàn bộ tiến trình học tập"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Đóng Modal */}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#202030] rounded-lg transition cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Bảng Kết Quả Học Tập (Dashboard Tiến Độ) Gọn Gàng */}
        <div className="p-3 bg-[#13131e] border-b border-[#232336] shrink-0 space-y-2">
          {/* Hàng 1: Thanh tiến trình tổng thể */}
          <div className="flex items-center justify-between text-xs font-medium">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">Tiến trình học tập:</span>
              <span className="font-extrabold text-emerald-400 text-sm font-mono">
                {totalCompleted} / {lessons.length} bài
              </span>
              <span className="text-[11px] font-bold text-gray-400 font-mono">
                ({progressPercent}%)
              </span>
            </div>

            {/* Bộ lọc trạng thái làm bài nhanh */}
            <div className="flex items-center space-x-1 text-[11px]">
              <span className="text-gray-500 hidden sm:inline mr-1 flex items-center">
                <Filter className="w-3 h-3 mr-0.5" /> Lọc:
              </span>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-[#2b2b3e] text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Tất cả ({lessons.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('uncompleted')}
                className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
                  statusFilter === 'uncompleted'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Chưa học ({lessons.length - totalCompleted})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
                  statusFilter === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Đã xong ({totalCompleted})
              </button>
            </div>
          </div>

          {/* Thanh vạch tiến trình mỏng, đẹp */}
          <div className="w-full h-2 bg-[#1b1b28] rounded-full overflow-hidden border border-[#29293e]">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-green-400 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Hàng 2: Thống kê chi tiết 3 cấp độ súc tích */}
          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-0.5">
            <div className="flex items-center space-x-3 font-mono">
              <span className="text-emerald-300">
                🟢 Cơ bản: <strong className="text-white">{basicCompleted}</strong>/{basicLessons.length}
              </span>
              <span className="text-gray-600">·</span>
              <span className="text-amber-300">
                🟡 Trung cấp: <strong className="text-white">{intermediateCompleted}</strong>/{intermediateLessons.length}
              </span>
              <span className="text-gray-600">·</span>
              <span className="text-purple-300">
                🟣 Nâng cao: <strong className="text-white">{advancedCompleted}</strong>/{advancedLessons.length}
              </span>
            </div>

            <span className="text-gray-500 text-[10px] hidden sm:inline">
              100% mã nguồn tiếng Việt chuẩn PEP 8
            </span>
          </div>
        </div>

        {/* 3. Phân Loại Cấp Độ & Tìm Kiếm (Gọn gàng trong 1 hàng) */}
        <div className="px-3.5 py-2 bg-[#161623] border-b border-[#242436] flex flex-wrap items-center justify-between gap-2 shrink-0 select-none">
          {/* Tabs cấp độ */}
          <div className="flex items-center space-x-1 bg-[#0f0f17] p-1 rounded-xl border border-[#28273c]">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#29283d] text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Tất cả ({lessons.length})
            </button>

            <button
              onClick={() => setActiveTab('basic')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                activeTab === 'basic'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-300/80 hover:text-emerald-200 hover:bg-[#15241b]'
              }`}
            >
              <span>🟢 Cơ bản</span>
              <span className="text-[10px] opacity-75 font-mono">({basicLessons.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('intermediate')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                activeTab === 'intermediate'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-amber-300/80 hover:text-amber-200 hover:bg-[#251d12]'
              }`}
            >
              <span>🟡 Trung cấp</span>
              <span className="text-[10px] opacity-75 font-mono">({intermediateLessons.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('advanced')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                activeTab === 'advanced'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-purple-300/80 hover:text-purple-200 hover:bg-[#241530]'
              }`}
            >
              <span>🟣 Nâng cao</span>
              <span className="text-[10px] opacity-75 font-mono">({advancedLessons.length})</span>
            </button>
          </div>

          {/* Ô tìm kiếm nhỏ gọn */}
          <div className="relative w-44 sm:w-56">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm bài học..."
              className="w-full bg-[#0f0f17] text-gray-200 pl-8 pr-7 py-1 text-xs rounded-xl border border-[#28273c] focus:outline-none focus:border-emerald-400 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* 4. Khung Tạo Bài Học Mới với Gemini AI (Khi mở ra) */}
        {showAiGenerator && (
          <div className="bg-[#181528] border-b-2 border-amber-400/60 p-3.5 text-xs space-y-2.5 animate-in slide-in-from-top-2 shrink-0 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-400 fill-current" />
                <span className="font-extrabold text-amber-300 text-xs sm:text-sm">
                  Biên soạn bài tập mới với Gemini AI
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.2 rounded-full">
                  100% Tên biến tiếng Việt & Không trùng lặp
                </span>
              </div>
              <button
                onClick={() => setShowAiGenerator(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#282442] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className="sm:col-span-2 space-y-1.5">
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="Nhập chủ đề muốn học (vd: Quản lý chi tiêu, Game xúc xắc, Hoá đơn trà sữa...)"
                  className="w-full bg-[#0e0c17] border border-[#352f4e] rounded-xl px-3 py-1.5 text-gray-200 text-xs focus:outline-none focus:border-amber-400 transition"
                />
                {/* Gợi ý chủ đề nhanh */}
                <div className="flex flex-wrap gap-1">
                  {['Quản lý chi tiêu', 'Hoá đơn trà sữa', 'Game đổ xúc xắc', 'Điểm thi học sinh', 'Xử lý chuỗi tiếng Việt', 'Thuật toán tìm kiếm'].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setAiTopic(chip)}
                      className="text-[10px] bg-[#211d35] hover:bg-[#2e284a] text-amber-300 px-2 py-0.5 rounded-lg border border-[#373055] transition cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chọn cấp độ */}
              <div>
                <select
                  value={aiLevel}
                  onChange={(e) => setAiLevel(e.target.value as any)}
                  className="w-full bg-[#0e0c17] border border-[#352f4e] rounded-xl px-2.5 py-1.5 text-gray-200 text-xs focus:outline-none focus:border-amber-400 transition cursor-pointer"
                >
                  <option value="cơ bản">🟢 Cấp độ 1 (Cơ bản)</option>
                  <option value="trung cấp">🟡 Cấp độ 2 (Trung cấp)</option>
                  <option value="nâng cao">🟣 Cấp độ 3 (Nâng cao)</option>
                </select>
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Gemini kiểm tra kho bài để tạo nội dung mới
                </span>
              </div>

              {/* Nút gửi yêu cầu */}
              <div>
                <button
                  type="button"
                  onClick={handleGenerateAiLessons}
                  disabled={isGenerating}
                  className="w-full py-2 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 active:bg-amber-500 disabled:opacity-50 text-black font-extrabold rounded-xl transition active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer shadow-md text-xs"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Gemini đang viết...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 fill-current" />
                      <span>Tạo bài tập ngay</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {generatorError && (
              <p className="text-red-400 text-xs font-semibold bg-red-950/40 p-2 rounded-lg border border-red-500/30">
                ❌ {generatorError}
              </p>
            )}

            {generatorSuccess && (
              <p className="text-emerald-300 text-xs font-semibold bg-emerald-950/50 p-2 rounded-lg border border-emerald-500/40 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{generatorSuccess}</span>
              </p>
            )}
          </div>
        )}

        {/* Banner thông báo các bài tập vừa tạo mới thành công */}
        {newlyCreatedIds.length > 0 && (
          <div className="mx-3 sm:mx-4 mt-2 p-3 bg-gradient-to-r from-amber-950/80 via-[#211a36] to-emerald-950/70 border-2 border-amber-400 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-lg animate-in slide-in-from-top-2 shrink-0">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-300 fill-current shrink-0 animate-bounce" />
              <div>
                <p className="font-extrabold text-amber-300 text-xs sm:text-sm">
                  🎉 Đã tạo thành công {newlyCreatedIds.length} bài tập mới! (100% biến tiếng Việt)
                </p>
                <p className="text-[11px] text-gray-300">
                  Các bài tập mới đang hiển thị ở ngay đầu danh sách bên dưới kèm nhãn <span className="text-amber-400 font-bold">MỚI TẠO</span>.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1.5">
              {filteredLessons.find((l) => newlyCreatedIds.includes(l.id)) && (
                <button
                  type="button"
                  onClick={() => {
                    const firstNew = filteredLessons.find((l) => newlyCreatedIds.includes(l.id));
                    if (firstNew) {
                      onSelectLesson(firstNew);
                      onClose();
                    }
                  }}
                  className="px-3 py-1 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-black font-extrabold rounded-lg text-xs transition active:scale-95 shadow cursor-pointer flex items-center space-x-1"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Làm bài mới ngay</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setNewlyCreatedIds([])}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-black/40 transition"
                title="Đóng thông báo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 5. Danh Sách Bài Tập Gọn Gàng */}
        <div ref={listContainerRef} className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 text-xs">
          {filteredLessons.length === 0 ? (
            <div className="text-center py-16 text-gray-400 italic space-y-3">
              <BookOpen className="w-10 h-10 text-gray-600 mx-auto" />
              <p>
                {lessons.length === 0
                  ? 'Kho bài tập hiện đang trống (Đã xoá hết bài tập).'
                  : 'Không tìm thấy bài học nào phù hợp với bộ lọc.'}
              </p>
              <div className="flex items-center justify-center space-x-2.5 pt-1 not-italic">
                {lessons.length === 0 && onRestoreDefaultLessons && (
                  <button
                    onClick={onRestoreDefaultLessons}
                    className="px-3.5 py-1.5 rounded-xl bg-[#202030] hover:bg-[#2b2b40] text-emerald-400 border border-emerald-500/40 text-xs font-bold transition cursor-pointer flex items-center space-x-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Khôi phục bài tập mẫu mặc định</span>
                  </button>
                )}
                {lessons.length > 0 && (
                  <button
                    onClick={() => {
                      setActiveTab('all');
                      setStatusFilter('all');
                      setSearchQuery('');
                    }}
                    className="text-emerald-400 underline text-xs cursor-pointer"
                  >
                    Xem toàn bộ bài học
                  </button>
                )}
              </div>
            </div>
          ) : (
            filteredLessons.map((item) => {
              const isExpanded = expandedSolutionId === item.id;
              const isCopied = copiedId === item.id;
              const isNewlyCreated = newlyCreatedIds.includes(item.id);
              const levelBadge = getLevelInfo(item.level);

              return (
                <div
                  key={item.id}
                  className={`p-3 sm:p-3.5 rounded-xl border transition-all ${
                    isNewlyCreated
                      ? 'bg-[#1a172e] border-amber-400/90 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/50'
                      : item.completed
                      ? 'bg-[#121c16] border-emerald-500/40 shadow-sm'
                      : 'bg-[#151522] border-[#252538] hover:border-[#383852]'
                  }`}
                >
                  {/* Card Header: Level & Title & Checkbox */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className={`px-2 py-0.2 rounded-md text-[10px] font-bold border ${levelBadge.color}`}>
                          {levelBadge.label}
                        </span>
                        {isNewlyCreated && (
                          <span className="px-2 py-0.2 bg-gradient-to-r from-amber-400 to-yellow-400 text-black font-black rounded-md text-[10px] flex items-center space-x-1 shadow-sm">
                            <Sparkles className="w-3 h-3 fill-current" />
                            <span>MỚI TẠO</span>
                          </span>
                        )}
                        {item.completed && (
                          <span className="px-2 py-0.2 bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 rounded-md text-[10px] font-bold flex items-center space-x-1">
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Đã xong</span>
                          </span>
                        )}
                        <h3 className="font-bold text-gray-100 text-xs sm:text-sm truncate">
                          {item.title}
                        </h3>
                      </div>

                      <p className="text-gray-300 text-xs leading-relaxed font-sans line-clamp-3">
                        {item.description}
                      </p>
                    </div>

                    {/* Quick status tick button */}
                    <button
                      onClick={() => onToggleComplete(item.id)}
                      className="p-1 rounded-full text-gray-400 hover:text-emerald-400 transition shrink-0 cursor-pointer"
                      title={item.completed ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
                    >
                      {item.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-600 hover:text-gray-400" />
                      )}
                    </button>
                  </div>

                  {/* Sample I/O Section */}
                  {(item.sampleInput || item.sampleOutput) && (
                    <div className="mt-2.5 p-2 bg-[#0c0c14] rounded-lg border border-[#222234] text-[11px] font-mono grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {item.sampleInput && (
                        <div>
                          <span className="text-gray-400 block font-sans font-semibold text-[10px] uppercase">
                            📥 Input mẫu:
                          </span>
                          <span className="text-amber-300 whitespace-pre font-mono block mt-0.5 truncate">
                            {item.sampleInput}
                          </span>
                        </div>
                      )}
                      {item.sampleOutput && (
                        <div>
                          <span className="text-gray-400 block font-sans font-semibold text-[10px] uppercase">
                            📤 Output mẫu:
                          </span>
                          <span className="text-emerald-300 whitespace-pre font-mono block mt-0.5 truncate">
                            {item.sampleOutput}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Nút thao tác bài tập */}
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-[#222234]">
                    <div className="flex items-center space-x-1.5">
                      {/* Nút Làm Bài */}
                      <button
                        onClick={() => {
                          onSelectLesson(item);
                          onClose();
                        }}
                        className="flex items-center space-x-1 px-3 py-1 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-black font-extrabold rounded-lg text-xs transition active:scale-95 shadow-sm cursor-pointer"
                        title="Nạp đề bài và khung mã starterCode vào Editor để bắt đầu lập trình"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Làm Bài</span>
                      </button>

                      {/* Nút Xem Lời giải */}
                      <button
                        onClick={() => setExpandedSolutionId(isExpanded ? null : item.id)}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition border cursor-pointer ${
                          isExpanded
                            ? 'bg-[#252038] text-yellow-300 border-yellow-400/50'
                            : 'bg-[#1b1b28] hover:bg-[#252538] text-gray-300 hover:text-white border-[#2f2f44]'
                        }`}
                        title="Xem đáp án chuẩn PEP 8 và phân tích thuật toán chi tiết"
                      >
                        <Lightbulb className="w-3 h-3 text-yellow-400" />
                        <span>Lời giải & Gợi ý</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                      </button>
                    </div>

                    <div className="flex items-center space-x-1">
                      {/* Đánh dấu hoàn thành */}
                      <button
                        onClick={() => onToggleComplete(item.id)}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer border ${
                          item.completed
                            ? 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border-emerald-500/50'
                            : 'bg-[#171724] hover:bg-[#202032] text-gray-400 hover:text-emerald-400 border-[#2b2b3e]'
                        }`}
                        title="Ghi nhận bài học đã hoàn thành vào tiến trình"
                      >
                        <CheckCircle2 className={`w-3 h-3 ${item.completed ? 'text-emerald-400' : 'text-gray-500'}`} />
                        <span>{item.completed ? 'Đã hoàn thành' : 'Đánh dấu'}</span>
                      </button>

                      {/* Xoá bài học cụ thể đã xong */}
                      {item.completed && onDeleteLesson && (
                        <button
                          onClick={() => {
                            setDeleteTargetId(item.id);
                            setShowConfirmDelete(true);
                          }}
                          className="p-1 rounded-lg text-rose-400 hover:text-white hover:bg-rose-900/60 transition border border-rose-500/30 cursor-pointer"
                          title="Xoá bài tập đã hoàn thành này khỏi kho bài tập"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Lời giải mẫu chuẩn PEP 8 (Khi mở) */}
                  {isExpanded && (
                    <div className="mt-2.5 p-3 bg-[#0a0a10] border border-[#262638] rounded-xl space-y-2.5 animate-in fade-in">
                      <div className="flex items-center justify-between text-xs pb-1.5 border-b border-[#1c1c2a]">
                        <span className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                          <Code2 className="w-3.5 h-3.5" />
                          <span>Đáp án chuẩn PEP 8 (100% biến tiếng Việt):</span>
                        </span>

                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleCopyCode(item.solutionCode, item.id)}
                            className="px-2 py-0.5 bg-[#171724] hover:bg-[#222234] text-gray-300 hover:text-white rounded-md text-[11px] flex items-center space-x-1 border border-[#2d2d40] transition cursor-pointer"
                          >
                            {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{isCopied ? 'Đã chép' : 'Sao chép'}</span>
                          </button>

                          {onSelectSolution && (
                            <button
                              onClick={() => {
                                onSelectSolution(item);
                                onClose();
                              }}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-md text-[11px] flex items-center space-x-1 transition cursor-pointer shadow-sm"
                            >
                              <span>Nạp vào Editor</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Khối code đáp án */}
                      <pre className="p-2.5 bg-[#050508] rounded-lg border border-[#1a1a26] text-emerald-300 font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed select-text">
                        {item.solutionCode}
                      </pre>

                      {/* Phân tích thuật toán */}
                      <div className="p-2.5 bg-[#141220] rounded-lg border border-[#28223c] space-y-1">
                        <div className="flex items-center space-x-1 text-amber-300 font-bold text-[11px]">
                          <Sparkles className="w-3 h-3 text-yellow-400 fill-current" />
                          <span>Phân tích thuật toán (Gemini AI):</span>
                        </div>
                        <p className="text-gray-300 text-xs leading-relaxed font-sans">
                          {item.explanation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Hộp thoại xác nhận xoá bài tập */}
        {showConfirmDelete && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[#181824] border border-rose-500/50 rounded-2xl w-full max-w-sm p-4 text-gray-200 shadow-2xl flex flex-col items-center text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-rose-950/80 border border-rose-500/50 flex items-center justify-center text-rose-400 shadow-inner">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">
                  {deleteTargetId ? 'Xoá bài tập này?' : 'Xoá bài tập đã hoàn thành?'}
                </h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  {deleteTargetId ? (
                    <>
                      Bạn có chắc muốn xoá bài tập <strong className="text-rose-400">"{lessons.find((l) => l.id === deleteTargetId)?.title}"</strong> khỏi kho bài không?
                    </>
                  ) : (
                    <>
                      Bạn có chắc chắn muốn xoá toàn bộ <strong className="text-rose-400">{totalCompleted} bài tập</strong> đã được đánh dấu hoàn thành khỏi kho không?
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center space-x-2 w-full pt-1">
                <button
                  onClick={() => {
                    setShowConfirmDelete(false);
                    setDeleteTargetId(null);
                  }}
                  className="flex-1 py-1.5 rounded-xl bg-[#252536] hover:bg-[#303046] text-gray-200 text-xs font-bold transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() => {
                    if (deleteTargetId) {
                      onDeleteLesson?.(deleteTargetId);
                    } else {
                      onDeleteCompletedLessons?.();
                    }
                    setShowConfirmDelete(false);
                    setDeleteTargetId(null);
                  }}
                  className="flex-1 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black transition active:scale-95 shadow-md shadow-rose-950/60 cursor-pointer"
                >
                  Xác nhận xoá
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
