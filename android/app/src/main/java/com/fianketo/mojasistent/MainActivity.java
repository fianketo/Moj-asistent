package com.fianketo.mojasistent;

import android.content.res.Configuration;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BatteryPlugin.class);
        registerPlugin(ParkingGeofencePlugin.class);
        super.onCreate(savedInstanceState);
        applyBarColors(getResources().getConfiguration());
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyBarColors(newConfig);
    }

    // Zaglavlje aplikacije je svetlo u svetloj temi: ikonice statusne trake moraju biti tamne (i obrnuto).
    private void applyBarColors(Configuration c) {
        boolean night = (c.uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        WindowInsetsControllerCompat ic = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        ic.setAppearanceLightStatusBars(!night);
        ic.setAppearanceLightNavigationBars(!night);
    }
}
