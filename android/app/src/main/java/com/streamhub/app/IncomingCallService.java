package com.streamhub.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class IncomingCallService extends Service {
    private static final String CALL_CHANNEL_ID = "incoming_calls_callstyle_v1";
    private static final int DEFAULT_NOTIFICATION_ID = 2001;

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
            targetUrl = callId.isEmpty() ? "/calls" : "/incoming-call/" + callId;
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

        CallRingtoneManager.start(this);

        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(() -> {
            CallRingtoneManager.stop();

            NotificationManager manager =
                    (NotificationManager) getSystemService(NOTIFICATION_SERVICE);

            if (manager != null) {
                manager.cancel(notificationId);
            }

            stopForeground(true);
            stopSelf();
        }, 60000);

        return START_NOT_STICKY;
    }

    private Notification buildCallNotification(
            String title,
            String message,
            String callId,
            String streamId,
            String targetUrl,
            int notificationId
    ) {
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

        return new NotificationCompat.Builder(this, CALL_CHANNEL_ID)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(message)
                .setContentIntent(fullScreenPendingIntent)
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .addAction(0, "Decline", declinePendingIntent)
                .addAction(0, "Accept", acceptPendingIntent)
                .build();
    }

    private void createCallChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager =
                (NotificationManager) getSystemService(NOTIFICATION_SERVICE);

        if (manager == null) return;

        NotificationChannel existing = manager.getNotificationChannel(CALL_CHANNEL_ID);
        if (existing != null) return;

        NotificationChannel channel = new NotificationChannel(
                CALL_CHANNEL_ID,
                "StreamHub Call Alerts",
                NotificationManager.IMPORTANCE_HIGH
        );

        channel.setDescription("Incoming StreamHub private call alerts");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.setBypassDnd(true);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 1000, 500, 1000});

        Uri soundUri = android.provider.Settings.System.DEFAULT_RINGTONE_URI;

        AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

        channel.setSound(soundUri, attributes);

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
