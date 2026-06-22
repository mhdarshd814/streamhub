package com.streamhub.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.telecom.Connection;
import android.telecom.DisconnectCause;

public class IncomingCallConnection extends Connection {
    private final Context context;
    private final String callId;
    private final String streamId;
    private final String targetUrl;
    private final String title;
    private final String message;

    public IncomingCallConnection(
            Context context,
            String callId,
            String streamId,
            String targetUrl,
            String title,
            String message
    ) {
        this.context = context;
        this.callId = callId == null ? "" : callId;
        this.streamId = streamId == null ? "" : streamId;
        this.targetUrl = targetUrl == null || targetUrl.isEmpty()
                ? (this.callId.isEmpty() ? "/calls" : "/incoming-call/" + this.callId)
                : targetUrl;
        this.title = title == null || title.isEmpty() ? "Incoming Private Call" : title;
        this.message = message == null || message.isEmpty()
                ? "Someone is calling you on StreamHub"
                : message;

        setAddress(Uri.fromParts("streamhub", this.title, null), android.telecom.TelecomManager.PRESENTATION_ALLOWED);
        setCallerDisplayName(this.title, android.telecom.TelecomManager.PRESENTATION_ALLOWED);
        setConnectionProperties(PROPERTY_SELF_MANAGED);
        setAudioModeIsVoip(true);
        setInitializing();
        setRinging();
    }

    @Override
    public void onShowIncomingCallUi() {
        openIncomingCallActivity(false);
    }

    @Override
    public void onAnswer() {
        openIncomingCallActivity(true);
        setActive();
    }

    @Override
    public void onReject() {
        CallRingtoneManager.stop();
        setDisconnected(new DisconnectCause(DisconnectCause.REJECTED));
        destroy();
    }

    @Override
    public void onDisconnect() {
        CallRingtoneManager.stop();
        setDisconnected(new DisconnectCause(DisconnectCause.LOCAL));
        destroy();
    }

    private void openIncomingCallActivity(boolean accepted) {
        Intent intent = new Intent(context, IncomingCallActivity.class);
        intent.putExtra("streamhub_url", targetUrl);
        intent.putExtra("callId", callId);
        intent.putExtra("streamId", streamId);
        intent.putExtra("title", title);
        intent.putExtra("message", message);
        if (accepted) {
            intent.putExtra("action", "accept");
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        context.startActivity(intent);
    }

    public static IncomingCallConnection fromExtras(Context context, Bundle extras) {
        if (extras == null) extras = new Bundle();

        String callId = extras.getString("callId", "");
        String streamId = extras.getString("streamId", "");
        String targetUrl = extras.getString("streamhub_url", "");
        String title = extras.getString("title", "Incoming Private Call");
        String message = extras.getString("message", "Someone is calling you on StreamHub");

        return new IncomingCallConnection(context, callId, streamId, targetUrl, title, message);
    }
}