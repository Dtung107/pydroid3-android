import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  LogOut,
  HardDrive,
  StickyNote,
  CheckSquare,
  RefreshCw,
  UploadCloud,
  Download,
  Trash2,
  Search,
  Plus,
  Pin,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Sparkles,
  Server,
  ExternalLink,
  Check,
  Edit3,
  Bot,
  Wrench,
  Terminal,
  Send,
  Copy,
} from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  GoogleAccountProfile,
  googleSignIn,
  logout,
  getAccessToken,
  getRenderBackendUrl,
  isRunningInsideNativeApk,
  formatGoogleAuthErrorMessage,
} from '../utils/googleAuth';
import {
  fetchGeminiProjectStatus,
  getBackendBaseUrl,
  sendGeminiChatStream,
  GeminiProjectStatus,
} from '../utils/geminiClient';
import {
  DriveFileItem,
  CloudNote,
  GoogleTaskListItem,
  GoogleTaskItem,
  WorkspaceAuthError,
  ensurePydroidDriveFolder,
  listDrivePythonFiles,
  readDriveFileContent,
  createDrivePythonFile,
  updateDrivePythonFile,
  deleteDriveFile,
  loadCloudNotes,
  saveCloudNotes,
  listGoogleTaskLists,
  listGoogleTasks,
  createGoogleTask,
  updateGoogleTask,
  deleteGoogleTask,
} from '../utils/googleWorkspaceApi';

interface GoogleWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: GoogleAccountProfile | null;
  needsAuth: boolean;
  currentFileName: string;
  currentCode: string;
  onLoadCodeToEditor: (fileName: string, code: string) => void;
  onInsertSnippetToEditor: (code: string) => void;
  onOpenSettings?: () => void;
  onOpenAiAssistant?: () => void;
  onOpenAutoFix?: () => void;
}

interface PendingConfirmAction {
  title: string;
  description: string;
  confirmLabel: string;
  isDanger?: boolean;
  onConfirm: () => Promise<void>;
}

const NOTE_COLOR_MAP: Record<CloudNote['color'], string> = {
  amber: 'bg-amber-950/35 border-amber-500/40',
  sky: 'bg-sky-950/35 border-sky-500/40',
  emerald: 'bg-emerald-950/35 border-emerald-500/40',
  purple: 'bg-purple-950/35 border-purple-500/40',
  rose: 'bg-rose-950/35 border-rose-500/40',
};

