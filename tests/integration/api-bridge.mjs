// Exclusivo de pruebas. PostgreSQL real + protocolo REST mínimo para probar el cliente.
// Auth usa identidades de fixture; no suplanta ni se entrega como Supabase Auth.
import { createServer } from 'node:http';
import { createHarness } from './harness.mjs';
const harness = await createHarness();
// Administrador exclusivamente en el clúster de pruebas; nunca en el seed productivo.
await harness.admin.query('insert into private.administrators(user_id) values($1)',[harness.users[2]]);
const pastSession='90000000-0000-4000-8000-000000000001';
await harness.admin.query(`insert into public.class_sessions(id,class_id,instructor_id,location_id,room,starts_at,duration_minutes,capacity)
  select $1,class_id,instructor_id,location_id,'Sala asistencia de pruebas',now()-interval '1 hour',45,20 from public.class_sessions limit 1`,[pastSession]);
await harness.admin.query(`insert into public.reservations(session_id,user_id,member_name,member_email)
  values($1,'60000000-0000-4000-8000-000000000001','Alumno de asistencia','socio-demo-1@titan.invalid')`,[pastSession]);
const initialClasses=(await harness.admin.query('select id from public.classes')).rows.map(r=>r.id);
const initialSessions=(await harness.admin.query('select id from public.class_sessions')).rows.map(r=>r.id);
const initialInstructors=(await harness.admin.query('select id from public.instructors')).rows.map(r=>r.id);
const initialCapacity=(await harness.admin.query('select id,capacity from public.class_sessions')).rows;
const users = harness.users.map((id,i)=>({id,aud:'authenticated',role:'authenticated',email:`test${i+1}@example.com`,email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[],created_at:new Date().toISOString()}));
function identify(req) {
  try { const token = req.headers.authorization?.replace(/^Bearer /,''); const sub=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub; return users.find(u=>u.id===sub); } catch { return null; }
}
const server = createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:5173');
  res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,content-profile,accept-profile,x-client-info,prefer,accept,x-supabase-api-version');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');
  res.setHeader('Content-Type','application/json');
  if (req.method==='OPTIONS') {res.writeHead(204);res.end();return;}
  const url = new URL(req.url,'http://127.0.0.1:54331');
  if(url.pathname==='/health'){res.end('{"ok":true}');return;}
  if(url.pathname==='/auth/v1/settings'){res.end('{"external":{"google":false,"email":true}}');return;}
  if(url.pathname==='/auth/v1/user'){const user=identify(req);res.writeHead(user?200:401);res.end(JSON.stringify(user||{msg:'No fixture identity'}));return;}
  if(url.pathname==='/auth/v1/logout'){res.writeHead(204);res.end();return;}
  if(url.pathname==='/__test/reset' && req.method==='POST'){
    await harness.admin.query('delete from private.attendance_history');await harness.admin.query('delete from public.attendance');
    await harness.admin.query('delete from public.waitlist');
    await harness.admin.query('delete from public.reservations where user_id=any($1::uuid[])',[harness.users]);
    await harness.admin.query('delete from public.class_sessions where not(id=any($1::uuid[]))',[initialSessions]);
    await harness.admin.query('update public.class_sessions set cancelled_at=null,cancel_reason=null where cancelled_at is not null');
    await harness.admin.query('update public.class_sessions s set capacity=v.capacity from unnest($1::uuid[],$2::int[]) v(id,capacity) where s.id=v.id and s.capacity<>v.capacity',[initialCapacity.map(r=>r.id),initialCapacity.map(r=>r.capacity)]);
    await harness.admin.query('delete from public.instructors where not(id=any($1::uuid[]))',[initialInstructors]);
    await harness.admin.query('delete from public.member_preferences');
    await harness.admin.query('delete from public.classes where not(id=any($1::uuid[]))',[initialClasses]);
    res.end('{"ok":true}');return;
  }
  let client;
  try {
    client=await harness.connectAs(identify(req)?.id);
    let data;
    if(req.method==='POST' && url.pathname.startsWith('/rest/v1/rpc/')){
      let body='';for await(const chunk of req)body+=chunk;
      const args=JSON.parse(body||'{}');
      if(url.pathname.endsWith('/list_sessions'))data=(await client.query('select * from public.list_sessions($1)',[args.p_session_id||null])).rows;
      else if(url.pathname.endsWith('/reserve_session'))data=(await client.query('select public.reserve_session($1,$2,$3) id',[args.p_session_id,args.p_member_name,args.p_email])).rows[0].id;
      else if(url.pathname.endsWith('/is_admin'))data=(await client.query('select public.is_admin() value')).rows[0].value;
      else if(url.pathname.endsWith('/admin_snapshot'))data=(await client.query('select public.admin_snapshot() value')).rows[0].value;
      else if(url.pathname.endsWith('/admin_roster'))data=(await client.query('select public.admin_roster($1) value',[args.p_session_id])).rows[0].value;
      else if(url.pathname.endsWith('/admin_save_class'))data=(await client.query('select public.admin_save_class($1,$2) value',[args.p_data,args.p_id||null])).rows[0].value;
      else if(url.pathname.endsWith('/admin_save_session'))data=(await client.query('select public.admin_save_session($1,$2) value',[args.p_data,args.p_id||null])).rows[0].value;
      else if(url.pathname.endsWith('/admin_set_attendance')){await client.query('select public.admin_set_attendance($1,$2)',[args.p_reservation_id,args.p_status]);data=null;}
      else if(url.pathname.endsWith('/cancel_reservation')){await client.query('select public.cancel_reservation($1)',[args.p_reservation_id]);data=null;}
      else if(url.pathname.endsWith('/admin_dataset'))data=(await client.query('select * from public.admin_dataset()')).rows;
      else if(url.pathname.endsWith('/accept_privacy_policy')){await client.query('select public.accept_privacy_policy($1)',[args.p_version]);data=null;}
      else if(url.pathname.endsWith('/admin_check_in'))data=(await client.query('select public.admin_check_in($1) value',[args.p_code])).rows[0].value;
      else if(url.pathname.endsWith('/set_email_reminders')){await client.query('select public.set_email_reminders($1)',[args.p_enabled]);data=null;}
      else if(url.pathname.endsWith('/join_waitlist'))data=(await client.query('select public.join_waitlist($1,$2,$3) id',[args.p_session_id,args.p_member_name,args.p_email])).rows[0].id;
      else if(url.pathname.endsWith('/leave_waitlist')){await client.query('select public.leave_waitlist($1)',[args.p_entry_id]);data=null;}
      else if(url.pathname.endsWith('/my_waitlist'))data=(await client.query('select * from public.my_waitlist()')).rows;
      else if(url.pathname.endsWith('/admin_waitlist'))data=(await client.query('select public.admin_waitlist($1) value',[args.p_session_id])).rows[0].value;
      else if(url.pathname.endsWith('/admin_cancel_session'))data=(await client.query('select public.admin_cancel_session($1,$2) value',[args.p_session_id,args.p_reason])).rows[0].value;
      else if(url.pathname.endsWith('/admin_create_recurring_sessions'))data=(await client.query('select public.admin_create_recurring_sessions($1,$2) value',[args.p_data,args.p_until])).rows[0].value;
      else if(url.pathname.endsWith('/admin_save_instructor'))data=(await client.query('select public.admin_save_instructor($1,$2) value',[args.p_data,args.p_id||null])).rows[0].value;
      else throw new Error('Unknown test RPC');
    }else if(req.method==='GET' && url.pathname==='/rest/v1/privacy_consents'){
      const version=url.searchParams.get('policy_version')?.replace(/^eq\./,'');
      data=(await client.query('select accepted_at,source from public.privacy_consents where policy_version=$1',[version])).rows;
    }else if(req.method==='GET' && url.pathname==='/rest/v1/member_preferences'){
      data=(await client.query('select email_reminders from public.member_preferences')).rows;
    }else if(req.method==='GET' && url.pathname==='/rest/v1/locations'){
      data=(await client.query('select id,name,address from public.locations order by name')).rows;
    }else if(req.method==='GET' && url.pathname==='/rest/v1/reservations'){
      const id=url.searchParams.get('id')?.replace(/^eq\./,'');
      // Embedding de PostgREST (session:class_sessions(...)): mismo JSON anidado y mismo RLS del usuario.
      const embed=url.searchParams.get('select')?.includes('session:');
      data=(await client.query(`select r.id,r.code,r.session_id,r.member_name,r.member_email,r.status,r.cancelled_by_gym,r.created_at${embed?`,
        case when s.id is null then null else json_build_object('starts_at',s.starts_at,'duration_minutes',s.duration_minutes,'room',s.room,'cancel_reason',s.cancel_reason,
          'class',json_build_object('name',c.name),'instructor',json_build_object('name',i.name)) end session`:''}
        from public.reservations r
        left join public.class_sessions s on s.id=r.session_id
        left join public.classes c on c.id=s.class_id
        left join public.instructors i on i.id=s.instructor_id
        where ($1::uuid is null or r.id=$1) order by r.created_at desc`,[id||null])).rows;
    }else {res.writeHead(404);res.end('{}');return;}
    res.end(JSON.stringify(data));
  }catch(e){res.writeHead(400);res.end(JSON.stringify({code:e.code||'TEST_ERROR',message:e.message}));}
  finally {if(client)await client.end();}
});
server.listen(54331,'127.0.0.1',()=>console.log('Puente REST de pruebas en 127.0.0.1:54331; PostgreSQL real, auth de fixture.'));
let closing=false;
async function shutdown(){if(closing)return;closing=true;server.close();await harness.close();process.exit();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
