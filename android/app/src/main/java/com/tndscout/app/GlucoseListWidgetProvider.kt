@file:Suppress("DEPRECATION")
package com.tndscout.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.*

class GlucoseListWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
        super.onUpdate(context, appWidgetManager, appWidgetIds)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val action = intent.action
        if (action == "expo.modules.sharedstorage.UPDATE_LIST_WIDGET" || action == AppWidgetManager.ACTION_APPWIDGET_UPDATE) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisWidget = ComponentName(context, GlucoseListWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)
            
            val listViewId = context.resources.getIdentifier("patient_list_view", "id", context.packageName)
            if (listViewId != 0) {
                for (appWidgetId in appWidgetIds) {
                    appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, listViewId)
                }
            }
            
            for (appWidgetId in appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId)
            }
        }
    }

    private fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
        val packageName = context.packageName
        val layoutId = context.resources.getIdentifier("glucose_widget_list", "layout", packageName)
        if (layoutId == 0) return

        val views = RemoteViews(packageName, layoutId)

        // Configura a Intent para o serviço que alimentará a ListView
        val serviceIntent = Intent(context, GlucoseListWidgetService::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
            data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
        }
        
        val listViewId = context.resources.getIdentifier("patient_list_view", "id", packageName)
        if (listViewId != 0) {
            @Suppress("DEPRECATION")
            views.setRemoteAdapter(listViewId, serviceIntent)
            
            val emptyViewId = context.resources.getIdentifier("empty_view", "id", packageName)
            if (emptyViewId != 0) {
                views.setEmptyView(listViewId, emptyViewId)
            }
        }

        // Configura Pending Intent para abrir o app ao clicar em qualquer item
        val appIntent = context.packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            context, 
            0, 
            appIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT else PendingIntent.FLAG_UPDATE_CURRENT
        )
        if (listViewId != 0) {
            views.setPendingIntentTemplate(listViewId, pendingIntent)
        }

        // Mostra a última hora de atualização geral do widget
        val updateId = context.resources.getIdentifier("widget_update_time", "id", packageName)
        if (updateId != 0) {
            val formatter = SimpleDateFormat("HH:mm", Locale.getDefault())
            views.setTextViewText(updateId, "Tempo Real · " + formatter.format(Date()))
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
