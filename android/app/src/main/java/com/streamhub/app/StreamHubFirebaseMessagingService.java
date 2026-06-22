package com.streamhub.app;

import android.content.Intent;
import android.os.PowerManager;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class StreamHubFirebaseMessagingService extends FirebaseMessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        String type = message.getData().get("type");

        if (!"incoming_call".equals(type) && !"incoming_private_call".equals(type)) {
            return;
        }

        wakeDeviceBriefly();

        String title = message.getData().get("title");
        String body = message.getData().get("message");
        String callId = message.getData().get("callId");
        String streamId = message.getData().get("streamId");
        String targetUrl = message.getData().get("url");

        if (title == null || title.isEmpty()) title = "Incoming Private Call";
        if (body == null || body.isEmpty()) body = "Someone is calling you on StreamHub";
        if (callId == null) callId = "";
        if (streamId == null) streamId = "";
        if (targetUrl == null || targetUrl.isEmpty()) {
            targetUrl = callId.isEmpty() ? "/calls" : "/incoming-call/" + callId;
        }

        Intent serviceIntent = new Intent(this, IncomingCallService.class);
        serviceIntent.putExtra("title", title);
        serviceIntent.putExtra("message", body);
        serviceIntent.putExtra("callId", callId);
        serviceIntent.putExtra("streamId", streamId);
        serviceIntent.putExtra("streamhub_url", targetUrl);

        ContextCompat.startForegroundService(this, serviceIntent);
    }

    private void wakeDeviceBriefly() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
            if (powerManager == null) return;

            PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "StreamHub:IncomingCallServiceWakeLock"
            );

            wakeLock.acquire(10000);
        } catch (Exception ignored) {
        }
    }
}