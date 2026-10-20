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
  await check('PF-03: reserva persistida y disponibilidad actualizada',async()=>{reservationId=(await reserve(a,s(2))).rows[0].id;const {rows}=await a.query('select * from public.reservations where id=$1',[reservationId]);assert.equal(rows.length,1);assert.equal(rows[0].user_id,users[0]);assert.match(rows[0].code,/^TG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);assert.equal((await anonymous.query('select available from public.list_sessions($1)',[s(2)])).rows[0].available,8);});
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
  const sessionData={class_id:null,instructor_id:'30000000-0000-4000-8000-000000000001',location_id:'20000000-0000-4000-8000-000000000001',room:'Sala de integración',starts_at:new Date(Date.now()+86400000*3).toISOString(),duration_minutes:45,capacity:2,published:true};
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
  await check('APF3 dataset: solo administradores, seudonimizado y con no-show etiquetado',async()=>{
    await assert.rejects(a.query('select * from public.admin_dataset()'),/ADMIN_REQUIRED/);
    await assert.rejects(anonymous.query('select * from public.admin_dataset()'),/permission denied/);
    const {rows,fields}=await manager.query('select * from public.admin_dataset()');
    const names=fields.map(f=>f.name);
    assert(!names.some(n=>/name|email|nombre|correo|user_id/.test(n)),'el dataset no debe incluir datos personales');
    const row=rows.find(r=>r.reserva_id===reservationId);
    assert(row,'la reserva de una sesión iniciada debe estar en el dataset');
    assert.equal(row.asistencia,'absent');assert.equal(row.asistio,false);
    assert.match(row.socio_ref,/^[0-9a-f]{16}$/);assert.notEqual(row.socio_ref,users[0]);
    assert(row.dia_semana>=1&&row.dia_semana<=7);assert.equal(typeof row.anticipacion_horas,'number');
    assert(rows.every(r=>new Date(r.inicio_sesion)<=new Date()),'solo sesiones que ya comenzaron');
  });
  await check('HU05: el socio cancela su reserva futura, libera el cupo y puede volver a reservar',async()=>{
    const cancelSession='91000000-0000-4000-8000-000000000001';
    await admin.query(`insert into public.class_sessions(id,class_id,instructor_id,location_id,room,starts_at,duration_minutes,capacity)
      select $1,class_id,instructor_id,location_id,'Sala cancelación',now()+interval '2 days',45,5 from public.class_sessions where id=$2`,[cancelSession,s(1)]);
    const available=async()=>(await anonymous.query('select available from public.list_sessions($1)',[cancelSession])).rows[0].available;
    const before=await available();
    const id=(await reserve(a,cancelSession)).rows[0].id;
    assert.equal(await available(),before-1);
    await assert.rejects(b.query('select public.cancel_reservation($1)',[id]),/RESERVATION_NOT_FOUND/);
    await assert.rejects(anonymous.query('select public.cancel_reservation($1)',[id]),/permission denied/);
    await a.query('select public.cancel_reservation($1)',[id]);
    const row=(await a.query('select status,cancelled_at from public.reservations where id=$1',[id])).rows[0];
    assert.equal(row.status,'cancelled');assert(row.cancelled_at);
    assert.equal(await available(),before);
    await a.query('select public.cancel_reservation($1)',[id]);
    await reserve(a,cancelSession);
    assert.equal(await available(),before-1);
  });
  await check('HU05: no se cancela una clase que ya comenzó ni se reescribe su asistencia',async()=>{
    await assert.rejects(a.query('select public.cancel_reservation($1)',[reservationId]),/CANCEL_TOO_LATE/);
    assert.equal((await admin.query('select status from public.reservations where id=$1',[reservationId])).rows[0].status,'confirmed');
  });
  await check('Asistencia: estado inválido y reserva cancelada rechazados',async()=>{
    await assert.rejects(manager.query('select public.admin_set_attendance($1,$2)',[reservationId,'inventado']),/INVALID_ATTENDANCE/);
    await admin.query("update public.reservations set status='cancelled' where id=$1",[reservationId]);
    assert((await admin.query('select cancelled_at from public.reservations where id=$1',[reservationId])).rows[0].cancelled_at,'el trigger registra la fecha de cancelación');
    await assert.rejects(manager.query('select public.admin_set_attendance($1,$2)',[reservationId,'present']),/RESERVATION_CANCELLED/);
  });
  await check('Ley 29733: sin consentimiento vigente no se guarda la reserva; aceptar la habilita',async()=>{
    const newcomer='70000000-0000-4000-8000-000000000008';
    await admin.query("insert into auth.users(id,email,email_confirmed_at) values($1,'nuevo@example.com',now())",[newcomer]);
    const c=await connectAs(newcomer);
    try{
      await assert.rejects(reserve(c,s(1),'nuevo@example.com','Nuevo Socio'),/PRIVACY_CONSENT_REQUIRED/);
      await assert.rejects(c.query("select public.accept_privacy_policy('2020-01-01')"),/PRIVACY_VERSION_OUTDATED/);
      await assert.rejects(anonymous.query("select public.accept_privacy_policy(private.current_privacy_version())"),/permission denied/);
      await c.query("select public.accept_privacy_policy(private.current_privacy_version())");
      await c.query("select public.accept_privacy_policy(private.current_privacy_version())");
      const rows=(await c.query('select * from public.privacy_consents')).rows;
      assert.equal(rows.length,1);assert.equal(rows[0].source,'reservation');assert(rows[0].accepted_at);
      assert.equal((await b.query('select * from public.privacy_consents where user_id=$1',[newcomer])).rows.length,0);
      await assert.rejects(c.query("insert into public.privacy_consents(user_id,policy_version,source) values($1,'2026-10-16','signup')",[newcomer]),/permission denied/);
      assert.ok((await reserve(c,s(1),'nuevo@example.com','Nuevo Socio')).rows[0].id);
    }finally{await c.end();}
  });
  await check('Ley 29733: la casilla de "Crear cuenta" queda registrada al crear el usuario',async()=>{
    const signup='70000000-0000-4000-8000-000000000009';
    await admin.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'registro@example.com',jsonb_build_object('privacy_version',private.current_privacy_version()))",[signup]);
    const row=(await admin.query('select source,accepted_at from public.privacy_consents where user_id=$1',[signup])).rows[0];
    assert.equal(row.source,'signup');assert(row.accepted_at);
    const forged='70000000-0000-4000-8000-00000000000a';
    await admin.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'antigua@example.com','{\"privacy_version\":\"2020-01-01\"}')",[forged]);
    assert.equal((await admin.query('select count(*)::int n from public.privacy_consents where user_id=$1',[forged])).rows[0].n,0);
  });
  await check('QR: el código corto es único, legible y sin caracteres ambiguos',async()=>{
    const {rows}=await admin.query('select code from public.reservations');
    assert(rows.length>50);
    assert(rows.every(r=>/^TG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(r.code)));
    assert.equal(new Set(rows.map(r=>r.code)).size,rows.length);
    await assert.rejects(admin.query("update public.reservations set code='TG-0OI1AB' where id=$1",[rows.length&&(await admin.query('select id from public.reservations limit 1')).rows[0].id]),/reservations_code_format/);
  });
  await check('QR: recepción registra "presente" por código, una sola vez y solo para administradores',async()=>{
    const qrSession='92000000-0000-4000-8000-000000000001';
    await admin.query(`insert into public.class_sessions(id,class_id,instructor_id,location_id,room,starts_at,duration_minutes,capacity)
      select $1,class_id,instructor_id,location_id,'Sala QR',now()+interval '2 days',45,10 from public.class_sessions where id=$2`,[qrSession,s(1)]);
    const id=(await reserve(b,qrSession,'test2@example.com','Beto Ruiz')).rows[0].id;
    const code=(await b.query('select code from public.reservations where id=$1',[id])).rows[0].code;
    await assert.rejects(manager.query('select public.admin_check_in($1)',[code]),/CHECKIN_TOO_EARLY/);
    await admin.query("update public.class_sessions set starts_at=now()+interval '10 minutes' where id=$1",[qrSession]);
    await assert.rejects(b.query('select public.admin_check_in($1)',[code]),/ADMIN_REQUIRED/);
    await assert.rejects(anonymous.query('select public.admin_check_in($1)',[code]),/permission denied/);
    await assert.rejects(manager.query('select public.admin_check_in($1)',['TG-ZZZZZZ']),/CODE_NOT_FOUND/);
    const first=(await manager.query('select public.admin_check_in($1) data',[` ${code.toLowerCase()} `])).rows[0].data;
    assert.equal(first.member_name,'Beto Ruiz');assert.equal(first.already_present,false);
    const second=(await manager.query('select public.admin_check_in($1) data',[code])).rows[0].data;
    assert.equal(second.already_present,true);
    assert.equal((await admin.query('select status from public.attendance where reservation_id=$1',[id])).rows[0].status,'present');
    assert.equal((await admin.query('select count(*)::int n from private.attendance_history where reservation_id=$1',[id])).rows[0].n,1);
    await admin.query("update public.class_sessions set starts_at=now()-interval '2 hours' where id=$1",[qrSession]);
    await assert.rejects(manager.query('select public.admin_check_in($1)',[code]),/CHECKIN_CLOSED/);
  });
  await check('Ventana de reservas: el catálogo muestra 7 días y no se reserva antes de tiempo',async()=>{
    const later='93000000-0000-4000-8000-000000000001';
    await admin.query(`insert into public.class_sessions(id,class_id,instructor_id,location_id,room,starts_at,duration_minutes,capacity)
      select $1,class_id,instructor_id,location_id,'Sala ventana',now()+interval '10 days',45,10 from public.class_sessions where id=$2`,[later,s(1)]);
    const catalog=(await anonymous.query('select id,starts_at from public.list_sessions()')).rows;
    assert(!catalog.some(r=>r.id===later),'la sesión a 10 días no debe estar en el catálogo');
    assert(catalog.every(r=>new Date(r.starts_at)<=new Date(Date.now()+7*86400000)));
    assert.equal((await anonymous.query('select id from public.list_sessions($1)',[later])).rows.length,1,'el detalle por id sigue disponible');
    await assert.rejects(reserve(a,later),/BOOKING_NOT_OPEN/);
    await admin.query("update public.class_sessions set starts_at=now()+interval '6 days' where id=$1",[later]);
    assert((await anonymous.query('select id from public.list_sessions()')).rows.some(r=>r.id===later),'al entrar en la ventana aparece en el catálogo');
    assert.ok((await reserve(a,later)).rows[0].id);
  });
  await check('HU07: recordatorios 3 horas antes, una sola vez, sin cancelados ni socios que los desactivaron',async()=>{
    const soon='94000000-0000-4000-8000-000000000001', later='94000000-0000-4000-8000-000000000002';
    for (const [id,offset,room] of [[soon,'2 hours','Sala recordatorio'],[later,'5 hours','Sala recordatorio tarde']])
      await admin.query(`insert into public.class_sessions(id,class_id,instructor_id,location_id,room,starts_at,duration_minutes,capacity)
        select $1,class_id,instructor_id,location_id,$3,now()+$2::interval,45,10 from public.class_sessions where id=$4`,[id,offset,room,s(1)]);
    const mine=(await reserve(a,soon)).rows[0].id;
    const optedOut=(await reserve(b,soon,'test2@example.com','Beto Ruiz')).rows[0].id;
    await b.query('select public.set_email_reminders(false)');
    const tooFar=(await reserve(a,later)).rows[0].id;
    const cancelled=(await reserve(manager,soon,'test3@example.com','Carla Admin')).rows[0].id;
    const demo=(await admin.query("insert into public.reservations(session_id,user_id,member_name,member_email) values($1,'60000000-0000-4000-8000-000000000001','Socio Demo 1','socio-demo-1@titan.invalid') returning id",[soon])).rows[0].id;
    await manager.query('select public.cancel_reservation($1)',[cancelled]);
    // Socios y visitantes no pueden leer ni marcar recordatorios.
    await assert.rejects(a.query('select * from public.claim_reminders(3,true)'),/permission denied/);
    await assert.rejects(anonymous.query('select * from public.claim_reminders(3,true)'),/permission denied/);
    await admin.query('set role service_role');
    try{
      const preview=(await admin.query('select * from public.claim_reminders(3,true)')).rows.map(r=>r.reservation_id);
      assert(preview.includes(mine));assert(!preview.includes(optedOut));assert(!preview.includes(tooFar));assert(!preview.includes(cancelled));assert(!preview.includes(demo),'los socios de demostración no reciben correos');
      const first=(await admin.query('select * from public.claim_reminders(3)')).rows;
      const row=first.find(r=>r.reservation_id===mine);
      assert(row);assert.equal(row.member_name,'Ana López');assert.equal(row.room,'Sala recordatorio');assert.match(row.code,/^TG-/);
      assert.equal((await admin.query('select * from public.claim_reminders(3)')).rows.filter(r=>r.reservation_id===mine).length,0,'no se envía dos veces');
      await admin.query('select public.release_reminder($1)',[mine]);
      assert((await admin.query('select * from public.claim_reminders(3,true)')).rows.some(r=>r.reservation_id===mine),'tras un fallo vuelve a quedar pendiente');
      await admin.query('select * from public.claim_reminders(3)');
    }finally{await admin.query('reset role');}
    assert.equal((await a.query('select email_reminders from public.member_preferences')).rows.length,0,'cada socio solo ve su preferencia');
    assert.equal((await b.query('select email_reminders from public.member_preferences')).rows[0].email_reminders,false);
    await admin.query("update public.class_sessions set starts_at=now()-interval '10 minutes' where id=$1",[soon]);
    const ds=(await manager.query('select reserva_id,recordatorio_enviado from public.admin_dataset() where reserva_id=$1',[mine])).rows[0];
    assert.equal(ds.recordatorio_enviado,true);
  });
  await check('US08: lista de espera en orden; al cancelar, el primero recibe la reserva sin superar el aforo',async()=>{
    const full='95000000-0000-4000-8000-000000000001';
    await admin.query(`insert into public.class_sessions(id,class_id,instructor_id,location_id,room,starts_at,duration_minutes,capacity)
      select $1,class_id,instructor_id,location_id,'Sala espera',now()+interval '2 days',45,1 from public.class_sessions where id=$2`,[full,s(1)]);
    const join=(client,email,name)=>client.query('select public.join_waitlist($1,$2,$3) id',[full,name,email]);
    const pos=async client=>(await client.query('select queue_position from public.my_waitlist() where session_id=$1',[full])).rows[0]?.queue_position;
    await assert.rejects(join(a,'test1@example.com','Ana López'),/SESSION_HAS_SEATS/);
    const held=(await reserve(a,full)).rows[0].id;
    await assert.rejects(join(a,'test1@example.com','Ana López'),/DUPLICATE_RESERVATION/);
    await assert.rejects(join(anonymous,'test1@example.com','Ana López'),/permission denied/);
    await assert.rejects(join(b,'otro@example.com','Beto Ruiz'),/EMAIL_MISMATCH/);
    await assert.rejects(join(b,'test2@example.com','Beto'),/INVALID_MEMBER/);
    const first=(await join(b,'test2@example.com','Beto Ruiz')).rows[0].id;
    await assert.rejects(join(b,'test2@example.com','Beto Ruiz'),/ALREADY_WAITING/);
    const second=(await join(manager,'test3@example.com','Carla Admin')).rows[0].id;
    assert.equal(await pos(b),1);assert.equal(await pos(manager),2);
    assert.equal((await b.query('select id from public.waitlist where session_id=$1',[full])).rows.length,1,'cada socio solo ve su entrada');
    await assert.rejects(anonymous.query('select * from public.waitlist'),/permission denied/);
    await assert.rejects(b.query("insert into public.waitlist(session_id,user_id,member_name,member_email) values($1,$2,'Beto Ruiz','test2@example.com')",[full,users[1]]),/permission denied/);
    await a.query('select public.cancel_reservation($1)',[held]);
    const active=(await admin.query("select user_id,member_name,code from public.reservations where session_id=$1 and status='confirmed'",[full])).rows;
    assert.equal(active.length,1,'se respeta el aforo de 1');assert.equal(active[0].user_id,users[1]);assert.equal(active[0].member_name,'Beto Ruiz');assert.match(active[0].code,/^TG-/);
    assert.equal((await b.query('select status from public.waitlist where id=$1',[first])).rows[0].status,'promoted');
    assert.equal(await pos(b),undefined);assert.equal(await pos(manager),1,'el siguiente avanza a la posición 1');
    await manager.query('select public.leave_waitlist($1)',[second]);
    assert.equal(await pos(manager),undefined);
    await assert.rejects(a.query('select public.leave_waitlist($1)',[first]),/WAITLIST_NOT_FOUND/);
    const third=(await join(manager,'test3@example.com','Carla Admin')).rows[0].id;
    await admin.query('update public.class_sessions set capacity=2 where id=$1',[full]);
    assert.equal((await admin.query('select status from public.waitlist where id=$1',[third])).rows[0].status,'promoted','el cupo nuevo por más capacidad va a la fila');
    assert.equal((await admin.query("select count(*)::int n from public.reservations where session_id=$1 and status='confirmed'",[full])).rows[0].n,2);
    await assert.rejects(b.query('select * from public.claim_waitlist_notices(true)'),/permission denied/);
    await admin.query('set role service_role');
    try{
      const notices=(await admin.query('select * from public.claim_waitlist_notices()')).rows.filter(r=>[first,third].includes(r.entry_id));
      assert.equal(notices.length,2);assert.match(notices[0].code,/^TG-/);assert.equal(notices.find(r=>r.entry_id===first).member_email,'test2@example.com');assert.equal(notices[0].room,'Sala espera');
      assert.equal((await admin.query('select * from public.claim_waitlist_notices()')).rows.filter(r=>r.entry_id===first).length,0,'no se avisa dos veces');
      await admin.query('select public.release_waitlist_notice($1)',[first]);
      assert((await admin.query('select * from public.claim_waitlist_notices(true)')).rows.some(r=>r.entry_id===first),'tras un fallo vuelve a quedar pendiente');
    }finally{await admin.query('reset role');}
  });
  await check('US08: en la última hora el cupo liberado no se asigna y la lista se cierra',async()=>{
    const soon='95000000-0000-4000-8000-000000000002';
    await admin.query(`insert into public.class_sessions(id,class_id,instructor_id,location_id,room,starts_at,duration_minutes,capacity)
      select $1,class_id,instructor_id,location_id,'Sala espera tarde',now()+interval '2 days',45,1 from public.class_sessions where id=$2`,[soon,s(1)]);
    const held=(await reserve(a,soon)).rows[0].id;
    const entry=(await b.query('select public.join_waitlist($1,$2,$3) id',[soon,'Beto Ruiz','test2@example.com'])).rows[0].id;
    await admin.query("update public.class_sessions set starts_at=now()+interval '30 minutes' where id=$1",[soon]);
    await a.query('select public.cancel_reservation($1)',[held]);
    assert.equal((await admin.query('select status from public.waitlist where id=$1',[entry])).rows[0].status,'waiting');
    assert.equal((await admin.query("select count(*)::int n from public.reservations where session_id=$1 and status='confirmed'",[soon])).rows[0].n,0,'el cupo queda libre para reservar directamente');
    await reserve(manager,soon,'test3@example.com','Carla Admin');
    await assert.rejects(a.query('select public.join_waitlist($1,$2,$3)',[soon,'Ana López','test1@example.com']),/WAITLIST_CLOSED/);
  });
  await check('US08: dos cancelaciones simultáneas se serializan y la fila nunca supera el aforo',async()=>{
    const pair='95000000-0000-4000-8000-000000000003';
    await admin.query(`insert into public.class_sessions(id,class_id,instructor_id,location_id,room,starts_at,duration_minutes,capacity)
      select $1,class_id,instructor_id,location_id,'Sala espera doble',now()+interval '2 days',45,2 from public.class_sessions where id=$2`,[pair,s(1)]);
    const ra=(await reserve(a,pair)).rows[0].id, rb=(await reserve(b,pair,'test2@example.com','Beto Ruiz')).rows[0].id;
    const entry=(await manager.query('select public.join_waitlist($1,$2,$3) id',[pair,'Carla Admin','test3@example.com'])).rows[0].id;
    await a.query('begin');await a.query('select public.cancel_reservation($1)',[ra]);
    let settled=false;
    const pending=b.query('select public.cancel_reservation($1)',[rb]).finally(()=>{settled=true;});
    await new Promise(r=>setTimeout(r,150));assert.equal(settled,false,'la segunda cancelación espera el bloqueo de la sesión');
    await a.query('commit');await pending;
    const active=(await admin.query("select user_id from public.reservations where session_id=$1 and status='confirmed'",[pair])).rows;
    assert.equal(active.length,1);assert.equal(active[0].user_id,users[2]);
    assert.equal((await admin.query('select status from public.waitlist where id=$1',[entry])).rows[0].status,'promoted');
  });
  await check('Panel: cancelar una sesión cancela sus reservas, cierra la lista de espera y prepara el aviso',async()=>{
    const sid='96000000-0000-4000-8000-000000000001';
    await admin.query(`insert into public.class_sessions(id,class_id,instructor_id,location_id,room,starts_at,duration_minutes,capacity)
      select $1,class_id,instructor_id,location_id,'Sala cancelable',now()+interval '2 days',45,1 from public.class_sessions where id=$2`,[sid,s(1)]);
    const rid=(await reserve(a,sid)).rows[0].id;
    await b.query('select public.join_waitlist($1,$2,$3)',[sid,'Beto Ruiz','test2@example.com']);
    assert.equal((await manager.query('select public.admin_waitlist($1) data',[sid])).rows[0].data.length,1);
    await assert.rejects(a.query('select public.admin_waitlist($1)',[sid]),/ADMIN_REQUIRED/);
    await assert.rejects(a.query('select public.admin_cancel_session($1,$2)',[sid,'Instructor enfermo']),/ADMIN_REQUIRED/);
    await assert.rejects(manager.query('select public.admin_cancel_session($1,$2)',[sid,'x']),/INVALID_REASON/);
    assert.equal((await manager.query('select public.admin_cancel_session($1,$2) n',[sid,'Instructor enfermo'])).rows[0].n,1);
    const r=(await a.query('select status,cancelled_by_gym,cancelled_at from public.reservations where id=$1',[rid])).rows[0];
    assert.equal(r.status,'cancelled');assert.equal(r.cancelled_by_gym,true);assert(r.cancelled_at);
    assert.equal((await manager.query('select public.admin_waitlist($1) data',[sid])).rows[0].data.length,0,'la lista de espera se cierra');
    const detail=(await anonymous.query('select cancelled,cancel_reason from public.list_sessions($1)',[sid])).rows[0];
    assert.equal(detail.cancelled,true);assert.equal(detail.cancel_reason,'Instructor enfermo');
    assert(!(await anonymous.query('select id from public.list_sessions()')).rows.some(x=>x.id===sid),'no aparece en el catálogo');
    await assert.rejects(reserve(b,sid,'test2@example.com','Beto Ruiz'),/SESSION_CLOSED/);
    await assert.rejects(manager.query('select public.admin_cancel_session($1,$2)',[sid,'Otra vez']),/SESSION_CANCELLED/);
    await assert.rejects(manager.query('select public.admin_save_session($1,$2)',[{class_id:'40000000-0000-4000-8000-000000000001',instructor_id:'30000000-0000-4000-8000-000000000001',location_id:'20000000-0000-4000-8000-000000000001',room:'Sala cancelable',starts_at:new Date(Date.now()+3*86400000).toISOString(),duration_minutes:45,capacity:5,published:true},sid]),/SESSION_CANCELLED/);
    await admin.query('set role service_role');
    try{
      const notices=(await admin.query('select * from public.claim_cancellation_notices()')).rows;
      assert(notices.some(n=>n.reservation_id===rid&&n.cancel_reason==='Instructor enfermo'));
      assert.equal((await admin.query('select * from public.claim_cancellation_notices()')).rows.filter(n=>n.reservation_id===rid).length,0,'el aviso no se repite');
    }finally{await admin.query('reset role');}
    await assert.rejects(a.query('select * from public.claim_cancellation_notices(true)'),/permission denied/);
  });
  await check('Panel: sesiones semanales hasta una fecha, omitiendo las salas ocupadas',async()=>{
    const start=new Date(Date.now()+3*86400000); start.setUTCSeconds(0,0);
    const base={class_id:'40000000-0000-4000-8000-000000000002',instructor_id:'30000000-0000-4000-8000-000000000002',location_id:'20000000-0000-4000-8000-000000000001',room:'Sala semanal',starts_at:start.toISOString(),duration_minutes:45,capacity:12,published:true};
    await manager.query('select public.admin_save_session($1)',[{...base,starts_at:new Date(start.getTime()+14*86400000).toISOString()}]);
    const until=new Date(start.getTime()+28*86400000).toISOString().slice(0,10);
    const result=(await manager.query('select public.admin_create_recurring_sessions($1,$2) r',[base,until])).rows[0].r;
    assert.equal(result.created,4);assert.equal(result.skipped,1);
    assert.equal((await admin.query("select count(*)::int n from public.class_sessions where room='Sala semanal'")).rows[0].n,5);
    await assert.rejects(manager.query('select public.admin_create_recurring_sessions($1,$2)',[base,'2030-01-01']),/INVALID_RECURRENCE/);
    await assert.rejects(a.query('select public.admin_create_recurring_sessions($1,$2)',[base,until]),/ADMIN_REQUIRED/);
  });
  await check('Panel: instructores, datos de la vista Hoy y correo del responsable en el historial',async()=>{
    const id=(await manager.query("select public.admin_save_instructor('{\"name\":\"Rosa Paredes\",\"bio\":\"Pilates y movilidad.\"}') id")).rows[0].id;
    await manager.query("select public.admin_save_instructor('{\"name\":\"Rosa Paredes Díaz\",\"bio\":\"\"}',$1)",[id]);
    assert.equal((await admin.query('select name from public.instructors where id=$1',[id])).rows[0].name,'Rosa Paredes Díaz');
    await assert.rejects(manager.query("select public.admin_save_instructor('{\"name\":\"Ro\"}')"),/INVALID_INSTRUCTOR/);
    await assert.rejects(a.query("select public.admin_save_instructor('{\"name\":\"Intruso Total\"}')"),/ADMIN_REQUIRED/);
    const snap=(await manager.query('select public.admin_snapshot() data')).rows[0].data;
    assert(snap.sessions.every(x=>typeof x.waiting==='number'&&typeof x.present==='number'));
    const past=snap.sessions.find(x=>x.present>0);
    assert(past,'una sesión con asistencia registrada informa sus presentes');
    const roster=(await manager.query('select public.admin_roster($1) data',[past.id])).rows[0].data;
    assert(roster.some(m=>m.history.some(h=>h.recorded_by_email==='test3@example.com')));
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
