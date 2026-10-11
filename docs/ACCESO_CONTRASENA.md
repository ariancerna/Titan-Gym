# Acceso con correo y contraseña

## Implementación

En el acceso seguro se puede elegir «Correo y contraseña» o «Enlace por correo», además de Google. El inicio utiliza Supabase Auth signInWithPassword y verifica el usuario mediante getUser. No existe inicio local simulado ni se consulta una tabla de contraseñas de la agenda.

En Mis reservas, una cuenta con correo verificado puede abrir «Crear contraseña». La operación usa updateUser con password, sobre la identidad autenticada obtenida del servicio. No acepta user_id ni correo editable para elegir otra cuenta. El UUID permanece igual, así como sus reservas y accesos anteriores. Si ya tenía contraseña, el formulario la reemplaza y lo advierte antes de guardar.

El formulario de creación exige 12–128 caracteres y coincidencia de confirmación; no recorta espacios ni impone reglas nuevas a la contraseña existente durante login. Supabase aplica además su política de servidor. Los campos de contraseña se limpian tras un intento y al cerrar el formulario. No se almacenan contraseñas en localStorage, Query, tablas públicas, logs o archivos; el servicio Auth maneja el hash. Los bloqueos de envío previenen solicitudes repetidas y el mensaje de credenciales inválidas no confirma si un correo existe.

## Cómo usarlo sin perder reservas

1. Entra con el método que pertenece a tu cuenta anterior. El correo exacto debe ser el mismo; cuentas con correos diferentes no se fusionan.
2. Abre Mis reservas → Crear contraseña.
3. Escribe tú una contraseña única, repítela y guarda. Nunca la compartas por chat.
4. Cierra sesión y elige Correo y contraseña con el correo de esa misma cuenta.
5. Comprueba que aparecen las reservas anteriores. Google y el enlace siguen disponibles cuando corresponda.

No se añadieron signUp público ni recuperación por correo como funcionalidades terminadas. Para una cuenta nueva, Google verifica la identidad; luego se configura la contraseña. Quien solo use correo necesita poder recibir el enlace con las restricciones del proveedor actual. No desactivar confirmación para eludirlas. Si olvida la contraseña puede regresar por Google vinculado o por un enlace autorizado. La recuperación por correo para todos los socios requiere un servicio de envío apropiado y su flujo propio.

El servidor puede exigir reautenticación para cambiar una contraseña. En ese caso se muestra un error explicativo, no éxito falso; debe volver a iniciar sesión. No se cambiaron ajustes Auth/RLS, se fusionaron usuarios ni se reemplazaron contraseñas del propietario durante el desarrollo.

## Seguridad y limitaciones

El advisor alojado mantiene la advertencia de protección de contraseñas filtradas deshabilitada. Supabase la ofrece en Pro y superiores; no se contrató un plan para activarla. Usar frases únicas y un gestor de contraseñas. La validación de 12 caracteres en este formulario no cambia por sí sola la política global del servidor. Para producción revisar esa política, reautenticación y protección contra abuso, siguiendo [seguridad de contraseñas](https://supabase.com/docs/guides/auth/password-security).

Las pruebas positivas de login/guardado interceptan Auth en Playwright y usan identidades de fixture; la reserva que se conserva se guarda en PostgreSQL real independiente. No acreditan un hash nuevo alojado. La prueba negativa alojada usa un correo aleatorio `.invalid` y password de prueba generado en memoria: el servicio real rechaza invalid_credentials y no concede sesión, sin crear cuenta, cambiar credenciales ni enviar correo.

La creación y el login positivos contra el proyecto real requieren que el propietario escriba su contraseña directamente en la aplicación. El agente no la introduce ni la solicita. No afirmar prueba real positiva hasta completarla.

Referencias: [autenticación por contraseña](https://supabase.com/docs/guides/auth/passwords), [vinculación de identidades](https://supabase.com/docs/guides/auth/auth-identity-linking).
