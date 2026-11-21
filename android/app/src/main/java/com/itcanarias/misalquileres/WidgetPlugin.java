package com.itcanarias.misalquileres;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {
    @PluginMethod
    public void actualizar(PluginCall call) {
        Context ctx = getContext();
        ctx.getSharedPreferences(WidgetResumen.PREFS, Context.MODE_PRIVATE).edit()
            .putString("titulo", call.getString("titulo", "Mis alquileres"))
            .putString("linea1", call.getString("linea1", ""))
            .putString("linea2", call.getString("linea2", ""))
            .apply();
        WidgetResumen.refrescar(ctx);
        call.resolve();
    }
}
