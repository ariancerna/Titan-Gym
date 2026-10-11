# Pruebas APF2

Fecha de ejecución: 11 de octubre de 2026, America/Lima. Entorno: Windows, Node 24.18.0, React/Vite, Chromium de Playwright y PostgreSQL 17.6 independiente.

## Resultados ejecutados

| Comprobación | Resultado | Alcance |
| --- | --- | --- |
| `npm test` | 31 pruebas aprobadas | Validaciones, fechas, filtros, accesibilidad, Auth y administración. |
| `npm run test:db` | 25 comprobaciones aprobadas | Reservas, concurrencia, RLS, administración, asistencia, recursos y sede única. |
| `npm run test:e2e` | 78 pruebas aprobadas | Veintiséis escenarios en 1440, 768 y 390 px; SQL real independiente y Auth de fixture. |
| `npm run build` | Aprobado | TypeScript estricto y bundle de producción. |
| `npm audit --omit=dev` | 0 vulnerabilidades reportadas | Dependencias de producción instaladas. |

## Ampliación administrativa · ejecución final

Se ejecutaron nuevamente 31 unitarias, 23 comprobaciones SQL, build y **72 pruebas de navegador aprobadas sin retries**. Los nuevos casos verifican acceso por contraseña y rol, cierre de sesión, negación a socios con metadata falsificada, creación y publicación de clases/sesiones con persistencia, consulta de inscritos, asistencia presente/ausente con historial, futura deshabilitada, sesión reservada protegida y errores de conexión.

La primera ejecución del módulo tuvo 69 pruebas aprobadas y una advertencia React de claves repetidas al abrir edición e inscritos de la misma sesión. Se diferenciaron las claves de los componentes y se añadió el caso de contraseña/cierre de sesión. La suite completa final pasó con 72 casos y sin esa advertencia. No se alteraron resultados para ocultarla.

La migración administrativa alojada pasó una verificación transaccional de rol, clase/sesión/reserva, roster, cambios auditados y revocación. Se hizo rollback: 89 reservas existentes, cero administradores reales asignados y ningún registro de asistencia/historial de prueba persistido. La cuenta administradora real y su login positivo permanecen pendientes de elección y credenciales del titular. La prueba Auth positiva del navegador utiliza fixtures, no credenciales reales.

Capturas locales del módulo: `admin-asistencia-{desktop,tablet,mobile}.png`. Documentación y avisos de advisors: [Administración](ADMINISTRACION.md).

## Renovación visual y sede única · última ejecución

Se ejecutaron 31 unitarias, 25 comprobaciones SQL, build, auditoría de producción (0 vulnerabilidades reportadas) y **78 pruebas de navegador aprobadas sin retries ni casos omitidos**. Antes de la corrección de sede/transparencia, la renovación visual también tuvo una ejecución completa de 75 aprobadas.

Las nuevas aserciones verifican fotografías de al menos 1600 px en las seis disciplinas, archivos existentes, logo web de 128 px, favicon PNG de 48 px y alfa 0 en sus esquinas. Comprueban sede única Qatuna y dirección de la referencia, ausencia del aviso retirado en frontend y dirección visible incluso sin sesiones publicadas. Se verificaron screenshots desktop/móvil; las capturas actuales reemplazan la evidencia anterior de esas rutas.

En Supabase se aplicaron las migraciones de recursos y consolidación: seis clases ilustradas, una sede, ocho sesiones y 89 reservas conservadas. Se retiraron únicamente las dos sedes académicas sobrantes después de reasignar sus sesiones. Ningún administrador fue asignado automáticamente. La procedencia de los recursos se conserva en RECURSOS_VISUALES.md y la corrección en SEDE.md; no se presenta el flujo Auth de fixture como login real.

## Matriz obligatoria APF2

| Caso | Procedimiento ejecutado | Resultado observado |
| --- | --- | --- |
| PF-01 | Consultar list_sessions como anon, verificar ocho sesiones futuras y navegar catálogo/detalle. | Ocho sesiones consistentes, disciplina y horario visibles. |
| PF-02 | Comparar aforo real del seed y textos/barras en UI. | Spinning: 4/25 libres; Funcional: 0/18; Yoga: 2/15. Después de reservar se actualiza la disponibilidad. |
| PF-03 | Registrar por RPC, consultar fila propia bajo RLS; enviar formulario en navegador, recargar comprobante y abrir Mis reservas. | UUID y código guardados; comprobante sobrevive a recarga; reserva visible solo para el propietario. |
| PF-04 | Reservar sesión llena directamente en SQL y visitar catálogo/reserva directa. | PostgreSQL rechaza SESSION_FULL; sigue habiendo 18 reservas; UI deshabilita el inicio de reserva. |

