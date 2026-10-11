import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

// Comprobaciones de solo lectura contra el proyecto configurado. No envía correos.
const env = Object.fromEntries((await readFile('.env.local', 'utf8')).split(/\r?\n/)
  .filter(line => line && !line.startsWith('#')).map(line => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url && key, 'Faltan variables de Supabase');
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: sessions, error } = await client.rpc('list_sessions');
assert.equal(error, null);
assert.equal(sessions.length, 8);
assert.ok(sessions.every(session => session.available === session.capacity - session.reserved));
console.log('PASS PF-01/PF-02: ocho sesiones y cupos consistentes en PostgREST real');
const full = sessions.find(session => session.id === '50000000-0000-4000-8000-000000000003');
assert.equal(full.available, 0);
console.log('PASS: clase completa con cero cupos');
const reservations = await client.from('reservations').select('id');
assert.ok(reservations.error, 'El rol anon no debe tener permiso de lectura');
console.log('PASS: reservas privadas bloqueadas para anon');
const booking = await client.rpc('reserve_session', {
  p_session_id: full.id, p_member_name: 'Prueba Pública', p_member_email: 'test@example.invalid',
});
assert.ok(booking.error, 'El rol anon no debe poder reservar');
console.log('PASS: RPC de reserva bloqueada para anon');
const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
assert.ok(response.ok);
const auth = await response.json();
assert.equal(auth.external.email, true);
assert.equal(auth.disable_signup, false);
assert.notEqual(auth.external.anonymous_users, true);
console.log('PASS: Auth real permite correo y altas, sin acceso anónimo');
console.log('No se verificaron recepción del enlace ni inicio de sesión real.');
