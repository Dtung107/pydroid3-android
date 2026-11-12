import React, { useState, useEffect, useRef } from 'react';
import {
  FolderOpen,
  X,
  FilePlus,
  Download,
  Upload,
  Edit2,
  Trash2,
  Save,
  Check,
  FileCode,
  Copy,
  CheckCircle2,
  Share2,
  ShieldCheck,
  Star,
  Plus,
  Search,
  Code2,
  Bookmark,
  ChevronDown,
  ChevronUp,
  FileDown,
  ArrowRight,
  Sparkles,
  RefreshCw,
  HardDriveDownload,
  HardDriveUpload,
  Database,
} from 'lucide-react';
import { SavedFile, SnippetItem, SnippetCategory } from '../types';
import {
  getAllVaultSnippets,
  saveVaultSnippet,
  deleteVaultSnippet,
  toggleFavoriteVaultSnippet,
  exportVaultToJson,
  importVaultFromJson,
} from '../utils/snippetVaultDb';

interface FileManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFileName: string;
  onRenameCurrentFile: (newName: string) => void;
  currentCode: string;
  onLoadFile: (file: SavedFile) => void;
  onSaveCurrentFile: () => void;
  onNewFile: () => void;
  savedFiles: SavedFile[];
  onDeleteFile: (id: string) => void;
  onUploadFile: (fileName: string, code: string) => void;
  onApplySnippet?: (code: string) => void;
  onInsertSnippet?: (code: string) => void;
}

const CATEGORY_LABELS: Record<SnippetCategory, { label: string; color: string; border: string }> = {
  template: { label: 'Mẫu Code', color: 'bg-emerald-500/20 text-emerald-300', border: 'border-emerald-500/30' },
  algorithm: { label: 'Thuật Toán', color: 'bg-sky-500/20 text-sky-300', border: 'border-sky-500/30' },
  utility: { label: 'Tiện Ích', color: 'bg-amber-500/20 text-amber-300', border: 'border-amber-500/30' },
  data: { label: 'Dữ Liệu', color: 'bg-purple-500/20 text-purple-300', border: 'border-purple-500/30' },
  custom: { label: 'Tự Tạo', color: 'bg-rose-500/20 text-rose-300', border: 'border-rose-500/30' },
};

