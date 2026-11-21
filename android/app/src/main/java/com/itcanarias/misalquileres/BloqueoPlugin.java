package com.itcanarias.misalquileres;

import android.view.WindowManager;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bloqueo de la app con el mismo método que desbloquea el móvil (huella, cara, PIN, patrón o contraseña).
 * La app no guarda ninguna clave: lo comprueba Android.
 */
@CapacitorPlugin(name = "Bloqueo")
public class BloqueoPlugin extends Plugin {
    private static final int METODOS = BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL;

    @PluginMethod
    public void disponible(PluginCall call) {
        int r = BiometricManager.from(getContext()).canAuthenticate(METODOS);
        JSObject o = new JSObject();
        o.put("disponible", r == BiometricManager.BIOMETRIC_SUCCESS);
        o.put("motivo", r == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED ? "SIN_BLOQUEO" : r == BiometricManager.BIOMETRIC_SUCCESS ? "" : "NO_DISPONIBLE");
        call.resolve(o);
    }

    @PluginMethod
    public void autenticar(PluginCall call) {
        final String titulo = call.getString("titulo", "Mis alquileres");
        final String subtitulo = call.getString("subtitulo", "");
        getActivity().runOnUiThread(() -> {
            try {
                FragmentActivity act = (FragmentActivity) getActivity();
                BiometricPrompt prompt = new BiometricPrompt(act, ContextCompat.getMainExecutor(act), new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) { call.resolve(); }
                    @Override
                    public void onAuthenticationError(int codigo, CharSequence msg) { call.reject(String.valueOf(msg), String.valueOf(codigo)); }
                });
                BiometricPrompt.PromptInfo.Builder info = new BiometricPrompt.PromptInfo.Builder().setTitle(titulo).setAllowedAuthenticators(METODOS);
                if (subtitulo != null && !subtitulo.isEmpty()) info.setSubtitle(subtitulo);
                prompt.authenticate(info.build());
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()), "ERROR");
            }
        });
    }

    // Oculta el contenido en la lista de apps recientes y en las capturas de pantalla
    @PluginMethod
    public void proteger(PluginCall call) {
        final boolean activo = Boolean.TRUE.equals(call.getBoolean("activo", false));
        getActivity().runOnUiThread(() -> {
            if (activo) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }
}
