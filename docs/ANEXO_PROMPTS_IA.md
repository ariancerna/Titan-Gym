# Anexo C - Uso de IA, prompts y validación

Proyecto: FitSmart Agenda - TITAN GYM.

Estado: registro preparado con evidencia disponible; **validación humana final del equipo pendiente**. No constituye un acta firmada ni acredita pruebas con usuarios reales del gimnasio.

## 1. Declaración de uso

Se utilizó un asistente de IA de desarrollo para apoyar la implementación de React/TypeScript, consultas y migraciones SQL, pruebas y documentación. También se empleó una herramienta integrada de generación de imágenes para fotografías ilustrativas, logo y transparencia. Los recursos originales de Figma se conservaron y los cambios visuales respondieron a solicitudes del propietario.

La IA intervino en el código y en los recursos, no únicamente en la redacción. Las decisiones de alcance proceden de instrucciones del propietario. La responsabilidad de comprender, revisar y sustentar el trabajo corresponde al equipo académico.

No se registra un identificador exacto de modelo para cada intervención porque ese dato no está disponible en la evidencia conservada. No se inventan fechas, autores de revisión o versiones de modelo.

## 2. Alcance del registro

Los siguientes son mensajes reales del historial o extractos literales identificados como tales. Se omiten correos personales y secretos. No son una exportación exhaustiva de toda la conversación ni de todas las instrucciones internas del asistente.

Para la entrega, adjuntar además la exportación de la conversación relevante, revisada por el equipo y sin credenciales, o completar el registro con mensajes originales que falten. No sustituir mensajes perdidos por prompts inventados retrospectivamente.

## 3. Prompts del usuario y trazabilidad

| ID | Prompt real o extracto literal | Uso y resultado vinculado | Validación disponible |
| --- | --- | --- | --- |
| P01 | Extracto del encargo inicial: “No quiero solamente un prototipo visual. Quiero una aplicación real, con navegación funcional, base de datos, persistencia de reservas y validación de aforo.” | Aplicación React y flujo de reserva: `src/pages`, `src/features/reservations`, migración inicial. | Pruebas automáticas y revisión técnica documentadas; revisión humana integral del código pendiente. |
| P02 | Extracto del encargo inicial: “Debe ser imposible superar el aforo incluso si dos usuarios intentan reservar el último cupo simultáneamente.” | Reserva atómica, bloqueo de sesión y restricciones de PostgreSQL. | Informe SQL y pruebas de concurrencia; no equivalen a validación humana firmada. |
| P03 | “crea el proyecto de supabase y configuralo por ti mismo” | Proyecto dedicado, esquema y conexión del frontend. | Comprobaciones alojadas documentadas; no se publican claves privilegiadas. |
| P04 | “añadir con google” | Acceso OAuth con retorno PKCE y conservación de identidad. | El propietario comunicó “listo si funciona”; no es una certificación de acceso para todos los usuarios externos. |
| P05 | Extracto literal: “tambien hay alguna forma de iniciar sesion con correo y contraseña?” | Login y configuración de contraseña para una cuenta autenticada. | Casos automáticos con Auth controlado; login positivo de cuenta de evaluación alojada pendiente. |
| P06 | “no puedes poner continuar con google abajo, tipo 2da opcion y que este el logo de google como lo tienen las demas empresas?” | Orden de opciones y logotipo oficial de Google en AuthGate. | Pruebas de orden visual y responsive documentadas; revisión final del equipo pendiente. |
| P07 | Extracto literal: “un administrador podra crear las clases y podra ver los alumnos matriculados y controlar su asistencia” | Panel, clases/sesiones, inscritos y asistencia auditada. | Pruebas SQL/UI documentadas. No se concede rol por proveedor de login. |
| P08 | Extracto literal: “tambien genera nuevas imagenes de fondo, algunas se ve pixeleadas, tambien cambia el logo, genera uno nuevo adecuado al gym y agrega favicon” | Fotos de seis disciplinas, fondo, logo y favicon. | Prompts exactos de generación y medidas en `RECURSOS_VISUALES.md`; inspección técnica no sustituye aprobación humana final. |
| P09 | Extractos literales: “la unica sede esta en image.png, es solo una, no 3” y “en el logo quita el fondo negro, que sea transparente, tambien para el favicon” | Sede Qatuna según referencia del propietario y recursos con alfa. | Corrección solicitada por una persona; pruebas de sede única y transparencia documentadas. |
| P10 | Extracto literal: “al aceptar en vez de seguir en vercel, me lo acepta en local” | Corrección del Site URL y allowlist de retorno en Supabase. | El propietario autorizó el cambio y luego comunicó “ya inicie sesion”; login de evaluación en ventana privada pendiente. |
| P11 | “mira el pdf de innovacion que esta llamado asi, dime si mi codigo cumple” | Comparación con la consigna real, identificación de entregables faltantes. | Cinco páginas leídas; 31 unitarias y build ejecutados. No se predijo una nota. |
| P12 | “dame la 3 y 5” | Procedimiento de demostración en Vercel y este anexo. | Cinco comprobaciones públicas de Supabase aprobadas; cuenta de evaluación y revisión humana final pendientes. |

