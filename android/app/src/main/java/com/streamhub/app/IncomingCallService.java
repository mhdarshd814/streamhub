package com.streamhub.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;

public class IncomingCallService extends Service {

    // v3: importance of an existing channel can NEVER be upgraded in code,
    // so fixing IMPORTANCE_DEFAULT requires a brand new channel ID.
    private static final String CALL_CHANNEL_ID = "incoming_calls_v3";
    private static final String LEGACY_CHANNEL_V2 = "incoming_calls_custom_v2";

    private static final int DEFAULT_NOTIFICATION_ID = 2001;
    private static final long RING_TIMEOUT_MS = 60_000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private int notificationId = DEFAULT_NOTIFICATION_ID;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String title = getStringExtra(intent, "title", "Incoming Private Call");
        String message = getStringExtra(intent, "message", "Someone is calling you on StreamHub");
        String callId = getStringExtra(intent, "callId", "");
        String streamId = getStringExtra(intent, "streamId", "");
        String targetUrl = getStringExtra(intent, "streamhub_url", "");

        if (targetUrl.isEmpty()) {
            // Phase A3: land on home; the in-app popup takes over from there.
            targetUrl = "/";
        }

        notificationId = callId.isEmpty() ? DEFAULT_NOTIFICATION_ID : Math.abs(callId.hashCode());

        createCallChannel();

        Notification notification = buildCallNotification(
                title,
                message,
                callId,
                streamId,
                targetUrl,
                notificationId
        );

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                        notificationId,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
                );
            } else {
                startForeground(notificationId, notification);
            }
        } catch (Exception e) {
            startForeground(notificationId, notification);
        }

        // Looping ring + vibration is owned exclusively by CallRingtoneManager.
        // The channel sound is intentionally null (see createCallChannel) to
        // prevent the double-ringtone bug on OEM skins.
        CallRingtoneManager.start(this);

        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(this::stopRinging, RING_TIMEOUT_MS);

        return START_NOT_STICKY;
    }

    private void stopRinging() {
        CallRingtoneManager.stop();

        NotificationManager manager =
                (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.cancel(notificationId);
        }

        stopForeground(true);
        stopSelf();
    }

    private Notification buildCallNotification(
            String title,
            String message,
            String callId,
            String streamId,
            String targetUrl,
            int notificationId
    ) {
        // ---- Full-screen intent: the lock-screen takeover ----
        Intent fullScreenIntent = new Intent(this, IncomingCallActivity.class);
        fullScreenIntent.putExtra("streamhub_url", targetUrl);
        fullScreenIntent.putExtra("callId", callId);
        fullScreenIntent.putExtra("streamId", streamId);
        fullScreenIntent.putExtra("title", title);
        fullScreenIntent.putExtra("message", message);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                this,
                notificationId,
                fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // ---- Accept: open the app; the in-app popup owns the accept flow ----
        Intent acceptIntent = new Intent(this, IncomingCallActivity.class);
        acceptIntent.putExtra("streamhub_url", targetUrl);
        acceptIntent.putExtra("callId", callId);
        acceptIntent.putExtra("streamId", streamId);
        acceptIntent.putExtra("title", title);
        acceptIntent.putExtra("message", message);
        acceptIntent.putExtra("action", "accept");
        acceptIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent acceptPendingIntent = PendingIntent.getActivity(
                this,
                notificationId + 10,
                acceptIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // ---- Decline: broadcast, no UI ----
        Intent declineIntent = new Intent(this, IncomingCallActionReceiver.class);
        declineIntent.setAction(IncomingCallActionReceiver.ACTION_DECLINE_CALL);
        declineIntent.putExtra("callId", callId);
        declineIntent.putExtra("streamId", streamId);
        declineIntent.putExtra("notificationId", notificationId);

        PendingIntent declinePendingIntent = PendingIntent.getBroadcast(
                this,
                notificationId + 20,
                declineIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // ---- Caller identity for CallStyle ----
        Person caller = new Person.Builder()
                .setName(title)
                .setImportant(true)
                .build();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CALL_CHANNEL_ID)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(message)
                .setContentIntent(fullScreenPendingIntent)
                // THE fix: actually attach the full-screen intent.
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setColor(Color.parseColor("#E50914"))
                .setStyle(NotificationCompat.CallStyle.forIncomingCall(
                        caller,
                        declinePendingIntent,
                        acceptPendingIntent
                ));

        return builder.build();
    }

    private void createCallChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager =
                (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) return;

        // Migration: remove the old DEFAULT-importance channel so it no longer
        // appears in the app's notification settings.
        try {
            manager.deleteNotificationChannel(LEGACY_CHANNEL_V2);
        } catch (Exception ignored) {
        }

        NotificationChannel existing = manager.getNotificationChannel(CALL_CHANNEL_ID);
        if (existing != null) return;

        NotificationChannel channel = new NotificationChannel(
                CALL_CHANNEL_ID,
                "Incoming calls",
                NotificationManager.IMPORTANCE_HIGH
        );

        channel.setDescription("Incoming StreamHub private call alerts");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.setBypassDnd(true);

        // Sound and vibration are owned by CallRingtoneManager (looping).
        // A channel sound plays once, doesn't loop, and would overlap it.
        channel.setSound(null, null);
        channel.enableVibration(false);

        manager.createNotificationChannel(channel);
    }

    private String getStringExtra(Intent intent, String key, String fallback) {
        if (intent == null) return fallback;
        String value = intent.getStringExtra(key);
        return value == null || value.isEmpty() ? fallback : value;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        CallRingtoneManager.stop();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
