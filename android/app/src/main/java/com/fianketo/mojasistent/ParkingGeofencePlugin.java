package com.fianketo.mojasistent;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.location.ActivityRecognition;
import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionRequest;
import com.google.android.gms.location.DetectedActivity;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingClient;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Zapamćena parking mesta kao geofence-ovi: kad se korisnik zadrži na mestu (DWELL),
 * GeofenceReceiver šalje obaveštenje da plati parking u toj zoni – i kad je aplikacija zatvorena.
 */
@CapacitorPlugin(
    name = "ParkingGeofence",
    permissions = {
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
        @Permission(alias = "background", strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }),
        @Permission(alias = "activity", strings = { Manifest.permission.ACTIVITY_RECOGNITION })
    }
)
public class ParkingGeofencePlugin extends Plugin {
    static final String PREFS = "parking_geofence";

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static PendingIntent pendingIntent(Context ctx) {
        Intent i = new Intent(ctx, GeofenceReceiver.class);
        i.setAction(GeofenceReceiver.ACTION_GEOFENCE);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
        return PendingIntent.getBroadcast(ctx, 4711, i, flags);
    }

    static PendingIntent activityIntent(Context ctx) {
        Intent i = new Intent(ctx, GeofenceReceiver.class);
        i.setAction(GeofenceReceiver.ACTION_ACTIVITY);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
        return PendingIntent.getBroadcast(ctx, 4712, i, flags);
    }

    static boolean hasActivity(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true;
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
    }

