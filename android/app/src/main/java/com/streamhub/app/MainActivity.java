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
    private static final String SERVER_URL = "https://streamhubhq.com";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        maybeRequestFullScreenIntentPermission();

        Window window = getWindow();

        WindowCompat.setDecorFitsSystemWindows(window, true);

        window.setStatusBarColor(Color.parseColor("#020617"));
        window.setNavigationBarColor(Color.parseColor("#020617"));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.getInsetsController().setSystemBarsAppearance(
                    0,
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
            );
        } else {
            window.getDecorView().setSystemUiVisibility(0);
        }

        WebView webView = getBridge().getWebView();

        // Cold-start white screen fix: the WebView and window default to
        // white while the remote app is loading over the network. Paint
        // them dark so the loading state matches the app theme.
        int appBackground = Color.parseColor("#020617");
        window.getDecorView().setBackgroundColor(appBackground);
        webView.setBackgroundColor(appBackground);

        webView.post(() -> {
            int statusBarHeight = getStatusBarHeight();
            webView.setPadding(0, statusBarHeight, 0, 0);
            webView.setClipToPadding(false);
        });

        maybeDeliverNativeAccept(getIntent());

        // NOTE: no handleIncomingIntent() here. On a cold start, calling
        // loadUrl() while the Capacitor bridge is still initializing races
        // the app's own load and produces a white screen. Capacitor loads
        // home by default, which is exactly where incoming calls should
        // land (Phase A3) — the in-app popup takes over from there.
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIncomingIntent(intent);
        maybeDeliverNativeAccept(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        maybeDeliverPendingDecline();
    }

    private int declineDeliveryAttempts = 0;

    private void maybeDeliverPendingDecline() {
        String rawCallId = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .getString(IncomingCallActionReceiver.PENDING_DECLINE_KEY, "");

        if (rawCallId == null || rawCallId.isEmpty()) return;

        final String callId = rawCallId.replaceAll("[^a-zA-Z0-9\\-]", "");
        if (callId.isEmpty()) return;

        final WebView webView = getBridge().getWebView();
        declineDeliveryAttempts = 0;

        Runnable attempt = new Runnable() {
            @Override
            public void run() {
                declineDeliveryAttempts++;

                String js = "(function(){"
                        + "if(!window.location||String(window.location.origin).indexOf('streamhubhq.com')<0){return 'wait';}"
                        + "try{localStorage.setItem('streamhub_decline_call','" + callId + "');return 'ok';}"
                        + "catch(e){return 'err';}"
                        + "})()";

                webView.evaluateJavascript(js, value -> {
                    boolean delivered = "\"ok\"".equals(value);

                    if (delivered) {
                        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                                .edit()
                                .remove(IncomingCallActionReceiver.PENDING_DECLINE_KEY)
                                .apply();
                    } else if (declineDeliveryAttempts < 40) {
                        webView.postDelayed(this, 500);
                    }
                });
            }
        };

        webView.postDelayed(attempt, 400);
    }

    private int acceptDeliveryAttempts = 0;

    private void maybeDeliverNativeAccept(Intent intent) {
        if (intent == null) return;
        if (!"accept".equals(intent.getStringExtra("action"))) return;

        String rawCallId = intent.getStringExtra("callId");
        if (rawCallId == null || rawCallId.isEmpty()) return;

        // Sanitize: the id is written into a JS string.
        final String callId = rawCallId.replaceAll("[^a-zA-Z0-9\\-]", "");
        if (callId.isEmpty()) return;

        final WebView webView = getBridge().getWebView();
        acceptDeliveryAttempts = 0;

        Runnable attempt = new Runnable() {
            @Override
            public void run() {
                acceptDeliveryAttempts++;

                String js = "(function(){"
                        + "if(!window.location||String(window.location.origin).indexOf('streamhubhq.com')<0){return 'wait';}"
                        + "try{localStorage.setItem('streamhub_accept_call','" + callId + "');return 'ok';}"
                        + "catch(e){return 'err';}"
                        + "})()";

                webView.evaluateJavascript(js, value -> {
                    boolean delivered = "\"ok\"".equals(value);
                    if (!delivered && acceptDeliveryAttempts < 40) {
                        webView.postDelayed(this, 500);
                    }
                });
            }
        };

        webView.postDelayed(attempt, 400);
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

        // Home is where the app already is (or loads to). Reloading the
        // WebView for "/" was the white-screen bug: a hard page reload that
        // killed SPA state and could hang on any network hiccup. For home,
        // do nothing — the IncomingCallPopup detects the ringing call.
        if (targetUrl.equals("/") || targetUrl.equals(SERVER_URL)
                || targetUrl.equals(SERVER_URL + "/")) {
            return;
        }

        final String fullUrl = targetUrl.startsWith("http")
                ? targetUrl
                : SERVER_URL + (targetUrl.startsWith("/") ? targetUrl : "/" + targetUrl);

        getBridge().getWebView().post(() -> {
            try {
                getBridge().getWebView().loadUrl(fullUrl);
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
