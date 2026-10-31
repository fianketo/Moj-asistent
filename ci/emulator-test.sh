#!/usr/bin/env bash
# Pokreće aplikaciju na Android emulatoru i ispisuje dijagnostiku obaveštenja.
set -x
PKG=com.fianketo.mojasistent
adb install -r moj-asistent-debug.apk
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS || true
adb shell pm grant $PKG android.permission.ACCESS_FINE_LOCATION || true
adb shell pm grant $PKG android.permission.ACCESS_BACKGROUND_LOCATION || true
adb emu geo fix 19.831626 45.262349 || true
adb shell pm grant $PKG android.permission.ACTIVITY_RECOGNITION || true
adb logcat -c
adb shell am start -n $PKG/.MainActivity
sleep 20
PID=$(adb shell pidof $PKG | tr -d '\r')
echo "PID=$PID"
adb forward tcp:9222 localabstract:webview_devtools_remote_$PID
curl -s localhost:9222/json || true
node ci/probe.js || echo "PROBE FAILED"
sleep 15
echo "===== POSTED ====="
adb shell dumpsys notification --noredact | grep -iE "NotificationRecord.*mojasistent|android.title=" | head -40
echo "===== DEEP LINK ====="
adb shell am start -a android.intent.action.VIEW -d "mojasistent://lista?d=WzEsIlBpamFjYSIsW1siUGFyYWRhanoiLDIsImtnIl0sWyJKYWphIiwxMCwia29tIl1dXQ" $PKG
sleep 4
node ci/check-import.js || echo "IMPORT CHECK FAILED"
echo "===== LOGCAT ====="
adb logcat -d | grep -iE "Capacitor|chromium|LocalNotif|$PKG|AndroidRuntime" | tail -150
echo "===== NOTIFICATIONS ====="
adb shell dumpsys notification --noredact | grep -iE -A4 "pkg=$PKG|$PKG" | head -80
echo "===== GEOFENCES ====="
adb shell dumpsys activity service com.google.android.gms/.chimera.GmsIntentOperationService 2>/dev/null | grep -i -A3 geofence | head -20
adb shell dumpsys location | grep -i -B2 -A6 "geofence" | head -40
echo "===== ALARMS ====="
adb shell dumpsys alarm | grep -iE -B2 -A3 "$PKG" | head -60
