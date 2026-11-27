export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
}

export interface CloudNote {
  id: string;
  title: string;
  content: string;
  color: 'amber' | 'sky' | 'emerald' | 'purple' | 'rose';
  pinned: boolean;
  updatedAt: number;
}

export interface GoogleTaskListItem {
  id: string;
  title: string;
}

export interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  updated?: string;
}

export class WorkspaceAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'WorkspaceAuthError';
    this.status = status;
  }
}

async function googleFetch(url: string, accessToken: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 401) {
    throw new WorkspaceAuthError('Phiên đăng nhập Google đã hết hạn. Vui lòng đăng nhập lại.', 401);
  }
  if (res.status === 403) {
    const errBody = await res.json().catch(() => ({}));
    const reason = errBody?.error?.message || 'Tài khoản chưa cấp đủ quyền truy cập Google Workspace.';
    throw new WorkspaceAuthError(reason, 403);
  }

  return res;
}

// ======================================================
// 1. GOOGLE DRIVE API (Files & "Pydroid 3" Folder)
// ======================================================

const PYDROID_FOLDER_NAME = 'Pydroid 3';
const NOTES_APP_DATA_FILENAME = 'pydroid3_keep_notes.json';

export async function ensurePydroidDriveFolder(accessToken: string): Promise<string> {
  const q = encodeURIComponent(
    `name='${PYDROID_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const searchRes = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=5`,
    accessToken
  );
  if (searchRes.ok) {
    const data = await searchRes.json();
    if (Array.isArray(data.files) && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  const createRes = await googleFetch('https://www.googleapis.com/drive/v3/files?fields=id,name', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: PYDROID_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Không thể tạo thư mục Pydroid 3 trên Google Drive.');
  }
  const created = await createRes.json();
  return created.id;
}

export async function listDrivePythonFiles(
  accessToken: string,
  searchQuery?: string
): Promise<DriveFileItem[]> {
  const cleanSearch = (searchQuery || '').trim().replace(/'/g, "\\'");
  const clauses = [
    'trashed = false',
    "mimeType != 'application/vnd.google-apps.folder'",
    "(name contains '.py' or mimeType = 'text/x-python' or mimeType = 'text/plain')",
  ];
  if (cleanSearch) {
    clauses.push(`name contains '${cleanSearch}'`);
  }

  const q = encodeURIComponent(clauses.join(' and '));
  const res = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=50&fields=files(id,name,mimeType,modifiedTime,size,parents)`,
    accessToken
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Lỗi tải danh sách Google Drive (HTTP ${res.status})`);
  }

  const data = await res.json();
  return Array.isArray(data.files) ? data.files : [];
}

export async function readDriveFileContent(accessToken: string, fileId: string): Promise<string> {
  const res = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    accessToken
  );
  if (!res.ok) {
    throw new Error(`Không thể đọc tệp từ Google Drive (HTTP ${res.status})`);
  }
  return await res.text();
}

export async function createDrivePythonFile(
  accessToken: string,
  fileName: string,
  content: string,
  folderId?: string
): Promise<DriveFileItem> {
  const boundary = 'pydroid3_multipart_boundary_' + Date.now();
  const metadata: Record<string, any> = {
    name: fileName.endsWith('.py') ? fileName : `${fileName}.py`,
    mimeType: 'text/x-python',
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/x-python; charset=UTF-8\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const res = await googleFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,parents',
    accessToken,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Lỗi lưu tệp mới lên Google Drive (HTTP ${res.status})`);
  }
  return await res.json();
}

export async function updateDrivePythonFile(
  accessToken: string,
  fileId: string,
  content: string,
  newName?: string
): Promise<DriveFileItem> {
  if (newName) {
    await googleFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
      accessToken,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.endsWith('.py') ? newName : `${newName}.py` }),
      }
    );
  }

  const res = await googleFetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,mimeType,modifiedTime,size`,
    accessToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'text/x-python; charset=UTF-8' },
      body: content,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Lỗi cập nhật tệp trên Google Drive (HTTP ${res.status})`);
  }
  return await res.json();
}

export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  const res = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    accessToken,
    {
      method: 'DELETE',
    }
  );
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Không thể xóa tệp Google Drive (HTTP ${res.status})`);
  }
}

