package com.bizarch.mobile;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.bizarch.mobile.plugins.PdfPrinterPlugin;
import com.bizarch.mobile.plugins.ThermalPrinterPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private String safeAreaJs = "";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ThermalPrinterPlugin.class);
        registerPlugin(PdfPrinterPlugin.class);
        super.onCreate(savedInstanceState);

        // Calculate status bar height from system resources
        int statusBarHeight = 0;
        int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            statusBarHeight = getResources().getDimensionPixelSize(resourceId);
        }
        float density = getResources().getDisplayMetrics().density;
        int topDp = Math.round(statusBarHeight / density);

        safeAreaJs = "document.documentElement.style.setProperty('--safe-area-inset-top','" + topDp + "px');";

        // WebView performance settings
        WebView wv = getBridge().getWebView();

        // Listen for window insets to get reliable bottom safe area (gesture nav / software buttons)
        ViewCompat.setOnApplyWindowInsetsListener(wv, (v, windowInsets) -> {
            Insets systemBarInsets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            int bottomDp = Math.round(systemBarInsets.bottom / density);
            safeAreaJs = "document.documentElement.style.setProperty('--safe-area-inset-top','" + topDp + "px');"
                       + "document.documentElement.style.setProperty('--safe-area-inset-bottom','" + bottomDp + "px');";
            wv.evaluateJavascript(safeAreaJs, null);
            return ViewCompat.onApplyWindowInsets(v, windowInsets);
        });

        WebSettings settings = wv.getSettings();
        settings.setDomStorageEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setDatabaseEnabled(true);
        wv.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        injectSafeArea();
    }

    private void injectSafeArea() {
        try {
            WebView wv = getBridge().getWebView();
            Handler handler = new Handler(Looper.getMainLooper());

            // Inject after page loads via WebViewClient wrapper
            WebViewClient originalClient = wv.getWebViewClient();
            wv.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    if (originalClient != null) originalClient.onPageFinished(view, url);
                    view.evaluateJavascript(safeAreaJs, null);
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                    if (originalClient != null) return originalClient.shouldOverrideUrlLoading(view, request);
                    return false;
                }
            });

            // Also inject with delays to cover SPA navigations
            handler.postDelayed(() -> wv.evaluateJavascript(safeAreaJs, null), 500);
            handler.postDelayed(() -> wv.evaluateJavascript(safeAreaJs, null), 1500);
            handler.postDelayed(() -> wv.evaluateJavascript(safeAreaJs, null), 3000);
        } catch (Exception ignored) {}
    }
}
