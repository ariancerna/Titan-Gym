-- Política de privacidad 2026-10-19: informa la lista de espera (datos, asignación automática y
-- aviso por correo) y el nombre guardado en Mi perfil. Todos los socios deberán aceptarla de nuevo
-- antes de su siguiente reserva o lista de espera; el registro de la versión anterior se conserva.
-- Debe coincidir con privacyPolicyVersion en src/content/privacy.ts.
create or replace function private.current_privacy_version() returns text
language sql immutable set search_path = '' as $$ select '2026-10-19'::text $$;
