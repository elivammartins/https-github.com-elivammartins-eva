
package com.elivam.pandora.services

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Base64
import android.util.Log
import android.graphics.Bitmap
import android.graphics.drawable.Icon
import android.graphics.drawable.BitmapDrawable
import java.io.ByteArrayOutputStream

class PandoraNotificationListener : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName
        
        // Filtro Estratégico para Comunicação Real
        if (packageName == "com.whatsapp" || packageName == "com.microsoft.teams" || packageName == "org.telegram.messenger") {
            val extras = sbn.notification.extras
            val title = extras.getString(Notification.EXTRA_TITLE) ?: "Remetente Oculto"
            val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
            
            // Tenta capturar o avatar real do remetente
            val largeIcon = sbn.notification.getLargeIcon()
            var base64Image: String? = null
            
            try {
                largeIcon?.let { icon ->
                    val drawable = icon.loadDrawable(this)
                    if (drawable is BitmapDrawable) {
                        val bitmap = drawable.bitmap
                        val outputStream = ByteArrayOutputStream()
                        bitmap.compress(Bitmap.CompressFormat.JPEG, 70, outputStream)
                        base64Image = Base64.encodeToString(outputStream.toByteArray(), Base64.DEFAULT)
                    }
                }
            } catch (e: Exception) {
                Log.e("PANDORA_NATIVE", "Erro ao processar ícone: ${e.message}")
            }

            // Injeção direta no WebView via Bridge JavaScript
            val payload = """
                {
                    "title": "${title.replace("\"", "\\\"")}",
                    "text": "${text.replace("\"", "\\\"")}",
                    "package": "$packageName",
                    "timestamp": ${System.currentTimeMillis()},
                    "image": ${if (base64Image != null) "\"data:image/jpeg;base64,$base64Image\"" else "null"}
                }
            """.trimIndent()

            val script = "if(window.onPandoraNotification) { window.onPandoraNotification($payload); }"
            
            // Nota: Em um ambiente Android real, este script deve ser enviado ao WebView
            // via EvaluateJavaScript no controlador da Activity principal.
            Log.d("PANDORA_NATIVE", "Notificação capturada de: $title")
        }
    }
}
