package com.tndscout.app

import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class GlucoseForegroundService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private val CHANNEL_ID = "GlucoseForegroundServiceChannel"
    private val NOTIFICATION_ID = 8888
    
    private val updateRunnable = object : Runnable {
        override fun run() {
            thread {
                fetchAndUpdateData()
            }
            // Executa a cada 40 segundos
            handler.postDelayed(this, 40000)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == "STOP_SERVICE") {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
            stopSelf()
            return START_NOT_STICKY
        }
        if (action == "FORCE_UPDATE") {
            thread {
                fetchAndUpdateData()
            }
            return START_STICKY
        }

        // Limpa estados de alertas anteriores para novos disparos imediatos após a inicialização do serviço
        val sharedPrefs = getSharedPreferences("tnd_scout_shared_data", Context.MODE_PRIVATE)
        val editor = sharedPrefs.edit()
        sharedPrefs.all.keys.forEach { key ->
            if (key.startsWith("last_alert_")) {
                editor.remove(key)
            }
        }
        editor.apply()

        // Configura a Intent para parar o serviço
        val stopIntent = Intent(this, GlucoseForegroundService::class.java).apply {
            this.action = "STOP_SERVICE"
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT else PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Configura a Intent para abrir o aplicativo
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val launchPendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT else PendingIntent.FLAG_UPDATE_CURRENT
        )

        val appIconId = resources.getIdentifier("ic_launcher", "mipmap", packageName)
        val serviceIcon = if (appIconId != 0) appIconId else android.R.drawable.ic_menu_myplaces

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Monitoramento em Tempo Real")
            .setContentText("Atualizando glicemias dos widgets a cada 1 minuto")
            .setSmallIcon(serviceIcon)
            .setContentIntent(launchPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Parar", stopPendingIntent)
            .setColor(Color.parseColor("#0d9488"))
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

        startForeground(NOTIFICATION_ID, notification)

        // Inicia o ciclo recorrente
        handler.removeCallbacks(updateRunnable)
        handler.post(updateRunnable)

        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(updateRunnable)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)

            // 1. Canal do Foreground Service (discreta, sem som)
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Monitoramento de Glicemia",
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                description = "Mantém a leitura em tempo real ativa a cada 1 minuto"
                setShowBadge(false)
            }
            manager.createNotificationChannel(serviceChannel)

            // Deleta canais antigos para forçar reconfiguração de som/vibração
            // (Android cacheia canais e não permite alterar configurações de som após criação)
            try {
                manager.deleteNotificationChannel("GlucoseAlertsChannelSound")
                manager.deleteNotificationChannel("GlucoseAlertsChannelSilent")
                manager.deleteNotificationChannel("GlucoseAlertsChannelSound_v2")
                manager.deleteNotificationChannel("GlucoseAlertsChannelSilent_v2")
                manager.deleteNotificationChannel("GlucoseAlertsChannelSound_v3")
                manager.deleteNotificationChannel("GlucoseAlertsChannelSilent_v3")
                manager.deleteNotificationChannel("GlucoseAlertsChannelSound_v4")
                manager.deleteNotificationChannel("GlucoseAlertsChannelSilent_v4")
                manager.deleteNotificationChannel("GlucoseAlertsChannelSound_v5")
                manager.deleteNotificationChannel("GlucoseAlertsChannelSilent_v5")
                manager.deleteNotificationChannel("GlucoseAlertsChannelSound_v6")
                manager.deleteNotificationChannel("GlucoseAlertsChannelSilent_v6")
                manager.deleteNotificationChannel("GlucoseAlertsChannelSound_v7")
                manager.deleteNotificationChannel("GlucoseAlertsChannelSilent_v7")
            } catch (_: Exception) { }

            // 2. Canal de Alertas Clínicos com Som (Heads-up / Prioridade Alta) - Versão 8 com Beep de Notificação do App
            val resId = resources.getIdentifier("beep", "raw", packageName)
            val alertSoundUri = Uri.parse(android.content.ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + packageName + "/" + resId)
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                .build()

            val alertSoundChannel = NotificationChannel(
                "GlucoseAlertsChannelSound_v8",
                "Alertas de Glicemia (Com Som)",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Alerta para episódios de hipoglicemia e hiperglicemia com som"
                enableLights(true)
                lightColor = Color.RED
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
                setSound(alertSoundUri, audioAttributes)
                setBypassDnd(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            manager.createNotificationChannel(alertSoundChannel)

            // 3. Canal de Alertas Clínicos Silencioso (Sem Som) - Versão 8
            val alertSilentChannel = NotificationChannel(
                "GlucoseAlertsChannelSilent_v8",
                "Alertas de Glicemia (Silencioso)",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Alerta para episódios de hipoglicemia e hiperglicemia sem som"
                enableLights(true)
                lightColor = Color.RED
                enableVibration(false)
                setSound(null, null)
            }
            manager.createNotificationChannel(alertSilentChannel)
        }
    }

    private fun sendClinicalAlertNotification(
        patientName: String, 
        sgv: Int, 
        direction: String, 
        isHypo: Boolean, 
        soundEnabled: Boolean, 
        patientHash: Int
    ) {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val launchPendingIntent = PendingIntent.getActivity(
            this, patientHash, launchIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT else PendingIntent.FLAG_UPDATE_CURRENT
        )

        val channelId = if (soundEnabled) "GlucoseAlertsChannelSound_v8" else "GlucoseAlertsChannelSilent_v8"

        val arrow = when (direction) {
            "FortyFiveUp" -> "↗"
            "SingleUp" -> "↑"
            "DoubleUp" -> "⇈"
            "FortyFiveDown" -> "↘"
            "SingleDown" -> "↓"
            "DoubleDown" -> "⇊"
            "Flat" -> "→"
            else -> ""
        }

        val typeText = if (isHypo) "Hipoglicemia ⚠️" else "Hiperglicemia 🚨"
        val statusText = if (isHypo) "baixo" else "alto"
        val contentTitle = "$typeText detectada!"
        val contentText = "$patientName está com valor $statusText: $sgv mg/dL $arrow"

        val appIconId = resources.getIdentifier("ic_launcher", "mipmap", packageName)
        val alertIcon = if (appIconId != 0) appIconId else android.R.drawable.ic_dialog_alert

        val resId = resources.getIdentifier("beep", "raw", packageName)
        val alertSoundUri = Uri.parse(android.content.ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + packageName + "/" + resId)
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setContentTitle(contentTitle)
            .setContentText(contentText)
            .setSmallIcon(alertIcon)
            .setContentIntent(launchPendingIntent)
            .setOngoing(true)
            .setColor(if (isHypo) Color.parseColor("#ef4444") else Color.parseColor("#f59e0b"))
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

        if (soundEnabled) {
            // Força heads-up e ativa som e vibração explicitamente sem conflitar com defaults
            notificationBuilder.setPriority(NotificationCompat.PRIORITY_MAX)
                .setSound(alertSoundUri)
                .setVibrate(longArrayOf(0, 500, 200, 500, 200, 500))
                .setLights(Color.RED, 3000, 3000)
            // fullScreenIntent garante heads-up no Samsung OneUI
            notificationBuilder.setFullScreenIntent(launchPendingIntent, true)
        } else {
            notificationBuilder.setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setSound(null)
                .setVibrate(null)
        }

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(patientHash, notificationBuilder.build())
    }

    private fun fetchAndUpdateData() {
        try {
            val sharedPrefs = getSharedPreferences("tnd_scout_shared_data", Context.MODE_PRIVATE)
            val glucoseDataJson = sharedPrefs.getString("glucose_data", "")
            if (glucoseDataJson.isNullOrEmpty()) return

            val rootJson = JSONObject(glucoseDataJson)
            val patientsArray = rootJson.optJSONArray("patients") ?: return
            var dataChanged = false

            // Carrega configurações de widget para filtrar alertas baseados neles
            val widgetPrefs = getSharedPreferences("tnd_scout_widget_config", Context.MODE_PRIVATE)
            val activeWidgetPatientIds = widgetPrefs.all.values.filterIsInstance<String>().toSet()
            val hasAnyWidgetConfigured = activeWidgetPatientIds.isNotEmpty()

            for (i in 0 until patientsArray.length()) {
                val patient = patientsArray.getJSONObject(i)
                val urlStr = patient.optString("url", "")
                if (urlStr.isNotEmpty()) {
                    // SEMPRE busca dados de TODOS os pacientes, independente de showInStatus
                    val apiSecret = patient.optString("apiSecret", "")
                    var fetchResult = fetchGlucoseFromUrl(urlStr, apiSecret)
                    
                    // Se falhar o fetch direto (ex: Nightscout privado sem credencial direta), tenta o Proxy no Vercel
                    if (fetchResult == null) {
                        val patientId = patient.optString("id", "")
                        val supabaseToken = rootJson.optString("supabaseToken", "")
                        if (patientId.isNotEmpty() && supabaseToken.isNotEmpty()) {
                            fetchResult = fetchGlucoseFromVercel(patientId, supabaseToken)
                        }
                    }
                    if (fetchResult != null) {
                        val entry = JSONObject(fetchResult)
                        val newSgv = entry.optInt("sgv", 0)
                        val newDirection = entry.optString("direction", "Flat")
                        val newDate = entry.optLong("date", System.currentTimeMillis())

                        val oldSgv = patient.optInt("sgv", 0)
                        val oldDate = patient.optLong("date", 0)

                        if (newSgv != oldSgv || newDate != oldDate) {
                            patient.put("sgv", newSgv)
                            patient.put("direction", newDirection)
                            patient.put("date", newDate)
                            patient.put("error", false)
                            dataChanged = true
                        }

                        // Processamento dos Alertas Clínicos de Glicemia
                        // showInStatus controla APENAS se notificações de alerta são exibidas
                        val showInStatus = patient.optBoolean("showInStatus", true)
                        val alertsEnabled = sharedPrefs.getBoolean("alerts_enabled", true)
                        val patientAlertsEnabled = patient.optBoolean("alertsEnabled", true)

                        val patientId = patient.optString("id", "")
                        val isInAnyWidget = activeWidgetPatientIds.contains(patientId)
                        val allowedByWidget = if (hasAnyWidgetConfigured) isInAnyWidget else true

                        if (alertsEnabled && patientAlertsEnabled && showInStatus && allowedByWidget && newSgv > 0) {
                            val alertsSoundEnabled = sharedPrefs.getBoolean("alerts_sound_enabled", true)
                            val hypoLimit = sharedPrefs.getInt("alert_hypo_limit", 70)
                            val hyperLimit = sharedPrefs.getInt("alert_hyper_limit", 180)
                            val patientName = patient.optString("name", "Paciente")
                            val patientHash = java.lang.Math.abs(urlStr.hashCode())
                            val lastAlertKey = "last_alert_$patientHash"
                            val lastAlertTimeKey = "last_alert_time_$patientHash"
                            
                            val lastAlertState = sharedPrefs.getString(lastAlertKey, "none")
                            val lastAlertTime = sharedPrefs.getLong(lastAlertTimeKey, 0L)
                            val currentTime = System.currentTimeMillis()
                            val snoozeTime = 10 * 60 * 1000 // 10 minutos de snooze para tocar repetidamente mesmo se não tiver saído da hipo/hiper
                            
                            if (newSgv <= hypoLimit) {
                                val shouldAlert = lastAlertState != "hypo" || (currentTime - lastAlertTime >= snoozeTime)
                                if (shouldAlert) {
                                    sendClinicalAlertNotification(patientName, newSgv, newDirection, true, alertsSoundEnabled, patientHash)
                                    sharedPrefs.edit()
                                        .putString(lastAlertKey, "hypo")
                                        .putLong(lastAlertTimeKey, currentTime)
                                        .apply()
                                }
                            } else if (newSgv >= hyperLimit) {
                                val shouldAlert = lastAlertState != "hyper" || (currentTime - lastAlertTime >= snoozeTime)
                                if (shouldAlert) {
                                    sendClinicalAlertNotification(patientName, newSgv, newDirection, false, alertsSoundEnabled, patientHash)
                                    sharedPrefs.edit()
                                        .putString(lastAlertKey, "hyper")
                                        .putLong(lastAlertTimeKey, currentTime)
                                        .apply()
                                }
                            } else {
                                if (lastAlertState != "none") {
                                    sharedPrefs.edit()
                                        .putString(lastAlertKey, "none")
                                        .putLong(lastAlertTimeKey, 0L)
                                        .apply()
                                    // Limpa a notificação de alerta se a glicemia voltou ao normal
                                    val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                                    notificationManager.cancel(patientHash)
                                }
                            }
                        }
                    } else {
                        // Se falhar no fetch, marca com erro
                        patient.put("error", true)
                        dataChanged = true
                    }
                }
            }

            if (dataChanged) {
                // Atualiza o default (primeiro paciente da lista) se ele tiver mudado
                if (patientsArray.length() > 0) {
                    rootJson.put("default", patientsArray.getJSONObject(0))
                }
                rootJson.put("updatedAt", System.currentTimeMillis())

                // Salva os novos dados de volta em SharedPreferences
                sharedPrefs.edit().putString("glucose_data", rootJson.toString()).apply()

                // Dispara os intents para forçar a atualização imediata das duas classes de widgets
                sendBroadcast(Intent("expo.modules.sharedstorage.UPDATE_WIDGET").apply { setPackage(packageName) })
                sendBroadcast(Intent("expo.modules.sharedstorage.UPDATE_LIST_WIDGET").apply { setPackage(packageName) })
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun getSha1(input: String): String {
        return try {
            val md = java.security.MessageDigest.getInstance("SHA-1")
            val bytes = md.digest(input.toByteArray(Charsets.UTF_8))
            bytes.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            e.printStackTrace()
            ""
        }
    }

    private fun fetchGlucoseFromUrl(urlStr: String, apiSecret: String): String? {
        var cleanUrl = urlStr.trim()
        if (cleanUrl.endsWith("/")) {
            cleanUrl = cleanUrl.substring(0, cleanUrl.length - 1)
        }
        
        // Tenta até 2 vezes para lidar com instabilidade de rede
        for (attempt in 1..2) {
            var connection: HttpURLConnection? = null
            try {
                val url = URL("$cleanUrl/api/v1/entries.json?count=1")
                connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.setRequestProperty("Accept", "application/json")
                connection.setRequestProperty("User-Agent", "TnDScout/1.0")
                if (apiSecret.isNotEmpty()) {
                    val sha1Secret = getSha1(apiSecret)
                    if (sha1Secret.isNotEmpty()) {
                        connection.setRequestProperty("api-secret", sha1Secret)
                    }
                }
                connection.connectTimeout = 15000
                connection.readTimeout = 15000

                val responseCode = connection.responseCode
                if (responseCode == HttpURLConnection.HTTP_OK) {
                    val reader = BufferedReader(InputStreamReader(connection.inputStream))
                    val response = StringBuilder()
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        response.append(line)
                    }
                    reader.close()
                    
                    val array = JSONArray(response.toString())
                    if (array.length() > 0) {
                        return array.getJSONObject(0).toString()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                if (attempt < 2) {
                    // Aguarda 2 segundos antes de tentar novamente
                    try { Thread.sleep(2000) } catch (_: InterruptedException) { }
                }
            } finally {
                connection?.disconnect()
            }
        }
        return null
    }

    private fun fetchGlucoseFromVercel(patientId: String, token: String): String? {
        var connection: HttpURLConnection? = null
        try {
            val url = URL("https://tndscout.vercel.app/api/patient/glucose?patientId=$patientId")
            connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("User-Agent", "TnDScout/1.0")
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("Cache-Control", "no-cache, no-store, must-revalidate")
            connection.connectTimeout = 15000
            connection.readTimeout = 15000

            val responseCode = connection.responseCode
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val reader = BufferedReader(InputStreamReader(connection.inputStream))
                val response = StringBuilder()
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    response.append(line)
                }
                reader.close()
                return response.toString()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            connection?.disconnect()
        }
        return null
    }
}
