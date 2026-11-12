import { SnippetItem, SnippetCategory } from '../types';

const DB_NAME = 'PydroidSnippetVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'snippets';
const LOCAL_STORAGE_FALLBACK_KEY = 'pydroid_snippet_vault_backup';

export const DEFAULT_CRITICAL_SNIPPETS: Array<Omit<SnippetItem, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    title: 'Khung Chương Trình Chuẩn PEP 8 (__main__)',
    description: 'Cấu trúc tiêu chuẩn quốc tế cho dự án Python với type hints và hàm main().',
    category: 'template',
    tags: ['template', 'pep8', 'main', 'typehints'],
    isFavorite: true,
    code: `# ==========================================================
# Mẫu Khung Chương Trình Python Chuẩn PEP 8 Quốc Tế
# ==========================================================
import sys
from typing import Optional, List, Dict, Any

def khoi_tao_he_thong() -> None:
    """Khởi tạo cấu hình và tham số hệ thống."""
    print("🚀 Pydroid 3 - Khởi chạy chương trình thành công!")

def xu_ly_chinh(tham_so: Optional[str] = None) -> int:
    """Thực thi luồng nghiệp vụ chính."""
    print(f"Đang xử lý nghiệp vụ với tham số: {tham_so}")
    return 0

if __name__ == "__main__":
    khoi_tao_he_thong()
    ma_thoat = xu_ly_chinh("Mặc định")
    sys.exit(ma_thoat)
`,
  },
  {
    title: 'Xử Lý Ngoại Lệ Toàn Diện (try-except-else-finally)',
    description: 'Bắt lỗi chia cho 0, lỗi kiểu dữ liệu và giải phóng tài nguyên an toàn.',
    category: 'utility',
    tags: ['exception', 'try-except', 'safe', 'error-handling'],
    isFavorite: true,
    code: `# ==========================================================
# Xử Lý Ngoại Lệ Toàn Diện (try - except - else - finally)
# ==========================================================
from typing import Optional

def chia_an_toan(so_bi_chia: float, so_chia: float) -> Optional[float]:
    """Chia hai số có bắt lỗi ZeroDivision và TypeError an toàn."""
    try:
        ket_qua = so_bi_chia / so_chia
    except ZeroDivisionError as loi_chia:
        print(f"⚠️ Lỗi: Không thể chia cho 0! ({loi_chia})")
        return None
    except TypeError as loi_kieu:
        print(f"⚠️ Lỗi: Sai kiểu dữ liệu! ({loi_kieu})")
        return None
    except Exception as loi_khac:
        print(f"⚠️ Lỗi không xác định: {loi_khac}")
        return None
    else:
        print("✅ Phép tính hoàn tất không gặp ngoại lệ.")
        return ket_qua
    finally:
        print("🔒 [Khối finally]: Luôn chạy để giải phóng tài nguyên.")

if __name__ == "__main__":
    print("Kết quả 1:", chia_an_toan(10, 2))
    print("Kết quả 2:", chia_an_toan(10, 0))
`,
  },
  {
    title: 'Đọc Ghi File An Toàn UTF-8 (with open)',
    description: 'Context manager tự động đóng file và xử lý tiếng Việt UTF-8 chuẩn xác.',
    category: 'utility',
    tags: ['file', 'io', 'context-manager', 'utf-8'],
    isFavorite: false,
    code: `# ==========================================================
# Đọc Ghi File An Toàn Với Context Manager (with open)
# ==========================================================
import os

def ghi_va_doc_tep(duong_dan: str, noi_dung: str) -> None:
    """Ghi và đọc dữ liệu UTF-8 an toàn trên bộ nhớ thiết bị."""
    # 1. Ghi tệp
    with open(duong_dan, "w", encoding="utf-8") as f_ghi:
        f_ghi.write(noi_dung)
    print(f"💾 Đã lưu dữ liệu vào '{duong_dan}' thành công!")

    # 2. Đọc tệp
    if os.path.exists(duong_dan):
        with open(duong_dan, "r", encoding="utf-8") as f_doc:
            ket_qua = f_doc.read()
        print(f"📖 Nội dung đọc từ '{duong_dan}':\\n{ket_qua}")

if __name__ == "__main__":
    ghi_va_doc_tep("offline_notes.txt", "Tập tin lưu trong Vault cục bộ.\\nHoạt động 100% không cần mạng!")
`,
  },
  {
    title: 'Sắp Xếp Nhanh QuickSort (O(N log N))',
    description: 'Thuật toán sắp xếp nhanh kinh điển tối ưu bằng List Comprehension.',
    category: 'algorithm',
    tags: ['algorithm', 'sort', 'quicksort', 'recursion'],
    isFavorite: true,
    code: `# ==========================================================
# Thuật Toán Sắp Xếp Nhanh (QuickSort Đệ Quy)
# ==========================================================
from typing import List

def sap_xep_nhanh(danh_sach: List[int]) -> List[int]:
    """Sắp xếp mảng số nguyên theo thứ tự tăng dần."""
    if len(danh_sach) <= 1:
        return danh_sach

    chot = danh_sach[len(danh_sach) // 2]
    nho_hon = [x for x in danh_sach if x < chot]
    bang_nhau = [x for x in danh_sach if x == chot]
    lon_hon = [x for x in danh_sach if x > chot]

    return sap_xep_nhanh(nho_hon) + bang_nhau + sap_xep_nhanh(lon_hon)

if __name__ == "__main__":
    mang_so = [42, 17, 89, 5, 23, 76, 12, 99, 1]
    mang_sap_xep = sap_xep_nhanh(mang_so)
    print("Mảng ban đầu:   ", mang_so)
    print("Mảng đã sắp xếp:", mang_sap_xep)
`,
  },
  {
    title: 'Tìm Kiếm Nhị Phân (Binary Search O(log N))',
    description: 'Tìm kiếm phần tử trên mảng đã sắp xếp với độ phức tạp logarit O(log N).',
    category: 'algorithm',
    tags: ['algorithm', 'search', 'binary-search'],
    isFavorite: false,
    code: `# ==========================================================
# Thuật Toán Tìm Kiếm Nhị Phân (Binary Search)
# ==========================================================
from typing import List, Optional

def tim_kiem_nhi_phan(mang_tang_dan: List[int], khoa_can_tim: int) -> Optional[int]:
    """Trả về vị trí index của phần tử cần tìm, hoặc None nếu không tồn tại."""
    dau = 0
    cuoi = len(mang_tang_dan) - 1

    while dau <= cuoi:
        giua = (dau + cuoi) // 2
        gia_tri_giua = mang_tang_dan[giua]

        if gia_tri_giua == khoa_can_tim:
            return giua
        elif gia_tri_giua < khoa_can_tim:
            dau = giua + 1
        else:
            cuoi = giua - 1

    return None

if __name__ == "__main__":
    mang = [3, 8, 15, 24, 37, 49, 62, 78, 85, 96]
    muc_tieu = 49
    vi_tri = tim_kiem_nhi_phan(mang, muc_tieu)
    print(f"Tìm số {muc_tieu} trong mảng -> Index: {vi_tri}")
`,
  },
  {
    title: 'Xử Lý Dữ Liệu JSON Chuẩn (loads & dumps)',
    description: 'Chuyển đổi Dict sang chuỗi JSON có format thụt lề và giải mã an toàn.',
    category: 'data',
    tags: ['json', 'serialization', 'dict', 'data'],
    isFavorite: false,
    code: `# ==========================================================
# Xử Lý & Chuyển Đổi Dữ Liệu JSON Chuẩn
# ==========================================================
import json

du_lieu_mau = {
    "ten_ung_dung": "Pydroid 3 Web",
    "phien_ban": "3.12.7",
    "tinh_nang": ["Chạy Python WASM", "Kho Snippet Vault Offline", "Hỗ trợ Android"],
    "trang_thai": True,
    "thiet_lap": {
        "thut_le": 4,
        "co_chu": 14,
        "giao_dien": "AMOLED Dark"
    }
}

# 1. Chuyển Dict sang chuỗi JSON (indent=4, giữ nguyên tiếng Việt)
chuoi_json = json.dumps(du_lieu_mau, ensure_ascii=False, indent=4)
print("=== CHUỖI JSON ===")
print(chuoi_json)

# 2. Giải mã JSON sang Python Dictionary
du_lieu_giai_ma = json.loads(chuoi_json)
print("\\nỨng dụng:", du_lieu_giai_ma["ten_ung_dung"])
print("Số tính năng:", len(du_lieu_giai_ma["tinh_nang"]))
`,
  },
  {
    title: 'Decorator Đo Thời Gian Thực Thi (Benchmark Timing)',
    description: 'Decorator đo thời gian chạy hàm tính bằng milliseconds với precision cao.',
    category: 'utility',
    tags: ['decorator', 'performance', 'timing', 'benchmark'],
    isFavorite: true,
    code: `# ==========================================================
# Decorator Đo Thời Gian Thực Thi Hàm (Benchmark)
# ==========================================================
import time
from functools import wraps
from typing import Callable, Any

def do_thoi_gian(ham: Callable) -> Callable:
    """Decorator tính thời gian thực thi của hàm mục tiêu."""
    @wraps(ham)
    def ham_bao_boc(*args, **kwargs) -> Any:
        thoi_diem_dau = time.perf_counter()
        ket_qua = ham(*args, **kwargs)
        thoi_diem_cuoi = time.perf_counter()
        tong_thoi_gian_ms = (thoi_diem_cuoi - thoi_diem_dau) * 1000
        print(f"⏱️ Hàm '{ham.__name__}' thực thi trong: {tong_thoi_gian_ms:.3f} ms")
        return ket_qua
    return ham_bao_boc

@do_thoi_gian
def tinh_tong_binh_phuong(gioi_han: int) -> int:
    """Tính tổng bình phương từ 1 đến N."""
    return sum(so * so for so in range(1, gioi_han + 1))

if __name__ == "__main__":
    dap_an = tinh_tong_binh_phuong(500000)
    print("Tổng kết quả:", dap_an)
`,
  },
];

