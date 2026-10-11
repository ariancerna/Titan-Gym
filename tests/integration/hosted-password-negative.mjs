import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

// No crea cuentas, envía correos ni cambia credenciales de socios.
const env = Object.fromEntries((await readFile('.env.local', 'utf8')).split(/\r?\n/)
  .filter(line => line && !line.startsWith('#')).map(line => {
    const position = line.indexOf('=');
    return [line.slice(0, position), line.slice(position + 1)];
  }));
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const result = await client.auth.signInWithPassword({ email: `pw-test-${randomUUID()}@example.invalid`, password: randomUUID() });
assert.equal(result.error?.code, 'invalid_credentials');
assert.equal(result.data.session, null);
assert.equal(result.data.user, null);
console.log('PASS: Supabase Auth real rechaza credenciales de prueba inválidas sin conceder sesión.');
console.log('No se comprobó creación ni acceso positivo con una contraseña real del propietario.');
