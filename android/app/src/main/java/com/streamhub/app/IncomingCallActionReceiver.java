package com.streamhub.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class IncomingCallActionReceiver extends BroadcastReceiver {

    public static final String ACTION_DECLINE_CALL = "com.streamhub.app.ACTION_DECLINE_CALL";

    private static final String PREFS_NAME = "streamhub_prefs";
    public static final String PENDING_DECLINE_KEY = "pending_decline_call";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_DECLINE_CALL.equals(intent.getAction())) {
            return;
        }

        String callId = intent.getStringExtra("callId");
        int notificationId = intent.getIntExtra("notificationId", 2001);

        // 1. Stop the ringing service (kills ringtone + vibration and
        //    removes the foreground notification with it).
        try {
            context.stopService(new Intent(context, IncomingCallService.class));
        } catch (Exception ignored) {
        }

        // 2. Cancel both possible notification ids (the service stop above
        //    already kills the ringtone, which the service itself owns).
        try {
            NotificationManager manager =
                    (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.cancel(notificationId);
                manager.cancel(2001);
            }
        } catch (Exception ignored) {
        }

        // 3. The server-side decline needs the user's session, which only
        //    the web app has. Save the callId; MainActivity delivers it to
        //    the web layer on next app open, and the popup declines it
        //    silently. Until then the caller side ends via ring timeout.
        if (callId != null && !callId.isEmpty()) {
            try {
                context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                        .edit()
                        .putString(PENDING_DECLINE_KEY, callId)
                        .apply();
            } catch (Exception ignored) {
            }
        }
    }
}
