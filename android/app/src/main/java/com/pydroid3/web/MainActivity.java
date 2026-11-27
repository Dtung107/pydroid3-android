package com.pydroid3.web;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Point;
import android.graphics.Rect;
import android.graphics.drawable.ColorDrawable;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.view.View;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private WindowInsetsCompat latestInsets;
    private int lastPadLeft = -1;
    private int lastPadTop = -1;
    private int lastPadRight = -1;
    private int lastPadBottom = -1;
    private ActivityResultLauncher<Intent> openEditableFileLauncher;

    private int[] getScreenSizePx() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Rect bounds = getWindowManager().getCurrentWindowMetrics().getBounds();
                return new int[]{bounds.width(), bounds.height()};
            } else {
                Point size = new Point();
                getWindowManager().getDefaultDisplay().getRealSize(size);
                return new int[]{size.x, size.y};
            }
        } catch (Exception e) {
            return new int[]{0, 0};
        }
    }

    private void applySmartInsets(View targetView, WindowInsetsCompat windowInsets) {
        if (targetView == null || windowInsets == null) return;
        latestInsets = windowInsets;

        Insets sysBars = windowInsets.getInsets(
            WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
        );
        Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());

        int[] screen = getScreenSizePx();
        int screenW = screen[0];
        int screenH = screen[1];

        int[] loc = new int[2];
        targetView.getLocationOnScreen(loc);
        int targetW = targetView.getWidth();
        int targetH = targetView.getHeight();

        // Detect how much space DecorView/adjustResize has ALREADY subtracted from screen bounds
        int alreadyTop = Math.max(0, loc[1]);
        int alreadyLeft = Math.max(0, loc[0]);
        int alreadyBottom = (targetH > 0 && screenH > 0)
            ? Math.max(0, screenH - (loc[1] + targetH))
            : 0;
        int alreadyRight = (targetW > 0 && screenW > 0)
            ? Math.max(0, screenW - (loc[0] + targetW))
            : 0;

        int desiredBottom = Math.max(sysBars.bottom, ime.bottom);

        int padLeft = Math.max(0, sysBars.left - alreadyLeft);
        int padTop = Math.max(0, sysBars.top - alreadyTop);
        int padRight = Math.max(0, sysBars.right - alreadyRight);
        int padBottom = Math.max(0, desiredBottom - alreadyBottom);

        if (padLeft != lastPadLeft || padTop != lastPadTop || padRight != lastPadRight || padBottom != lastPadBottom) {
            lastPadLeft = padLeft;
            lastPadTop = padTop;
            lastPadRight = padRight;
            lastPadBottom = padBottom;
            targetView.setPadding(padLeft, padTop, padRight, padBottom);
        }
    }

    public class AndroidFileBridge {
        private final Context context;

        public AndroidFileBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public boolean saveFile(String fileName, String content) {
            try {
                if (fileName == null || fileName.trim().isEmpty()) {
                    fileName = "untitled.py";
                }
                if (!fileName.endsWith(".py")) {
                    fileName += ".py";
                }

                boolean saved = false;

                // 1. Try MediaStore Downloads on Android 10+ (Q+)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    try {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                        values.put(MediaStore.MediaColumns.MIME_TYPE, "text/plain");
                        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                        Uri uri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (uri != null) {
                            try (OutputStream os = context.getContentResolver().openOutputStream(uri)) {
                                if (os != null) {
                                    os.write(content.getBytes(StandardCharsets.UTF_8));
                                    os.flush();
                                    saved = true;
                                }
                            }
                        }
                    } catch (Exception e) {
                        saved = false;
                    }
                }

                // 2. Fallback to standard public Downloads folder
                if (!saved) {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadsDir.exists()) {
                        downloadsDir.mkdirs();
                    }
                    File targetFile = new File(downloadsDir, fileName);
                    try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                        fos.write(content.getBytes(StandardCharsets.UTF_8));
                        fos.flush();
                        saved = true;
                        MediaScannerConnection.scanFile(context, new String[]{targetFile.getAbsolutePath()}, null, null);
                    }
                }

                if (saved) {
                    final String finalName = fileName;
                    runOnUiThread(() -> Toast.makeText(context, "✓ Đã lưu " + finalName + " vào thư mục Download của điện thoại!", Toast.LENGTH_LONG).show());
                    return true;
                }
            } catch (Exception e) {
                final String errorMsg = e.getMessage();
                runOnUiThread(() -> Toast.makeText(context, "Lỗi khi lưu file: " + errorMsg, Toast.LENGTH_SHORT).show());
            }
            return false;
        }

        @JavascriptInterface
        public boolean shareFile(String fileName, String content) {
            try {
                if (fileName == null || fileName.trim().isEmpty()) {
                    fileName = "untitled.py";
                }
                if (!fileName.endsWith(".py")) {
                    fileName += ".py";
                }
                File cacheDir = new File(context.getCacheDir(), "shared_files");
                if (!cacheDir.exists()) {
                    cacheDir.mkdirs();
                }
                File file = new File(cacheDir, fileName);
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    fos.write(content.getBytes(StandardCharsets.UTF_8));
                    fos.flush();
                }

                Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType("text/plain");
                shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, fileName);
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                Intent chooser = Intent.createChooser(shareIntent, "Lưu hoặc chia sẻ " + fileName);
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(chooser);
                return true;
            } catch (Exception e) {
                final String errorMsg = e.getMessage();
                runOnUiThread(() -> Toast.makeText(context, "Lỗi khi chia sẻ: " + errorMsg, Toast.LENGTH_SHORT).show());
                return false;
            }
        }

        @JavascriptInterface
        public boolean openExternalBrowser(String url) {
            try {
                if (url == null || url.trim().isEmpty()) return false;
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url.trim()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                return true;
            } catch (Exception e) {
                final String errorMsg = e.getMessage();
                runOnUiThread(() -> Toast.makeText(context, "Không thể mở trình duyệt: " + errorMsg, Toast.LENGTH_SHORT).show());
                return false;
            }
        }

        @JavascriptInterface
        public boolean openEditableFile() {
            try {
                if (openEditableFileLauncher == null) return false;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"text/x-python", "text/plain", "application/octet-stream"});
                intent.addFlags(
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                );
                runOnUiThread(() -> openEditableFileLauncher.launch(intent));
                return true;
            } catch (Exception e) {
                final String errorMsg = e.getMessage();
                runOnUiThread(() -> Toast.makeText(context, "Không thể mở trình chọn tệp: " + errorMsg, Toast.LENGTH_SHORT).show());
                return false;
            }
        }

        @JavascriptInterface
        public String overwriteUriFile(String uriString, String content) {
            JSONObject res = new JSONObject();
            try {
                if (uriString == null || uriString.trim().isEmpty()) {
                    res.put("ok", false);
                    res.put("error", "Không tìm thấy đường dẫn tệp gốc để ghi đè.");
                    return res.toString();
                }
                Uri uri = Uri.parse(uriString);
                byte[] bytes = (content != null ? content : "").getBytes(StandardCharsets.UTF_8);
                boolean written = false;
                Exception lastErr = null;

                // 1. Preferred mode "wt" (write + truncate)
                try (OutputStream os = context.getContentResolver().openOutputStream(uri, "wt")) {
                    if (os != null) {
                        os.write(bytes);
                        os.flush();
                        written = true;
                    }
                } catch (Exception e) {
                    lastErr = e;
                }

                // 2. ParcelFileDescriptor "rw" with explicit channel truncate(0)
                if (!written) {
                    try (ParcelFileDescriptor pfd = context.getContentResolver().openFileDescriptor(uri, "rw")) {
                        if (pfd != null) {
                            try (FileOutputStream fos = new FileOutputStream(pfd.getFileDescriptor())) {
                                fos.getChannel().truncate(0);
                                fos.write(bytes);
                                fos.flush();
                                written = true;
                            }
                        }
                    } catch (Exception e) {
                        lastErr = e;
                    }
                }

                // 3. Fallback mode "w"
                if (!written) {
                    try (OutputStream os = context.getContentResolver().openOutputStream(uri, "w")) {
                        if (os != null) {
                            os.write(bytes);
                            os.flush();
                            written = true;
                        }
                    } catch (Exception e) {
                        lastErr = e;
                    }
                }

                if (!written) {
                    res.put("ok", false);
                    res.put("error", lastErr != null && lastErr.getMessage() != null
                        ? lastErr.getMessage()
                        : "Thiết bị từ chối quyền ghi đè trực tiếp lên tệp này.");
                    return res.toString();
                }

                res.put("ok", true);
                return res.toString();
            } catch (Exception e) {
                try {
                    res.put("ok", false);
                    res.put("error", e.getMessage() != null ? e.getMessage() : "Lỗi khi ghi đè tệp.");
                } catch (Exception ignored) {}
                return res.toString();
            }
        }
    }

    private String getDisplayNameFromUri(Uri uri) {
        String name = null;
        try (Cursor cursor = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) {
                    name = cursor.getString(idx);
                }
            }
        } catch (Exception ignored) {}
        if (name == null || name.trim().isEmpty()) {
            String segment = uri.getLastPathSegment();
            if (segment != null && !segment.trim().isEmpty()) {
                int slash = segment.lastIndexOf('/');
                name = slash >= 0 ? segment.substring(slash + 1) : segment;
            }
        }
        return (name == null || name.trim().isEmpty()) ? "untitled.py" : name.trim();
    }

    private void dispatchOpenedSafFile(Uri uri) {
        try {
            String fileName = getDisplayNameFromUri(uri);
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            try (InputStream is = getContentResolver().openInputStream(uri)) {
                if (is == null) {
                    runOnUiThread(() -> Toast.makeText(this, "Không thể đọc nội dung tệp đã chọn.", Toast.LENGTH_SHORT).show());
                    return;
                }
                byte[] chunk = new byte[8192];
                int read;
                while ((read = is.read(chunk)) != -1) {
                    buffer.write(chunk, 0, read);
                }
            }
            String content = new String(buffer.toByteArray(), StandardCharsets.UTF_8);
            JSONObject payload = new JSONObject();
            payload.put("uri", uri.toString());
            payload.put("name", fileName);
            payload.put("content", content);

            final String js = "if (window.__handleApkOpenedFile) { window.__handleApkOpenedFile(" + payload.toString() + "); }";
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
            }
        } catch (Exception e) {
            final String msg = e.getMessage();
            runOnUiThread(() -> Toast.makeText(this, "Lỗi đọc tệp: " + msg, Toast.LENGTH_SHORT).show());
        }
    }

    private void registerBridgeInterface() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().addJavascriptInterface(new AndroidFileBridge(this), "AndroidFileBridge");

                // Also attach standard DownloadListener to catch any download requests
                getBridge().getWebView().setDownloadListener(new DownloadListener() {
                    @Override
                    public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                        try {
                            Intent intent = new Intent(Intent.ACTION_VIEW);
                            intent.setData(Uri.parse(url));
                            startActivity(intent);
                        } catch (Exception ignored) {}
                    }
                });
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        openEditableFileLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null && result.getData().getData() != null) {
                    Uri uri = result.getData().getData();
                    try {
                        int takeFlags = result.getData().getFlags()
                            & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                        if (takeFlags == 0) {
                            takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
                        }
                        getContentResolver().takePersistableUriPermission(uri, takeFlags);
                    } catch (Exception ignored) {}
                    dispatchOpenedSafFile(uri);
                }
            }
        );

        int bgDark = Color.parseColor("#13131c");
        getWindow().setBackgroundDrawable(new ColorDrawable(bgDark));
        getWindow().setStatusBarColor(bgDark);
        getWindow().setNavigationBarColor(bgDark);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        View decorView = getWindow().getDecorView();
        decorView.setBackgroundColor(bgDark);

        WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(getWindow(), decorView);
        if (insetsController != null) {
            insetsController.setAppearanceLightStatusBars(false);
            insetsController.setAppearanceLightNavigationBars(false);
        }

        View contentView = findViewById(android.R.id.content);
        View insetTarget = contentView != null ? contentView : decorView;
        insetTarget.setBackgroundColor(bgDark);

        ViewCompat.setOnApplyWindowInsetsListener(insetTarget, (view, windowInsets) -> {
            applySmartInsets(view, windowInsets);
            return WindowInsetsCompat.CONSUMED;
        });

        // Re-check insets if adjustResize resizes insetTarget height after inset dispatch (prevents double padding)
        insetTarget.addOnLayoutChangeListener((v, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> {
            if (latestInsets != null && (bottom - top != oldBottom - oldTop || right - left != oldRight - oldLeft)) {
                v.post(() -> applySmartInsets(v, latestInsets));
            }
        });

        ViewCompat.requestApplyInsets(insetTarget);

        registerBridgeInterface();

        // Delay slightly to ensure Capacitor WebView is fully initialized
        decorView.postDelayed(this::registerBridgeInterface, 500);
        decorView.postDelayed(this::registerBridgeInterface, 1500);
        handleDeepLinkIntent(getIntent());
    }

    private String pendingAuthFragment = null;

    private void dispatchPendingAuthFragment() {
        if (pendingAuthFragment == null) return;
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                final String fragmentToSend = pendingAuthFragment;
                pendingAuthFragment = null;
                final String js = "if (window.__handleApkGoogleAuthCallback) { window.__handleApkGoogleAuthCallback(" + JSONObject.quote(fragmentToSend) + "); }";
                getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
            }
        } catch (Exception ignored) {}
    }

    private void handleDeepLinkIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri data = intent.getData();
        if ("com.pydroid3.web".equals(data.getScheme()) && "auth-callback".equals(data.getHost())) {
            String fragment = data.getEncodedFragment();
            if (fragment == null || fragment.isEmpty()) {
                fragment = data.getEncodedQuery();
            }
            if (fragment != null && !fragment.isEmpty()) {
                pendingAuthFragment = fragment;
                dispatchPendingAuthFragment();
                View decorView = getWindow().getDecorView();
                decorView.postDelayed(this::dispatchPendingAuthFragment, 600);
                decorView.postDelayed(this::dispatchPendingAuthFragment, 1500);
            }
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLinkIntent(intent);
    }

    @Override
    public void onStart() {
        super.onStart();
        registerBridgeInterface();
        dispatchPendingAuthFragment();
    }

    @Override
    public void onResume() {
        super.onResume();
        registerBridgeInterface();
        dispatchPendingAuthFragment();
    }
}