// ======================================================
// 2. KEEP-STYLE CLOUD NOTES (Stored in Drive appDataFolder)
//    Works for all consumer @gmail.com and Workspace accounts
// ======================================================

export async function loadCloudNotes(
  accessToken: string
): Promise<{ fileId: string | null; notes: CloudNote[] }> {
  const q = encodeURIComponent(`name='${NOTES_APP_DATA_FILENAME}' and trashed=false`);
  const listRes = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime)&pageSize=5`,
    accessToken
  );

  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Không thể tải ghi chú từ Google Drive Cloud.');
  }

  const listData = await listRes.json();
  const files = Array.isArray(listData.files) ? listData.files : [];
  if (files.length === 0) {
    return { fileId: null, notes: [] };
  }

  const fileId = files[0].id as string;
  const contentRes = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    accessToken
  );

  if (!contentRes.ok) {
    return { fileId, notes: [] };
  }

  try {
    const parsed = await contentRes.json();
    return {
      fileId,
      notes: Array.isArray(parsed) ? parsed : [],
    };
  } catch (_) {
    return { fileId, notes: [] };
  }
}

export async function saveCloudNotes(
  accessToken: string,
  existingFileId: string | null,
  notes: CloudNote[]
): Promise<string> {
  const jsonPayload = JSON.stringify(notes, null, 2);

  if (existingFileId) {
    const patchRes = await googleFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFileId)}?uploadType=media&fields=id`,
      accessToken,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: jsonPayload,
      }
    );
    if (!patchRes.ok) {
      const err = await patchRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Không thể cập nhật ghi chú trên Google Cloud.');
    }
    const updated = await patchRes.json();
    return updated.id || existingFileId;
  }

  const boundary = 'pydroid3_notes_' + Date.now();
  const metadata = {
    name: NOTES_APP_DATA_FILENAME,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${jsonPayload}\r\n` +
    `--${boundary}--`;

  const createRes = await googleFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }
  );
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Không thể tạo kho ghi chú trên Google Cloud.');
  }
  const created = await createRes.json();
  return created.id;
}

// ======================================================
// 3. GOOGLE TASKS API
// ======================================================

export async function listGoogleTaskLists(accessToken: string): Promise<GoogleTaskListItem[]> {
  const res = await googleFetch(
    'https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=20',
    accessToken
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Không thể tải danh sách Google Tasks.');
  }
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

export async function listGoogleTasks(
  accessToken: string,
  taskListId: string
): Promise<GoogleTaskItem[]> {
  const res = await googleFetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks?showCompleted=true&showHidden=true&maxResults=50`,
    accessToken
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Không thể tải công việc Google Tasks.');
  }
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

export async function createGoogleTask(
  accessToken: string,
  taskListId: string,
  title: string,
  notes?: string
): Promise<GoogleTaskItem> {
  const res = await googleFetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, notes: notes || undefined }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Không thể tạo công việc mới trên Google Tasks.');
  }
  return await res.json();
}

export async function updateGoogleTask(
  accessToken: string,
  taskListId: string,
  taskId: string,
  patch: Partial<Pick<GoogleTaskItem, 'title' | 'notes' | 'status'>>
): Promise<GoogleTaskItem> {
  const res = await googleFetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    accessToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Không thể cập nhật Google Task.');
  }
  return await res.json();
}

export async function deleteGoogleTask(
  accessToken: string,
  taskListId: string,
  taskId: string
): Promise<void> {
  const res = await googleFetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    accessToken,
    {
      method: 'DELETE',
    }
  );
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Không thể xóa Google Task.');
  }
}
