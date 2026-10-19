# Lista de espera (US08)

Cuando una clase está llena, el socio puede apuntarse en una fila. Si se libera un cupo, el primero de la fila **recibe la reserva automáticamente** y se le avisa por correo con su código y su QR.

## Reglas

| Regla | Detalle |
| --- | --- |
| Cuándo se ofrece | Solo en clases llenas, publicadas, dentro de la ventana de 7 días y con más de 1 hora por delante. Con cupos libres se reserva directamente (`SESSION_HAS_SEATS`). |
| Quién puede apuntarse | Mismas comprobaciones que al reservar: correo verificado, consentimiento de privacidad vigente, correo de la cuenta y nombre con apellido. Una sola entrada activa por socio y clase (`ALREADY_WAITING`); quien ya tiene reserva no entra (`DUPLICATE_RESERVATION`). |
| Orden | Por llegada (`created_at`). El socio ve su posición en Mis reservas y en la página de la clase. |
| Asignación | Al cancelar una reserva y al aumentar la capacidad de la sesión desde el panel. Se crea la reserva a nombre del socio en la misma transacción. |
| Última hora | No se asignan cupos ni se admiten entradas (`WAITLIST_CLOSED`): quien no vea el correo a tiempo sería una inasistencia segura. El cupo liberado queda libre para reservar directamente. |
| Salir | El socio puede salir de la fila desde Mis reservas, con confirmación. |

## Diseño

- Tabla `public.waitlist` con RLS: cada socio solo lee sus propias entradas; nadie escribe directamente.
- `join_waitlist`, `leave_waitlist` y `my_waitlist` son RPC para socios autenticados (fachadas `SECURITY INVOKER` sobre funciones del esquema `private`). `my_waitlist` calcula la posición contando a los demás, sin devolver sus datos.
- `private.promote_waitlist` recorre la fila mientras haya cupos. La llaman `cancel_reservation` y el trigger `session_capacity_promote`, que ya tienen la sesión bloqueada (`FOR UPDATE`).
- `cancel_reservation` ahora bloquea primero la sesión, en el mismo orden que `reserve_session`, para que reservas y cancelaciones simultáneas se serialicen sin interbloqueos. El trigger de aforo sigue siendo la última defensa.
- Aviso por correo: la tarea de [recordatorios](RECORDATORIOS.md) llama a `claim_waitlist_notices` (marca y devuelve en la misma operación, nunca dos veces) y a `release_waitlist_notice` si el envío falla. Solo con la clave de servicio.

## Aplicar en Supabase

1. Abre Supabase → **SQL Editor** y ejecuta completo `supabase/migrations/20261021000000_lista_espera.sql`.
2. Regístrala en el historial:

   ```sql
   insert into supabase_migrations.schema_migrations(version, name)
   values ('20261021000000', 'lista_espera')
   on conflict (version) do nothing;
   ```

3. Comprueba que existen `public.join_waitlist`, `public.my_waitlist` y la tabla `public.waitlist`.

Mientras la migración no esté aplicada, la web sigue funcionando: Mis reservas no muestra la sección (la RPC responde `PGRST202` y se trata como lista vacía), unirse muestra «La lista de espera todavía no está disponible» y la tarea de correos deja una advertencia sin marcarse como fallida.

## Pruebas

- PostgreSQL real (`npm run test:db`): orden de la fila y asignación al cancelar sin superar el aforo, RLS, salir, asignación al subir la capacidad, regla de la última hora, avisos solo con la clave de servicio y una sola vez, y dos cancelaciones simultáneas serializadas.
- Navegador (`tests/e2e/waitlist.spec.ts`): unirse desde una clase llena, ver la posición, no duplicar el formulario y salir con confirmación; un visitante debe ingresar primero.
- Unitarias: correo de cupo asignado con horario de Lima, código, QR y escape de HTML.
