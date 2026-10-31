package com.fianketo.mojasistent;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;
import java.util.Calendar;
import org.json.JSONArray;
import org.json.JSONObject;

/** Prima događaje geofence-a (i restart telefona) i šalje podsetnik za plaćanje parkinga. */
public class GeofenceReceiver extends BroadcastReceiver {
    static final String ACTION_GEOFENCE = "com.fianketo.mojasistent.GEOFENCE";
    static final String ACTION_TEST = "com.fianketo.mojasistent.TEST_DWELL"; // za test na emulatoru
    static final long COOLDOWN_MS = 2 * 60 * 60 * 1000L;

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            ParkingGeofencePlugin.register(ctx);
            return;
        }
        SharedPreferences p = ParkingGeofencePlugin.prefs(ctx);
        if (ACTION_TEST.equals(action)) {
            onDwell(ctx, p, intent.getStringExtra("id"), true);
            return;
        }
        GeofencingEvent ev = GeofencingEvent.fromIntent(intent);
        if (ev == null || ev.hasError()) {
            p.edit().putString("lastEvent", "error:" + (ev == null ? "null" : ev.getErrorCode())).apply();
            return;
        }
        if (ev.getTriggeringGeofences() == null) return;
        for (Geofence g : ev.getTriggeringGeofences()) {
            if (ev.getGeofenceTransition() == Geofence.GEOFENCE_TRANSITION_DWELL) onDwell(ctx, p, g.getRequestId(), false);
            else p.edit().putString("lastEvent", "exit:" + g.getRequestId() + "@" + System.currentTimeMillis()).apply();
        }
    }

    private void onDwell(Context ctx, SharedPreferences p, String id, boolean ignoreHours) {
        long now = System.currentTimeMillis();
        p.edit().putString("lastEvent", "dwell:" + id + "@" + now).apply();
        if (id == null || !p.getBoolean("enabled", false)) return;
        if (p.getLong("activeUntil", 0) > now) return; // već plaćeno u aplikaciji
        if (now - p.getLong("notified_" + id, 0) < COOLDOWN_MS) return;
        try {
            JSONObject spot = null;
            JSONArray spots = new JSONArray(p.getString("spots", "[]"));
            for (int k = 0; k < spots.length(); k++) if (id.equals(spots.getJSONObject(k).getString("id"))) spot = spots.getJSONObject(k);
            if (spot == null) return;
            if (!ignoreHours && !isPaidTime(new JSONObject(p.getString("hours", "{}")))) return;
            String zone = spot.optString("zone", "Parking zona");
            String sms = spot.optString("sms", "");
            String plate = p.getString("plate", "");
            notifyPay(ctx, id, zone, sms, plate);
            p.edit().putLong("notified_" + id, now).apply();
        } catch (Exception e) {
            p.edit().putString("lastEvent", "error:" + e.getMessage()).apply();
        }
    }

    /** hours: {wd:[7,21], sat:[7,14], sun:null} – u satima, lokalno vreme. Bez podataka: uvek. */
    static boolean isPaidTime(JSONObject hours) {
        if (hours.length() == 0) return true;
        Calendar c = Calendar.getInstance();
        int dow = c.get(Calendar.DAY_OF_WEEK);
        String key = dow == Calendar.SATURDAY ? "sat" : dow == Calendar.SUNDAY ? "sun" : "wd";
        JSONArray r = hours.optJSONArray(key);
        if (r == null || r.length() < 2) return false;
        double h = c.get(Calendar.HOUR_OF_DAY) + c.get(Calendar.MINUTE) / 60.0;
        return h >= r.optDouble(0) && h < r.optDouble(1);
    }

    private void notifyPay(Context ctx, String id, String zone, String sms, String plate) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel("parking") == null) {
            nm.createNotificationChannel(new NotificationChannel("parking", "Parking", NotificationManager.IMPORTANCE_HIGH));
        }
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        PendingIntent openPi = PendingIntent.getActivity(ctx, 5000, open, flags);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, "parking")
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setColor(0xFF4F46E5)
            .setContentTitle("🅿️ Plati parking – " + zone)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(openPi);
        if (!sms.isEmpty()) {
            Intent smsIntent = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + sms));
            smsIntent.putExtra("sms_body", plate);
            PendingIntent smsPi = PendingIntent.getActivity(ctx, 5001, smsIntent, flags);
            b.setContentText("Izgleda da si parkirao ovde. Dodirni da pošalješ SMS na " + sms + (plate.isEmpty() ? "" : " (" + plate + ")") + ".")
                .setContentIntent(smsPi)
                .addAction(0, "💬 Plati SMS " + sms, smsPi)
                .addAction(0, "Otvori aplikaciju", openPi);
        } else {
            b.setContentText("Izgleda da si parkirao ovde – ne zaboravi da platiš.");
        }
        try {
            NotificationManagerCompat.from(ctx).notify(("geo:" + id).hashCode(), b.build());
        } catch (SecurityException ignored) {
            // nema dozvole za obaveštenja
        }
    }
}