## 4. Prompts de imágenes

El registro de instrucciones reales en inglés se conserva íntegramente en [Recursos visuales y prompts](RECURSOS_VISUALES.md), secciones “Prompts finales” y “Extracción final del fondo”. Adjuntar esas secciones como parte de este anexo en el informe final; no basta un enlace local inaccesible al evaluador.

Incluye el fondo principal, seis disciplinas, logo y extracción del fondo. Las fotografías son generadas e ilustrativas: no son evidencia de instalaciones, alumnos o instructores reales. La salida de las fotos fue 1672 × 941 px; no se afirma que sean 4K. El logo y favicon son PNG raster con transparencia, no vectores.

## 5. Validación técnica registrada

| Evidencia | Resultado registrado | Límite |
| --- | --- | --- |
| Unitarias reejecutadas durante la revisión del PDF | 31 aprobadas | Verifican aserciones automáticas, no uso por una persona del gimnasio. |
| Build reejecutado durante la revisión del PDF | Aprobado | No garantiza que el despliegue conserve todas las variables correctas. |
| `docs/evidencias/database-results.json` | 25 comprobaciones aprobadas en la ejecución conservada | PostgreSQL temporal con superficie Auth mínima de pruebas. No se reejecutó al redactar este anexo. |
| `docs/evidencias/playwright-results.json` | 78 esperadas, 0 inesperadas, 0 omitidas, 0 flaky | Navegador con Auth de fixture; no prueba entrega de correo ni login Google real. No se reejecutó al redactar este anexo. |
| `node tests/integration/hosted-public.mjs` al preparar este anexo | Cinco comprobaciones públicas aprobadas | Supabase alojado, sin login positivo ni reserva de evaluación. |
| Respuesta de Vercel a `/clases` y `/mis-reservas` | HTTP 200 | Entrega HTML; no es prueba funcional autenticada. |

Los resultados y correcciones históricas, incluyendo intentos fallidos, están en [Pruebas APF2](PRUEBAS_APF2.md). No presentar una prueba automatizada como “validación humana”.

## 6. Evidencia humana disponible y límites

- El propietario comunicó que el acceso funciona y solicitó correcciones concretas en presentación, imágenes y sede. Estas intervenciones son evidencia de participación y retroalimentación, no de una revisión exhaustiva de seguridad.
- No se dispone en este registro de una entrevista, consentimiento, acta de prueba o medición con un socio/instructor real de TITAN GYM.
- No se dispone de nombres y firmas de revisores para cada módulo. No se atribuyen revisiones que no ocurrieron.
- Retirar comentarios de IA de las pantallas no elimina la obligación de declarar su uso en el informe académico.

## 7. Validación humana final que debe completar el equipo

Cada integrante debe comprender lo que presenta. Registrar solamente verificaciones efectivamente realizadas:

| Elemento a revisar | Procedimiento humano | Responsable / fecha | Resultado y evidencia |
| --- | --- | --- | --- |
| Flujo principal | Ejecutar consulta, reserva y recarga del comprobante en Vercel con cuenta de evaluación. | Pendiente | Pendiente |
| Persistencia | Comparar código del comprobante con fila guardada en Supabase. | Pendiente | Pendiente |
| Aforo | Revisar la función de reserva y explicar por qué el bloqueo impide sobreocupación; revisar evidencia de concurrencia. | Pendiente | Pendiente |
| Privacidad | Revisar RLS y probar que una cuenta no puede consultar reservas ajenas. | Pendiente | Pendiente |
| Administración | Verificar que un socio no puede entrar; comprobar gestión con administrador autorizado. | Pendiente | Pendiente |
| Recursos visuales | Aprobar legibilidad, recortes, transparencia y procedencia ilustrativa en desktop/móvil. | Pendiente | Pendiente |
| Documentación académica | Contrastarla con APF1, consigna y evidencias; eliminar afirmaciones sin respaldo. | Pendiente | Pendiente |

Al completar la revisión, cada responsable añadirá su nombre, fecha, resultado observado y ubicación de evidencia. No firmar esta tabla antes de realizar las comprobaciones.

## 8. Integridad de la entrega

- No incluir tokens, claves de servicio, contraseñas ni datos privados de terceros en el anexo.
- No inventar entrevistas, participantes, firmas, capturas, métricas de mejora o resultados de pruebas.
- Separar datos académicos del seed, datos operativos y ejemplos anonimizados.
- Entregar la declaración del uso de IA, este registro, los prompts originales adicionales disponibles y las validaciones humanas realizadas.

La penalización y condiciones de integridad corresponden a la consigna del curso; este anexo no garantiza su cumplimiento mientras sigan pendientes las validaciones y el registro complementario.