export const FileManagerModal: React.FC<FileManagerModalProps> = ({
  isOpen,
  onClose,
  currentFileName,
  onRenameCurrentFile,
  currentCode,
  onLoadFile,
  onSaveCurrentFile,
  onNewFile,
  savedFiles,
  onDeleteFile,
  onUploadFile,
  onApplySnippet,
  onInsertSnippet,
}) => {
  // Navigation tabs: 'files' = File Manager, 'vault' = IndexedDB Snippet Vault
  const [activeTab, setActiveTab] = useState<'files' | 'vault'>('files');

  // File Manager states
  const [editingName, setEditingName] = useState(currentFileName);
  const [isRenaming, setIsRenaming] = useState(false);
  const [downloadNotification, setDownloadNotification] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Snippet Vault states
  const [snippets, setSnippets] = useState<SnippetItem[]>([]);
  const [isLoadingVault, setIsLoadingVault] = useState<boolean>(false);
  const [vaultSearch, setVaultSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'favorites' | SnippetCategory>('all');
  const [expandedSnippetId, setExpandedSnippetId] = useState<string | null>(null);
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);

  // Snippet Form states (New / Edit)
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formId, setFormId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formDesc, setFormDesc] = useState<string>('');
  const [formCategory, setFormCategory] = useState<SnippetCategory>('custom');
  const [formTags, setFormTags] = useState<string>('');
  const [vaultNotice, setVaultNotice] = useState<string | null>(null);
  const vaultImportInputRef = useRef<HTMLInputElement>(null);

  // Load vault snippets whenever modal opens or tab switches to vault
  useEffect(() => {
    if (isOpen) {
      loadSnippets();
    }
  }, [isOpen]);

  const loadSnippets = async () => {
    setIsLoadingVault(true);
    try {
      const items = await getAllVaultSnippets();
      setSnippets(items);
    } catch (err) {
      console.warn('Lỗi tải snippets:', err);
    } finally {
      setIsLoadingVault(false);
    }
  };

  const showVaultNotification = (msg: string) => {
    setVaultNotice(msg);
    setTimeout(() => setVaultNotice(null), 3500);
  };

  if (!isOpen) return null;

  // File rename logic
  const handleSaveRename = () => {
    let name = editingName.trim();
    if (!name) name = 'untitled.py';
    if (!name.endsWith('.py')) name += '.py';
    onRenameCurrentFile(name);
    setIsRenaming(false);
  };

  // Download code to device / Android
  // Download code to device / Android
  const handleDownload = async () => {
    let name = currentFileName.trim();
    if (!name) name = 'untitled.py';
    if (!name.endsWith('.py')) name += '.py';

    // 1. Native Android Bridge (APK direct save to Downloads)
    if (typeof window !== 'undefined' && (window as any).AndroidFileBridge?.saveFile) {
      try {
        const ok = (window as any).AndroidFileBridge.saveFile(name, currentCode);
        if (ok) {
          setDownloadNotification(`✓ Đã lưu "${name}" vào thư mục Download của điện thoại!`);
          setTimeout(() => setDownloadNotification(null), 4000);
          return;
        }
      } catch (err: any) {
        console.warn('Android native save error:', err);
      }
    }

    // 2. Native Android Bridge Share fallback (APK)
    if (typeof window !== 'undefined' && (window as any).AndroidFileBridge?.shareFile) {
      try {
        const ok = (window as any).AndroidFileBridge.shareFile(name, currentCode);
        if (ok) {
          setDownloadNotification(`✓ Đang mở hộp thoại lưu tệp "${name}"...`);
          setTimeout(() => setDownloadNotification(null), 4000);
          return;
        }
      } catch (err: any) {
        console.warn('Android native shareFile error:', err);
      }
    }

    // 3. Web Share API with File (Mobile Chrome / Android WebView)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        const file = new File([currentCode], name, { type: 'text/plain;charset=utf-8' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Lưu ${name}`,
          });
          setDownloadNotification(`✓ Đã mở hộp thoại lưu tệp "${name}"!`);
          setTimeout(() => setDownloadNotification(null), 3500);
          return;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    // 4. File System Access API (Modern Desktop Chrome / Edge)
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: name,
          types: [{ description: 'Tập tin Python (*.py)', accept: { 'text/x-python': ['.py'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(currentCode);
        await writable.close();
        setDownloadNotification(`✓ Đã lưu "${name}" thành công!`);
        setTimeout(() => setDownloadNotification(null), 3500);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    // 5. Blob Object URL + Anchor Click (Standard Browser Download)
    try {
      const blob = new Blob([currentCode], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (_) {}
      }, 1000);
      setDownloadNotification(`✓ Đang tải xuống "${name}"...`);
      setTimeout(() => setDownloadNotification(null), 3500);
    } catch (_) {
      // 6. Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(currentCode);
        setDownloadNotification(`✓ Đã sao chép mã nguồn "${name}" vào bộ nhớ tạm!`);
        setTimeout(() => setDownloadNotification(null), 3500);
      } catch (_) {}
    }
  };

  const handleShare = async () => {
    let name = currentFileName.trim();
    if (!name) name = 'untitled.py';
    if (!name.endsWith('.py')) name += '.py';

    // 1. Native Android Share Intent (APK)
    if (typeof window !== 'undefined' && (window as any).AndroidFileBridge?.shareFile) {
      try {
        (window as any).AndroidFileBridge.shareFile(name, currentCode);
        return;
      } catch (err: any) {
        console.warn('Android native share error:', err);
      }
    }

    // 2. Web Share API (Mobile Browsers)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        const file = new File([currentCode], name, { type: 'text/x-python;charset=utf-8' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Tập tin Python: ${name}`,
          });
          return;
        }
        await navigator.share({
          title: name,
          text: currentCode,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    // Fallback: Copy code
    await handleCopyCode();
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      setDownloadNotification(`Đã sao chép toàn bộ mã vào bộ nhớ tạm!`);
      setTimeout(() => setDownloadNotification(null), 3000);
    } catch (_) {}
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      onUploadFile(file.name, content);
      onClose();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ==========================================
  // Snippet Vault Handlers
  // ==========================================

  // Save current editor code directly into Vault
  const handleSaveCurrentCodeToVault = () => {
    const suggestedTitle = currentFileName.replace(/\.py$/i, '').trim() || 'Mã nguồn hiện tại';
    setFormId(null);
    setFormTitle(suggestedTitle);
    setFormCode(currentCode || '# Đoạn mã Python');
    setFormDesc('Lưu trữ từ trình soạn thảo Pydroid 3 vào Kho Vault IndexedDB.');
    setFormCategory('custom');
    setFormTags('editor, python');
    setIsFormOpen(true);
    setActiveTab('vault');
  };

  // Open form for fresh new snippet
  const handleOpenNewSnippetForm = () => {
    setFormId(null);
    setFormTitle('');
    setFormCode('');
    setFormDesc('');
    setFormCategory('custom');
    setFormTags('');
    setIsFormOpen(true);
  };

  // Open form to edit existing snippet
  const handleEditSnippet = (snippet: SnippetItem) => {
    setFormId(snippet.id);
    setFormTitle(snippet.title);
    setFormCode(snippet.code);
    setFormDesc(snippet.description || '');
    setFormCategory(snippet.category);
    setFormTags((snippet.tags || []).join(', '));
    setIsFormOpen(true);
  };

  // Submit snippet form (IndexedDB Save)
  const handleSubmitSnippet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formCode.trim()) {
      showVaultNotification('⚠️ Vui lòng nhập tiêu đề và nội dung đoạn mã!');
      return;
    }

    const tagsArray = formTags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    await saveVaultSnippet({
      id: formId || undefined,
      title: formTitle,
      code: formCode,
      description: formDesc,
      category: formCategory,
      tags: tagsArray,
    });

    setIsFormOpen(false);
    await loadSnippets();
    showVaultNotification(`✓ Đã lưu đoạn mã "${formTitle}" vào Kho IndexedDB!`);
  };

  // Delete snippet
  const handleDeleteSnippet = async (id: string, title: string) => {
    await deleteVaultSnippet(id);
    await loadSnippets();
    showVaultNotification(`Đã xóa đoạn mã "${title}" khỏi Vault.`);
  };

  // Toggle favorite
  const handleToggleFavorite = async (id: string) => {
    const isFav = await toggleFavoriteVaultSnippet(id);
    setSnippets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isFavorite: isFav } : s))
    );
  };

  // Apply snippet to editor
  const handleApplySnippetToEditor = (code: string, title: string) => {
    if (onApplySnippet) {
      onApplySnippet(code);
      onClose();
    } else {
      onUploadFile(`${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.py`, code);
      onClose();
    }
  };

  // Insert snippet at cursor
  const handleInsertSnippetAtCursor = (code: string) => {
    if (onInsertSnippet) {
      onInsertSnippet(code);
      onClose();
    } else if (onApplySnippet) {
      onApplySnippet(currentCode ? `${currentCode}\n\n${code}` : code);
      onClose();
    }
  };

  // Copy snippet code
  const handleCopySnippet = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedSnippetId(id);
      setTimeout(() => setCopiedSnippetId(null), 2500);
    } catch (_) {}
  };

  // Export entire vault to JSON file
  const handleExportVault = async () => {
    try {
      const jsonStr = await exportVaultToJson();
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pydroid-snippet-vault-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showVaultNotification('✓ Đã xuất tệp sao lưu Vault JSON thành công!');
    } catch (err: any) {
      showVaultNotification(`Lỗi xuất: ${err.message}`);
    }
  };

  // Import vault from JSON file
  const handleImportVaultFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const count = await importVaultFromJson(content);
        await loadSnippets();
        showVaultNotification(`✓ Đã nạp thành công ${count} đoạn mã vào IndexedDB Vault!`);
      } catch (err: any) {
        showVaultNotification(`Lỗi khôi phục: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filtered snippets
  const filteredSnippets = snippets.filter((s) => {
    // Category filter
    if (selectedCategory === 'favorites' && !s.isFavorite) return false;
    if (selectedCategory !== 'all' && selectedCategory !== 'favorites' && s.category !== selectedCategory) {
      return false;
    }

    // Search query filter
    if (vaultSearch.trim()) {
      const q = vaultSearch.toLowerCase().trim();
      const matchesTitle = s.title.toLowerCase().includes(q);
      const matchesDesc = (s.description || '').toLowerCase().includes(q);
      const matchesCode = s.code.toLowerCase().includes(q);
      const matchesTags = (s.tags || []).some((t) => t.toLowerCase().includes(q));
      return matchesTitle || matchesDesc || matchesCode || matchesTags;
    }

    return true;
  });

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 animate-in fade-in">
      <div className="bg-[#1b1b26] border border-[#373550] rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col text-gray-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-14 border-b border-[#2d2b42] px-4 flex items-center justify-between shrink-0 bg-[#222134]">
          <div className="flex items-center space-x-2.5">
            <div className={`p-1.5 rounded-lg border transition ${
              activeTab === 'vault'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-sky-950/80 border-sky-500/40 text-sky-400'
            }`}>
              {activeTab === 'vault' ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <FolderOpen className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-bold text-sm text-gray-100">
                  {activeTab === 'vault' ? 'Kho Đoạn Mã Snippet Vault' : 'Quản Lý Tập Tin Python (.py)'}
                </h2>
                {activeTab === 'vault' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-semibold flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>IndexedDB Offline</span>
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-400">
                {activeTab === 'vault'
                  ? 'Lưu trữ cục bộ an toàn, hoạt động 100% không cần kết nối mạng'
                  : 'Tạo mới, đổi tên, lưu trữ và tải về điện thoại Android'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg transition"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Switcher */}
        <div className="flex items-center border-b border-[#2d2b42] bg-[#1a1928] px-4 pt-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('files');
              setIsFormOpen(false);
            }}
            className={`pb-2.5 px-3 font-semibold text-xs transition border-b-2 flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'files'
                ? 'border-sky-400 text-sky-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Tập Tin (.py)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-gray-800 text-gray-300 font-mono">
              {savedFiles.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('vault');
              setIsFormOpen(false);
            }}
            className={`pb-2.5 px-3 font-semibold text-xs transition border-b-2 flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'vault'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Kho Snippet Vault</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
              {snippets.length}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {/* ======================================================== */}
          {/* TAB 1: FILE MANAGER */}
          {/* ======================================================== */}
          {activeTab === 'files' && (
            <div className="space-y-4">
              {/* Current File Banner */}
              <div className="p-3 bg-[#222232] rounded-xl border border-[#36364e] space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-gray-400 text-xs">Tập tin đang mở:</span>
                  <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="flex items-center space-x-1 text-xs text-sky-400 hover:text-sky-300 font-semibold py-1 px-2 rounded-lg bg-sky-500/15 border border-sky-500/30 transition cursor-pointer active:scale-95"
                      title="Sao chép toàn bộ mã vào bộ nhớ tạm"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveCurrentCodeToVault}
                      className="flex items-center space-x-1 text-xs text-emerald-300 hover:text-emerald-200 font-semibold py-1 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 transition cursor-pointer active:scale-95"
                      title="Lưu đoạn code này vào Kho Snippet Vault để dùng lại offline"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Lưu vào Vault</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownload}
                      className="flex items-center space-x-1 text-xs text-amber-300 hover:text-amber-200 font-bold py-1 px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 transition cursor-pointer active:scale-95 shadow-sm"
                      title="Lưu file .py trực tiếp vào thư mục Download của điện thoại"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải .py về máy</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleShare}
                      className="flex items-center space-x-1 text-xs text-purple-300 hover:text-purple-200 font-bold py-1 px-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 transition cursor-pointer active:scale-95 shadow-sm"
                      title="Chia sẻ file .py qua Zalo, Drive, Gmail..."
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Chia sẻ</span>
                    </button>
                  </div>
                </div>

                {downloadNotification && (
                  <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span>{downloadNotification}</span>
                  </div>
                )}

                {isRenaming ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 bg-[#14141e] border border-amber-400 rounded px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveRename}
                      className="p-1.5 bg-amber-400 text-black font-bold rounded"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-[#151520] p-2.5 rounded-lg border border-[#2c2c3e]">
                    <div className="flex items-center space-x-2">
                      <FileCode className="w-4 h-4 text-emerald-400" />
                      <span className="font-mono font-bold text-emerald-300 text-sm">
                        {currentFileName}
                      </span>
                    </div>
                    <button
                      onClick={() => setIsRenaming(true)}
                      className="p-1 text-gray-400 hover:text-amber-300 transition"
                      title="Đổi tên file"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Action Grid */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    onNewFile();
                    onClose();
                  }}
                  className="p-3 bg-[#20202e] hover:bg-[#28283a] rounded-xl border border-[#33334a] flex items-center space-x-2 transition text-left active:scale-95 cursor-pointer"
                >
                  <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-lg">
                    <FilePlus className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-200">Tạo File Mới</div>
                    <div className="text-[10px] text-gray-400">Tạo trang mã trắng</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onSaveCurrentFile();
                    onClose();
                  }}
                  className="p-3 bg-[#20202e] hover:bg-[#28283a] rounded-xl border border-[#33334a] flex items-center space-x-2 transition text-left active:scale-95 cursor-pointer"
                >
                  <div className="p-2 bg-sky-500/20 text-sky-300 rounded-lg">
                    <Save className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-200">Lưu Trữ File</div>
                    <div className="text-[10px] text-gray-400">Lưu vào bộ nhớ máy</div>
                  </div>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 bg-[#20202e] hover:bg-[#28283a] rounded-xl border border-[#33334a] flex items-center space-x-2 transition text-left active:scale-95 col-span-2 cursor-pointer"
                >
                  <div className="p-2 bg-purple-500/20 text-purple-300 rounded-lg">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-200">Mở File .py từ Điện thoại</div>
                    <div className="text-[10px] text-gray-400">Chọn file .py từ bộ nhớ Android để nạp vào IDE</div>
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".py,text/plain"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>

              {/* Saved Files List */}
              <div>
                <span className="block font-semibold text-gray-300 mb-2">
                  Các file đã lưu ({savedFiles.length}):
                </span>

                {savedFiles.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 italic bg-[#151520] rounded-xl border border-[#2b2b3c]">
                    Chưa có file nào được lưu trong bộ nhớ.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {savedFiles.map((f) => (
                      <div
                        key={f.id}
                        className="p-2.5 bg-[#171722] hover:bg-[#20202e] rounded-xl border border-[#2d2d40] flex items-center justify-between transition"
                      >
                        <button
                          onClick={() => {
                            onLoadFile(f);
                            onClose();
                          }}
                          className="flex-1 text-left flex items-center space-x-2 overflow-hidden cursor-pointer"
                        >
                          <FileCode className="w-4 h-4 text-sky-400 shrink-0" />
                          <div className="overflow-hidden">
                            <div className="font-mono font-bold text-gray-200 text-xs truncate">
                              {f.name}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {new Date(f.lastModified).toLocaleString('vi-VN')}
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => onDeleteFile(f.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 rounded transition cursor-pointer"
                          title="Xóa file khỏi danh sách"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: LOCAL SNIPPET VAULT (INDEXEDDB OFFLINE SYSTEM) */}
          {/* ======================================================== */}
          {activeTab === 'vault' && (
            <div className="space-y-3">
              {/* Vault Notification Banner */}
              {vaultNotice && (
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center space-x-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-400" />
                  <span className="leading-snug">{vaultNotice}</span>
                </div>
              )}

              {/* Snippet Form Modal/Drawer (When Adding or Editing) */}
              {isFormOpen ? (
                <form
                  onSubmit={handleSubmitSnippet}
                  className="p-3.5 bg-[#171624] border border-amber-500/40 rounded-xl space-y-3 animate-in fade-in"
                >
                  <div className="flex items-center justify-between border-b border-[#2d2c40] pb-2">
                    <span className="font-bold text-xs text-amber-300 flex items-center space-x-1.5">
                      <Code2 className="w-4 h-4 text-amber-400" />
                      <span>{formId ? 'Chỉnh Sửa Đoạn Mã' : 'Thêm Đoạn Mã Mới Vào Vault'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="text-gray-400 hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">
                        Tiêu đề đoạn mã *
                      </label>
                      <input
                        type="text"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="Ví dụ: QuickSort, Đọc ghi file, Xử lý chuỗi..."
                        className="w-full bg-[#11111a] border border-[#333246] rounded-lg px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-400"
                        required
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-gray-400 mb-1">
                          Danh mục
                        </label>
                        <select
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value as SnippetCategory)}
                          className="w-full bg-[#11111a] border border-[#333246] rounded-lg px-2.5 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-amber-400"
                        >
                          <option value="template">Mẫu Code (Template)</option>
                          <option value="algorithm">Thuật toán (Algorithm)</option>
                          <option value="utility">Tiện ích (Utility)</option>
                          <option value="data">Dữ liệu (Data / JSON)</option>
                          <option value="custom">Tự tạo (Custom)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-400 mb-1">
                          Thẻ tags (cách nhau dấu phẩy)
                        </label>
                        <input
                          type="text"
                          value={formTags}
                          onChange={(e) => setFormTags(e.target.value)}
                          placeholder="sort, recursion, pep8..."
                          className="w-full bg-[#11111a] border border-[#333246] rounded-lg px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">
                        Mô tả ngắn gọn
                      </label>
                      <input
                        type="text"
                        value={formDesc}
                        onChange={(e) => setFormDesc(e.target.value)}
                        placeholder="Giải thích ngắn gọn công dụng hoặc lưu ý..."
                        className="w-full bg-[#11111a] border border-[#333246] rounded-lg px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">
                        Nội dung mã nguồn Python *
                      </label>
                      <textarea
                        value={formCode}
                        onChange={(e) => setFormCode(e.target.value)}
                        rows={7}
                        placeholder="# Nhập hoặc dán mã nguồn Python..."
                        className="w-full bg-[#0d0d14] border border-[#333246] rounded-lg p-2.5 text-xs text-amber-200 font-mono leading-relaxed focus:outline-none focus:border-amber-400"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-1 border-t border-[#2d2c40]">
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-3 py-1.5 bg-[#252536] hover:bg-[#303045] text-gray-300 rounded-lg text-xs font-semibold transition"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black rounded-lg text-xs font-bold transition shadow-md active:scale-95"
                    >
                      {formId ? 'Cập Nhật Đoạn Mã' : 'Lưu Vào Vault (IndexedDB)'}
                    </button>
                  </div>
                </form>
              ) : null}

              {/* Action Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-2 bg-[#201f30] p-2.5 rounded-xl border border-[#333248]">
                <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={handleSaveCurrentCodeToVault}
                    className="flex items-center space-x-1 text-xs text-emerald-300 hover:text-emerald-200 font-bold py-1 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 transition active:scale-95 cursor-pointer shadow-sm"
                    title="Lưu toàn bộ code hiện tại trong Editor vào IndexedDB Vault"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Lưu Code Vào Vault</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenNewSnippetForm}
                    className="flex items-center space-x-1 text-xs text-amber-300 hover:text-amber-200 font-bold py-1 px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 transition active:scale-95 cursor-pointer shadow-sm"
                    title="Tạo snippet mới bằng tay"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm Mới</span>
                  </button>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={handleExportVault}
                    className="flex items-center space-x-1 text-[11px] text-gray-300 hover:text-white py-1 px-2 rounded-lg bg-[#2b2a40] hover:bg-[#34334e] border border-[#403f5c] transition cursor-pointer"
                    title="Xuất toàn bộ kho snippet ra file JSON sao lưu"
                  >
                    <HardDriveDownload className="w-3 h-3 text-sky-400" />
                    <span>Xuất JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => vaultImportInputRef.current?.click()}
                    className="flex items-center space-x-1 text-[11px] text-gray-300 hover:text-white py-1 px-2 rounded-lg bg-[#2b2a40] hover:bg-[#34334e] border border-[#403f5c] transition cursor-pointer"
                    title="Khôi phục hoặc nạp thêm snippet từ file JSON sao lưu"
                  >
                    <HardDriveUpload className="w-3 h-3 text-purple-400" />
                    <span>Nạp JSON</span>
                  </button>
                  <input
                    ref={vaultImportInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportVaultFile}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Search & Category Filter Chips */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={vaultSearch}
                    onChange={(e) => setVaultSearch(e.target.value)}
                    placeholder="Tìm kiếm theo tiêu đề, thuật toán, tag, từ khóa mã nguồn..."
                    className="w-full bg-[#141420] border border-[#2d2c42] rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                  {vaultSearch && (
                    <button
                      type="button"
                      onClick={() => setVaultSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Filter Chips */}
                <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-2.5 py-1 rounded-lg border font-medium shrink-0 transition cursor-pointer ${
                      selectedCategory === 'all'
                        ? 'bg-amber-400 text-black border-amber-400 font-bold'
                        : 'bg-[#1b1a2a] text-gray-400 border-[#2e2d42] hover:text-gray-200'
                    }`}
                  >
                    Tất cả ({snippets.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCategory('favorites')}
                    className={`px-2.5 py-1 rounded-lg border font-medium shrink-0 transition flex items-center space-x-1 cursor-pointer ${
                      selectedCategory === 'favorites'
                        ? 'bg-amber-500/30 text-amber-300 border-amber-500/50 font-bold'
                        : 'bg-[#1b1a2a] text-gray-400 border-[#2e2d42] hover:text-amber-300'
                    }`}
                  >
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>Yêu thích</span>
                  </button>

                  {(['template', 'algorithm', 'utility', 'data', 'custom'] as SnippetCategory[]).map((cat) => {
                    const cfg = CATEGORY_LABELS[cat];
                    const isSelected = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg border font-medium shrink-0 transition cursor-pointer ${
                          isSelected
                            ? `${cfg.color} ${cfg.border} font-bold shadow-sm`
                            : 'bg-[#1b1a2a] text-gray-400 border-[#2e2d42] hover:text-gray-200'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Snippet List */}
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {isLoadingVault ? (
                  <div className="p-6 text-center text-gray-400 flex flex-col items-center justify-center space-y-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                    <span className="text-xs">Đang mở Kho Vault IndexedDB...</span>
                  </div>
                ) : filteredSnippets.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 italic bg-[#151520] rounded-xl border border-[#2b2b3c] space-y-2">
                    <Database className="w-8 h-8 mx-auto text-gray-600" />
                    <div>Không tìm thấy đoạn mã nào phù hợp với bộ lọc.</div>
                    <button
                      type="button"
                      onClick={() => {
                        setVaultSearch('');
                        setSelectedCategory('all');
                      }}
                      className="text-xs text-amber-400 hover:underline inline-block font-semibold"
                    >
                      Xóa bộ lọc
                    </button>
                  </div>
                ) : (
                  filteredSnippets.map((item) => {
                    const isExpanded = expandedSnippetId === item.id;
                    const catCfg = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.custom;

                    return (
                      <div
                        key={item.id}
                        className="bg-[#181726] hover:bg-[#1e1d30] border border-[#2d2c42] rounded-xl p-3 space-y-2 transition"
                      >
                        {/* Snippet Card Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-1.5 flex-wrap gap-1 mb-1">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${catCfg.color} ${catCfg.border}`}
                              >
                                {catCfg.label}
                              </span>
                              {item.tags && item.tags.length > 0 && (
                                <div className="flex items-center space-x-1">
                                  {item.tags.slice(0, 3).map((tag, idx) => (
                                    <span
                                      key={idx}
                                      className="text-[9px] px-1.5 py-0.2 rounded bg-[#242336] text-gray-400 font-mono"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <h3 className="font-bold text-gray-100 text-xs sm:text-sm leading-snug">
                              {item.title}
                            </h3>

                            {item.description && (
                              <p className="text-[11px] text-gray-400 line-clamp-2 mt-0.5 leading-relaxed">
                                {item.description}
                              </p>
                            )}
                          </div>

                          {/* Star favorite toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleFavorite(item.id)}
                            className="p-1 text-gray-500 hover:text-amber-400 transition cursor-pointer"
                            title={item.isFavorite ? 'Bỏ yêu thích' : 'Đánh dấu yêu thích'}
                          >
                            <Star
                              className={`w-4 h-4 ${
                                item.isFavorite
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-gray-500'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Collapsible Code Preview */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                            <button
                              type="button"
                              onClick={() => setExpandedSnippetId(isExpanded ? null : item.id)}
                              className="flex items-center space-x-1 text-gray-400 hover:text-amber-300 font-medium cursor-pointer"
                            >
                              <span>{isExpanded ? 'Thu gọn mã' : 'Xem trước mã nguồn'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <span className="text-[10px] text-gray-500 font-mono">
                              {item.code.split('\n').length} dòng
                            </span>
                          </div>

                          {isExpanded && (
                            <div className="mt-2 relative animate-in fade-in">
                              <pre className="p-2.5 bg-[#0e0e16] border border-[#29283e] rounded-lg text-[11px] text-amber-200/90 font-mono overflow-x-auto max-h-56 leading-relaxed selection:bg-amber-500/30">
                                <code>{item.code}</code>
                              </pre>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-1 border-t border-[#27263b] flex-wrap gap-1.5">
                          <div className="flex items-center space-x-1">
                            {/* Copy Code */}
                            <button
                              type="button"
                              onClick={() => handleCopySnippet(item.id, item.code)}
                              className="p-1.5 rounded-lg bg-[#252438] hover:bg-[#302f4a] text-gray-300 text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
                              title="Sao chép đoạn mã"
                            >
                              {copiedSnippetId === item.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-300 text-[11px]">Đã chép</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-gray-400" />
                                  <span className="text-[11px]">Chép</span>
                                </>
                              )}
                            </button>

                            {/* Insert at cursor */}
                            <button
                              type="button"
                              onClick={() => handleInsertSnippetAtCursor(item.code)}
                              className="py-1 px-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-300 text-[11px] font-semibold transition cursor-pointer active:scale-95"
                              title="Chèn đoạn mã này vào vị trí con trỏ hiện tại trong Editor"
                            >
                              Chèn vào vị trí
                            </button>

                            {/* Load / Replace into editor */}
                            <button
                              type="button"
                              onClick={() => handleApplySnippetToEditor(item.code, item.title)}
                              className="py-1 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-extrabold transition cursor-pointer active:scale-95 shadow-sm"
                              title="Thay thế nội dung Editor bằng đoạn mã này"
                            >
                              Nạp vào Editor
                            </button>
                          </div>

                          <div className="flex items-center space-x-1">
                            {/* Edit snippet */}
                            <button
                              type="button"
                              onClick={() => handleEditSnippet(item)}
                              className="p-1.5 text-gray-400 hover:text-amber-300 rounded transition cursor-pointer"
                              title="Chỉnh sửa đoạn mã"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete snippet */}
                            <button
                              type="button"
                              onClick={() => handleDeleteSnippet(item.id, item.title)}
                              className="p-1.5 text-gray-500 hover:text-red-400 rounded transition cursor-pointer"
                              title="Xóa đoạn mã này khỏi Vault"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-14 border-t border-[#2d2b42] px-4 flex items-center justify-between shrink-0 bg-[#222134]">
          <div className="text-[11px] text-gray-400 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Môi trường lưu trữ: IndexedDB & Local Storage Cục Bộ</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-black font-extrabold rounded-xl text-xs transition shadow-md cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
