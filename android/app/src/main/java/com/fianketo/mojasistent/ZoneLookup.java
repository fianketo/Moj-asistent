package com.fianketo.mojasistent;

import android.content.Context;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

/** Traži zonu naplate po koordinatama u zones-ns.json (katastar Parking servisa Novi Sad). */
final class ZoneLookup {
    static final class Hit {
        String zoneKey; String code; String text; double dist;
    }

    private static int[] pts;
    private static double baseLat, baseLng, scale;
    private static String[] zones;
    private static String[][] codes;

    private static synchronized boolean load(Context ctx) {
        if (pts != null) return true;
        try (InputStream in = ctx.getAssets().open("public/zones-ns.json")) {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] chunk = new byte[65536];
            for (int n; (n = in.read(chunk)) > 0; ) bos.write(chunk, 0, n);
            JSONObject o = new JSONObject(new String(bos.toByteArray(), StandardCharsets.UTF_8));
            JSONArray base = o.getJSONArray("base");
            baseLat = base.getDouble(0); baseLng = base.getDouble(1); scale = o.getDouble("scale");
            JSONArray z = o.getJSONArray("zones"); zones = new String[z.length()];
            for (int i = 0; i < z.length(); i++) zones[i] = z.getString(i);
            JSONArray c = o.getJSONArray("codes"); codes = new String[c.length()][];
            for (int i = 0; i < c.length(); i++) codes[i] = new String[] { c.getJSONArray(i).getString(0), c.getJSONArray(i).getString(1) };
            JSONArray p = o.getJSONArray("pts"); int[] a = new int[p.length()];
            for (int i = 0; i < a.length; i++) a[i] = p.getInt(i);
            pts = a;
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** Najbliže parkiralište u krugu maxM metara, ili null. */
    static Hit find(Context ctx, double lat, double lng, double maxM) {
        if (!load(ctx)) return null;
        double kx = Math.cos(Math.toRadians(lat)) * 111320, ky = 110574;
        double best = maxM * maxM; int bi = -1;
        for (int i = 0; i < pts.length; i += 4) {
            double dy = (baseLat + pts[i] * scale - lat) * ky;
            if (Math.abs(dy) > maxM) continue;
            double dx = (baseLng + pts[i + 1] * scale - lng) * kx;
            double d = dx * dx + dy * dy;
            if (d < best) { best = d; bi = i; }
        }
        if (bi < 0) return null;
        Hit h = new Hit();
        h.zoneKey = zones[pts[bi + 2]];
        int ci = pts[bi + 3];
        if (ci >= 0) { h.code = codes[ci][0]; h.text = codes[ci][1]; }
        h.dist = Math.sqrt(best);
        return h;
    }
}
