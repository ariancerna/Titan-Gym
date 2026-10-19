# Auditoría y plan de trabajo · APF3

Fecha: 15 de octubre de 2026. Revisión estática del repositorio más las pruebas locales disponibles. No se ejecutaron pruebas contra Supabase alojado ni contra Vercel.

## 1. Qué se debe presentar en el APF3

La consigna oficial del APF3 **no está en el repositorio**. Lo siguiente sale de lo que el propio informe del APF2 comprometió para esta etapa; debe contrastarse con la consigna del curso antes de cerrar el informe.

| Fuente en el informe APF2 | Compromiso para el APF3 |
| --- | --- |
| §1.2 Continuidad | Ampliar los registros de asistencia y preparar los datos para evaluar un modelo predictivo de inasistencias. |
| §3.5 Roadmap | Ampliar reservas y asistencias, preparar el dataset, analizar la calidad de los datos y desarrollar o evaluar un modelo predictivo. Entregable: **dataset documentado y avance del componente de ML**. |
| §4.3 Contrato de datos | Variable objetivo `asistio`, campos del dataset, calidad y partición 80/20. |
| §4.4 Riesgo 3 | Registro obligatorio de los campos clave (estado y asistencia). |

## 2. Lista de verificación

Estados: ✅ cumplido y verificado · 🟡 parcial · ❌ pendiente · ❔ no verificable desde el repositorio.

| Requisito | Estado | Evidencia o lo que falta |
| --- | --- | --- |
| Registro de asistencia por el personal | ✅ | Panel `/admin`, tabla `attendance` con historial auditado. 28 comprobaciones SQL. |
| Cancelación de reservas (HU05) | ✅ (nuevo) | Necesaria para distinguir inasistencia avisada de no avisada. El informe APF2 la daba por implementada y no lo estaba. |
| Dataset documentado | ✅ (nuevo) | `admin_dataset()`, exportación CSV y [DATASET_APF3.md](DATASET_APF3.md). |
| Análisis de calidad de datos | 🟡 | Hay indicador de cobertura y restricciones SQL. Falta el análisis sobre datos reales (volumen, desbalance, faltantes). |
| Indicador principal: % de no-shows (HU09) | ✅ (nuevo) | Panel de indicadores. El informe APF2 lo daba por implementado y no lo estaba. |
| Partición 80/20 | 🟡 | Documentada como partición temporal. Se aplicará cuando haya datos. |
| Modelo predictivo o su evaluación | ❌ | No hay asistencia real registrada para entrenar. No conviene presentar métricas sobre datos sintéticos como si fueran reales. |
| Migración aplicada en Supabase alojado | ❔ | La migración nueva solo se probó en PostgreSQL local. Debe aplicarse antes de desplegar el frontend. |
| Administrador real asignado | ❔ | Según `SUPABASE.md` (11/10) no había ninguno. Sin él no se pueden crear sesiones ni registrar asistencia en la demo. |
| Sesiones futuras en producción | ❔ | El seed creó sesiones entre el 12 y el 16/10. Hoy casi todas ya pasaron. |
| Consentimiento y política de privacidad (Ley N.° 29733) | ✅ (nuevo) | Página `/privacidad`, casilla obligatoria y registro con fecha en `privacy_consents`; la reserva exige consentimiento. Ver [PRIVACIDAD.md](PRIVACIDAD.md). |
| Recordatorios (HU07) y lista de espera (HU08) | ❌ | Fuera del alcance comprometido para el APF3. |

### Contradicciones del informe APF2 que conviene corregir en el APF3

