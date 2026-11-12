package com.pydroid3.web;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {

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

        // Ensure Android system bars (status bar, clock, notch, navigation bar) do not overlap UI buttons
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (view, windowInsets) -> {
            int top = windowInsets.getInsets(WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.displayCutout()).top;
            int bottom = windowInsets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
            view.setPadding(0, top, 0, bottom);
            return windowInsets;
        });

        registerBridgeInterface();

        // Delay slightly to ensure Capacitor WebView is fully initialized
        getWindow().getDecorView().postDelayed(this::registerBridgeInterface, 500);
        getWindow().getDecorView().postDelayed(this::registerBridgeInterface, 1500);
    }

    @Override
    public void onStart() {
        super.onStart();
        registerBridgeInterface();
    }

    @Override
    public void onResume() {
        super.onResume();
        registerBridgeInterface();
    }
}