export const GoogleWorkspaceModal: React.FC<GoogleWorkspaceModalProps> = ({
  isOpen,
  onClose,
  profile,
  needsAuth,
  currentFileName,
  currentCode,
  onLoadCodeToEditor,
  onInsertSnippetToEditor,
  onOpenSettings,
  onOpenAiAssistant,
  onOpenAutoFix,
}) => {
  const [activeTab, setActiveTab] = useState<'drive' | 'notes' | 'tasks' | 'gemini'>('drive');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ ok: boolean; text: string } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmAction | null>(null);
  const [isExecutingConfirm, setIsExecutingConfirm] = useState(false);

  // Google Drive states
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [driveSearch, setDriveSearch] = useState('');
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);

  // Cloud Notes (Keep-style via Drive AppData)
  const [notesFileId, setNotesFileId] = useState<string | null>(null);
  const [notes, setNotes] = useState<CloudNote[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isNoteFormOpen, setIsNoteFormOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteColor, setNoteColor] = useState<CloudNote['color']>('amber');

  // Google Tasks states
  const [taskLists, setTaskLists] = useState<GoogleTaskListItem[]>([]);
  const [selectedTaskListId, setSelectedTaskListId] = useState<string>('');
  const [tasks, setTasks] = useState<GoogleTaskItem[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');

  // Gemini Project states
  const [geminiProject, setGeminiProject] = useState<GeminiProjectStatus | null>(null);
  const [geminiOverallStatus, setGeminiOverallStatus] = useState<'PASS' | 'WARN' | 'FAIL' | null>(null);
  const [isCheckingGemini, setIsCheckingGemini] = useState(false);
  const [geminiTestedModels, setGeminiTestedModels] = useState<
    Array<{
      model: string;
      status: 'PASS' | 'WARN' | 'FAIL';
      latencyMs: number;
      message: string;
      httpStatus?: number;
    }>
  >([]);
  const [geminiQuickPrompt, setGeminiQuickPrompt] = useState('');
  const [geminiQuickOutput, setGeminiQuickOutput] = useState('');
  const [isRunningGeminiPrompt, setIsRunningGeminiPrompt] = useState(false);

  const inApk = isRunningInsideNativeApk();
  const renderUrl = getRenderBackendUrl();

  const showBanner = (ok: boolean, text: string) => {
    setStatusBanner({ ok, text });
    setTimeout(() => {
      setStatusBanner((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const handleWorkspaceError = (err: any) => {
    if (err instanceof WorkspaceAuthError) {
      setAuthError(err.message);
    } else {
      showBanner(false, err?.message || 'Đã xảy ra lỗi khi kết nối dịch vụ Google.');
    }
  };

  const fetchDrive = useCallback(async (query = driveSearch) => {
    const token = await getAccessToken();
    if (!token) return;
    setIsLoadingDrive(true);
    try {
      const files = await listDrivePythonFiles(token, query);
      setDriveFiles(files);
    } catch (err) {
      handleWorkspaceError(err);
    } finally {
      setIsLoadingDrive(false);
    }
  }, [driveSearch]);

  const fetchNotes = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    setIsLoadingNotes(true);
    try {
      const res = await loadCloudNotes(token);
      setNotesFileId(res.fileId);
      setNotes(res.notes);
    } catch (err) {
      handleWorkspaceError(err);
    } finally {
      setIsLoadingNotes(false);
    }
  }, []);

  const fetchTasks = useCallback(async (listIdOverride?: string) => {
    const token = await getAccessToken();
    if (!token) return;
    setIsLoadingTasks(true);
    try {
      let activeListId = listIdOverride || selectedTaskListId;
      if (taskLists.length === 0 || !activeListId) {
        const lists = await listGoogleTaskLists(token);
        setTaskLists(lists);
        activeListId = lists[0]?.id || '@default';
        setSelectedTaskListId(activeListId);
      }
      if (activeListId) {
        const items = await listGoogleTasks(token, activeListId);
        setTasks(items);
      }
    } catch (err) {
      handleWorkspaceError(err);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [selectedTaskListId, taskLists.length]);

  const checkGeminiProject = useCallback(async (runDeepDiagnose = false) => {
    setIsCheckingGemini(true);
    try {
      const status = await fetchGeminiProjectStatus();
      setGeminiProject(status);

      if (runDeepDiagnose) {
        const baseUrl = getBackendBaseUrl();
        const diagRes = await fetch(`${baseUrl}/api/ai/diagnose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (diagRes.ok) {
          const diagData = await diagRes.json();
          const diagOverall: 'PASS' | 'WARN' | 'FAIL' =
            diagData.overallStatus === 'PASS' || diagData.overallStatus === 'FAIL'
              ? diagData.overallStatus
              : 'WARN';
          setGeminiOverallStatus(diagOverall);

          if (Array.isArray(diagData.testedModels)) {
            setGeminiTestedModels(diagData.testedModels);
          }

          const firstFailMsg = Array.isArray(diagData.testedModels)
            ? diagData.testedModels.find((m: any) => m.status === 'FAIL')?.message ||
              diagData.testedModels.find((m: any) => m.status === 'WARN')?.message
            : '';

          const syncedMessage =
            diagData.summaryMessage ||
            (diagOverall === 'PASS'
              ? `Dự án Gemini (${status.projectId}) hoạt động sẵn sàng từ máy chủ.`
              : firstFailMsg || status.message);

          setGeminiProject({
            ...status,
            ok: Boolean(diagData.ok),
            serverKeyConfigured: Boolean(diagData.serverKeyConfigured ?? status.serverKeyConfigured),
            message: syncedMessage,
          });

          if (diagOverall === 'PASS') {
            showBanner(true, `Đã kết nối dự án Gemini (${status.projectId}) thành công!`);
          } else {
            showBanner(
              false,
              syncedMessage ||
                (status.serverKeyConfigured
                  ? 'Máy chủ chưa xác thực được Gemini API (kiểm tra GEMINI_API_KEY).'
                  : 'Chưa thiết lập GEMINI_API_KEY trên máy chủ Render/Preview.')
            );
          }
        }
      }
    } catch (_) {
      setGeminiOverallStatus('WARN');
      showBanner(false, 'Không thể kiểm tra máy chủ Gemini lúc này.');
    } finally {
      setIsCheckingGemini(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'gemini') {
      checkGeminiProject(true);
      return;
    }
    if (needsAuth) return;
    if (activeTab === 'drive') {
      fetchDrive('');
    } else if (activeTab === 'notes') {
      fetchNotes();
    } else if (activeTab === 'tasks') {
      fetchTasks();
    }
  }, [isOpen, needsAuth, activeTab]);

  if (!isOpen) return null;

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        showBanner(true, `Đã kết nối tài khoản ${res.profile.email}!`);
        if (activeTab === 'drive') fetchDrive('');
        if (activeTab === 'notes') fetchNotes();
        if (activeTab === 'tasks') fetchTasks();
      } else if (inApk) {
        showBanner(
          true,
          'Đã mở trình duyệt Chrome để đăng nhập Google. Sau khi xác nhận, ứng dụng sẽ tự động quay lại!'
        );
      }
    } catch (err: any) {
      setAuthError(formatGoogleAuthErrorMessage(err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setDriveFiles([]);
    setNotes([]);
    setTasks([]);
    showBanner(true, 'Đã đăng xuất tài khoản Google.');
  };

  // ======================================================
  // Google Drive Actions (Mutations require explicit confirm)
  // ======================================================

  const handleSaveCurrentFileToDrive = async () => {
    const token = await getAccessToken();
    if (!token) return;

    const targetName = currentFileName.trim().endsWith('.py')
      ? currentFileName.trim()
      : `${currentFileName.trim() || 'main'}.py`;

    const existing = driveFiles.find(
      (f) => f.name.toLowerCase() === targetName.toLowerCase()
    );

    if (existing) {
      setPendingConfirm({
        title: `Ghi đè tệp "${existing.name}" trên Google Drive?`,
        description: `Tệp "${existing.name}" đã tồn tại trên Google Drive của bạn. Xác nhận ghi đè nội dung mới từ Editor lên Google Drive?`,
        confirmLabel: 'Xác nhận ghi đè',
        onConfirm: async () => {
          setIsUploadingDrive(true);
          try {
            await updateDrivePythonFile(token, existing.id, currentCode, targetName);
            showBanner(true, `Đã cập nhật "${targetName}" trên Google Drive!`);
            await fetchDrive(driveSearch);
          } catch (err) {
            handleWorkspaceError(err);
          } finally {
            setIsUploadingDrive(false);
          }
        },
      });
      return;
    }

    setIsUploadingDrive(true);
    try {
      const folderId = await ensurePydroidDriveFolder(token);
      await createDrivePythonFile(token, targetName, currentCode, folderId);
      showBanner(true, `Đã lưu "${targetName}" vào thư mục Pydroid 3 trên Google Drive!`);
      await fetchDrive(driveSearch);
    } catch (err) {
      handleWorkspaceError(err);
    } finally {
      setIsUploadingDrive(false);
    }
  };

  const handleOpenDriveFile = async (file: DriveFileItem) => {
    const token = await getAccessToken();
    if (!token) return;
    setOpeningFileId(file.id);
    try {
      const content = await readDriveFileContent(token, file.id);
      onLoadCodeToEditor(file.name, content);
      onClose();
    } catch (err) {
      handleWorkspaceError(err);
    } finally {
      setOpeningFileId(null);
    }
  };

  const handleRequestDeleteDriveFile = (file: DriveFileItem) => {
    setPendingConfirm({
      title: `Xóa "${file.name}" khỏi Google Drive?`,
      description: `Tệp "${file.name}" sẽ bị xóa vĩnh viễn khỏi Google Drive của bạn. Hành động này không thể hoàn tác.`,
      confirmLabel: 'Xóa vĩnh viễn',
      isDanger: true,
      onConfirm: async () => {
        const token = await getAccessToken();
        if (!token) return;
        try {
          await deleteDriveFile(token, file.id);
          setDriveFiles((prev) => prev.filter((f) => f.id !== file.id));
          showBanner(true, `Đã xóa "${file.name}" khỏi Google Drive.`);
        } catch (err) {
          handleWorkspaceError(err);
        }
      },
    });
  };

  // ======================================================
  // Keep-Style Cloud Notes Actions
  // ======================================================

  const handleOpenNewNote = (prefillCurrentCode = false) => {
    setEditingNoteId(null);
    setNoteTitle(prefillCurrentCode ? `Ghi chú: ${currentFileName}` : '');
    setNoteContent(prefillCurrentCode ? currentCode : '');
    setNoteColor('amber');
    setIsNoteFormOpen(true);
  };

  const handleOpenEditNote = (note: CloudNote) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteColor(note.color);
    setIsNoteFormOpen(true);
  };

  const persistNotes = async (nextNotes: CloudNote[], successText: string) => {
    const token = await getAccessToken();
    if (!token) return;
    setIsLoadingNotes(true);
    try {
      const nextId = await saveCloudNotes(token, notesFileId, nextNotes);
      setNotesFileId(nextId);
      setNotes(nextNotes);
      setIsNoteFormOpen(false);
      showBanner(true, successText);
    } catch (err) {
      handleWorkspaceError(err);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  const handleSubmitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() && !noteContent.trim()) return;

    if (editingNoteId) {
      const nextNotes = notes.map((n) =>
        n.id === editingNoteId
          ? {
              ...n,
              title: noteTitle.trim() || 'Ghi chú không tiêu đề',
              content: noteContent,
              color: noteColor,
              updatedAt: Date.now(),
            }
          : n
      );
      setPendingConfirm({
        title: `Cập nhật ghi chú "${noteTitle.trim() || 'Ghi chú'}"?`,
        description: 'Nội dung ghi chú cũ trên Google Cloud sẽ được thay thế bằng nội dung bạn vừa chỉnh sửa.',
        confirmLabel: 'Lưu cập nhật',
        onConfirm: async () => {
          await persistNotes(nextNotes, 'Đã cập nhật ghi chú lên Google Cloud!');
        },
      });
      return;
    }

    const created: CloudNote = {
      id: `note_${Date.now()}`,
      title: noteTitle.trim() || 'Ghi chú Python',
      content: noteContent,
      color: noteColor,
      pinned: false,
      updatedAt: Date.now(),
    };
    await persistNotes([created, ...notes], 'Đã lưu ghi chú mới lên Google Cloud!');
  };

  const handleRequestTogglePinNote = (note: CloudNote) => {
    const nextNotes = notes.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n));
    setPendingConfirm({
      title: note.pinned ? `Bỏ ghim ghi chú "${note.title}"?` : `Ghim ghi chú "${note.title}" lên đầu?`,
      description: 'Thao tác này sẽ cập nhật trạng thái ghi chú trên Google Cloud của bạn.',
      confirmLabel: 'Xác nhận',
      onConfirm: async () => {
        await persistNotes(nextNotes, note.pinned ? 'Đã bỏ ghim ghi chú.' : 'Đã ghim ghi chú lên đầu.');
      },
    });
  };

  const handleRequestDeleteNote = (note: CloudNote) => {
    setPendingConfirm({
      title: `Xóa ghi chú "${note.title}"?`,
      description: 'Ghi chú này sẽ bị xóa khỏi Google Cloud và không thể khôi phục.',
      confirmLabel: 'Xóa ghi chú',
      isDanger: true,
      onConfirm: async () => {
        const nextNotes = notes.filter((n) => n.id !== note.id);
        await persistNotes(nextNotes, `Đã xóa ghi chú "${note.title}".`);
      },
    });
  };

  // ======================================================
  // Google Tasks Actions
  // ======================================================

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedTaskListId) return;
    const token = await getAccessToken();
    if (!token) return;
    try {
      const created = await createGoogleTask(
        token,
        selectedTaskListId,
        newTaskTitle.trim(),
        newTaskNotes.trim() || undefined
      );
      setTasks((prev) => [created, ...prev]);
      setNewTaskTitle('');
      setNewTaskNotes('');
      showBanner(true, `Đã thêm "${created.title}" vào Google Tasks!`);
    } catch (err) {
      handleWorkspaceError(err);
    }
  };

  const handleRequestToggleTask = (task: GoogleTaskItem) => {
    const nextStatus = task.status === 'completed' ? 'needsAction' : 'completed';
    setPendingConfirm({
      title:
        nextStatus === 'completed'
          ? `Đánh dấu hoàn thành "${task.title}"?`
          : `Mở lại công việc "${task.title}"?`,
      description: 'Trạng thái công việc sẽ được cập nhật trực tiếp trên Google Tasks của bạn.',
      confirmLabel: 'Cập nhật Google Tasks',
      onConfirm: async () => {
        const token = await getAccessToken();
        if (!token || !selectedTaskListId) return;
        try {
          const updated = await updateGoogleTask(token, selectedTaskListId, task.id, {
            status: nextStatus,
          });
          setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
          showBanner(true, 'Đã đồng bộ trạng thái lên Google Tasks!');
        } catch (err) {
          handleWorkspaceError(err);
        }
      },
    });
  };

  const handleRequestDeleteTask = (task: GoogleTaskItem) => {
    setPendingConfirm({
      title: `Xóa công việc "${task.title}"?`,
      description: 'Công việc này sẽ bị xóa vĩnh viễn khỏi Google Tasks của bạn.',
      confirmLabel: 'Xóa công việc',
      isDanger: true,
      onConfirm: async () => {
        const token = await getAccessToken();
        if (!token || !selectedTaskListId) return;
        try {
          await deleteGoogleTask(token, selectedTaskListId, task.id);
          setTasks((prev) => prev.filter((t) => t.id !== task.id));
          showBanner(true, `Đã xóa "${task.title}" khỏi Google Tasks.`);
        } catch (err) {
          handleWorkspaceError(err);
        }
      },
    });
  };

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 animate-in fade-in">
      <div className="bg-[#181824] border border-[#34334d] rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col text-gray-200 shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="h-13 border-b border-[#29283d] px-4 flex items-center justify-between shrink-0 bg-[#13131c]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow border border-white/20 shrink-0">
              <svg viewBox="0 0 48 48" className="w-5 h-5">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-sm text-gray-100">
                Dịch Vụ Google & Đám Mây
              </h2>
              <p className="text-[10px] text-gray-400">
                Google Drive • Ghi chú Cloud • Google Tasks • Gemini Render
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white flex items-center justify-center transition cursor-pointer shadow"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Account Status Strip */}
        <div className="px-4 py-2.5 bg-[#1b1b29] border-b border-[#2b2a40] shrink-0">
          {!needsAuth && profile ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5 min-w-0">
                {profile.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt={profile.displayName}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full border border-emerald-400/50 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 font-bold text-xs shrink-0">
                    {(profile.displayName || 'G').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-xs text-gray-100 truncate">
                      {profile.displayName}
                    </span>
                    <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold shrink-0">
                      Đã kết nối
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 truncate">{profile.email}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="px-2.5 py-1.5 bg-[#252438] hover:bg-rose-950/70 text-gray-300 hover:text-rose-300 border border-[#35344f] hover:border-rose-500/40 rounded-lg text-xs font-semibold flex items-center space-x-1 transition cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng xuất</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="text-xs text-gray-300">
                <span className="font-semibold text-amber-300">Chưa kết nối tài khoản Google.</span>{' '}
                Đăng nhập để đồng bộ code lên Google Drive, Ghi chú Cloud & Google Tasks.
              </div>
              <GoogleSignInButton
                onClick={handleLogin}
                disabled={isLoggingIn}
                label={isLoggingIn ? 'Đang kết nối...' : 'Sign in with Google'}
                className="shrink-0 self-start sm:self-auto"
              />
            </div>
          )}

          {authError && (
            <div className="mt-2 p-2.5 rounded-lg bg-amber-950/50 border border-amber-500/40 text-amber-200 text-[11px] flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="leading-relaxed">{authError}</div>
                {typeof window !== 'undefined' && window.self !== window.top && !inApk && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-sky-300 hover:underline font-semibold"
                  >
                    <span>Mở ứng dụng trong tab trình duyệt mới</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Service Navigation Tabs */}
        <div className="flex items-center border-b border-[#29283d] bg-[#151522] px-2 pt-2 shrink-0 space-x-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('drive')}
            className={`pb-2 px-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 cursor-pointer shrink-0 ${
              activeTab === 'drive'
                ? 'border-sky-400 text-sky-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Drive (.py)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`pb-2 px-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 cursor-pointer shrink-0 ${
              activeTab === 'notes'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span>Ghi chú Cloud</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`pb-2 px-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 cursor-pointer shrink-0 ${
              activeTab === 'tasks'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Google Tasks</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gemini')}
            className={`pb-2 px-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 cursor-pointer shrink-0 ${
              activeTab === 'gemini'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gemini AI</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs">
          {/* Status Banner */}
          {statusBanner && (
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-center space-x-2 animate-in fade-in ${
                statusBanner.ok
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
              }`}
            >
              {statusBanner.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="flex-1">{statusBanner.text}</span>
            </div>
          )}

          {/* Render + Gemini APK Bridge Status Card */}
          <div className="p-2.5 rounded-xl bg-[#13131e] border border-[#2a2940] flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                <Server className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-gray-200 flex items-center space-x-1.5">
                  <span>Máy chủ Gemini & Python Cloud</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {inApk ? 'APK Cloud' : 'Web Proxy'}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-gray-400 truncate">
                  {renderUrl}
                </div>
              </div>
            </div>
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="px-2 py-1 rounded-lg bg-[#202032] hover:bg-[#2b2a42] text-gray-300 border border-[#34334d] text-[10px] font-semibold shrink-0 cursor-pointer"
              >
                Cấu hình
              </button>
            )}
          </div>

          {activeTab !== 'gemini' && needsAuth ? (
            <div className="p-6 rounded-2xl bg-[#13131c] border border-[#2c2b42] flex flex-col items-center text-center space-y-3">
              <Sparkles className="w-8 h-8 text-amber-400" />
              <div className="space-y-1 max-w-sm">
                <h3 className="font-bold text-sm text-gray-100">
                  Kết nối tài khoản Google của bạn
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Đăng nhập bằng Google để lưu trực tiếp file Python (`.py`) vào thư mục{' '}
                  <strong className="text-gray-200">Pydroid 3</strong> trên Google Drive, đồng bộ Ghi chú Cloud và quản lý Google Tasks ngay trên điện thoại.
                </p>
              </div>
              <GoogleSignInButton
                onClick={handleLogin}
                disabled={isLoggingIn}
                label={isLoggingIn ? 'Đang mở đăng nhập Google...' : 'Sign in with Google'}
              />
              {inApk && (
                <p className="text-[10px] text-gray-500 leading-relaxed max-w-xs">
                  Trên ứng dụng APK Android, hệ thống sẽ mở trình duyệt Chrome xác thực an toàn qua{' '}
                  <span className="font-mono text-gray-400">{renderUrl}</span> rồi tự động quay lại ứng dụng.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* ================================================= */}
              {/* TAB 1: GOOGLE DRIVE (.py)                         */}
              {/* ================================================= */}
              {activeTab === 'drive' && (
                <div className="space-y-3">
                  {/* Save Current Editor Code Banner */}
                  <div className="p-3 rounded-xl bg-sky-950/25 border border-sky-500/30 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] text-sky-300 font-bold flex items-center space-x-1">
                        <FileCode className="w-3.5 h-3.5" />
                        <span className="truncate">Tệp đang mở: {currentFileName}</span>
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Lưu vào thư mục "Pydroid 3" trên Google Drive
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveCurrentFileToDrive}
                      disabled={isUploadingDrive}
                      className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-black font-extrabold rounded-lg text-xs flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50 shrink-0 shadow"
                    >
                      {isUploadingDrive ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UploadCloud className="w-3.5 h-3.5" />
                      )}
                      <span>{isUploadingDrive ? 'Đang lưu...' : 'Lưu lên Drive'}</span>
                    </button>
                  </div>

                  {/* Search & Refresh */}
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={driveSearch}
                        onChange={(e) => setDriveSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') fetchDrive(driveSearch);
                        }}
                        placeholder="Tìm tệp .py trên Google Drive..."
                        className="w-full bg-[#13131c] border border-[#2d2c44] rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-sky-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchDrive(driveSearch)}
                      disabled={isLoadingDrive}
                      className="px-2.5 py-1.5 bg-[#202030] hover:bg-[#2a2940] text-gray-200 rounded-lg border border-[#34334d] flex items-center space-x-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDrive ? 'animate-spin text-sky-400' : ''}`} />
                      <span>Tải lại</span>
                    </button>
                  </div>

                  {/* Files List */}
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                    {isLoadingDrive ? (
                      <div className="p-6 text-center text-gray-400 flex items-center justify-center space-x-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                        <span>Đang tải danh sách từ Google Drive...</span>
                      </div>
                    ) : driveFiles.length === 0 ? (
                      <div className="p-5 text-center text-gray-500 bg-[#13131c] rounded-xl border border-[#28273c]">
                        Chưa tìm thấy tệp `.py` nào trên Google Drive. Nhấn "Lưu lên Drive" để tải tệp hiện tại lên!
                      </div>
                    ) : (
                      driveFiles.map((file) => (
                        <div
                          key={file.id}
                          className="p-2.5 bg-[#141420] hover:bg-[#1b1b2b] rounded-xl border border-[#2a2940] flex items-center justify-between gap-2 transition"
                        >
                          <div className="min-w-0 flex-1 flex items-center space-x-2">
                            <FileCode className="w-4 h-4 text-sky-400 shrink-0" />
                            <div className="min-w-0">
                              <div className="font-mono font-bold text-gray-100 truncate">
                                {file.name}
                              </div>
                              <div className="text-[10px] text-gray-500">
                                {file.modifiedTime
                                  ? new Date(file.modifiedTime).toLocaleString('vi-VN')
                                  : 'Google Drive'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenDriveFile(file)}
                              disabled={openingFileId === file.id}
                              className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                            >
                              {openingFileId === file.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Download className="w-3 h-3" />
                              )}
                              <span>Mở</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRequestDeleteDriveFile(file)}
                              className="p-1.5 bg-rose-950/50 hover:bg-rose-900/70 text-rose-300 border border-rose-500/30 rounded-lg cursor-pointer"
                              title="Xóa khỏi Google Drive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ================================================= */}
              {/* TAB 2: KEEP-STYLE CLOUD NOTES (Drive AppData)     */}
              {/* ================================================= */}
              {activeTab === 'notes' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenNewNote(false)}
                        className="px-2.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold rounded-lg text-xs flex items-center space-x-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Ghi chú mới</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenNewNote(true)}
                        className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-bold rounded-lg text-xs flex items-center space-x-1 cursor-pointer"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        <span>Lưu code vào Ghi chú</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={fetchNotes}
                      disabled={isLoadingNotes}
                      className="p-1.5 bg-[#202030] hover:bg-[#2a2940] text-gray-300 rounded-lg border border-[#34334d] cursor-pointer"
                      title="Làm mới ghi chú"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingNotes ? 'animate-spin text-amber-400' : ''}`} />
                    </button>
                  </div>

                  {isNoteFormOpen && (
                    <form
                      onSubmit={handleSubmitNote}
                      className="p-3 rounded-xl bg-[#13131c] border border-amber-500/40 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300 text-xs">
                          {editingNoteId ? 'Chỉnh sửa ghi chú' : 'Tạo ghi chú Cloud mới'}
                        </span>
                        <div className="flex items-center space-x-1">
                          {(['amber', 'sky', 'emerald', 'purple', 'rose'] as CloudNote['color'][]).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setNoteColor(c)}
                              className={`w-4 h-4 rounded-full border cursor-pointer ${
                                c === 'amber'
                                  ? 'bg-amber-400'
                                  : c === 'sky'
                                  ? 'bg-sky-400'
                                  : c === 'emerald'
                                  ? 'bg-emerald-400'
                                  : c === 'purple'
                                  ? 'bg-purple-400'
                                  : 'bg-rose-400'
                              } ${noteColor === c ? 'ring-2 ring-white scale-110' : 'opacity-60'}`}
                            />
                          ))}
                        </div>
                      </div>

                      <input
                        type="text"
                        value={noteTitle}
                        onChange={(e) => setNoteTitle(e.target.value)}
                        placeholder="Tiêu đề ghi chú..."
                        className="w-full bg-[#1a1a28] border border-[#2f2e46] rounded-lg px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-400"
                      />

                      <textarea
                        rows={4}
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="Nội dung ghi chú hoặc đoạn mã Python..."
                        className="w-full bg-[#0e0e16] border border-[#2f2e46] rounded-lg p-2.5 text-xs font-mono text-amber-100 placeholder-gray-500 focus:outline-none focus:border-amber-400"
                      />

                      <div className="flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => setIsNoteFormOpen(false)}
                          className="px-3 py-1 bg-[#252538] text-gray-300 rounded-lg text-xs cursor-pointer"
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-lg text-xs cursor-pointer"
                        >
                          {editingNoteId ? 'Lưu cập nhật' : 'Lưu ghi chú'}
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                    {isLoadingNotes ? (
                      <div className="p-6 text-center text-gray-400 flex items-center justify-center space-x-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                        <span>Đang đồng bộ Ghi chú Cloud...</span>
                      </div>
                    ) : sortedNotes.length === 0 ? (
                      <div className="p-5 text-center text-gray-500 bg-[#13131c] rounded-xl border border-[#28273c]">
                        Chưa có ghi chú nào trên Google Cloud. Tạo ghi chú để đồng bộ giữa Web và APK!
                      </div>
                    ) : (
                      sortedNotes.map((note) => (
                        <div
                          key={note.id}
                          className={`p-3 rounded-xl border space-y-2 ${NOTE_COLOR_MAP[note.color]}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-gray-100 text-xs flex items-center space-x-1.5">
                                {note.pinned && <Pin className="w-3 h-3 text-amber-300 shrink-0" />}
                                <span className="truncate">{note.title}</span>
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {new Date(note.updatedAt).toLocaleString('vi-VN')}
                              </div>
                            </div>

                            <div className="flex items-center space-x-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleRequestTogglePinNote(note)}
                                className={`p-1 rounded border cursor-pointer ${
                                  note.pinned
                                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                                    : 'bg-black/25 text-gray-400 border-white/10 hover:text-white'
                                }`}
                                title={note.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
                              >
                                <Pin className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditNote(note)}
                                className="p-1 rounded bg-black/25 text-gray-300 hover:text-white border border-white/10 cursor-pointer"
                                title="Sửa ghi chú"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestDeleteNote(note)}
                                className="p-1 rounded bg-rose-950/50 text-rose-300 hover:bg-rose-900 border border-rose-500/30 cursor-pointer"
                                title="Xóa ghi chú"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {note.content && (
                            <pre className="p-2 rounded-lg bg-black/35 text-[11px] font-mono text-gray-200 whitespace-pre-wrap max-h-24 overflow-y-auto select-text">
                              {note.content}
                            </pre>
                          )}

                          <div className="flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                onInsertSnippetToEditor(note.content);
                                onClose();
                              }}
                              className="px-2 py-1 bg-white/10 hover:bg-white/20 text-gray-100 rounded text-[10px] font-bold cursor-pointer"
                            >
                              Chèn vào Editor
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ================================================= */}
              {/* TAB 3: GOOGLE TASKS                               */}
              {/* ================================================= */}
              {activeTab === 'tasks' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={selectedTaskListId}
                      onChange={(e) => {
                        setSelectedTaskListId(e.target.value);
                        fetchTasks(e.target.value);
                      }}
                      className="flex-1 bg-[#13131c] border border-[#2d2c44] rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-emerald-400"
                    >
                      {taskLists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.title}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => fetchTasks(selectedTaskListId)}
                      disabled={isLoadingTasks}
                      className="p-1.5 bg-[#202030] hover:bg-[#2a2940] text-gray-300 rounded-lg border border-[#34334d] cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTasks ? 'animate-spin text-emerald-400' : ''}`} />
                    </button>
                  </div>

                  <form onSubmit={handleAddTask} className="p-2.5 rounded-xl bg-[#13131c] border border-[#2a2940] space-y-2">
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="text"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="Thêm việc cần làm / bài tập Python..."
                        className="flex-1 bg-[#1b1b29] border border-[#2f2e46] rounded-lg px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-400"
                      />
                      <button
                        type="submit"
                        disabled={!newTaskTitle.trim()}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-lg text-xs flex items-center space-x-1 cursor-pointer disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={newTaskNotes}
                      onChange={(e) => setNewTaskNotes(e.target.value)}
                      placeholder="Ghi chú thêm (tùy chọn)..."
                      className="w-full bg-[#181826] border border-[#28273e] rounded-lg px-2.5 py-1 text-[11px] text-gray-300 placeholder-gray-500 focus:outline-none focus:border-emerald-400"
                    />
                  </form>

                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                    {isLoadingTasks ? (
                      <div className="p-6 text-center text-gray-400 flex items-center justify-center space-x-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                        <span>Đang tải Google Tasks...</span>
                      </div>
                    ) : tasks.length === 0 ? (
                      <div className="p-5 text-center text-gray-500 bg-[#13131c] rounded-xl border border-[#28273c]">
                        Danh sách công việc đang trống.
                      </div>
                    ) : (
                      tasks.map((task) => {
                        const done = task.status === 'completed';
                        return (
                          <div
                            key={task.id}
                            className="p-2.5 bg-[#141420] rounded-xl border border-[#2a2940] flex items-start justify-between gap-2"
                          >
                            <button
                              type="button"
                              onClick={() => handleRequestToggleTask(task)}
                              className="flex items-start space-x-2.5 text-left flex-1 min-w-0 cursor-pointer"
                            >
                              <span
                                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                  done
                                    ? 'bg-emerald-500 border-emerald-400 text-black'
                                    : 'border-gray-500 text-transparent'
                                }`}
                              >
                                <Check className="w-3 h-3" />
                              </span>
                              <div className="min-w-0">
                                <div
                                  className={`text-xs font-semibold break-words ${
                                    done ? 'line-through text-gray-500' : 'text-gray-100'
                                  }`}
                                >
                                  {task.title}
                                </div>
                                {task.notes && (
                                  <div className="text-[11px] text-gray-400 mt-0.5 break-words">
                                    {task.notes}
                                  </div>
                                )}
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRequestDeleteTask(task)}
                              className="p-1 text-gray-500 hover:text-rose-400 rounded cursor-pointer shrink-0"
                              title="Xóa công việc"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* ================================================= */}
              {/* TAB 4: DỰ ÁN GEMINI AI (Server Proxy & Render)    */}
              {/* ================================================= */}
              {activeTab === 'gemini' && (
                <div className="space-y-3">
                  {/* Connected Gemini Project Overview Card */}
                  <div className="p-3 rounded-xl bg-gradient-to-br from-[#1b1530] to-[#131625] border border-purple-500/35 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                          <span className="font-bold text-xs text-purple-200 truncate">
                            Dự án Gemini Cloud đã liên kết
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-gray-300 truncate">
                          Project ID:{' '}
                          <span className="text-amber-300 font-bold">
                            {geminiProject?.projectId || 'gen-lang-client-0593049002'}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Project #{geminiProject?.projectNumber || '591209272290'} • Model:{' '}
                          <span className="font-mono text-emerald-300">
                            {geminiProject?.model || 'gemini-4-hydrogen'}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                          geminiOverallStatus === 'FAIL'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : geminiOverallStatus === 'WARN' || (geminiProject && !geminiProject.ok)
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : geminiProject?.ok
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {isCheckingGemini
                          ? 'Đang kiểm tra...'
                          : geminiOverallStatus === 'FAIL'
                          ? 'Lỗi xác thực Key'
                          : geminiOverallStatus === 'WARN'
                          ? 'Cảnh báo'
                          : geminiProject?.ok
                          ? 'Sẵn sàng'
                          : 'Chờ cấu hình Key'}
                      </span>
                    </div>

                    <div className="text-[11px] text-gray-300 bg-black/25 rounded-lg px-2.5 py-1.5 border border-white/5 leading-relaxed">
                      {geminiProject?.message ||
                        'Đang kiểm tra kết nối tới máy chủ Gemini Server Proxy...'}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => checkGeminiProject(true)}
                        disabled={isCheckingGemini}
                        className="px-3 py-1.5 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-lg text-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isCheckingGemini ? 'animate-spin' : ''}`}
                        />
                        <span>Kiểm tra kết nối Gemini Project</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('pydroid:run-gemini-diagnostic'));
                          }
                        }}
                        className="px-2.5 py-1.5 bg-[#232238] hover:bg-[#2e2d48] text-amber-300 border border-amber-500/30 font-semibold rounded-lg text-xs flex items-center space-x-1 cursor-pointer"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Chẩn đoán Terminal</span>
                      </button>
                    </div>

                    {geminiTestedModels.length > 0 && (
                      <div className="space-y-1.5 pt-1 border-t border-white/10">
                        {geminiTestedModels.map((m) => (
                          <div
                            key={m.model}
                            className="bg-black/30 px-2 py-1.5 rounded border border-white/5 space-y-0.5"
                          >
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-mono text-gray-200">{m.model}</span>
                              <span
                                className={
                                  m.status === 'PASS'
                                    ? 'text-emerald-300 font-bold'
                                    : m.status === 'WARN'
                                    ? 'text-amber-300 font-bold'
                                    : 'text-rose-300 font-bold'
                                }
                              >
                                {m.status} ({m.latencyMs}ms){m.httpStatus ? ` • HTTP ${m.httpStatus}` : ''}
                              </span>
                            </div>
                            {m.status !== 'PASS' && m.message && (
                              <div className="text-[10px] text-rose-200/90 leading-snug">
                                {m.message}
                              </div>
                            )}
                          </div>
                        ))}
                        {geminiOverallStatus === 'FAIL' && (
                          <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-[10px] text-rose-200 leading-relaxed space-y-1">
                            <div className="font-bold text-rose-300">
                              Cách khắc phục trên máy chủ Render ({renderUrl}):
                            </div>
                            <div>
                              1. Tạo khóa Gemini API tại <span className="font-mono text-amber-300">aistudio.google.com/apikey</span> (không dùng Firebase Web API Key).
                            </div>
                            <div>
                              2. Nếu khóa có giới hạn <span className="font-semibold">HTTP Referrer</span> trong Google Cloud Console, hãy đổi sang <span className="font-mono text-amber-300">None</span> để máy chủ Render gọi được.
                            </div>
                            <div>
                              3. Vào Render Dashboard → Service <span className="font-mono">pydroid3-android</span> → <span className="font-semibold">Environment</span> → cập nhật biến <span className="font-mono text-emerald-300">GEMINI_API_KEY</span> (không khoảng trắng/ngoặc kép) rồi Save & Deploy.
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quick Workspace <-> Gemini IDE Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAiAssistant?.();
                      }}
                      className="p-2.5 rounded-xl bg-[#151525] hover:bg-[#1e1e33] border border-[#2f2e4b] text-left space-y-1 transition cursor-pointer"
                    >
                      <div className="flex items-center space-x-1.5 text-sky-300 font-bold text-xs">
                        <Bot className="w-4 h-4" />
                        <span>Mở Trợ lý Chat AI</span>
                      </div>
                      <p className="text-[10px] text-gray-400">
                        Hỏi đáp Python streaming & Live WebSocket
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAutoFix?.();
                      }}
                      className="p-2.5 rounded-xl bg-[#151525] hover:bg-[#1e1e33] border border-[#2f2e4b] text-left space-y-1 transition cursor-pointer"
                    >
                      <div className="flex items-center space-x-1.5 text-amber-300 font-bold text-xs">
                        <Wrench className="w-4 h-4" />
                        <span>Sửa lỗi bằng Gemini</span>
                      </div>
                      <p className="text-[10px] text-gray-400">
                        Phân tích & sửa code {currentFileName}
                      </p>
                    </button>
                  </div>

                  {/* Quick Live Prompt Bridge directly inside Gemini Project Tab */}
                  <div className="p-3 rounded-xl bg-[#13131c] border border-[#2a2940] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-gray-200">
                        Truy vấn nhanh Gemini cho {currentFileName}
                      </span>
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          disabled={isRunningGeminiPrompt}
                          onClick={async () => {
                            setIsRunningGeminiPrompt(true);
                            setGeminiQuickOutput('');
                            try {
                              await sendGeminiChatStream(
                                [
                                  {
                                    role: 'user',
                                    content: `Giải thích ngắn gọn mục đích và luồng chạy của đoạn code Python sau:\n\`\`\`python\n${currentCode}\n\`\`\``,
                                  },
                                ],
                                undefined,
                                (chunk) => setGeminiQuickOutput((prev) => prev + chunk),
                                { code: currentCode, instruction: 'explain_source_code' }
                              );
                            } finally {
                              setIsRunningGeminiPrompt(false);
                            }
                          }}
                          className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[10px] font-semibold cursor-pointer disabled:opacity-50"
                        >
                          Giải thích code
                        </button>
                        <button
                          type="button"
                          disabled={isRunningGeminiPrompt}
                          onClick={async () => {
                            setIsRunningGeminiPrompt(true);
                            setGeminiQuickOutput('');
                            try {
                              await sendGeminiChatStream(
                                [
                                  {
                                    role: 'user',
                                    content: `Tối ưu chuẩn PEP 8 và trả về mã Python hoàn chỉnh cho:\n\`\`\`python\n${currentCode}\n\`\`\``,
                                  },
                                ],
                                'pep8',
                                (chunk) => setGeminiQuickOutput((prev) => prev + chunk),
                                { code: currentCode, instruction: 'optimize_pep8' }
                              );
                            } finally {
                              setIsRunningGeminiPrompt(false);
                            }
                          }}
                          className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold cursor-pointer disabled:opacity-50"
                        >
                          Tối ưu PEP 8
                        </button>
                      </div>
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const promptText = geminiQuickPrompt.trim();
                        if (!promptText || isRunningGeminiPrompt) return;
                        setIsRunningGeminiPrompt(true);
                        setGeminiQuickOutput('');
                        try {
                          await sendGeminiChatStream(
                            [
                              {
                                role: 'user',
                                content: `File hiện tại (${currentFileName}):\n\`\`\`python\n${currentCode}\n\`\`\`\n\nYêu cầu: ${promptText}`,
                              },
                            ],
                            promptText,
                            (chunk) => setGeminiQuickOutput((prev) => prev + chunk),
                            { code: currentCode }
                          );
                        } finally {
                          setIsRunningGeminiPrompt(false);
                        }
                      }}
                      className="flex items-center space-x-1.5"
                    >
                      <input
                        type="text"
                        value={geminiQuickPrompt}
                        onChange={(e) => setGeminiQuickPrompt(e.target.value)}
                        placeholder="Nhập yêu cầu cho Gemini (VD: Viết hàm kiểm tra số nguyên tố)..."
                        className="flex-1 bg-[#1b1b29] border border-[#2f2e46] rounded-lg px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-400"
                      />
                      <button
                        type="submit"
                        disabled={!geminiQuickPrompt.trim() || isRunningGeminiPrompt}
                        className="px-3 py-1.5 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-lg text-xs flex items-center space-x-1 cursor-pointer disabled:opacity-40"
                      >
                        {isRunningGeminiPrompt ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>Gửi</span>
                      </button>
                    </form>

                    {geminiQuickOutput && (
                      <div className="space-y-2 pt-1">
                        <pre className="p-2.5 rounded-lg bg-[#0d0d15] border border-[#2b2a42] text-[11px] font-mono text-gray-200 whitespace-pre-wrap max-h-44 overflow-y-auto select-text">
                          {geminiQuickOutput}
                        </pre>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(geminiQuickOutput);
                              showBanner(true, 'Đã sao chép phản hồi Gemini!');
                            }}
                            className="px-2 py-1 bg-[#222136] hover:bg-[#2d2c48] text-gray-200 rounded text-[10px] font-semibold flex items-center space-x-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Sao chép</span>
                          </button>
                          {(() => {
                            const match = geminiQuickOutput.match(/```(?:python)?\s*([\s\S]*?)```/);
                            const extractedCode = match?.[1]?.trim();
                            if (!extractedCode) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  onLoadCodeToEditor(currentFileName, extractedCode);
                                  onClose();
                                }}
                                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded text-[10px] cursor-pointer"
                              >
                                Áp dụng code vào Editor
                              </button>
                            );
                          })()}
                          {!needsAuth && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('notes');
                                setEditingNoteId(null);
                                setNoteTitle(`Gemini AI: ${currentFileName}`);
                                setNoteContent(geminiQuickOutput);
                                setNoteColor('purple');
                                setIsNoteFormOpen(true);
                              }}
                              className="px-2.5 py-1 bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-400/40 font-bold rounded text-[10px] cursor-pointer"
                            >
                              Lưu vào Ghi chú Cloud
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="h-11 border-t border-[#29283d] px-4 flex items-center justify-between shrink-0 bg-[#13131c] text-[11px] text-gray-400">
          <a
            href={renderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:underline flex items-center space-x-1"
          >
            <span>Mở bản Web Render</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1 bg-[#262538] hover:bg-[#32314a] text-gray-200 font-bold rounded-lg text-xs cursor-pointer"
          >
            Đóng
          </button>
        </div>

        {/* Mandatory Explicit Confirmation Modal for Mutating/Destructive Workspace Actions */}
        {pendingConfirm && (
          <div className="absolute inset-0 bg-black/80 z-20 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[#1b1b28] border border-[#3a3856] rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-2xl">
              <div className="flex items-start space-x-2.5">
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    pendingConfirm.isDanger
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-gray-100">{pendingConfirm.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {pendingConfirm.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  disabled={isExecutingConfirm}
                  onClick={() => setPendingConfirm(null)}
                  className="flex-1 py-2 bg-[#27263a] hover:bg-[#32314a] text-gray-200 font-semibold rounded-xl text-xs cursor-pointer disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={isExecutingConfirm}
                  onClick={async () => {
                    setIsExecutingConfirm(true);
                    try {
                      await pendingConfirm.onConfirm();
                    } finally {
                      setIsExecutingConfirm(false);
                      setPendingConfirm(null);
                    }
                  }}
                  className={`flex-1 py-2 font-bold rounded-xl text-xs cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5 ${
                    pendingConfirm.isDanger
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-amber-400 hover:bg-amber-300 text-black'
                  }`}
                >
                  {isExecutingConfirm && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{pendingConfirm.confirmLabel}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
