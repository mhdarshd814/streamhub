package com.streamhub.app;

import android.telecom.Connection;
import android.telecom.ConnectionRequest;
import android.telecom.ConnectionService;
import android.telecom.PhoneAccountHandle;

public class IncomingCallConnectionService extends ConnectionService {
    @Override
    public Connection onCreateIncomingConnection(
            PhoneAccountHandle connectionManagerPhoneAccount,
            ConnectionRequest request
    ) {
        return IncomingCallConnection.fromExtras(this, request.getExtras());
    }

    @Override
    public void onCreateIncomingConnectionFailed(
            PhoneAccountHandle connectionManagerPhoneAccount,
            ConnectionRequest request
    ) {
        super.onCreateIncomingConnectionFailed(connectionManagerPhoneAccount, request);
    }
}