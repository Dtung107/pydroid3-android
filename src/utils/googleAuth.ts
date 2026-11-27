import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  browserPopupRedirectResolver,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  Auth,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const DEFAULT_RENDER_BACKEND_URL = 'https://pydroid3-android.onrender.com';
const RENDER_BACKEND_STORAGE_KEY = 'pydroid_render_backend_url';

export const GOOGLE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/tasks',
];

export interface GoogleAccountProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}

export function getRenderBackendUrl(): string {
  try {
    const saved = localStorage.getItem(RENDER_BACKEND_STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  } catch (_) {}
  return DEFAULT_RENDER_BACKEND_URL;
}

export function setRenderBackendUrl(url: string): string {
  const clean = url.trim().replace(/\/+$/, '');
  try {
    if (clean) {
      localStorage.setItem(RENDER_BACKEND_STORAGE_KEY, clean);
    } else {
      localStorage.removeItem(RENDER_BACKEND_STORAGE_KEY);
    }
  } catch (_) {}
  return clean || DEFAULT_RENDER_BACKEND_URL;
}

export function isRunningInsideNativeApk(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'capacitor:' ||
    (window as any).AndroidFileBridge !== undefined ||
    ((window as any).Capacitor !== undefined &&
      typeof (window as any).Capacitor?.isNativePlatform === 'function' &&
      (window as any).Capacitor.isNativePlatform())
  );
}

// Reuse existing Firebase app if already initialized.
// Use initializeAuth WITHOUT eager popupRedirectResolver at startup so mobile/iframe/APK environments
// do not proactively open and timeout on hidden __/auth/iframe pings during boot.
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
function createFirebaseAuth(firebaseApp: FirebaseApp): Auth {
  try {
    return initializeAuth(firebaseApp, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
      ],
    });
  } catch {
    return getAuth(firebaseApp);
  }
}
const auth = createFirebaseAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of GOOGLE_WORKSPACE_SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'select_account',
});

// In-memory only cache (NEVER stored in localStorage or sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedProfile: GoogleAccountProfile | null = null;
const authListeners = new Set<
  (profile: GoogleAccountProfile | null, token: string | null) => void
>();

function toProfile(user: User): GoogleAccountProfile {
  return {
    uid: user.uid,
    displayName: user.displayName || user.email || 'Người dùng Google',
    email: user.email || '',
    photoURL: user.photoURL || '',
  };
}

function notifyAuthListeners() {
  for (const cb of authListeners) {
    try {
      cb(cachedProfile, cachedAccessToken);
    } catch (_) {}
  }
}

export function subscribeGoogleAuth(
  cb: (profile: GoogleAccountProfile | null, token: string | null) => void
): () => void {
  authListeners.add(cb);
  cb(cachedProfile, cachedAccessToken);
  return () => {
    authListeners.delete(cb);
  };
}

export const initAuth = (
  onAuthSuccess?: (profile: GoogleAccountProfile, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      cachedProfile = toProfile(user);
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(cachedProfile, cachedAccessToken);
        notifyAuthListeners();
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
        notifyAuthListeners();
      }
    } else if (!cachedApkBridgeSession()) {
      cachedAccessToken = null;
      cachedProfile = null;
      if (onAuthFailure) onAuthFailure();
      notifyAuthListeners();
    }
  });
};

function cachedApkBridgeSession(): boolean {
  return Boolean(isRunningInsideNativeApk() && cachedAccessToken && cachedProfile);
}

