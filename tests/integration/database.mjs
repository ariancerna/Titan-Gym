import assert from 'node:assert/strict';
import { createHarness } from './harness.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
const results=[];
const harness = await createHarness();
const { admin, users, connectAs } = harness;
const s = n => `50000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const a = await connectAs(users[0]);
const b = await connectAs(users[1]);
const anonymous = await connectAs(null);
async function check(name, fn) { await fn(); results.push({ name, passed:true }); console.log('PASS · '+name); }
const reserve = (client,session,email='test1@example.com',name='Ana López') => client.query('select public.reserve_session($1,$2,$3) id',[session,name,email]);
try {
  await check('PF-01: catálogo público con ocho sesiones y horarios futuros',async()=>{const {rows}=await anonymous.query('select * from public.list_sessions()'); assert.equal(rows.length,8); assert(rows.every(r=>new Date(r.starts_at)>new Date())); assert(rows.some(r=>r.discipline==='Cross Training'));});
  await check('PF-02: cupos exactos, pocos cupos y clase llena',async()=>{const {rows}=await anonymous.query('select * from public.list_sessions()'); assert.equal(rows.find(r=>r.id===s(1)).available,4); assert.equal(rows.find(r=>r.id===s(3)).available,0); assert.equal(rows.find(r=>r.id===s(5)).available,2);});
  let reservationId;
  await check('PF-03: reserva persistida y disponibilidad actualizada',async()=>{reservationId=(await reserve(a,s(2))).rows[0].id;const {rows}=await a.query('select * from public.reservations where id=$1',[reservationId]);assert.equal(rows.length,1);assert.equal(rows[0].user_id,users[0]);assert.match(rows[0].code,/^TG-[A-F0-9]{32}$/);assert.equal((await anonymous.query('select available from public.list_sessions($1)',[s(2)])).rows[0].available,8);});
  await check('PF-04: aforo completo rechazado por PostgreSQL',async()=>{await assert.rejects(reserve(a,s(3)),/SESSION_FULL/);assert.equal((await admin.query('select count(*) n from public.reservations where session_id=$1',[s(3)])).rows[0].n,'18');});
  await check('Reserva duplicada rechazada',async()=>{await assert.rejects(reserve(a,s(2)),/DUPLICATE_RESERVATION/);});
  await check('Campos e identidad falsificados rechazados',async()=>{await assert.rejects(reserve(a,s(4),'otro@example.com'),/EMAIL_MISMATCH/);await assert.rejects(reserve(a,s(4),'test1@example.com','Ana'),/INVALID_MEMBER/);});
  await check('RLS: otro socio no puede leer la reserva',async()=>{assert.equal((await b.query('select * from public.reservations where id=$1',[reservationId])).rows.length,0);await assert.rejects(anonymous.query('select * from public.reservations'),/permission denied/);});
  await check('Sin privilegios de inserción directa ni reserva anónima',async()=>{await assert.rejects(a.query("insert into public.reservations(session_id,user_id,member_name,member_email) values($1,$2,'Ana López','test1@example.com')",[s(4),users[0]]),/permission denied/);await assert.rejects(reserve(anonymous,s(4)),/permission denied/);});
  await check('Último cupo: dos transacciones simultáneas, exactamente una reserva',async()=>{
    await admin.query('update public.class_sessions set capacity=1 where id=$1',[s(8)]);
    await a.query('begin'); await reserve(a,s(8));
    let settled=false;
    const pending=reserve(b,s(8),'test2@example.com').then(()=>({ok:true}),e=>({ok:false,error:e.message})).finally(()=>{settled=true;});
    await new Promise(r=>setTimeout(r,150));assert.equal(settled,false,'La segunda conexión debe esperar el bloqueo');
    await a.query('commit'); const result=await pending;
    assert.equal(result.ok,false);assert.match(result.error,/SESSION_FULL/);
    assert.equal((await admin.query('select count(*) n from public.reservations where session_id=$1',[s(8)])).rows[0].n,'1');
  });
  await check('Rollback libera el último cupo para otra transacción',async()=>{await admin.query('update public.class_sessions set capacity=1 where id=$1',[s(7)]);await a.query('begin');await reserve(a,s(7));const pending=reserve(b,s(7),'test2@example.com');await a.query('rollback');assert.ok((await pending).rows[0].id);});
  await check('Trigger protege importaciones y reducción del aforo',async()=>{await assert.rejects(admin.query("insert into public.reservations(session_id,user_id,member_name,member_email) values($1,$2,'Ana López','test3@example.com')",[s(8),users[2]]),/SESSION_FULL/);await assert.rejects(admin.query('update public.class_sessions set capacity=10 where id=$1',[s(3)]),/CAPACITY_BELOW_RESERVATIONS/);});
  await check('Sesión pasada o despublicada no acepta reservas',async()=>{await admin.query('update public.class_sessions set starts_at=now()-interval \'1 day\' where id=$1',[s(4)]);await assert.rejects(reserve(a,s(4)),/SESSION_CLOSED/);});
  await mkdir('docs/evidencias',{recursive:true});
  await writeFile('docs/evidencias/database-results.json',JSON.stringify({executedAt:new Date().toISOString(),engine:(await admin.query('select version() v')).rows[0].v,scope:'PostgreSQL real; auth.uid y auth.users mínimos de pruebas. Sin servicio Supabase Auth.',results},null,2));
  console.log(`${results.length} comprobaciones PostgreSQL superadas.`);
} finally { await Promise.allSettled([a.end(),b.end(),anonymous.end()]);await harness.close(); }
