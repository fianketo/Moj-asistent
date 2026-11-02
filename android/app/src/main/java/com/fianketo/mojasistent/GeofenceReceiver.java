package com.fianketo.mojasistent;

import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.google.android.gms.location.ActivityRecognitionResult;
import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionEvent;
import com.google.android.gms.location.ActivityTransitionResult;
import com.google.android.gms.location.DetectedActivity;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.tasks.CancellationTokenSource;
import com.google.android.gms.location.GeofencingEvent;
import java.util.Calendar;
import org.json.JSONArray;
import org.json.JSONObject;

/** Prima događaje geofence-a (i restart telefona) i šalje podsetnik za plaćanje parkinga. */
public class GeofenceReceiver extends BroadcastReceiver {
    static final String ACTION_GEOFENCE = "com.fianketo.mojasistent.GEOFENCE";
    static final String ACTION_TEST = "com.fianketo.mojasistent.TEST_DWELL"; // za test na emulatoru
    static final String ACTION_ACTIVITY = "com.fianketo.mojasistent.ACTIVITY";
    static final String ACTION_ACTIVITY_UPDATE = "com.fianketo.mojasistent.ACTIVITY_UPDATE";
    static final String ACTION_TEST_EXIT = "com.fianketo.mojasistent.TEST_EXIT";
    static final long COOLDOWN_MS = 2 * 60 * 60 * 1000L;

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            ParkingGeofencePlugin.register(ctx);
            ParkingGeofencePlugin.registerActivity(ctx);
            return;
        }
        SharedPreferences p = ParkingGeofencePlugin.prefs(ctx);
        if (ACTION_TEST_EXIT.equals(action)) {
            onVehicleExit(ctx, p, true);
            return;
        }
        if (ACTION_ACTIVITY.equals(action)) {
            if (!ActivityTransitionResult.hasResult(intent)) return;
            ActivityTransitionResult res = ActivityTransitionResult.extractResult(intent);
            if (res == null) return;
            for (ActivityTransitionEvent ev : res.getTransitionEvents()) {
                if (ev.getActivityType() != DetectedActivity.IN_VEHICLE) continue;
                boolean exit = ev.getTransitionType() == ActivityTransition.ACTIVITY_TRANSITION_EXIT;
                log(p, exit ? "telefon: izlazak iz vozila" : "telefon: vožnja počela");
                if (exit) parkedSignal(ctx, p, "prelaz aktivnosti"); else drivingSignal(p, null);
            }
            return;
        }
        if (ACTION_ACTIVITY_UPDATE.equals(action)) {
            if (!ActivityRecognitionResult.hasResult(intent)) return;
            ActivityRecognitionResult r = ActivityRecognitionResult.extractResult(intent);
            if (r == null) return;
            DetectedActivity a = r.getMostProbableActivity();
            long now = System.currentTimeMillis();
            boolean driving = p.getBoolean("driving", false);
            long lastVeh = p.getLong("lastVehicle", 0);
            if (a.getType() == DetectedActivity.IN_VEHICLE && a.getConfidence() >= 60) {
                drivingSignal(p, "provera kretanja: vožnja");
            } else if (driving) {
                boolean walking = (a.getType() == DetectedActivity.ON_FOOT || a.getType() == DetectedActivity.WALKING) && a.getConfidence() >= 50;
                boolean stillLong = a.getType() == DetectedActivity.STILL && now - lastVeh > 4 * 60 * 1000L;
                if (now - lastVeh > 60 * 60 * 1000L) p.edit().putBoolean("driving", false).apply();
                else if (walking || stillLong) parkedSignal(ctx, p, walking ? "provera kretanja: hodaš posle vožnje" : "provera kretanja: stojiš posle vožnje");
            }
            return;
        }
        if (android.bluetooth.BluetoothDevice.ACTION_ACL_CONNECTED.equals(action) || android.bluetooth.BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(action)) {
            android.bluetooth.BluetoothDevice d = intent.getParcelableExtra(android.bluetooth.BluetoothDevice.EXTRA_DEVICE);
            String car = p.getString("carBt", "");
            if (d == null || car.isEmpty() || !car.equalsIgnoreCase(d.getAddress())) return;
            if (android.bluetooth.BluetoothDevice.ACTION_ACL_CONNECTED.equals(action)) drivingSignal(p, "auto povezano (Bluetooth)");
            else { log(p, "auto odspojeno (Bluetooth)"); parkedSignal(ctx, p, "Bluetooth auta"); }
            return;
        }
        if (ACTION_TEST.equals(action)) {
            onDwell(ctx, p, intent.getStringExtra("id"), true);
            return;
        }
        GeofencingEvent ev = GeofencingEvent.fromIntent(intent);
        if (ev == null || ev.hasError()) {
            log(p, "error:" + (ev == null ? "null" : ev.getErrorCode()));
            return;
        }
        if (ev.getTriggeringGeofences() == null) return;
        for (Geofence g : ev.getTriggeringGeofences()) {
            if (ev.getGeofenceTransition() == Geofence.GEOFENCE_TRANSITION_DWELL) onDwell(ctx, p, g.getRequestId(), false);
            else log(p, "napustio zapamćeno mesto");
        }
    }

    private void onDwell(Context ctx, SharedPreferences p, String id, boolean ignoreHours) {
        long now = System.currentTimeMillis();
        log(p, "zadržao se na zapamćenom mestu");
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
            notifyPay(ctx, id, zone, sms, plate, "");
            p.edit().putLong("notified_" + id, now).apply();
        } catch (Exception e) {
            log(p, "error:" + e.getMessage());
        }
    }

    /** Upravo si izašao iz auta: uzmi lokaciju, nađi zonu (katastar ili zapamćeno mesto) i podseti. */
    @SuppressLint("MissingPermission")
    private void onVehicleExit(Context ctx, SharedPreferences p, boolean test) {
        if (!p.getBoolean("enabled", false)) { log(p, "preskočeno: podsetnik isključen"); return; }
        if (!ParkingGeofencePlugin.hasFine(ctx)) { log(p, "preskočeno: nema dozvole za lokaciju"); return; }
        long now = System.currentTimeMillis();
        if (!test && p.getLong("activeUntil", 0) > now) { log(p, "preskočeno: parking već plaćen u aplikaciji"); return; }
        if (!test && now - p.getLong("lastAutoNotify", 0) < 20 * 60 * 1000L) { log(p, "preskočeno: podsetnik poslat pre manje od 20 min"); return; }
        try {
            if (!test && !isPaidTime(new JSONObject(p.getString("hours", "{}")))) { log(p, "preskočeno: van vremena naplate"); return; }
        } catch (Exception ignored) { }
        log(p, test ? "proba: tražim lokaciju" : "izašao iz auta – tražim lokaciju");
        final PendingResult pr = goAsync();
        CancellationTokenSource cts = new CancellationTokenSource();
        LocationServices.getFusedLocationProviderClient(ctx)
            .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.getToken())
            .addOnCompleteListener(task -> {
                try {
                    Location loc = task.isSuccessful() ? task.getResult() : null;
                    if (loc != null) log(p, String.format(java.util.Locale.US, "lokacija %.5f, %.5f (±%.0f m)", loc.getLatitude(), loc.getLongitude(), loc.getAccuracy()));
                    if (loc == null) { log(p, "lokacija nije dobijena (isključena ili nema signala)"); return; }
                    handleParkedAt(ctx, p, loc.getLatitude(), loc.getLongitude(), loc.hasAccuracy() ? loc.getAccuracy() : 20);
                } finally {
                    pr.finish();
                }
            });
    }

    private void handleParkedAt(Context ctx, SharedPreferences p, double lat, double lng, double acc) {
        try {
            String zoneName = null, sms = "", extra = "";
            JSONObject cityZones = new JSONObject(p.getString("cityZones", "{}"));
            if ("novisad".equals(p.getString("city", ""))) {
                // tačke su duž ivica parkirališta; GPS ume da odstupa – 60 m + nesigurnost, najviše 100 m
                double maxM = Math.min(100, 60 + Math.max(0, acc));
                ZoneLookup.Hit h = ZoneLookup.find(ctx, lat, lng, maxM);
                if (h == null) {
                    ZoneLookup.Hit far = ZoneLookup.find(ctx, lat, lng, 1000);
                    log(p, far == null ? "najbliža zona: dalje od 1 km" : String.format(java.util.Locale.US, "najbliža zona: %s, %.0f m (granica %.0f m)", far.zoneKey, far.dist, maxM));
                } else {
                    log(p, String.format(java.util.Locale.US, "zona %s, %.0f m od parkirališta %s", h.zoneKey, h.dist, h.code == null ? "" : h.code));
                }
                if (h != null && cityZones.has(h.zoneKey)) {
                    JSONObject z = cityZones.getJSONObject(h.zoneKey);
                    zoneName = z.optString("name"); sms = z.optString("sms");
                    if (h.code != null) extra = "Parkiralište " + h.code + (h.text != null ? " – " + h.text : "") + ". ";
                }
            }
            if (zoneName == null) { // zapamćena mesta
                JSONArray spots = new JSONArray(p.getString("spots", "[]"));
                double best = 120;
                for (int k = 0; k < spots.length(); k++) {
                    JSONObject s = spots.getJSONObject(k);
                    double d = distM(lat, lng, s.getDouble("lat"), s.getDouble("lng"));
                    if (d < best) { best = d; zoneName = s.optString("zone"); sms = s.optString("sms", ""); }
                }
            }
            log(p, zoneName == null ? "parkirao van zone naplate – bez obaveštenja" : "parkirao: " + zoneName + " – obaveštenje poslato");
            if (zoneName == null) return;
            notifyPay(ctx, "auto", zoneName, sms, p.getString("plate", ""), extra);
            p.edit().putLong("lastAutoNotify", System.currentTimeMillis()).apply();
        } catch (Exception e) {
            log(p, "error:" + e.getMessage());
        }
    }

    private static void drivingSignal(SharedPreferences p, String msg) {
        boolean was = p.getBoolean("driving", false);
        p.edit().putBoolean("driving", true).putLong("lastVehicle", System.currentTimeMillis()).apply();
        if (!was && msg != null) log(p, msg);
    }

    /** Neki izvor kaže da si parkirao – jednom u 8 min, pa proveri zonu. */
    private void parkedSignal(Context ctx, SharedPreferences p, String source) {
        long now = System.currentTimeMillis();
        p.edit().putBoolean("driving", false).apply();
        if (now - p.getLong("lastExitAt", 0) < 8 * 60 * 1000L) return;
        p.edit().putLong("lastExitAt", now).apply();
        log(p, "parkiranje prepoznato (" + source + ")");
        onVehicleExit(ctx, p, false);
    }

    /** Dnevnik poslednjih događaja (vidi se u Podešavanjima aplikacije). */
    static synchronized void log(SharedPreferences p, String msg) {
        long now = System.currentTimeMillis();
        try {
            JSONArray a = new JSONArray(p.getString("log", "[]"));
            JSONArray out = new JSONArray();
            out.put(new JSONArray().put(now).put(msg));
            for (int i = 0; i < a.length() && i < 19; i++) out.put(a.get(i));
            p.edit().putString("log", out.toString()).putString("lastEvent", msg + "@" + now).apply();
        } catch (Exception e) {
            p.edit().putString("lastEvent", msg + "@" + now).apply();
        }
    }

    static double distM(double la1, double ln1, double la2, double ln2) {
        double kx = Math.cos(Math.toRadians(la1)) * 111320, ky = 110574;
        return Math.hypot((la2 - la1) * ky, (ln2 - ln1) * kx);
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

    private void notifyPay(Context ctx, String id, String zone, String sms, String plate, String extra) {
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
            String txt = extra + "Dodirni da pošalješ SMS na " + sms + (plate.isEmpty() ? "" : " (" + plate + ")") + ".";
            b.setContentText(txt)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(txt))
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