/**
 * Open or create IndexedDB instance for Snippet Vault
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB không được hỗ trợ trong môi trường này'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('isFavorite', 'isFavorite', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Không thể mở IndexedDB'));
    };
  });
}

/**
 * Fallback to localStorage if IndexedDB is blocked by iframe security
 */
function getLocalStorageFallback(): SnippetItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return [];
}

function saveLocalStorageFallback(items: SnippetItem[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(items));
  } catch (_) {}
}

/**
 * Get all snippets from IndexedDB with auto-seeding on first run
 */
export async function getAllVaultSnippets(): Promise<SnippetItem[]> {
  try {
    const db = await openDB();
    const items = await new Promise<SnippetItem[]>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    if (items.length === 0) {
      // First-run seed
      const seeded = await seedDefaultSnippets();
      saveLocalStorageFallback(seeded);
      return seeded;
    }

    saveLocalStorageFallback(items);
    return items.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.warn('[SnippetVault] IndexedDB không sẵn sàng, sử dụng bộ lưu trữ dự phòng:', err);
    const fallback = getLocalStorageFallback();
    if (fallback.length === 0) {
      const initial = DEFAULT_CRITICAL_SNIPPETS.map((s, idx) => ({
        ...s,
        id: `seed_snippet_${idx + 1}`,
        createdAt: Date.now() - idx * 1000,
        updatedAt: Date.now() - idx * 1000,
      }));
      saveLocalStorageFallback(initial);
      return initial;
    }
    return fallback.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

/**
 * Seed initial critical snippets
 */
export async function seedDefaultSnippets(): Promise<SnippetItem[]> {
  try {
    const db = await openDB();
    const seededList: SnippetItem[] = [];

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      DEFAULT_CRITICAL_SNIPPETS.forEach((item, index) => {
        const fullItem: SnippetItem = {
          ...item,
          id: `seed_snippet_${Date.now()}_${index}`,
          createdAt: Date.now() - (DEFAULT_CRITICAL_SNIPPETS.length - index) * 1000,
          updatedAt: Date.now() - (DEFAULT_CRITICAL_SNIPPETS.length - index) * 1000,
        };
        store.put(fullItem);
        seededList.push(fullItem);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    return seededList.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (_) {
    return DEFAULT_CRITICAL_SNIPPETS.map((s, idx) => ({
      ...s,
      id: `seed_snippet_${idx + 1}`,
      createdAt: Date.now() - idx * 1000,
      updatedAt: Date.now() - idx * 1000,
    }));
  }
}

/**
 * Save or update a snippet in the Vault
 */
export async function saveVaultSnippet(
  data: Partial<SnippetItem> & { title: string; code: string }
): Promise<SnippetItem> {
  const now = Date.now();
  const id = data.id || `snippet_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const item: SnippetItem = {
    id,
    title: data.title.trim() || 'Đoạn mã Python không tên',
    code: data.code || '',
    description: (data.description || '').trim(),
    category: data.category || 'custom',
    tags: Array.isArray(data.tags) ? data.tags.filter(Boolean) : [],
    isFavorite: Boolean(data.isFavorite),
    createdAt: data.createdAt || now,
    updatedAt: now,
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[SnippetVault] Lưu qua localStorage fallback do IndexedDB bận:', err);
  }

  // Always update backup mirror
  const current = getLocalStorageFallback().filter((s) => s.id !== item.id);
  current.unshift(item);
  saveLocalStorageFallback(current);

  return item;
}

/**
 * Delete a snippet from the Vault
 */
export async function deleteVaultSnippet(id: string): Promise<boolean> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[SnippetVault] Xoá trên fallback store:', err);
  }

  const current = getLocalStorageFallback().filter((s) => s.id !== id);
  saveLocalStorageFallback(current);
  return true;
}

/**
 * Toggle favorite status
 */
export async function toggleFavoriteVaultSnippet(id: string): Promise<boolean> {
  const snippets = await getAllVaultSnippets();
  const target = snippets.find((s) => s.id === id);
  if (!target) return false;

  target.isFavorite = !target.isFavorite;
  await saveVaultSnippet(target);
  return target.isFavorite;
}

/**
 * Export all snippets to JSON string for backup
 */
export async function exportVaultToJson(): Promise<string> {
  const snippets = await getAllVaultSnippets();
  const exportPayload = {
    app: 'Pydroid 3 Web - Snippet Vault',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    totalSnippets: snippets.length,
    snippets,
  };
  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Import snippets from JSON backup string
 */
export async function importVaultFromJson(jsonString: string): Promise<number> {
  try {
    const parsed = JSON.parse(jsonString);
    const snippetsToImport: SnippetItem[] = Array.isArray(parsed)
      ? parsed
      : (Array.isArray(parsed.snippets) ? parsed.snippets : []);

    let importedCount = 0;
    for (const item of snippetsToImport) {
      if (item && item.title && item.code) {
        await saveVaultSnippet(item);
        importedCount++;
      }
    }
    return importedCount;
  } catch (err) {
    throw new Error('Dữ liệu JSON không đúng định dạng sao lưu của Kho Snippet.');
  }
}