    /** Prati izlazak iz vozila – tada se proverava da li si parkirao u zoni naplate. */
    @SuppressLint("MissingPermission")
    static String registerActivity(Context ctx) {
        try {
            ActivityRecognition.getClient(ctx).removeActivityTransitionUpdates(activityIntent(ctx));
            SharedPreferences p = prefs(ctx);
            if (!p.getBoolean("enabled", false)) return "disabled";
            if (!hasActivity(ctx)) return "no_activity_permission";
            List<ActivityTransition> t = new ArrayList<>();
            t.add(new ActivityTransition.Builder().setActivityType(DetectedActivity.IN_VEHICLE).setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER).build());
            t.add(new ActivityTransition.Builder().setActivityType(DetectedActivity.IN_VEHICLE).setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT).build());
            ActivityRecognition.getClient(ctx).requestActivityTransitionUpdates(new ActivityTransitionRequest(t), activityIntent(ctx))
                .addOnSuccessListener(v -> { p.edit().putString("lastActivityRegister", "ok:" + System.currentTimeMillis()).apply(); GeofenceReceiver.log(p, "praćenje vožnje uključeno"); })
                .addOnFailureListener(e -> { p.edit().putString("lastActivityRegister", "error:" + e.getMessage()).apply(); GeofenceReceiver.log(p, "GREŠKA praćenja vožnje: " + e.getMessage()); });
            return "ok";
        } catch (Exception e) {
            return "error:" + e.getMessage();
        }
    }

    static boolean hasFine(Context ctx) {
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean hasBackground(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return hasFine(ctx);
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    /** Registruje sve sačuvane geofence-ove (poziva se i posle restarta telefona). */
    @SuppressLint("MissingPermission")
    static String register(Context ctx) {
        GeofencingClient client = LocationServices.getGeofencingClient(ctx);
        client.removeGeofences(pendingIntent(ctx));
        SharedPreferences p = prefs(ctx);
        if (!p.getBoolean("enabled", false)) return "disabled";
        if (!hasFine(ctx)) return "no_location_permission";
        try {
            JSONArray spots = new JSONArray(p.getString("spots", "[]"));
            int dwellMs = p.getInt("dwellMs", 180000);
            List<Geofence> list = new ArrayList<>();
            for (int k = 0; k < spots.length() && list.size() < 95; k++) {
                JSONObject s = spots.getJSONObject(k);
                list.add(new Geofence.Builder()
                    .setRequestId(s.getString("id"))
                    .setCircularRegion(s.getDouble("lat"), s.getDouble("lng"), (float) s.optDouble("radius", 120))
                    .setExpirationDuration(Geofence.NEVER_EXPIRE)
                    .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_DWELL | Geofence.GEOFENCE_TRANSITION_EXIT)
                    .setLoiteringDelay(dwellMs)
                    .setNotificationResponsiveness(60000)
                    .build());
            }
            if (list.isEmpty()) return "no_spots";
            GeofencingRequest req = new GeofencingRequest.Builder()
                .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_DWELL)
                .addGeofences(list)
                .build();
            client.addGeofences(req, pendingIntent(ctx))
                .addOnSuccessListener(v -> p.edit().putString("lastRegister", "ok:" + System.currentTimeMillis()).apply())
                .addOnFailureListener(e -> p.edit().putString("lastRegister", "error:" + e.getMessage()).apply());
            return "registering:" + list.size();
        } catch (Exception e) {
            return "error:" + e.getMessage();
        }
    }

    /** {enabled, spots:[{id,lat,lng,radius,zone,sms}], plate, hours:{wd:[od,do], sat:[od,do], sun:[od,do]|null}, dwellMin} */
    @PluginMethod
    public void configure(PluginCall call) {
        SharedPreferences.Editor e = prefs(getContext()).edit();
        e.putBoolean("enabled", call.getBoolean("enabled", false));
        JSArray spots = call.getArray("spots", new JSArray());
        e.putString("spots", spots.toString());
        e.putString("plate", call.getString("plate", ""));
        JSObject hours = call.getObject("hours", new JSObject());
        e.putString("hours", hours.toString());
        e.putInt("dwellMs", (int) Math.round(call.getDouble("dwellMin", 3.0) * 60000));
        e.putString("city", call.getString("city", ""));
        e.putString("cityZones", call.getObject("cityZones", new JSObject()).toString());
        e.apply();
        JSObject ret = new JSObject();
        ret.put("result", register(getContext()));
        ret.put("activity", registerActivity(getContext()));
        call.resolve(ret);
    }

    /** Dok je parking plaćen u aplikaciji, ne podsećaj. */
    @PluginMethod
    public void setActiveUntil(PluginCall call) {
        prefs(getContext()).edit().putLong("activeUntil", call.getLong("until", 0L)).apply();
        call.resolve();
    }

    /** Probno: ponaša se kao da si se zadržao na mestu `id` (ignoriše radno vreme i pauzu). */
    @PluginMethod
    public void testDwell(PluginCall call) {
        String id = call.getString("id");
        prefs(getContext()).edit().remove("notified_" + id).apply();
        Intent i = new Intent(getContext(), GeofenceReceiver.class);
        i.setAction(GeofenceReceiver.ACTION_TEST);
        i.putExtra("id", id);
        getContext().sendBroadcast(i);
        call.resolve();
    }

    /** Probno: ponaša se kao da si upravo izašao iz auta (ignoriše radno vreme i pauzu). */
    @PluginMethod
    public void testVehicleExit(PluginCall call) {
        prefs(getContext()).edit().putLong("lastAutoNotify", 0).apply();
        Intent i = new Intent(getContext(), GeofenceReceiver.class);
        i.setAction(GeofenceReceiver.ACTION_TEST_EXIT);
        getContext().sendBroadcast(i);
        call.resolve();
    }

    /** Zona naplate na datoj lokaciji (katastar Novog Sada). */
    @PluginMethod
    public void zoneAt(PluginCall call) {
        ZoneLookup.Hit h = ZoneLookup.find(getContext(), call.getDouble("lat", 0.0), call.getDouble("lng", 0.0), call.getDouble("maxM", 30.0));
        JSObject r = new JSObject();
        if (h != null) { r.put("zone", h.zoneKey); r.put("code", h.code); r.put("text", h.text); r.put("dist", h.dist); }
        call.resolve(r);
    }

    @PluginMethod
    public void status(PluginCall call) {
        SharedPreferences p = prefs(getContext());
        JSObject ret = new JSObject();
        ret.put("activity", hasActivity(getContext()));
        android.location.LocationManager lm = (android.location.LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        ret.put("gps", lm != null && androidx.core.location.LocationManagerCompat.isLocationEnabled(lm));
        ret.put("lastActivityRegister", p.getString("lastActivityRegister", ""));
        ret.put("location", hasFine(getContext()));
        ret.put("background", hasBackground(getContext()));
        ret.put("enabled", p.getBoolean("enabled", false));
        ret.put("lastRegister", p.getString("lastRegister", ""));
        ret.put("lastEvent", p.getString("lastEvent", ""));
        try { ret.put("log", new JSArray(p.getString("log", "[]"))); } catch (Exception ignored) { }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestLocation(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            requestBackgroundStep(call);
        } else {
            requestPermissionForAlias("location", call, "afterLocation");
        }
    }

    @PermissionCallback
    private void afterLocation(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            JSObject r = new JSObject();
            r.put("location", false);
            r.put("background", false);
            call.resolve(r);
            return;
        }
        requestBackgroundStep(call);
    }

    private void requestBackgroundStep(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && getPermissionState("background") != PermissionState.GRANTED) {
            // Android 11+ ovo otvara ekran gde se bira „Dozvoli uvek“.
            requestPermissionForAlias("background", call, "afterBackground");
        } else {
            afterBackground(call);
        }
    }

    @PermissionCallback
    private void afterBackground(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && getPermissionState("activity") != PermissionState.GRANTED && !call.getBoolean("activityAsked", false)) {
            call.getData().put("activityAsked", true);
            requestPermissionForAlias("activity", call, "afterBackground");
            return;
        }
        register(getContext());
        registerActivity(getContext());
        JSObject r = new JSObject();
        r.put("location", hasFine(getContext()));
        r.put("background", hasBackground(getContext()));
        r.put("activity", hasActivity(getContext()));
        call.resolve(r);
    }
}
