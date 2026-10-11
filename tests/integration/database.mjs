import assert from 'node:assert/strict';
import { createHarness } from './harness.mjs';
import { writeFile, mkdir, access } from 'node:fs/promises';
const results=[];
const harness = await createHarness();
const { admin, users, connectAs } = harness;
const s = n => `50000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const a = await connectAs(users[0]);
const b = await connectAs(users[1]);
const anonymous = await connectAs(null);
const manager = await connectAs(users[2]);
async function check(name, fn) { await fn(); results.push({ name, passed:true }); console.log('PASS · '+name); }
const reserve = (client,session,email='test1@example.com',name='Ana López') => client.query('select public.reserve_session($1,$2,$3) id',[session,name,email]);
try {
  await check('PF-01: catálogo público con ocho sesiones y horarios futuros',async()=>{const {rows}=await anonymous.query('select * from public.list_sessions()'); assert.equal(rows.length,8); assert(rows.every(r=>new Date(r.starts_at)>new Date())); assert(rows.some(r=>r.discipline==='Cross Training'));});
  await check('PF-02: cupos exactos, pocos cupos y clase llena',async()=>{const {rows}=await anonymous.query('select * from public.list_sessions()'); assert.equal(rows.find(r=>r.id===s(1)).available,4); assert.equal(rows.find(r=>r.id===s(3)).available,0); assert.equal(rows.find(r=>r.id===s(5)).available,2);});
  await check('Sede única Qatuna: dirección de la referencia y todas las sesiones coherentes',async()=>{
    const locations=(await anonymous.query('select name,address from public.locations')).rows;
    assert.equal(locations.length,1);assert.equal(locations[0].name,'TITAN GYM QATUNA');assert.equal(locations[0].address,'Isabel Chimpu Ocllo cdra 10, Carabayllo 15318');
    assert((await anonymous.query('select * from public.list_sessions()')).rows.every(r=>r.location===locations[0].name&&r.address===locations[0].address));
  });
  await check('Recursos visuales: seis disciplinas con fotografía existente y aforo intacto',async()=>{
    const {rows}=await anonymous.query('select * from public.list_sessions()');
    assert.equal(new Set(rows.map(r=>r.image_url)).size,6);
    for(const r of rows){assert.match(r.image_url,/^\/assets\/generated\/.+\.jpg$/);await access('public'+r.image_url);}
    assert.equal(rows.find(r=>r.id===s(3)).available,0);
  });
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
  await check('Admin: socio y anónimo no pueden acceder al panel ni al roster',async()=>{
    assert.equal((await a.query('select public.is_admin() value')).rows[0].value,false);
    await assert.rejects(a.query('select public.admin_snapshot()'),/ADMIN_REQUIRED/);
    await assert.rejects(a.query('select public.admin_roster($1)',[s(2)]),/ADMIN_REQUIRED/);
    await assert.rejects(anonymous.query('select public.admin_snapshot()'),/permission denied/);
  });
  await check('Admin: no se puede autoasignar el rol ni falsificar metadata',async()=>{
    await assert.rejects(a.query('insert into private.administrators(user_id) values($1)',[users[0]]),/permission denied/);
    await admin.query('update auth.users set raw_user_meta_data=$1 where id=$2',[{role:'admin'},users[0]]);
    assert.equal((await a.query('select public.is_admin() value')).rows[0].value,false);
    await admin.query('insert into private.administrators(user_id) values($1)',[users[2]]);
    assert.equal((await manager.query('select public.is_admin() value')).rows[0].value,true);
  });
  let classId,sessionId;
  const classData={name:'Clase de integración',description:'Entrenamiento funcional con evidencia SQL.',discipline_id:'10000000-0000-4000-8000-000000000001',image_url:'/assets/1-758/asset-0.png'};
  await check('Admin: creación y edición de clase persistidas; socio rechazado',async()=>{
    await assert.rejects(a.query('select public.admin_save_class($1)',[classData]),/ADMIN_REQUIRED/);
    classId=(await manager.query('select public.admin_save_class($1) id',[classData])).rows[0].id;
    await manager.query('select public.admin_save_class($1,$2)',[{...classData,name:'Clase editada de integración'},classId]);
    const snapshot=(await manager.query('select public.admin_snapshot() data')).rows[0].data;
    assert(snapshot.classes.some(c=>c.id===classId&&c.name==='Clase editada de integración'));
  });
  const sessionData={class_id:null,instructor_id:'30000000-0000-4000-8000-000000000001',location_id:'20000000-0000-4000-8000-000000000001',room:'Sala de integración',starts_at:new Date(Date.now()+86400000*10).toISOString(),duration_minutes:45,capacity:2,published:true};
  await check('Admin: nueva sesión publicada aparece en catálogo con cupos reales',async()=>{
    sessionData.class_id=classId;
    sessionId=(await manager.query('select public.admin_save_session($1) id',[sessionData])).rows[0].id;
    const row=(await anonymous.query('select * from public.list_sessions($1)',[sessionId])).rows[0];
    assert.equal(row.capacity,2);assert.equal(row.available,2);assert.equal(row.name,'Clase editada de integración');
  });
  await check('Admin: roster autorizado y sesión reservada conserva datos y aforo',async()=>{
    await reserve(a,sessionId);
    assert.equal((await manager.query('select public.admin_roster($1) data',[sessionId])).rows[0].data[0].member_email,'test1@example.com');
    await assert.rejects(manager.query('select public.admin_save_session($1,$2)',[{...sessionData,room:'Otro lugar'},sessionId]),/SESSION_HAS_RESERVATIONS/);
    await manager.query('select public.admin_save_session($1,$2)',[{...sessionData,capacity:3},sessionId]);
    await assert.rejects(manager.query('select public.admin_save_session($1,$2)',[{...sessionData,capacity:0},sessionId]),/CAPACITY_BELOW_RESERVATIONS|check constraint/);
    assert.equal((await anonymous.query('select available from public.list_sessions($1)',[sessionId])).rows[0].available,2);
  });
  await check('Admin: validación SQL de clase y sesión inválidas',async()=>{
    await assert.rejects(manager.query('select public.admin_save_class($1)',[{...classData,name:'A'}]),/INVALID_CLASS/);
    await assert.rejects(manager.query('select public.admin_save_class($1)',[{...classData,image_url:'https://unknown.invalid/image.jpg'}]),/INVALID_IMAGE/);
    await assert.rejects(manager.query('select public.admin_save_session($1)',[{...sessionData,starts_at:new Date(0).toISOString()}]),/INVALID_SESSION/);
  });
  await check('Asistencia: futuro y socio rechazados sin insertar filas',async()=>{
    await assert.rejects(manager.query('select public.admin_set_attendance($1,$2)',[reservationId,'present']),/ATTENDANCE_TOO_EARLY/);
    await assert.rejects(a.query('select public.admin_set_attendance($1,$2)',[reservationId,'present']),/ADMIN_REQUIRED/);
    assert.equal((await admin.query('select count(*) n from public.attendance')).rows[0].n,'0');
  });
  await check('Asistencia: presencia y corrección con auditoría real e identidad del actor',async()=>{
    await admin.query("update public.class_sessions set starts_at=now()-interval '1 hour' where id=$1",[s(2)]);
    await manager.query('select public.admin_set_attendance($1,$2)',[reservationId,'present']);
    await manager.query('select public.admin_set_attendance($1,$2)',[reservationId,'absent']);
    const row=(await admin.query('select * from public.attendance where reservation_id=$1',[reservationId])).rows[0];
    assert.equal(row.status,'absent');assert.equal(row.recorded_by,users[2]);
    const {rows}=await admin.query('select * from private.attendance_history where reservation_id=$1 order by created_at',[reservationId]);
    assert.equal(rows.length,2);assert.equal(rows[1].previous_status,'present');assert(rows.every(h=>h.recorded_by===users[2]));
    assert.equal((await anonymous.query('select reserved from public.list_sessions($1)',[s(2)])).rows[0].reserved,12);
  });
  await check('Asistencia: idempotencia y aislamiento de historial',async()=>{
    await manager.query('select public.admin_set_attendance($1,$2)',[reservationId,'absent']);
    assert.equal((await admin.query('select count(*) n from private.attendance_history where reservation_id=$1',[reservationId])).rows[0].n,'2');
    assert.equal((await a.query('select * from public.attendance')).rows.length,0);
    await assert.rejects(a.query('select * from private.attendance_history'),/permission denied/);
    await assert.rejects(manager.query("update public.attendance set recorded_by=$1",[users[0]]),/permission denied/);
  });
  await check('Asistencia: estado inválido y reserva cancelada rechazados',async()=>{
    await assert.rejects(manager.query('select public.admin_set_attendance($1,$2)',[reservationId,'inventado']),/INVALID_ATTENDANCE/);
    await admin.query("update public.reservations set status='cancelled' where id=$1",[reservationId]);
    await assert.rejects(manager.query('select public.admin_set_attendance($1,$2)',[reservationId,'present']),/RESERVATION_CANCELLED/);
  });
  await check('Admin: revocación inmediata sin renovar JWT',async()=>{
    await admin.query('delete from private.administrators where user_id=$1',[users[2]]);
    assert.equal((await manager.query('select public.is_admin() value')).rows[0].value,false);
    await assert.rejects(manager.query('select public.admin_snapshot()'),/ADMIN_REQUIRED/);
  });
  await mkdir('docs/evidencias',{recursive:true});
  await writeFile('docs/evidencias/database-results.json',JSON.stringify({executedAt:new Date().toISOString(),engine:(await admin.query('select version() v')).rows[0].v,scope:'PostgreSQL real; auth.uid y auth.users mínimos de pruebas. Sin servicio Supabase Auth.',results},null,2));
  console.log(`${results.length} comprobaciones PostgreSQL superadas.`);
} finally { await Promise.allSettled([a.end(),b.end(),anonymous.end(),manager.end()]);await harness.close(); }
