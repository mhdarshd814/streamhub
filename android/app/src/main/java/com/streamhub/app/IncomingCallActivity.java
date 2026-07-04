package com.streamhub.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class IncomingCallActivity extends Activity {

    private String callId = "";
    private String streamId = "";
    private String targetUrl = "/";
    private int notificationId = 2001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Kill any white flash from the theme's window background before
        // the dark layout below is drawn.
        getWindow().getDecorView().setBackgroundColor(Color.parseColor("#020617"));

        wakeAndShowOnLockScreen();
        readIntentData();
        buildUi();

        String incomingAction = getIntent().getStringExtra("action");
        if ("accept".equals(incomingAction)) {
            acceptCall();
        }
    }

    private void wakeAndShowOnLockScreen() {
        Window window = getWindow();

        window.addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);

            KeyguardManager keyguardManager =
                    (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);

            if (keyguardManager != null) {
                keyguardManager.requestDismissKeyguard(this, null);
            }
        }
    }

    private void readIntentData() {
        Intent intent = getIntent();
        if (intent == null) return;

        String incomingCallId = intent.getStringExtra("callId");
        String incomingStreamId = intent.getStringExtra("streamId");
        String incomingUrl = intent.getStringExtra("streamhub_url");

        if (incomingCallId != null) callId = incomingCallId;
        if (incomingStreamId != null) streamId = incomingStreamId;

        // Phase A3/A5: ringing never routes to /incoming-call. Home is the
        // only destination; the in-app popup owns accept/decline UI.
        if (incomingUrl != null && !incomingUrl.isEmpty()
                && !incomingUrl.contains("/incoming-call")) {
            targetUrl = incomingUrl;
        } else {
            targetUrl = "/";
        }

        // The service derives the notification id from the callId hash.
        // Mirror that so this screen clears the right notification.
        notificationId = callId.isEmpty() ? 2001 : Math.abs(callId.hashCode());
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(48, 48, 48, 48);
        root.setBackgroundColor(Color.parseColor("#020617"));

        TextView appName = new TextView(this);
        appName.setText("StreamHub");
        appName.setTextColor(Color.parseColor("#ef4444"));
        appName.setTextSize(18);
        appName.setGravity(Gravity.CENTER);
        appName.setTypeface(null, android.graphics.Typeface.BOLD);

        TextView title = new TextView(this);
        title.setText(getIntent() != null && getIntent().getStringExtra("title") != null
                ? getIntent().getStringExtra("title")
                : "Incoming Private Call");
        title.setTextColor(Color.WHITE);
        title.setTextSize(30);
        title.setGravity(Gravity.CENTER);
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        title.setPadding(0, 32, 0, 12);

        TextView subtitle = new TextView(this);
        subtitle.setText(getIntent() != null && getIntent().getStringExtra("message") != null
                ? getIntent().getStringExtra("message")
                : "Someone is calling you on StreamHub");
        subtitle.setTextColor(Color.parseColor("#94a3b8"));
        subtitle.setTextSize(16);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, 0, 0, 56);

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.CENTER);

        Button declineButton = new Button(this);
        declineButton.setText("Decline");
        declineButton.setTextColor(Color.WHITE);
        declineButton.setTextSize(16);
        declineButton.setAllCaps(false);
        declineButton.setBackgroundColor(Color.parseColor("#374151"));

        Button acceptButton = new Button(this);
        acceptButton.setText("Accept");
        acceptButton.setTextColor(Color.WHITE);
        acceptButton.setTextSize(16);
        acceptButton.setAllCaps(false);
        acceptButton.setBackgroundColor(Color.parseColor("#16a34a"));

        LinearLayout.LayoutParams buttonParams =
                new LinearLayout.LayoutParams(0, 140, 1);
        buttonParams.setMargins(12, 0, 12, 0);

        actions.addView(declineButton, buttonParams);
        actions.addView(acceptButton, buttonParams);

        root.addView(appName);
        root.addView(title);
        root.addView(subtitle);
        root.addView(actions, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        setContentView(root);

        declineButton.setOnClickListener(view -> declineCall());
        acceptButton.setOnClickListener(view -> acceptCall());
    }

    private void acceptCall() {
        clearNotification();
        stopService(new Intent(this, IncomingCallService.class));

        Intent intent = new Intent(this, MainActivity.class);
        intent.putExtra("streamhub_url", targetUrl);
        intent.putExtra("action", "accept");
        intent.putExtra("callId", callId);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        startActivity(intent);
        finish();
    }

    private void declineCall() {
        clearNotification();
        stopService(new Intent(this, IncomingCallService.class));

        // Server-side decline (updating private_call_requests) is handled by
        // the web layer; the native decline stops ringing on this device.
        Intent declineBroadcast = new Intent(this, IncomingCallActionReceiver.class);
        declineBroadcast.setAction(IncomingCallActionReceiver.ACTION_DECLINE_CALL);
        declineBroadcast.putExtra("callId", callId);
        declineBroadcast.putExtra("streamId", streamId);
        declineBroadcast.putExtra("notificationId", notificationId);
        sendBroadcast(declineBroadcast);

        finish();
    }

    private void clearNotification() {
        NotificationManager manager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        if (manager != null) {
            manager.cancel(notificationId);
            manager.cancel(2001);
        }
    }
}
