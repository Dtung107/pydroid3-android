package com.pydroid3.web;

import android.os.Bundle;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
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

        // Enable native file download handling in WebView
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
                    try {
                        android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_VIEW);
                        intent.setData(android.net.Uri.parse(url));
                        startActivity(intent);
                    } catch (Exception ignored) {}
                });
            }
        } catch (Exception ignored) {}
    }
}