Pruebas adicionales ejecutadas: nombre/correo/consentimiento inválidos; correo falsificado; reserva duplicada; último cupo con dos conexiones concurrentes; rollback del primer solicitante; trigger frente a importación que superaría el aforo; reducción de capacidad; sesión pasada; lectura de otra cuenta; prohibición de INSERT directo y RPC anónima; navegación; ruta inexistente; ausencia de éxito falso; ancho horizontal; caída de conexión y recuperación.

En concurrencia, la primera conexión abrió una transacción, obtuvo el último lugar y mantuvo el bloqueo. La segunda inició su solicitud mientras la primera seguía abierta; se comprobó que seguía esperando. Tras commit, recibió SESSION_FULL y quedó exactamente una reserva. Otro escenario hizo rollback y permitió completar la solicitud que esperaba.

## Evidencia y reproducción

`tests/unit` contiene las aserciones de UI/validación. `tests/integration/database.mjs` inicializa un clúster nuevo y produce `docs/evidencias/database-results.json`, incluyendo versión del motor y resultados. `tests/e2e` captura pantallas reales durante la ejecución en `test-results`. Las capturas seleccionadas se conservaron en `docs/evidencias`.

```powershell
npm ci
npm test
npm run test:db
npx playwright install chromium
npm run test:e2e
npm run build
```

Los tests usan puertos de prueba y datos temporales, nunca una base de producción. Los clústeres se detienen al terminar; sus directorios temporales contienen solo datos de pruebas. El puerto PostgreSQL se asigna dinámicamente para evitar puertos reservados por Windows.

## Limitaciones explícitas

- No se ejecutó el flujo de correo OTP contra un proyecto Supabase alojado. El puente de tests utiliza identidades de fixture y una implementación mínima de auth.uid/auth.users; la persistencia y los bloqueos sí son PostgreSQL real.
- PostgREST real y los advisors ya se verificaron en el proyecto dedicado. No se completó Supabase Auth de extremo a extremo con recepción de correo; ese control continúa pendiente.
- Docker está instalado pero su motor no logró responder; `supabase start` no pudo completarse. Se utilizó PostgreSQL independiente para verificar SQL.
- El primer intento de Playwright falló por falta del ejecutable de Chromium. Se instaló y se repitieron las pruebas. El puente de pruebas requirió corregir CORS para los encabezados de Supabase antes del resultado aprobado.
- Las capturas proceden de ejecución local con datos académicos. No son capturas de producción ni acreditan un despliegue público.
- La revisión de responsive se realizó en Chromium a tres anchos; no certifica todos los navegadores o tecnologías de asistencia. No se ejecutó una auditoría automatizada WCAG completa.

## Verificación pendiente en Supabase alojado

Migración y seed ya aplicados; acceso por enlace mágico y redirección PKCE configurados. Solicitar y abrir el enlace con el correo autorizado del propietario y comprobar la reserva real. El envío público a socios requiere SMTP propio; no añadir evaluadores al equipo administrativo. Para probar aislamiento de dos cuentas en un entorno público, usar cuentas controladas con un servicio de correo apropiado. Repetir PF-01 a PF-04 desde una ventana privada sobre la URL pública real antes de declarar publicación.

## Verificación alojada adicional

El 11 de octubre de 2026 se creó el proyecto dedicado `cyufnolnnwaeacnyzpfy`. `node tests/integration/hosted-public.mjs` pasó cinco comprobaciones contra PostgREST/Auth settings reales: ocho sesiones con disponibilidad consistente, clase completa, SELECT de reservas denegado a anon, RPC de reserva denegada a anon y proveedor email con altas habilitadas y acceso anónimo deshabilitado.

En SQL remoto se ejecutaron cinco aserciones dentro de una transacción con rol authenticated e identidad académica definida administrativamente: fila insertada, descuento de un cupo, aislamiento RLS, duplicado rechazado y SESSION_FULL. La transacción terminó con rollback; se confirmó después que permanecen exactamente 88 reservas. Esto verifica PostgreSQL alojado, pero no acredita obtención de JWT mediante OTP. Los advisors no reportaron errores de tablas/RLS; advertencia de protección de contraseñas filtradas y seis índices todavía sin uso, documentadas en `SUPABASE.md`. El build con las variables reales también se ejecutó correctamente.

## Adaptación gratuita al enlace mágico

Por elección del propietario se sustituyó la entrada manual de código por el enlace predeterminado. Se ejecutaron nuevamente 18 unitarias, 12 SQL, 30 de navegador y cinco comprobaciones públicas alojadas; todo aprobado. El build también se ejecutó. Las nuevas pruebas cubren solicitud con desafío PKCE, redirección exacta, intercambio único del código, retorno a la sesión elegida, enlace vencido/otro navegador, retorno sin código y correo no autorizado sin afirmar envío.

