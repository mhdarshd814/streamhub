package com.streamhub.app;

import android.app.NotificationManager;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Window;
import android.view.WindowInsetsController;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String PREFS_NAME = "streamhub_prefs";
    private static final String FULL_SCREEN_PERMISSION_ASKED = "full_screen_permission_asked";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        maybeRequestFullScreenIntentPermission();
        handleIncomingIntent(getIntent());

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

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIncomingIntent(intent);
    }

    private void maybeRequestFullScreenIntentPermission() {
        if (Build.VERSION.SDK_INT < 34) return;

        try {
            NotificationManager notificationManager =
                    (NotificationManager) getSystemService(NOTIFICATION_SERVICE);

            if (notificationManager == null) return;

            if (notificationManager.canUseFullScreenIntent()) return;

            boolean alreadyAsked = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                    .getBoolean(FULL_SCREEN_PERMISSION_ASKED, false);

            if (alreadyAsked) return;

            getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                    .edit()
                    .putBoolean(FULL_SCREEN_PERMISSION_ASKED, true)
                    .apply();

            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        } catch (Exception ignored) {
        }
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;

        String targetUrl = intent.getStringExtra("streamhub_url");

        if (targetUrl == null || targetUrl.isEmpty()) return;

        getBridge().getWebView().post(() -> {
            try {
                getBridge().getWebView().loadUrl(
                        "javascript:window.location.href='" + targetUrl + "';"
                );
            } catch (Exception ignored) {
            }
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