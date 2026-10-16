import EmbeddedPostgres from 'embedded-postgres';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
export async function createHarness() {
  const dir = await mkdtemp(join(tmpdir(), 'fitsmart-pg-'));
  const probe = createServer();
  await new Promise((resolve,reject) => { probe.once('error',reject); probe.listen(0,'127.0.0.1',resolve); });
  const port = Number(process.env.TEST_PG_PORT || probe.address().port);
  await new Promise(resolve => probe.close(resolve));
  const password = randomBytes(24).toString('hex');
  const db = new EmbeddedPostgres({ databaseDir: join(dir, 'data'), user: 'postgres', password, port, persistent: true, initdbFlags: ['--encoding=UTF8'], postgresFlags: ['-h','127.0.0.1'], onLog: m => { if (process.env.TEST_DB_DEBUG) console.log(m); }, onError: m => console.error(String(m)) });
  await db.initialise();
  await db.start();
  const admin = db.getPgClient();
  await admin.connect();
  // Solo entorno de pruebas: superficie auth mínima. No es un servicio Supabase Auth.
  await admin.query(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,
      is_anonymous boolean default false,raw_app_meta_data jsonb,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
    $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
  `);
  for (const name of (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) await admin.query(await readFile(join('supabase/migrations',name),'utf8'));
  await admin.query(await readFile('supabase/seed.sql','utf8'));
  const users = ['70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000003'];
  for (const [i,id] of users.entries()) await admin.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,`test${i+1}@example.com`]);
  // Los socios de prueba ya aceptaron la política vigente; el caso sin consentimiento se prueba aparte.
  await admin.query("insert into public.privacy_consents(user_id,policy_version,source) select unnest($1::uuid[]),private.current_privacy_version(),'signup'",[users]);
  async function connectAs(userId) {
    const client = db.getPgClient(); await client.connect();
    await client.query(`set role ${userId ? 'authenticated' : 'anon'}`);
    if (userId) await client.query("select set_config('request.jwt.claim.sub',$1,false)",[userId]);
    return client;
  }
  return { db, admin, users, connectAs, async close() { await admin.end(); await db.stop(); } };
}
