# Product Backlog · MoSCoW

| ID | Historia | Prioridad | Criterio de aceptación | Estado real |
| --- | --- | --- | --- | --- |
| US01 | Como socio quiero consultar clases y horarios para planificar mis entrenamientos. | Must have | Catálogo de sesiones, fecha/hora, instructor, sede y filtros. | Implementado; verificado con SQL, navegador local y PostgREST alojado. |
| US03 | Como socio quiero ver cupos disponibles para elegir una sesión. | Must have | Conteo consistente, porcentaje y clase completa. | Implementado; PF-02 aprobado localmente; datos calculados por PostgreSQL. |
| US02 | Como socio quiero reservar una clase para asegurar mi lugar. | Must have | Identidad verificada, campos válidos, fila persistida y comprobante real. | RPC, interfaz, RLS y aforo verificados. Propietario informó acceso real por correo y Google; reserva propia anterior sigue guardada. Contraseña implementada y probada con fixtures; prueba positiva alojada pendiente. Acceso externo sujeto a Audience Google y restricciones de correo. |
| US05 | Como gimnasio quiero validar aforo para evitar sobreocupación. | Must have | Rechazar clases completas y dos solicitudes concurrentes al último cupo. | Implementado; PF-04 y prueba con dos conexiones PostgreSQL aprobados. |
| US04 | Como socio quiero cancelar mi reserva. | Should have | Cancelación autorizada y liberación de cupo. | Implementado en APF3: RPC `cancel_reservation` (solo el titular y antes del inicio), fecha `cancelled_at`, botón con confirmación en Mis reservas. Pruebas SQL y de navegador. |
| US06 | Como instructor quiero registrar asistencia. | Should have | Registro autorizado y auditable. | Implementado mediante administradores autorizados: pendiente/presente/ausente e historial de actor/fecha. SQL y navegador aprobados; primer rol real y login administrativo positivo pendientes del propietario. No se implementó un rol independiente de instructor. |
| US07 | Como socio quiero recibir recordatorios. | Should have | Envíos programados con preferencias y zona horaria. | Implementado en APF3: correo 3 horas antes con QR y enlace para cancelar, enviado por una tarea programada; el socio puede desactivarlo. Ver [RECORDATORIOS.md](RECORDATORIOS.md). |
| US08 | Como socio quiero una lista de espera. | Could have | Cola ordenada y asignación de lugares liberados. | Implementado el 19/10: al cancelar o subir la capacidad, el primero de la fila recibe la reserva en la misma transacción (sin superar el aforo) y un aviso por correo. No se asigna en la última hora. Pruebas SQL (incluida concurrencia) y de navegador. Migración `20261021000000_lista_espera.sql` aplicada en Supabase por el titular el 19/10 (informado por el propietario). Ver [Lista de espera](LISTA_ESPERA.md). |
| US09 | Como gimnasio quiero indicadores de uso. | Could have | Dashboard autorizado con métricas definidas. | Implementado en APF3 (versión básica): tasa de no-shows, presentes, cancelaciones, cobertura de asistencia y no-shows por clase en `/admin`. |
| US10 | Como gimnasio quiero predecir inasistencias mediante ML. | Won't have now | Modelo, evaluación y tratamiento de datos. | APF3: dataset seudonimizado y exportable ([DATASET_APF3.md](DATASET_APF3.md)). El modelo queda pendiente hasta contar con asistencia real registrada. |

## Ampliación administrativa solicitada

Estas historias amplían el alcance original; no sustituyen las historias obligatorias APF2.

| ID | Historia | Prioridad de la ampliación | Estado real |
| --- | --- | --- | --- |
| ADM01 | Como administrador quiero crear/editar clases y programar sesiones. | Must have | Implementada y probada en SQL/navegador; migración alojada aplicada. Sesiones reservadas conservan sus detalles. |
| ADM02 | Como administrador quiero consultar los inscritos de cada sesión. | Must have | Implementada mediante RPC con rol protegido; datos privados denegados a socios/anónimos. Primera cuenta real pendiente de autorización. |

## Ampliación de experiencia del socio (19/10/2026)

| ID | Historia | Prioridad | Estado real |
| --- | --- | --- | --- |
| EXP01 | Como visitante quiero resolver dudas frecuentes sin buscar en toda la web. | Could have | Asistente guiado con respuestas fijas (sin IA ni envío de datos a terceros): clases, horarios por día con la agenda real, cómo reservar y contacto por WhatsApp. |
| EXP02 | Como socio quiero un perfil con mis datos y ajustes de cuenta. | Should have | Página Mi perfil: correo verificado, formas de entrar, nombre que completa las reservas, contraseña («Crear» o «Cambiar» según la cuenta), recordatorios y privacidad. Mis reservas queda solo con las reservas. |

La administración no crea ni borra cuentas de socios y no gestiona membresías. US06 registra asistencia mediante el rol administrador, no mediante un rol separado de instructor. Configuración y límites: [Administración](ADMINISTRACION.md).

El frontend está publicado en https://titan-gym-tau.vercel.app (HTTP 200 comprobado el 11/10/2026). Las sedes, instructores y reservas del seed son datos académicos. La cuenta real del propietario y su reserva no se borraron; una cuenta Google con otro correo es independiente. Completar pruebas de acceso externo y contraseña antes de declarar esos flujos terminados de extremo a extremo.
