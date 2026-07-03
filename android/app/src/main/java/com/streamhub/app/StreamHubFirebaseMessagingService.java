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

        String title = getValue(message, "title", "Incoming Private Call");
        String body = getValue(message, "message", "Someone is calling you on StreamHub");
        String callId = getValue(message, "callId", "");
        String streamId = getValue(message, "streamId", "");

        // Phase A3: native Accept lands on home. The in-app IncomingCallPopup
        // owns the styled accept/decline flow. Never route to /incoming-call.
        String targetUrl = "/";

        Intent serviceIntent = new Intent(this, IncomingCallService.class);
        serviceIntent.putExtra("title", title);
        serviceIntent.putExtra("message", body);
        serviceIntent.putExtra("callId", callId);
        serviceIntent.putExtra("streamId", streamId);
        serviceIntent.putExtra("streamhub_url", targetUrl);

        ContextCompat.startForegroundService(this, serviceIntent);
    }

    private String getValue(RemoteMessage message, String key, String fallback) {
        String value = message.getData().get(key);
        return value == null || value.isEmpty() ? fallback : value;
    }

    private void wakeDeviceBriefly() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
            if (powerManager == null) return;

            PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "StreamHub:IncomingCallWakeLock"
            );

            wakeLock.acquire(10000);
        } catch (Exception ignored) {
        }
    }
}
