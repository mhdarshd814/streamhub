package com.streamhub.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class IncomingCallActionReceiver extends BroadcastReceiver {
    public static final String ACTION_ACCEPT_CALL = "com.streamhub.app.ACCEPT_CALL";
    public static final String ACTION_DECLINE_CALL = "com.streamhub.app.DECLINE_CALL";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        String callId = intent.getStringExtra("callId");
        String streamId = intent.getStringExtra("streamId");
        String targetUrl = intent.getStringExtra("streamhub_url");
        int notificationId = intent.getIntExtra("notificationId", 2001);

        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (manager != null) {
            manager.cancel(notificationId);
        }

        if (ACTION_ACCEPT_CALL.equals(action)) {
            if (targetUrl == null || targetUrl.isEmpty()) {
                targetUrl = callId == null || callId.isEmpty()
                        ? "/calls"
                        : "/incoming-call/" + callId;
            }

            Intent activityIntent = new Intent(context, IncomingCallActivity.class);
            activityIntent.putExtra("streamhub_url", targetUrl);
            activityIntent.putExtra("callId", callId);
            activityIntent.putExtra("streamId", streamId);
            activityIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            context.startActivity(activityIntent);
            return;
        }

        if (ACTION_DECLINE_CALL.equals(action)) {
            // Native decline currently dismisses the lock-screen notification.
            // Server-side decline update will be added in the next phase.
        }
    }
}