| Afirmación del informe | Situación real |
| --- | --- |
| HU05 y HU09 "Implementado" | No estaban implementadas. Ya lo están. |
| Roles cliente/administrador/**instructor** (§4.2) | No existe un rol de instructor; la asistencia la registra el administrador. |
| "Campos encriptados" (§4.2) | Supabase cifra en tránsito y en reposo a nivel de plataforma; no hay columnas cifradas por la aplicación. La protección real es RLS más funciones privadas. |
| Prueba con usuarios: "elimina las dobles reservas" (§2.2) | No hay acta ni medición con personal del gimnasio. Las dobles reservas sí están impedidas técnicamente (índice único y prueba de concurrencia). |
| Referencias a FastAPI y scikit-learn | No se usan. Retirarlas o justificar scikit-learn solo si se entrena el modelo. |
| Credenciales de prueba en el informe | Ver hallazgo S1. |

## 3. Hallazgos de la auditoría

Tipos: **V** vulnerabilidad o defecto verificado · **P** problema potencial · **R** recomendación.

| ID | Tipo | Prioridad | Ubicación | Problema | Corrección | Afecta |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | V | Crítica | `proyecto.md` §3.1 | Contraseña real de la cuenta de evaluación en texto plano; el repositorio de GitHub es público. | Se añadió `/proyecto.md` a `.gitignore`. Entregar credenciales solo por el canal privado del curso y cambiar la contraseña tras la evaluación. | Seguridad |
| S2 | P | Media | Supabase Auth → Email | La longitud mínima de contraseña en Supabase es 6, menor que los 12 caracteres que exige la app, y la contraseña de evaluación es débil. La protección contra contraseñas filtradas solo existe en el plan Pro. | Subir "Minimum password length" a 12 y usar una frase larga para la cuenta de evaluación. | Seguridad |
| S3 | R | Media | `vercel.json` | No hay Content-Security-Policy ni Permissions-Policy. | Añadir CSP (`default-src 'self'; connect-src 'self' https://*.supabase.co; …`) y verificarla en un despliegue de Preview antes de producción. | Seguridad |
| S4 | V | Baja | `AuthGate.tsx`, `errors.ts` | Mensajes al socio mencionaban el "equipo de Supabase" y cómo eludir la limitación del correo. | Corregido: textos neutros para el socio. | Presentación |
| F1 | V | Alta | `proyecto.md` vs. código | Funciones declaradas como implementadas sin estarlo (HU05, HU09). | Implementadas con pruebas. | Académico |
| F2 | V | Alta | `supabase/seed.sql` | Sesiones relativas al día del seed; hoy el catálogo de producción probablemente está casi vacío. | Crear sesiones nuevas desde `/admin` antes de la exposición. | Funcionalidad |
| F3 | V | Media | `AuthProvider.tsx` | La caché privada se borraba en cada evento de Auth, incluida la renovación horaria del token. | Corregido: solo se borra si cambia la cuenta. | Funcionalidad |
| F4 | V | Media | `CatalogPage.tsx` | Con la agenda vacía se mostraba "Sin clases para estos filtros". Las disciplinas estaban fijas en el código. | Corregido: mensaje propio y disciplinas tomadas de la agenda. | UX |
| F5 | V | Baja | `HomePage.tsx` | "Ver horarios" llevaba a `/clases?vista=horarios`, parámetro que nadie lee. | Retirado. | UX |
| F6 | V | Baja | `AdminPage.tsx` | Se invalidaba la clave `['session']`, que no existe; "Reservas activas" sumaba sesiones pasadas. | Corregido. | Mantenimiento |
| F7 | V | Baja | `ConfirmationPage.tsx` | Un comprobante cancelado mostraba "guardada, preséntalo en recepción" con insignia verde. | Corregido. | UX |
| Q1 | V | Alta | `src/**` | Componentes comprimidos en una sola línea (hasta ~4.800 caracteres). Imposible de revisar o defender. | Prettier añadido (`npm run format`) y aplicado sin cambios de lógica. | Mantenimiento / académico |
| Q2 | P | Media | `MyReservationsPage.tsx` | Una consulta por cada reserva (N+1) para obtener los datos de la sesión. | Pendiente: RPC `my_reservations` que devuelva reserva y sesión juntas. | Rendimiento |
| Q3 | P | Baja | `admin_snapshot` | Devuelve todas las sesiones históricas sin paginar. | Pendiente cuando haya meses de datos. | Rendimiento |
| Q4 | R | Baja | `public/assets` | ~1,8 MB de PNG fuente del logo y más de 100 SVG de Figma sin uso se publican en el despliegue. | Moverlos fuera de `public/`. Convertir las fotos a WebP. | Rendimiento |
| Q5 | R | Baja | `AdminForms.tsx` | Los campos bloqueados de una sesión con reservas usan `aria-disabled` e interceptan `onChange`; el checkbox cambia visualmente aunque no se guarde. | Usar `disabled` real o `Controller`. El servidor ya rechaza el cambio. | UX |
| D1 | R | Media | `docs/` | La documentación es extensa y repite advertencias; `DESPLIEGUE.md` y el README dicen "sin despliegue público" mientras el informe da una URL de Vercel. | Unificar el estado del despliegue y resumir. | Académico |

### Lo que está bien resuelto (verificado)

- Reserva atómica con `FOR UPDATE`, índice único parcial y trigger de aforo. Hay una prueba de dos transacciones simultáneas por el último cupo.
- RLS en todas las tablas. Las funciones privilegiadas están en el esquema `private`, con `search_path = ''`, y las fachadas públicas son `SECURITY INVOKER`.
- El rol de administrador se comprueba en cada RPC contra una tabla privada, nunca contra metadata editable por el usuario.
- La redirección tras el login está limitada a rutas internas (`safeReturnPath`).
- No hay `dangerouslySetInnerHTML` ni SQL dinámico con datos del usuario. `npm audit`: 0 vulnerabilidades.

## 4. Plan de trabajo

### 4.1 Imprescindibles para el APF3

| Tarea | Archivos | Resultado esperado | Cómo comprobar | Estado |
| --- | --- | --- | --- | --- |
| Cancelación de reservas | migración `20261016…`, `features/reservations/api.ts`, `MyReservationsPage.tsx` | El socio cancela antes del inicio y el cupo se libera. | `npm run test:db`, e2e "HU05" | Hecho |
| Dataset seudonimizado y exportable | migración, `features/admin/*`, `AttendanceIndicators.tsx` | CSV sin datos personales, con `asistio`. | e2e "HU09", unitarias de CSV | Hecho |
| Indicador de no-shows | `indicators.ts`, `AttendanceIndicators.tsx` | Tasa, cobertura y desglose por clase. | Unitarias de `summarizeAttendance` | Hecho |
| Documentar el dataset | `docs/DATASET_APF3.md` | Diccionario, calidad, partición y privacidad. | Revisión del equipo | Hecho |
| Aplicar la migración en Supabase alojado | Panel de Supabase o `npx supabase db push` | RPC disponibles en producción. | Cancelar una reserva de prueba desde Vercel | **Pendiente (equipo)** |
| Asignar un administrador real | `docs/ADMINISTRACION.md` | Acceso al panel en producción. | Entrar a `/admin` en ventana privada | **Pendiente (equipo)** |
| Programar sesiones y registrar asistencia real | `/admin` | Datos reales para el dataset. | Cobertura > 0 % en el panel | **Pendiente (equipo)** |
| Corregir el informe | Informe APF3 | Sin afirmaciones contradictorias. | Contrastar con la sección 2 | **Pendiente (equipo)** |

### 4.2 Seguridad y errores funcionales

S1 (hecho en el repositorio; falta cambiar la contraseña), S4, F3, F6 y F7 hechos. S2 y S3 pendientes.

### 4.3 Diseño y experiencia de usuario

Hecho: portada con datos reales en lugar de métricas de relleno ("100 % control", "Tu lugar"), sección de pasos como lista numerada en lugar de tarjetas con iconos, retiro del banner "El compromiso se demuestra en la cancha", pestañas de fecha compactas y desplazables, estados vacíos correctos, confirmación de cancelación en línea y pie de página que identifica el proyecto académico.

### 4.4 Calidad de código

Hecho: Q1. Pendiente: Q2 a Q5.

### 4.5 Opcional

CSP (S3), imágenes WebP, paginación del panel, recordatorios (HU07) y lista de espera (HU08).

## 5. Despliegue de los cambios

El orden importa: si se despliega el frontend sin la migración, Mis reservas y el panel mostrarán errores al llamar a `cancel_reservation` y `admin_dataset`.

1. Aplicar `supabase/migrations/20261016000000_apf3_cancelacion_dataset.sql` en el proyecto alojado.
2. Comprobar en el editor SQL que existen `public.cancel_reservation` y `public.admin_dataset`.
3. Desplegar el frontend en Vercel.
4. Probar en una ventana privada: reservar, cancelar y ver el cupo liberado; en `/admin`, el indicador y la exportación.

## 6. Pruebas ejecutadas (15/10/2026, entorno local)

| Comando | Antes de los cambios | Después |
| --- | --- | --- |
| `npm run build` | Aprobado | Aprobado |
| `npm test` | 31 aprobadas | 46 aprobadas |
| `npm run test:db` | 25 aprobadas | 34 aprobadas (incluye cancelación, dataset, privacidad, código QR, ventana de 7 días y recordatorios) |
| `npm run test:e2e` | 78 aprobadas (registro del 11/10) | 120 aprobadas, 0 fallidas, 0 inestables, en 3 tamaños de pantalla |
| `npm audit` | 0 vulnerabilidades | 0 vulnerabilidades |
| `npm run format:check` | — | Sin diferencias |

Alcance: PostgreSQL 17 embebido con Auth de prueba y Chromium de Playwright. No acredita que la migración funcione en el Supabase alojado hasta aplicarla y probarla allí. Capturas nuevas: `cancelar-reserva-{desktop,tablet,mobile}.png`; el resto de `docs/evidencias/` se regeneró con la interfaz actual.

## 7. Seguimiento del 19 de octubre de 2026

Estado de los hallazgos y pendientes de este informe después de los cambios del 19/10. La tabla de la sección 3 se conserva como registro del 15/10.

| ID / requisito | Estado | Qué se hizo o qué falta |
| --- | --- | --- |
| HU08 lista de espera | ✅ Código y pruebas | Fila por orden de llegada; al cancelar o subir la capacidad, el primero recibe la reserva en la misma transacción y un aviso por correo. Falta **aplicar `20261021000000_lista_espera.sql` en Supabase** ([pasos](LISTA_ESPERA.md)); hasta entonces la web oculta la función sin errores. |
| HU07 recordatorios | ✅ | Implementados desde el 15/10 (la fila «HU07 y HU08 ❌» de la sección 2 quedó desactualizada). |
| S3 CSP | ✅ Corregido | Content-Security-Policy y Permissions-Policy en `vercel.json`. Verificado sirviendo el build con esas cabeceras: 0 violaciones en inicio, asistente, catálogo, detalle, perfil, admin y acceso con Google. Falta confirmarlo en el despliegue real. |
| Q2 consultas N+1 | ✅ Corregido | Mis reservas trae reserva, sesión, clase e instructor en una sola consulta (embedding de PostgREST), sin migración. |
| Q4 recursos sin uso | ✅ Corregido | Fotos en WebP (1972 KB → 851 KB) con el JPG de respaldo; 116 recursos de Figma sin uso movidos a `design/figma`. |
| F2 sesiones en producción | ✅ Verificado | El catálogo público alojado devolvía 16 sesiones futuras el 19/10. |
| D1 documentación | ✅ Corregido | README, despliegue y backlog indican la URL publicada y el estado real de cada historia. |
| S2 longitud mínima de contraseña | ❌ Titular | Subir «Minimum password length» a 12 en Supabase → Authentication → Providers → Email. |
| Administrador real | ❔ Titular | Autorizar una cuenta según [Administración](ADMINISTRACION.md) para poder demostrar `/admin`. |
| S1 contraseña de evaluación | ❔ Titular | Cambiarla después de la evaluación. |
| Q3, Q5 | Pendiente | Sin cambios. |
| Modelo predictivo | ❌ | Sigue sin datos reales de asistencia; no se entrenó con datos sintéticos. |

Además se agregaron el asistente guiado (sin IA), la página Mi perfil y el menú de cuenta en la barra de navegación ([backlog](PRODUCT_BACKLOG.md)).

Pruebas del 19/10: ver la tabla del [README](../README.md#pruebas-y-evidencia).
