package com.streamhub.app;

import android.content.Intent;
import android.os.Bundle;
import android.os.PowerManager;
import android.telecom.TelecomManager;

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
        StreamHubPhoneAccount.register(this);

        String title = getValue(message, "title", "Incoming Private Call");
        String body = getValue(message, "message", "Someone is calling you on StreamHub");
        String callId = getValue(message, "callId", "");
        String streamId = getValue(message, "streamId", "");
        String targetUrl = getValue(message, "url", "");

        if (targetUrl.isEmpty()) {
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

    private boolean tryStartTelecomIncomingCall(
            String title,
            String message,
            String callId,
            String streamId,
            String targetUrl
    ) {
        try {
            TelecomManager telecomManager =
                    (TelecomManager) getSystemService(TELECOM_SERVICE);

            if (telecomManager == null) return false;

            Bundle extras = new Bundle();
            extras.putString("title", title);
            extras.putString("message", message);
            extras.putString("callId", callId);
            extras.putString("streamId", streamId);
            extras.putString("streamhub_url", targetUrl);

            telecomManager.addNewIncomingCall(
                    StreamHubPhoneAccount.getHandle(this),
                    extras
            );

            return true;
        } catch (Exception error) {
            return false;
        }
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
                    "StreamHub:TelecomIncomingCallWakeLock"
            );

            wakeLock.acquire(10000);
        } catch (Exception ignored) {
        }
    }
}
