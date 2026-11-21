package com.itcanarias.misalquileres;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/** Widget de la pantalla de inicio: lo que te deben y lo cobrado este mes. Los textos los escribe la app al guardar. */
public class WidgetResumen extends AppWidgetProvider {
    static final String PREFS = "widget_resumen";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) mgr.updateAppWidget(id, vistas(ctx));
    }

    static RemoteViews vistas(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_resumen);
        v.setTextViewText(R.id.widget_titulo, p.getString("titulo", ctx.getString(R.string.app_name)));
        v.setTextViewText(R.id.widget_linea1, p.getString("linea1", ctx.getString(R.string.widget_abrir)));
        v.setTextViewText(R.id.widget_linea2, p.getString("linea2", ""));
        Intent abrir = new Intent(ctx, MainActivity.class);
        abrir.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setOnClickPendingIntent(R.id.widget_raiz, PendingIntent.getActivity(ctx, 0, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return v;
    }

    static void refrescar(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, WidgetResumen.class));
        if (ids != null && ids.length > 0) for (int id : ids) mgr.updateAppWidget(id, vistas(ctx));
    }
}
