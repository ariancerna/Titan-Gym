# Acceso de evaluación y demostración pública APF2

## Estado verificable

URL del MVP: https://titan-gym-tau.vercel.app

Fecha de comprobación: 11 de octubre de 2026, America/Lima.

| Comprobación ejecutada | Resultado | Alcance y evidencia |
| --- | --- | --- |
| Solicitud HTTP a `/clases` | Pasó: HTTP 200 | Verificación en la revisión de la consigna. Solo acredita entrega del HTML, no ejecución de React ni reserva. |
| Solicitud HTTP a `/mis-reservas` | Pasó: HTTP 200 | Verificación durante la preparación de este documento. No acredita login. |
| Catálogo y cupos en Supabase alojado | Pasó | `node tests/integration/hosted-public.mjs`: ocho sesiones y disponibilidad igual a capacidad menos reservas. |
| Sesión completa en Supabase alojado | Pasó | El mismo script verificó cero cupos en la sesión Funcional del seed. |
| Protección de reservas | Pasó | SELECT y RPC de reserva rechazados para el rol anónimo. |
| Configuración pública de Auth | Pasó | Email habilitado, altas habilitadas y acceso anónimo no habilitado. No implica que cualquier destinatario pueda recibir correo. |
| Login de la cuenta de evaluación en ventana privada | Pendiente | Falta elegir la cuenta y realizar el acceso real. |
| Reserva autenticada desde Vercel y comprobación en BD | Pendiente | No se ha ejecutado esta prueba con una cuenta de evaluación. |

No se considera completada la prueba de extremo a extremo a partir de respuestas HTTP, fixtures de Playwright o consultas SQL con identidad establecida administrativamente.

## Cuenta de evaluación

Se utilizará una cuenta dedicada de **socio**, sin pertenencia a `private.administrators`. No utilizar la cuenta personal administradora del propietario.

Correo propuesto por el propietario: `admin@titan-gym.com`. Aunque el nombre sea “admin”, esta cuenta de evaluación será un socio sin privilegios administrativos.

Estado: se verificó que no existe todavía en Supabase. Se preparó el formulario oficial de creación con ese correo, sin contraseña ni envío. Falta confirmar que el propietario controla el buzón y completar la creación directamente. No se creó ninguna cuenta ni se cambió una contraseña.

El formulario administrativo ofrece “Auto confirm user” y no envía correo de confirmación. Crear por esa vía una identidad de pruebas no demuestra propiedad del dominio o del buzón; no utilizar un correo ajeno ni desactivar globalmente la confirmación de socios. Para una cuenta controlada, el responsable puede provisionarla desde ese formulario oficial y establecer él mismo una contraseña exclusiva; luego debe probar el acceso desde Vercel. No se asigna automáticamente rol administrador.

Procedimiento con la aplicación actual:

1. Elegir un correo controlado por el equipo, destinado únicamente a evaluación.
2. Entrar con esa cuenta desde Google en `/mis-reservas`. Si la aplicación OAuth está en modo de pruebas, comprobar que la cuenta puede autorizarla. No compartir contraseñas de Google con el profesor.
3. Alternativamente, usar el enlace por correo solo si el servicio de envío permite ese destinatario. No añadir al profesor al equipo de Supabase para eludir restricciones.
4. Una vez autenticado, abrir **Crear contraseña** en Mis reservas y configurar una frase exclusiva para esta cuenta. El propietario la introduce directamente; no se escribe en este repositorio ni en el chat.
5. Cerrar sesión. Abrir una ventana privada y probar **Correo y contraseña** con esa cuenta.
6. Verificar que `/admin` muestra acceso restringido. Esta cuenta no necesita permisos administrativos para demostrar reservas.

La aplicación no incluye alta pública por contraseña. Por eso la primera identidad debe establecerse por un método disponible y verificado antes de configurar su contraseña. No insertar usuarios ni hashes manualmente en `auth.users`.

En el informe entregado privadamente al docente, completar este bloque **solo después de probar el acceso**:

```text
URL: https://titan-gym-tau.vercel.app/mis-reservas
Rol: socio de evaluación
Correo: [completar con la cuenta verificada]
Contraseña de prueba: [entregar únicamente en el informe privado]
Fecha y responsable de verificación: [completar]
Vigencia del acceso: [completar]
```

