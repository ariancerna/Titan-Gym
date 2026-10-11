# Acceso con Google

## Estado real

Botón integrado mediante Supabase signInWithOAuth, PKCE y retorno `/auth/confirm`. Reutiliza la validación getUser, la identidad confirmada y las restricciones de reserva existentes. La interfaz consulta `/auth/v1/settings` y mantiene el botón deshabilitado si Google está desactivado. No hay claves OAuth ni secretos en React.

El propietario completó las credenciales y activó Google en Supabase. Se consultó `/auth/v1/settings` real: HTTP 200, google=true, email=true, anonymous_users=false y altas habilitadas. Desde la aplicación real se pulsó Continuar con Google y se llegó al selector de cuentas oficial de Google usando el cliente de Nexo y el callback TITAN GYM. No se completó todavía el consentimiento ni se verificó el intercambio final de código/JWT. No se inspeccionó, registró ni copió el secreto.

Se dejó el Client ID público de Nexo escrito en el formulario Supabase, **sin guardar ni activar**. El secreto sigue vacío. Evidencia: `docs/evidencias/google-oauth-pendiente.png`. Se dejaron ambos paneles abiertos para que el propietario complete la credencial; no se creó ningún secreto nuevo.

La descripción anterior registra el estado previo a la configuración del propietario. Después de su aviso «listo», settings confirmó que el proveedor quedó activo. La captura de estado pendiente no acredita el estado actual ni un acceso completado.

El propietario confirmó la ampliación de URLs. Se guardó el nombre `Nexo · TITAN GYM` y el callback TITAN GYM adicional, conservando el callback de Nexo. Google mostró «Se guardó el cliente OAuth» y se abrió de nuevo el cliente para verificar ambas URLs persistidas. Evidencia: `docs/evidencias/google-nexo-guardado.png`. El nombre del proyecto Cloud y la marca pública no se cambiaron. El secreto existente sigue habilitado; no fue revocado.

## Reutilizar Nexo sin romperlo

- Proyecto Google Cloud: `nexo-508803`.
- Cliente Web: `252321702436-qkh2ifbfjqldndg32t5c6cvsti2jfki0.apps.googleusercontent.com`.
- Conservar callback de Nexo: `https://xvfosvjtwtnybinibwiz.supabase.co/auth/v1/callback`.
- Añadir callback TITAN GYM: `https://cyufnolnnwaeacnyzpfy.supabase.co/auth/v1/callback`.
- Nombre interno recomendado: `Nexo · TITAN GYM`. Este nombre solo identifica al cliente en la consola; no cambia la marca que ven los usuarios en el consentimiento.
- No cambiar project ID, no borrar clientes, no revocar el secreto existente ni quitar URL de Nexo.

Google ya no deja ver o descargar el secreto antiguo desde la consola. Si el propietario lo conserva, puede pegarlo directamente en el proveedor Google de Supabase. Si no, deberá añadir un secreto nuevo en Google y pegarlo allí sin eliminar el antiguo. No compartir secretos por chat ni guardarlos en Git o variables VITE_. La creación/entrada de credenciales se deja al propietario.

En Supabase → Authentication → Sign In / Providers → Google: Client ID, Client Secret, habilitar proveedor y guardar. Mantener Skip nonce checks y Allow users without an email desactivados. La redirección de aplicación `http://127.0.0.1:5173/auth/confirm` ya está autorizada en Supabase; no confundirla con el callback de Google hacia Supabase.

## Público y permisos mínimos

Usar solo scopes `openid`, `email`, `profile`; no solicitar Drive, Gmail, Calendar o tokens offline. Google no necesita enviar un correo SMTP para verificar el acceso.

Se revisó Audience del proyecto compartido: estado **Prueba**, tipo **Usuarios externos**, cero usuarios de prueba. El panel indica que mientras siga en Prueba solo acceden usuarios de prueba. Publicar app está deshabilitado y exige completar branding. No se añadieron usuarios ni se cambió branding/publicación. No afirmar acceso público hasta completar publicación/consentimiento y probar con una cuenta externa. Cambiar branding o publicar afecta también Nexo, por lo que requiere decisión explícita del propietario. No añadir usuarios de la aplicación al equipo administrador de Supabase.

## Verificación

Los tests de Google interceptan las respuestas de settings/authorize: verifican desafío PKCE, provider, scopes, prompt, retorno exacto y botón deshabilitado cuando no está configurado. No sustituyen una sesión real con Google. La ruta común de retorno tiene pruebas separadas de intercambio, identidad, errores y redirecciones internas.

Una vez guardado el proveedor, volver a la aplicación y actualizar. Probar con una cuenta Google controlada, aceptar únicamente datos básicos, reservar, recargar comprobante y consultar Mis reservas. Verificar privacidad con otra cuenta y aforo en SQL. Registrar resultado real antes de marcar Google terminado.

Prueba real iniciada: el botón estaba habilitado, Supabase redirigió correctamente a `accounts.google.com` y Google mostró «Elige una cuenta». No apareció redirect_uri_mismatch ni proveedor deshabilitado. La selección/consentimiento se dejó al propietario; todavía no acredita que el secreto sea válido en el intercambio final ni que cuentas externas puedan completar el acceso. Las cinco comprobaciones públicas alojadas se ejecutaron nuevamente y pasaron.

Referencias: [Google con Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

Diseño actualizado: correo y contraseña es la opción predeterminada; Google aparece después del formulario, separado por «o». Botón blanco con la G multicolor original, Google Sans Medium local y texto «Continuar con Google», según [los lineamientos oficiales de marca](https://developers.google.com/identity/branding-guidelines). Recursos y licencia: `public/assets/brands/PROCEDENCIA.md`. No se alteró el flujo OAuth. Las capturas administrativas citadas en este documento se conservan localmente, pero se excluyen del repositorio público.

Actualización posterior: el propietario completó el selector/consentimiento e informó que Google funciona. Una consulta de solo lectura confirmó identidad Google con correo verificado en el proyecto. Su dirección es diferente de la cuenta anterior por correo; esta conserva una reserva. No se fusionaron cuentas ni se atribuyeron reservas de una a otra. No se verificó con una cuenta externa independiente el estado de Audience/publicación.
