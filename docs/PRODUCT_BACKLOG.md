# Product Backlog · MoSCoW

| ID | Historia | Prioridad | Criterio de aceptación | Estado real |
| --- | --- | --- | --- | --- |
| US01 | Como socio quiero consultar clases y horarios para planificar mis entrenamientos. | Must have | Catálogo de sesiones, fecha/hora, instructor, sede y filtros. | Implementado; verificado con SQL, navegador local y PostgREST alojado. |
| US03 | Como socio quiero ver cupos disponibles para elegir una sesión. | Must have | Conteo consistente, porcentaje y clase completa. | Implementado; PF-02 aprobado localmente; datos calculados por PostgreSQL. |
| US02 | Como socio quiero reservar una clase para asegurar mi lugar. | Must have | Identidad verificada, campos válidos, fila persistida y comprobante real. | RPC, interfaz, RLS y aforo verificados. Propietario informó acceso real por correo y Google; reserva propia anterior sigue guardada. Contraseña implementada y probada con fixtures; prueba positiva alojada pendiente. Acceso externo sujeto a Audience Google y restricciones de correo. |
| US05 | Como gimnasio quiero validar aforo para evitar sobreocupación. | Must have | Rechazar clases completas y dos solicitudes concurrentes al último cupo. | Implementado; PF-04 y prueba con dos conexiones PostgreSQL aprobados. |
| US04 | Como socio quiero cancelar mi reserva. | Should have | Cancelación autorizada y liberación de cupo. | Pendiente; no hay interfaz ni RPC de cancelación. |
| US06 | Como instructor quiero registrar asistencia. | Should have | Registro autorizado y auditable. | Pendiente; no se infiere asistencia por fecha. |
| US07 | Como socio quiero recibir recordatorios. | Should have | Envíos programados con preferencias y zona horaria. | Pendiente; no se envían recordatorios ni comprobantes por correo. |
| US08 | Como socio quiero una lista de espera. | Could have | Cola ordenada y asignación de lugares liberados. | Pendiente. |
| US09 | Como gimnasio quiero indicadores de uso. | Could have | Dashboard autorizado con métricas definidas. | Pendiente; las barras operativas de aforo corresponden a US03, no a un dashboard. |
| US10 | Como gimnasio quiero predecir inasistencias mediante ML. | Won't have now | Modelo, evaluación y tratamiento de datos. | Excluido del MVP APF2. |

La demostración local no equivale a una publicación productiva. No existe URL pública del frontend verificada. Las sedes, instructores y reservas del seed son datos académicos. La cuenta real del propietario y su reserva no se borraron; una cuenta Google con otro correo es independiente. Completar pruebas de acceso externo y contraseña antes de declarar esos flujos terminados de extremo a extremo.