No publicar esas credenciales en GitHub, capturas públicas o logs. Si el profesor necesita revisar administración, realizar una demostración supervisada con el propietario; no concederle un rol amplio a la cuenta de reservas.

## Guion de prueba real en ventana privada

Anotar clase, ID de sesión, fecha/hora y cupos iniciales. Utilizar sesiones futuras con suficientes cupos; las fechas del seed no son permanentemente futuras.

| Caso | Acción | Resultado esperado | Estado actual |
| --- | --- | --- | --- |
| PF-01 | Abrir Clases, buscar una disciplina y entrar al detalle. | Nombre, instructor, sede y horario coherentes entre catálogo y detalle. | Pendiente de ejecución manual pública. |
| PF-02 | Comparar capacidad, reservas y cupos de esa sesión. | Cupos = capacidad - reservas activas; indicador coherente. | Backend público verificado; UI pública pendiente. |
| Campos inválidos | Enviar el formulario sin nombre completo o sin confirmación. | Error accesible y ninguna reserva nueva. | Pendiente de ejecución manual pública. |
| PF-03 | Iniciar sesión y confirmar una reserva como “Socio Evaluación”. | Comprobante real con UUID y código; cupos disminuyen en uno. | Pendiente. |
| Persistencia | Recargar el comprobante, cerrar sesión, volver a entrar y abrir Mis reservas. | La misma reserva y código siguen disponibles. | Pendiente. |
| Duplicado | Intentar reservar de nuevo la misma sesión con esa cuenta. | Rechazo claro y una sola reserva activa de esa cuenta/sesión. | Pendiente. |
| PF-04 | Buscar una sesión futura llena y visitar su detalle/reserva. | “Clase completa”; no se registra una reserva. | Backend detecta clase llena; flujo UI público pendiente. |
| Aislamiento | Abrir la URL del comprobante en otra cuenta de prueba controlada. | No se muestran datos de la primera cuenta. | Pendiente; requiere segunda cuenta controlada. |
| Sin privilegios | Abrir `/admin` con la cuenta de evaluación. | Acceso restringido. | Pendiente. |

Si una sesión disponible cambia durante la prueba, registrar la nueva disponibilidad; no forzar una reserva ni modificar el aforo para fabricar un resultado. La concurrencia por el último cupo ya tiene pruebas SQL documentadas: no generar carga artificial contra producción para la sustentación.

## Evidencia de persistencia

Después de reservar, el responsable comprobará en Supabase la fila correspondiente al UUID del comprobante, su sesión y titular. Comparará el código con el mostrado en Vercel. Esta consulta es de solo lectura y no sustituye el acceso real del navegador.

Guardar capturas de catálogo, comprobante recargado y Mis reservas. Ocultar correos, tokens y datos de terceros en la evidencia pública. En cada prueba registrar:

```text
Caso:
Fecha/hora y zona horaria:
Responsable humano:
Navegador / ventana privada:
Pasos y resultado observado:
Pasó / No pasó:
Evidencia:
Corrección aplicada (o “no requerida”):
```

No escribir “Pasó” hasta observar y documentar el resultado. La reserva de evaluación ocupa un cupo real; no se implementó cancelación en la aplicación. No prometer borrado automático ni borrar otras reservas para limpiar una demostración.

## Antes de la sustentación

- Repetir el acceso de evaluación y verificar una sesión futura disponible.
- Entregar las credenciales solo al docente por el canal académico privado.
- Abrir previamente el MVP y ensayar el flujo en aproximadamente cuatro minutos.
- No presentar capturas locales como evidencia de Vercel.
- Al finalizar la evaluación, retirar o rotar el acceso mediante los controles oficiales de Auth y revisar las sesiones activas. Eliminar una cuenta no invalida por sí solo todos los JWT vigentes.

Documentación relacionada: [pruebas](PRUEBAS_APF2.md), [acceso por contraseña](ACCESO_CONTRASENA.md), [Google](GOOGLE_AUTH.md), [administración](ADMINISTRACION.md).
