package com.streamhub.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class StreamHubFirebaseMessagingService extends FirebaseMessagingService {
    private static final String CALL_CHANNEL_ID = "incoming_calls";
    private static final int CALL_NOTIFICATION_ID = 2001;

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        String type = message.getData().get("type");

        if (!"incoming_call".equals(type)) {
            return;
        }

        String title = message.getData().get("title");
        String body = message.getData().get("message");
        String callId = message.getData().get("callId");

        if (title == null || title.isEmpty()) {
            title = "Incoming Private Call";
        }

        if (body == null || body.isEmpty()) {
            body = "Someone is calling you on StreamHub";
        }

        if (callId == null || callId.isEmpty()) {
            callId = "";
        }

        String path = callId.isEmpty() ? "/calls" : "/incoming-call/" + callId;

        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.putExtra("streamhub_url", path);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                1001,
                intent,
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
                        .setOngoing(false)
                        .setAutoCancel(true)
                        .setContentIntent(pendingIntent)
                        .setFullScreenIntent(pendingIntent, true);

        NotificationManager manager =
                (NotificationManager) getSystemService(android.content.Context.NOTIFICATION_SERVICE);

        if (manager != null) {
            manager.notify(CALL_NOTIFICATION_ID, builder.build());
        }
    }

    private void createCallChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager =
                (NotificationManager) getSystemService(android.content.Context.NOTIFICATION_SERVICE);

        if (manager == null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
                CALL_CHANNEL_ID,
                "Incoming Calls",
                NotificationManager.IMPORTANCE_HIGH
        );

        channel.setDescription("StreamHub incoming private call alerts");
        channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        Uri soundUri = android.provider.Settings.System.DEFAULT_RINGTONE_URI;

        AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

        channel.setSound(soundUri, attributes);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{700, 300, 700, 300});

        manager.createNotificationChannel(channel);
    }
}