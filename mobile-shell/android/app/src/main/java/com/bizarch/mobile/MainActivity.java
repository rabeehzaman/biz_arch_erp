package com.bizarch.mobile;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.bizarch.mobile.plugins.ThermalPrinterPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ThermalPrinterPlugin.class);
        super.onCreate(savedInstanceState);

        // White background behind WebView margin gap (prevents green line)
        getWindow().getDecorView().setBackgroundColor(Color.WHITE);

        applyStatusBarPadding();
    }

    private void applyStatusBarPadding() {
        View decorView = getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(decorView, (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            try {
                WebView wv = getBridge().getWebView();
                // Use margin to physically push the WebView below the status bar
                ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams) wv.getLayoutParams();
                params.topMargin = insets.top;
                wv.setLayoutParams(params);

                // Also inject CSS vars
                float density = getResources().getDisplayMetrics().density;
                int topDp = Math.round(insets.top / density);
                int bottomDp = Math.round(insets.bottom / density);
                String js = "document.documentElement.style.setProperty('--safe-area-inset-top','" + topDp + "px');"
                          + "document.documentElement.style.setProperty('--safe-area-inset-bottom','" + bottomDp + "px');";
                wv.post(() -> wv.evaluateJavascript(js, null));
            } catch (Exception ignored) {}
            return windowInsets;
        });
    }
}
