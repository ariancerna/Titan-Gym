# Privacidad y consentimiento · Ley N.° 29733

Evidencia para la matriz de cumplimiento normativo (sección 4.2 del informe).

## Qué se implementó

| Requisito de la ley | Implementación | Dónde verificarlo |
| --- | --- | --- |
| Informar al titular antes de tratar sus datos (finalidad, destinatarios, plazo, derechos) | Página pública `/privacidad`, enlazada en el pie de página y en cada casilla de aceptación. | `src/content/privacy.ts`, `src/pages/PrivacyPage.tsx` |
| Consentimiento previo, expreso e informado | Casilla obligatoria en "Crear cuenta". Quien entra con Google o con enlace la acepta en su primera reserva. | `SignUpForm.tsx`, `ReservationForm.tsx` |
| Poder demostrar el consentimiento | Tabla `public.privacy_consents`: usuario, versión aceptada, fecha (hora del servidor) y origen (`signup` o `reservation`). | Migración `20261017000000_privacy_consent.sql` |
| No tratar datos sin consentimiento | `reserve_session` rechaza la reserva (`PRIVACY_CONSENT_REQUIRED`) si no hay consentimiento vigente. La regla está en la base de datos, no solo en la pantalla. | Misma migración; prueba SQL "Ley 29733" |
| Transferencia internacional | La política informa que Supabase aloja los datos en São Paulo, Brasil. | Sección 5 de la política |
| Derechos ARCO | La política explica cómo ejercerlos y menciona a la Autoridad Nacional de Protección de Datos Personales. | Secciones 7 y 9 |
| Seudonimización para análisis | El dataset de ML no incluye nombre ni correo. | `docs/DATASET_APF3.md` |

Cada socio puede ver la fecha en que aceptó la política al final de Mis reservas.

## Consulta de evidencia (Supabase → SQL Editor)

```sql
select source, count(*) as socios, min(accepted_at) as primera, max(accepted_at) as ultima
from public.privacy_consents
where policy_version = '2026-10-16'
group by source;
```

## Si cambia la política

1. Actualiza el texto en `src/content/privacy.ts` y la fecha `privacyPolicyVersion`.
2. Crea una migración que cambie `private.current_privacy_version()` a la misma fecha.
3. Al desplegar, todos los socios deberán aceptar la nueva versión antes de su siguiente reserva.

## Pendiente del equipo

- **Validar el texto con el gimnasio:** el plazo de conservación (2 años) y la forma de atender solicitudes son propuestas del equipo.
- **Correo de contacto:** si el gimnasio tiene uno para solicitudes ARCO, ponlo en `privacyContactEmail` (`src/content/privacy.ts`). Hoy la política indica solo la recepción.
- **Inscripción del banco de datos:** la ley exige inscribir el banco de datos personales en el Registro Nacional de Protección de Datos Personales. Es un trámite del titular (TITAN GYM), no del software; mencionarlo en el informe como paso para un uso real.