// Register native Android APK callback (receives URL fragment from system Chrome browser in memory)
if (typeof window !== 'undefined') {
  (window as any).__handleApkGoogleAuthCallback = (fragmentString: string) => {
    try {
      const cleanFragment = String(fragmentString || '').replace(/^#/, '');
      const params = new URLSearchParams(cleanFragment);
      const token = params.get('access_token');
      if (!token) return;

      cachedAccessToken = token;
      cachedProfile = {
        uid: params.get('uid') || 'apk_google_user',
        displayName: params.get('name') || params.get('email') || 'Tài khoản Google',
        email: params.get('email') || '',
        photoURL: params.get('photo') || '',
      };
      notifyAuthListeners();
      window.dispatchEvent(
        new CustomEvent('pydroid:google-auth-updated', {
          detail: { profile: cachedProfile, hasToken: true },
        })
      );
    } catch (err) {
      console.warn('APK Google auth callback parse warning:', err);
    }
  };
}

export function launchApkSystemBrowserAuth(): boolean {
  if (typeof window === 'undefined') return false;
  const bridge = (window as any).AndroidFileBridge;
  if (bridge && typeof bridge.openExternalBrowser === 'function') {
    const backendUrl = getRenderBackendUrl();
    const targetUrl = `${backendUrl}/?apk_auth=1`;
    return Boolean(bridge.openExternalBrowser(targetUrl));
  }
  return false;
}

export const googleSignIn = async (options?: {
  forcePopup?: boolean;
}): Promise<{ profile: GoogleAccountProfile; accessToken: string } | null> => {
  // In native Android APK, Google blocks embedded WebViews (disallowed_useragent).
  // Open system Chrome on the user's Render web app (client-side Firebase Auth) which returns via deep-link fragment.
  if (isRunningInsideNativeApk() && !options?.forcePopup) {
    const launched = launchApkSystemBrowserAuth();
    if (launched) {
      return null;
    }
  }

  if (isSigningIn) {
    return null;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const offlineError: any = new Error('Thiết bị đang ngoại tuyến (offline). Vui lòng kết nối mạng và thử lại.');
    offlineError.code = 'auth/network-request-failed';
    throw offlineError;
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Không nhận được mã truy cập Google từ Firebase Auth.');
    }

    cachedAccessToken = credential.accessToken;
    cachedProfile = toProfile(result.user);
    notifyAuthListeners();
    return { profile: cachedProfile, accessToken: cachedAccessToken };
  } catch (error: any) {
    const code = error?.code || '';
    // Closing, cancelling, or encountering transient network/iframe blocks during OAuth is non-fatal
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/popup-blocked' ||
      code === 'auth/network-request-failed'
    ) {
      console.info('Google Sign-In interrupted:', code);
    } else {
      console.warn('Google Sign-In warning:', code || error?.message || error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentGoogleProfile = (): GoogleAccountProfile | null => {
  return cachedProfile;
};

export const clearAccessTokenInMemory = () => {
  cachedAccessToken = null;
  notifyAuthListeners();
};

export const logout = async () => {
  cachedAccessToken = null;
  cachedProfile = null;
  try {
    if (auth.currentUser) {
      await auth.signOut();
    }
  } catch (_) {}
  notifyAuthListeners();
};

export function formatGoogleAuthErrorMessage(err: any): string {
  const code = err?.code || '';
  const msg = err?.message || String(err || '');

  if (code === 'auth/popup-closed-by-user') {
    const inIframe = typeof window !== 'undefined' && window.self !== window.top;
    return inIframe
      ? 'Cửa sổ đăng nhập Google đã bị đóng trước khi hoàn tất. Vui lòng thử bấm đăng nhập lại hoặc mở ứng dụng trong tab trình duyệt mới.'
      : 'Bạn đã đóng cửa sổ đăng nhập Google trước khi hoàn tất. Vui lòng bấm đăng nhập lại nếu muốn kết nối.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Trình duyệt đang chặn cửa sổ bật lên (Popup). Vui lòng cho phép mở popup hoặc mở ứng dụng ở tab mới rồi bấm đăng nhập lại.';
  }
  if (code === 'auth/network-request-failed') {
    const inIframe = typeof window !== 'undefined' && window.self !== window.top;
    return inIframe
      ? 'Không thể kết nối máy chủ xác thực Google (mạng chậm hoặc trình duyệt đang chặn iframe bên thứ ba). Vui lòng kiểm tra Wi-Fi/4G, tắt trình chặn quảng cáo hoặc mở ứng dụng trong tab trình duyệt mới rồi thử lại.'
      : 'Lỗi kết nối mạng khi xác thực Google. Vui lòng kiểm tra kết nối Internet, tắt trình chặn quảng cáo/VPN nếu có và thử lại.';
  }
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return `Tên miền "${host}" chưa được thêm vào Authorized Domains trong Firebase Console (Authentication -> Settings -> Authorized domains).`;
  }
  if (code === 'auth/cancelled-popup-request') {
    return 'Yêu cầu đăng nhập trước đó đã bị hủy. Vui lòng thử lại.';
  }
  if (code === 'auth/web-storage-unsupported') {
    return 'Trình duyệt đang tắt cookie/lưu trữ web (Web Storage). Vui lòng bật lại để đăng nhập Google.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Phương thức đăng nhập Google chưa được bật trong Firebase Console (Authentication -> Sign-in method).';
  }
  if (code === 'auth/internal-error') {
    return 'Lỗi nội bộ từ dịch vụ xác thực Google. Vui lòng tải lại trang và thử đăng nhập lại.';
  }
  if (msg.includes('disallowed_useragent')) {
    return 'Google không cho phép đăng nhập bên trong WebView nhúng. Hệ thống sẽ mở trình duyệt Chrome để đăng nhập an toàn.';
  }
  return msg || 'Không thể đăng nhập tài khoản Google lúc này.';
}
