package com.fianketo.mojasistent;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

/** Pozadinska provera vazduha i polena (svaka 2 sata) – obaveštenje stiže i kad je aplikacija zatvorena. */
public class EnvWorker extends Worker {
    static final String[] AQ = { "Dobar", "Prihvatljiv", "Umeren", "Loš", "Veoma loš", "Izuzetno loš" };
    static final String[] AQ_TIP = { "", "", "Osetljive osobe neka smanje naporne aktivnosti napolju.",
        "Smanji naporne aktivnosti napolju, trening radi u zatvorenom.", "Izbegavaj naporne aktivnosti napolju.", "Izbegavaj boravak napolju, drži prozore zatvorene." };

    public EnvWorker(@NonNull Context ctx, @NonNull WorkerParameters params) { super(ctx, params); }

    static void schedule(Context ctx) {
        Constraints c = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(EnvWorker.class, 2, TimeUnit.HOURS).setConstraints(c).build();
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork("okolina", ExistingPeriodicWorkPolicy.UPDATE, req);
    }

    @NonNull @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences p = ParkingGeofencePlugin.prefs(ctx);
        try { checkSubv(ctx, p); } catch (Exception ignored) { }
        String url = p.getString("envUrl", "");
        if (url.isEmpty()) return Result.success();
        try {
            HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
            con.setConnectTimeout(20000); con.setReadTimeout(30000);
            InputStream in = con.getInputStream(); ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[8192]; int n; while ((n = in.read(buf)) > 0) bo.write(buf, 0, n); in.close();
            JSONObject d = new JSONObject(bo.toString("UTF-8"));
            long now = System.currentTimeMillis();
            // vazduh
            int alert = p.getInt("envAirAlert", 3);
            JSONObject air = d.optJSONObject("air");
            if (air != null && !air.isNull("level")) {
                int lv = air.getInt("level");
                if (lv >= alert && now - p.getLong("envAirNotified", 0) > 6 * 3600 * 1000L) {
                    notify(ctx, 7101, "💨 Vazduh u Novom Sadu: " + AQ[Math.min(lv, 5)], AQ_TIP[Math.min(lv, 5)]);
                    p.edit().putLong("envAirNotified", now).apply();
                }
            }
            // polen: izabrani alergeni sa visokom koncentracijom, jednom po merenju
            Set<String> mine = new HashSet<>(Arrays.asList(p.getString("envAllergens", "").split(",")));
            JSONObject pol = d.optJSONObject("pollen");
            if (pol != null && pol.optBoolean("season") && p.getBoolean("envPollenAlert", true) && !mine.isEmpty()) {
                String date = pol.optString("date"); StringBuilder hi = new StringBuilder();
                JSONArray items = pol.optJSONArray("items");
                for (int i = 0; items != null && i < items.length(); i++) {
                    JSONObject it = items.getJSONObject(i);
                    if (mine.contains(it.optString("key")) && it.optInt("level") == 2) hi.append(hi.length() > 0 ? ", " : "").append(it.optString("name"));
                }
                if (hi.length() > 0 && !date.equals(p.getString("envPollenNotified", ""))) {
                    notify(ctx, 7102, "🌼 Visok polen: " + hi, "Zatvori prozore; posle boravka napolju operi lice i promeni odeću.");
                    p.edit().putString("envPollenNotified", date).apply();
                }
            }
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }

    static String fetch(String url) throws Exception {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(20000); con.setReadTimeout(30000);
        InputStream in = con.getInputStream(); ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[8192]; int n; while ((n = in.read(buf)) > 0) bo.write(buf, 0, n); in.close();
        return bo.toString("UTF-8");
    }

    /** Nove objave o subvencijama (pozivi, isplate, rezultati) za izabrane oblasti. */
    static void checkSubv(Context ctx, SharedPreferences p) throws Exception {
        if (!p.getBoolean("subvOn", false) || p.getString("subvUrl", "").isEmpty()) return;
        JSONArray items = new JSONObject(fetch(p.getString("subvUrl", ""))).getJSONArray("items");
        String seen = p.getString("subvSeen", ""), max = seen;
        String tagsStr = p.getString("subvTags", "");
        Set<String> tags = new HashSet<>(Arrays.asList(tagsStr.split(",")));
        java.util.List<String> fresh = new java.util.ArrayList<>();
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.getJSONObject(i);
            String fs = it.optString("first_seen");
            if (fs.compareTo(max) > 0) max = fs;
            if (fs.compareTo(seen) <= 0 || "vest".equals(it.optString("kind"))) continue;
            boolean match = tagsStr.isEmpty();
            JSONArray t = it.optJSONArray("tags");
            for (int k = 0; !match && t != null && k < t.length(); k++) if (tags.contains(t.getString(k))) match = true;
            if (match) fresh.add(it.optString("title"));
        }
        if (!fresh.isEmpty()) {
            String title = fresh.size() == 1 ? "🌾 " + fresh.get(0) : "🌾 " + fresh.size() + " nove objave o subvencijama";
            StringBuilder body = new StringBuilder();
            for (int i = 0; i < Math.min(3, fresh.size()); i++) body.append(i > 0 ? "\n" : "").append(fresh.get(i));
            notify(ctx, 7103, title, fresh.size() == 1 ? "Otvori aplikaciju za rok i detalje." : body.toString());
        }
        p.edit().putString("subvSeen", max).apply();
    }

    static void notify(Context ctx, int id, String title, String text) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel("okolina") == null) {
            nm.createNotificationChannel(new NotificationChannel("okolina", "Vazduh i polen", NotificationManager.IMPORTANCE_DEFAULT));
        }
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        PendingIntent pi = PendingIntent.getActivity(ctx, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, "okolina")
            .setSmallIcon(R.drawable.ic_stat_notify).setColor(0xFF6750A4)
            .setContentTitle(title).setContentText(text).setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setAutoCancel(true).setContentIntent(pi);
        try { NotificationManagerCompat.from(ctx).notify(id, b.build()); } catch (SecurityException ignored) { }
    }
}
