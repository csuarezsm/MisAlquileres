package com.itcanarias.misalquileres;

import android.app.Activity;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;
import java.util.Collections;

/**
 * Permiso para guardar las copias en el Google Drive del usuario.
 * Solo pide acceso a los archivos que crea la propia app (drive.file) y devuelve un token de acceso
 * de corta duración; la subida la hace la app directamente contra Google, sin servidores intermedios.
 */
@CapacitorPlugin(name = "Drive")
public class DrivePlugin extends Plugin {
    private static final String ALCANCE = "https://www.googleapis.com/auth/drive.file";
    private ActivityResultLauncher<IntentSenderRequest> lanzador;
    private PluginCall pendiente;

    @Override
    public void load() {
        lanzador = getActivity().registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), this::alVolver);
    }

    @PluginMethod
    public void autorizar(PluginCall call) {
        final boolean interactivo = Boolean.TRUE.equals(call.getBoolean("interactivo", false));
        AuthorizationRequest req = AuthorizationRequest.builder().setRequestedScopes(Collections.singletonList(new Scope(ALCANCE))).build();
        Identity.getAuthorizationClient(getActivity()).authorize(req)
            .addOnSuccessListener((AuthorizationResult res) -> {
                if (res.hasResolution()) {
                    if (!interactivo) { call.reject("Hace falta dar permiso a Google Drive", "PERMISO"); return; }
                    if (pendiente != null) { call.reject("Ya hay una petición en curso", "OCUPADO"); return; }
                    pendiente = call;
                    try {
                        lanzador.launch(new IntentSenderRequest.Builder(res.getPendingIntent().getIntentSender()).build());
                    } catch (Exception e) {
                        pendiente = null;
                        call.reject(String.valueOf(e.getMessage()), "ERROR");
                    }
                } else {
                    responder(call, res);
                }
            })
            .addOnFailureListener((Exception e) -> call.reject(String.valueOf(e.getMessage()), "ERROR"));
    }

    private void alVolver(ActivityResult r) {
        if (pendiente == null) return;
        PluginCall call = pendiente;
        pendiente = null;
        if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null) { call.reject("No se ha dado permiso", "CANCELADO"); return; }
        try {
            responder(call, Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(r.getData()));
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()), "ERROR");
        }
    }

    private void responder(PluginCall call, AuthorizationResult res) {
        if (res.getAccessToken() == null) { call.reject("Google no ha devuelto el acceso", "ERROR"); return; }
        JSObject o = new JSObject();
        o.put("token", res.getAccessToken());
        call.resolve(o);
    }
}