Los casos de Auth usan respuestas interceptadas explícitamente en Playwright: no enviaron correos reales ni acreditan recepción. El panel alojado mostró dos URLs autorizadas, incluyendo `/auth/confirm`; captura en `docs/evidencias/supabase-url-config.png`. Falta un correo autorizado controlado por el propietario para completar la prueba real. No se contrató SMTP, no se modificaron RLS ni privilegios para admitir cuentas sin verificar.

## Integración Google · estado pendiente de credenciales

Se ejecutaron 22 unitarias, 36 de navegador, 12 SQL, cinco comprobaciones públicas alojadas, build y auditoría de producción (0 vulnerabilidades reportadas): todo aprobado en la ejecución final. Las nuevas pruebas verifican que settings no se interpreta como habilitado ante error/payload inválido, que Google deshabilitado no inicia OAuth, y que la salida OAuth solicita provider google, scopes básicos, selección de cuenta, desafío PKCE y retorno exacto.

La primera ejecución de navegador tuvo nueve fallos de las aserciones: consulta de localStorage en el origen del proveedor en vez del origen de la aplicación y textos de heading desactualizados. Se corrigieron esas aserciones y se repitió la suite completa: 36 passed. No se ocultaron fallos mediante retries. El protocolo del proveedor es interceptado en tests; **no se probó aún un acceso Google real** porque faltan configuración y secreto OAuth. El propietario informó que el enlace mágico real funciona; no es evidencia de Google.

Actualización después de configurar las credenciales: el endpoint público real devolvió google=true y el botón de la aplicación condujo al selector oficial Google con el callback correcto. Las cinco comprobaciones públicas alojadas se repitieron y pasaron. El acceso real quedó pendiente de selección/consentimiento del propietario; no se declara JWT, reserva Google ni acceso externo completados.

## Correo y contraseña

Implementados signInWithPassword y updateUser sobre una cuenta ya autenticada. Se ejecutaron 26 unitarias, 12 SQL, 48 de navegador, cinco comprobaciones públicas alojadas, una negativa de contraseña contra Supabase Auth real, build y auditoría de producción: aprobados en la ejecución final; 0 vulnerabilidades reportadas. El script `tests/integration/hosted-password-negative.mjs` no crea cuentas ni modifica credenciales; confirmó invalid_credentials y ausencia de sesión con datos aleatorios `.invalid`.

Los casos positivos de contraseña usan Auth interceptado en Playwright. Verifican identidad con getUser, una sola solicitud de guardado, campos inválidos, confirmación no coincidente, estado de error sin éxito falso y conservación del UUID/comprobante de una reserva previamente guardada en PostgreSQL real independiente. No acreditan creación de hash alojado ni login con contraseña real del propietario; debe introducirla él directamente.

La primera ejecución tuvo tres fallos de la aserción que esperaba solo password: el SDK añade metadatos PKCE. Tras corregirla, la segunda detectó tres selectores de status ambiguos ante carga simultánea y un timeout puntual del caso de duplicado móvil. Se acotó el selector a Seguridad de tu cuenta y se repitió la suite completa sin retries automáticos: **48 passed**. El timeout de duplicado no se reprodujo en la ejecución final; queda documentado para ampliar verificaciones de estabilidad. No se presentan los intentos previos como aprobados.

El propietario informó que Google funciona y se comprobó identidad Google verificada en SQL. La cuenta anterior de correo mantiene una reserva; las direcciones son diferentes y no se fusionaron. No se modificaron contraseñas reales, RLS ni datos de socios para estas pruebas. Advisor real: advertencia de protección de contraseñas filtradas deshabilitada, disponible en planes superiores; no se contrató un plan. Límites: `ACCESO_CONTRASENA.md`.

## Presentación del acceso y entrega GitHub

Se cambió la opción predeterminada a correo/contraseña y Google quedó debajo del formulario con separador «o», G multicolor oficial y Google Sans Medium local. Se ejecutó la suite completa: **51 passed**; las 26 unitarias y build también pasaron. Se repitieron las 12 comprobaciones SQL y auditoría de producción sin vulnerabilidades reportadas. La prueba adicional confirma orden vertical, opción predeterminada, recurso original cargado y ausencia de desbordamiento en 1440/768/390. Capturas: `acceso-google-secundario-{desktop,tablet,mobile}.png`.

El informe Playwright publicado conserva resultados, fechas y estadísticas; `tools/prepare-public-evidence.mjs` sustituye las rutas personales por `<workspace>`. La copia original `.private.json` y las capturas administrativas Google/Supabase se conservan localmente y se excluyen del repositorio público. No son resultados inventados ni evidencia de despliegue Vercel.
