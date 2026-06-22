package com.streamhub.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;

public class CallRingtoneManager {
    private static Ringtone ringtone;
    private static Vibrator vibrator;

    public static void start(Context context) {
        stop();

        try {
            AudioManager audioManager =
                    (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);

            if (audioManager == null) return;

            int ringerMode = audioManager.getRingerMode();

            if (ringerMode != AudioManager.RINGER_MODE_SILENT) {
                vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);

                if (vibrator != null) {
                    long[] pattern = new long[]{0, 1000, 500, 1000, 500};

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                    } else {
                        vibrator.vibrate(pattern, 0);
                    }
                }
            }

            if (ringerMode == AudioManager.RINGER_MODE_NORMAL) {
                Uri uri = RingtoneManager.getActualDefaultRingtoneUri(
                        context,
                        RingtoneManager.TYPE_RINGTONE
                );

                ringtone = RingtoneManager.getRingtone(context, uri);

                if (ringtone != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        ringtone.setAudioAttributes(
                                new AudioAttributes.Builder()
                                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                        .build()
                        );
                    }

                    ringtone.play();
                }
            }
        } catch (Exception ignored) {
        }
    }

    public static void stop() {
        try {
            if (vibrator != null) {
                vibrator.cancel();
                vibrator = null;
            }

            if (ringtone != null) {
                ringtone.stop();
                ringtone = null;
            }
        } catch (Exception ignored) {
        }
    }
}