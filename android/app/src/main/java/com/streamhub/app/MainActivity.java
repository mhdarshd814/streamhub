package com.streamhub.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowInsetsController;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();

        WindowCompat.setDecorFitsSystemWindows(window, true);

        window.setStatusBarColor(Color.parseColor("#020617"));
        window.setNavigationBarColor(Color.parseColor("#020617"));

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            window.getInsetsController().setSystemBarsAppearance(
                0,
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
            );
        } else {
            window.getDecorView().setSystemUiVisibility(0);
        }

        WebView webView = getBridge().getWebView();

        webView.post(() -> {
            int statusBarHeight = getStatusBarHeight();
            webView.setPadding(0, statusBarHeight, 0, 0);
            webView.setClipToPadding(false);
        });
    }

    private int getStatusBarHeight() {
        int result = 0;

        int resourceId = getResources().getIdentifier(
            "status_bar_height",
            "dimen",
            "android"
        );

        if (resourceId > 0) {
            result = getResources().getDimensionPixelSize(resourceId);
        }

        return result;
    }
}