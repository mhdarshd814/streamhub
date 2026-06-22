package com.streamhub.app;

import android.content.ComponentName;
import android.content.Context;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.telecom.PhoneAccount;
import android.telecom.PhoneAccountHandle;
import android.telecom.TelecomManager;

public class StreamHubPhoneAccount {
    public static final String ACCOUNT_ID = "streamhub_private_calls";

    public static PhoneAccountHandle getHandle(Context context) {
        ComponentName componentName = new ComponentName(
                context,
                IncomingCallConnectionService.class
        );

        return new PhoneAccountHandle(componentName, ACCOUNT_ID);
    }

    public static void register(Context context) {
        try {
            TelecomManager telecomManager =
                    (TelecomManager) context.getSystemService(Context.TELECOM_SERVICE);

            if (telecomManager == null) return;

            PhoneAccountHandle handle = getHandle(context);

            PhoneAccount.Builder builder = PhoneAccount.builder(handle, "StreamHub Calls")
                    .setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                builder.setIcon(Icon.createWithResource(context, context.getApplicationInfo().icon));
            }

            telecomManager.registerPhoneAccount(builder.build());
        } catch (Exception ignored) {
        }
    }
}