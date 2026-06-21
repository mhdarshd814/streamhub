package com.streamhub.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class StreamHubFirebaseMessagingService extends FirebaseMessagingService {
    private static final String CALL_CHANNEL_ID = "incoming_calls_v2";
    private static final int CALL_NOTIFICATION_ID = 2001;

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        String type = message.getData().get("type");

        if (!"incoming_call".equals(type)) {
            return;
        }

        wakeDeviceBriefly();

        String title = message.getData().get("title");
        String body = message.getData().get("message");
        String callId = message.getData().get("callId");
        String streamId = message.getData().get("streamId");

        if (title == null || title.isEmpty()) title = "Incoming Private Call";
        if (body == null || body.isEmpty()) body = "Someone is calling you on StreamHub";
        if (callId == null) callId = "";
        if (streamId == null) streamId = "";

        String path = callId.isEmpty() ? "/calls" : "/incoming-call/" + callId;
        int notificationId = callId.isEmpty() ? CALL_NOTIFICATION_ID : Math.abs(callId.hashCode());

        Intent fullScreenIntent = new Intent(this, IncomingCallActivity.class);
        fullScreenIntent.setAction(Intent.ACTION_VIEW);
        fullScreenIntent.putExtra("streamhub_url", path);
        fullScreenIntent.putExtra("callId", callId);
        fullScreenIntent.putExtra("streamId", streamId);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                this,
                notificationId,
                fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent acceptIntent = new Intent(this, IncomingCallActionReceiver.class);
        acceptIntent.setAction(IncomingCallActionReceiver.ACTION_ACCEPT_CALL);
        acceptIntent.putExtra("streamhub_url", path);
        acceptIntent.putExtra("callId", callId);
        acceptIntent.putExtra("streamId", streamId);
        acceptIntent.putExtra("notificationId", notificationId);

        PendingIntent acceptPendingIntent = PendingIntent.getBroadcast(
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

        createCallChannel();

        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(this, CALL_CHANNEL_ID)
                        .setSmallIcon(getApplicationInfo().icon)
                        .setContentTitle(title)
                        .setContentText(body)
                        .setPriority(NotificationCompat.PRIORITY_MAX)
                        .setCategory(NotificationCompat.CATEGORY_CALL)
                        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                        .setOngoing(true)
                        .setAutoCancel(false)
                        .setTimeoutAfter(60000)
                        .setContentIntent(fullScreenPendingIntent)
                        .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePendingIntent)
                        .addAction(android.R.drawable.ic_menu_call, "Accept", acceptPendingIntent)
                        .setFullScreenIntent(fullScreenPendingIntent, true);

        NotificationManager manager =
                (NotificationManager) getSystemService(android.content.Context.NOTIFICATION_SERVICE);

        if (manager != null) {
            manager.notify(notificationId, builder.build());
        }
    }

    private void wakeDeviceBriefly() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
            if (powerManager == null) return;

            PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                    PowerManager.ACQUIRE_CAUSES_WAKEUP |
                    PowerManager.ON_AFTER_RELEASE,
                    "StreamHub:IncomingCallWakeLock"
            );

            wakeLock.acquire(10000);
        } catch (Exception ignored) {
        }
    }

    private void createCallChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager =
                (NotificationManager) getSystemService(android.content.Context.NOTIFICATION_SERVICE);

        if (manager == null) return;

        NotificationChannel channel = new NotificationChannel(
                CALL_CHANNEL_ID,
                "StreamHub Incoming Calls",
                NotificationManager.IMPORTANCE_HIGH
        );

        channel.setDescription("StreamHub private incoming call alerts");
        channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        Uri soundUri = android.provider.Settings.System.DEFAULT_RINGTONE_URI;

        AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

        channel.setSound(soundUri, attributes);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{700, 300, 700, 300, 700});

        manager.createNotificationChannel(channel);
    }
}
