import ExcelJS from 'exceljs';
import {Client} from 'pg';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {cleanImportedName,importedAmount,importedDate,importedProcedure,importedTime,nameKey} from '../src/lib/history-import.ts';
import {todayISO,conflicts} from '../src/lib/model.ts';
import {commandSchema} from '../src/lib/commands.ts';

const [action,source,output,envFile,aliasesFile]=process.argv.slice(2);
if(!['prepare','apply'].includes(action)||!source||!envFile)throw new Error('Use prepare ARQUIVO.xlsx PLANO.json ENV ou apply PLANO.json RELATORIO.json ENV.');
process.loadEnvFile(envFile);
const aliases=aliasesFile?JSON.parse(await readFile(aliasesFile,'utf8')):{};
const address=new URL(process.env.DIRECT_URL);
const client=new Client({host:address.hostname,port:Number(address.port||5432),user:decodeURIComponent(address.username),password:decodeURIComponent(address.password),database:address.pathname.slice(1),ssl:{rejectUnauthorized:true,ca:await readFile(new URL('../supabase/prod-ca-2021.crt',import.meta.url),'utf8')},connectionTimeoutMillis:15000,statement_timeout:30000});
const hash=value=>createHash('sha256').update(value).digest('hex');
async function writePrivate(file,data){await writeFile(file,JSON.stringify(data,null,2),{mode:0o600});}
async function workspace(owner){await client.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);return (await client.query('select public.nail_read_workspace() as workspace')).rows[0].workspace;}
function value(cell){const v=cell.value;return v&&typeof v==='object'&&'result'in v?v.result:v;}
try{
 await client.connect();
 const owner=(await client.query('select id from auth.users where lower(email)=lower($1)',[process.env.SUPABASE_OWNER_EMAIL])).rows[0]?.id;
 if(!owner)throw new Error('Conta autorizada não encontrada.');
 if(action==='prepare'){
  const sourceHash=hash(await readFile(source));const book=new ExcelJS.Workbook();await book.xlsx.readFile(source);
  const sheet=book.getWorksheet('Agenda 2026');
  if(!sheet||value(sheet.getCell('A2'))!=='Data'||value(sheet.getCell('D2'))!=='Evento')throw new Error('Formato diferente da agenda histórica.');
  const current=await workspace(owner);const data=current.data;
  const rows=[];
  for(let n=3;n<=sheet.rowCount;n++){
   const event=value(sheet.getCell(n,4));if(!event)continue;
   if(typeof event!=='string')throw new Error(`Evento inválido na linha ${n}.`);
   const date=importedDate(value(sheet.getCell(n,1))),time=importedTime(value(sheet.getCell(n,3))),amount=importedAmount(value(sheet.getCell(n,5)));
   if(!/^2026-(0[6-9]|1[01])-/.test(date))throw new Error(`Data fora do período autorizado na linha ${n}.`);
   const cleaned=cleanImportedName(event);
   rows.push({row:n,date,time,amount,event,name:aliases[nameKey(cleaned)]??cleaned});
  }
  const table=(await client.query("select to_regclass('nail_private.import_rows') is not null as present")).rows[0].present;
  const imported=table?(await client.query('select source_row,record_hash from nail_private.import_rows where owner_id=$1 and source_hash=$2',[owner,sourceHash])).rows:[];
  const recorded=new Map(imported.map(r=>[r.source_row,r.record_hash]));
  const clients=new Map();for(const c of data.clients){const key=nameKey(c.name);if(clients.has(key))throw new Error(`Há clientes com nomes equivalentes: ${c.name}. Revise antes de importar.`);clients.set(key,c);}
  const newClients=[],newProcedures=[],entries=[],existing=[],overlaps=[],alreadyImported=[];
  const reusedClients=new Set();
  function procedure(key){
   const cache=newProcedures.find(p=>p.importKey===key);if(cache)return cache;
   const exact=data.procedures.find(p=>key==='alignment'?nameKey(p.name).startsWith('alinhamento'):key==='extension'?nameKey(p.name).startsWith('alongamento'):key==='cuticle'?nameKey(p.name)==='cutilagem russa':key==='extra'?nameKey(p.name)==='extra importado':nameKey(p.name)==='procedimento a definir');
   if(exact)return exact;
   const cuticleDuration=data.procedures.find(p=>nameKey(p.name).startsWith('cutilagem russa'))?.duration??60;
   const defaults={alignment:['Alinhamento de lâmina',12000,160],extension:['Alongamento',14000,180],cuticle:['Cutilagem Russa',0,cuticleDuration],extra:['Extra importado',0,5],undefined:['Procedimento a definir',0,90]}[key];
   const p={id:randomUUID(),name:defaults[0],description:'Cadastro auxiliar da importação histórica. Pode ser ajustado depois.',price:defaults[1],duration:defaults[2],active:false,importKey:key};newProcedures.push(p);return p;
  }
  const seen=new Set();
  for(const row of rows){
   const recordHash=hash(JSON.stringify(row));
   if(recorded.has(row.row)){if(recorded.get(row.row)!==recordHash)throw new Error('Uma linha já importada tem conteúdo diferente.');alreadyImported.push(row.row);continue;}
   const key=nameKey(row.name);let c=clients.get(key);
   if(!c){c={id:randomUUID(),name:row.name,phone:'',notes:'Cadastro criado na importação da agenda 2026. Complete o telefone quando possível.',color:'sand'};clients.set(key,c);newClients.push(c);}else if(data.clients.some(v=>v.id===c.id))reusedClients.add(c.id);
   const identity=`${c.id}|${row.date}|${row.time??'unknown'}`;
   if(seen.has(identity))throw new Error(`Cliente repetida no mesmo dia e horário na linha ${row.row}. Revise antes de importar.`);seen.add(identity);
   const matched=data.appointments.filter(a=>a.clientId===c.id&&a.date===row.date&&(row.time?a.time===row.time&&!a.timeUnknown:a.timeUnknown));
   if(matched.length>1)throw new Error(`Há mais de um agendamento existente para a linha ${row.row}.`);
   if(matched.length){const a=matched[0];existing.push({sourceRow:row.row,recordHash,appointmentId:a.id,name:c.name,date:row.date,time:row.time,sourceReceived:row.amount,existingPrice:a.price,existingReceived:data.payments.filter(p=>p.appointmentId===a.id).reduce((t,p)=>t+p.amount,0)});continue;}
   const classification=importedProcedure(row.amount),base=procedure(classification.base),extra=classification.extra?procedure('extra'):null;
   const snapshot=(p,price)=>({id:p.id,name:p.name,price,duration:p.duration});
   const basePrice=classification.base==='alignment'?12000:classification.base==='extension'?14000:row.amount??0;
   const a={id:randomUUID(),clientId:c.id,date:row.date,time:row.time??'00:00',timeUnknown:!row.time,duration:base.duration,price:row.amount??0,pricePending:row.amount===null,procedures:[snapshot(base,basePrice),...(extra?[snapshot(extra,classification.extra)]:[])],notes:`Importado da agenda 2026, linha ${row.row}. Registro original: ${row.event}. Duração baseada no cadastro atual${classification.base==='undefined'?' (estimativa de 90 minutos)':''}. ${!row.time?'Horário não informado na origem. ':''}${row.amount===null?'Procedimento e valor a definir. ':row.amount>0?'Valor recebido na data do atendimento; forma de pagamento não informada na origem. ':'Atendimento gratuito.'}`,status:row.date<todayISO()?'completed':'scheduled',overlapConfirmed:false};
   const clashes=conflicts({...data,appointments:[...data.appointments,...entries.map(e=>e.appointment)]},a);
   if(clashes.length){a.overlapConfirmed=true;overlaps.push({sourceRow:row.row,name:c.name,date:a.date,time:row.time,with:clashes.map(x=>({name:[...data.clients,...newClients].find(c=>c.id===x.clientId)?.name,time:x.time,existing:data.appointments.some(v=>v.id===x.id)}))});}
   commandSchema.parse({type:'appointment.save',appointment:a});
   const payment=row.amount>0?{id:randomUUID(),appointmentId:a.id,amount:row.amount,date:row.date,method:'Não informado',kind:'balance'}:null;
   entries.push({sourceRow:row.row,recordHash,appointment:a,payment});
  }
  const allAppointments=[...data.appointments,...entries.map(e=>e.appointment)];
  for(const e of entries){if(conflicts({...data,appointments:allAppointments},e.appointment).length)e.appointment.overlapConfirmed=true;}
  const summary={sourceRows:rows.length,sourceTotalCents:rows.reduce((s,r)=>s+(r.amount??0),0),newClients:newClients.length,reusedClients:reusedClients.size,newProcedures:newProcedures.map(p=>p.name),newAppointments:entries.length,existingAppointmentsPreserved:existing.length,alreadyImported:alreadyImported.length,newPayments:entries.filter(e=>e.payment).length,newReceivedCents:entries.reduce((s,e)=>s+(e.payment?.amount??0),0),pricePending:entries.filter(e=>e.appointment.pricePending).length,freeAppointments:entries.filter(e=>!e.appointment.pricePending&&e.appointment.price===0).length,unknownTimes:entries.filter(e=>e.appointment.timeUnknown).length,overlapRows:entries.filter(e=>e.appointment.overlapConfirmed).length,dates:[rows[0]?.date,rows.at(-1)?.date]};
  const plan={version:1,source:path.resolve(source),sourceName:path.basename(source),sourceHash,owner,revision:current.revision,createdAt:new Date().toISOString(),summary,newClients,newProcedures,entries,existing,alreadyImported,overlaps};
  await writePrivate(output,plan);console.log(JSON.stringify({summary,existing,overlaps},null,2));
 }else{
  const plan=JSON.parse(await readFile(source,'utf8'));
  if(plan.version!==1||plan.owner!==owner||hash(await readFile(plan.source))!==plan.sourceHash)throw new Error('O plano não corresponde ao arquivo ou à conta.');
  await client.query('begin');
  const account=(await client.query('select revision from public.nail_accounts where owner_id=$1 and active for update',[owner])).rows[0];
  if(!account||Number(account.revision)!==plan.revision)throw new Error('Os cadastros mudaram desde a conferência. Prepare o plano novamente.');
  const before=await workspace(owner);await writePrivate(output+'.before.json',before);
  await client.query('insert into public.nail_clients(owner_id,id,name,phone,notes,color) select $1,x.id,x.name,x.phone,x.notes,x.color from jsonb_to_recordset($2::jsonb) as x(id uuid,name text,phone text,notes text,color text)',[owner,JSON.stringify(plan.newClients)]);
  await client.query('insert into public.nail_procedures(owner_id,id,name,description,price,duration,active) select $1,x.id,x.name,x.description,x.price,x.duration,x.active from jsonb_to_recordset($2::jsonb) as x(id uuid,name text,description text,price integer,duration integer,active boolean)',[owner,JSON.stringify(plan.newProcedures)]);
  await client.query('insert into public.nail_appointments(owner_id,id,client_id,appointment_date,start_time,duration,procedures,price,notes,status,overlap_confirmed,price_pending,time_unknown) select $1,x.id,x."clientId",x.date,x.time,x.duration,x.procedures,x.price,x.notes,x.status,x."overlapConfirmed",x."pricePending",x."timeUnknown" from jsonb_to_recordset($2::jsonb) as x(id uuid,"clientId" uuid,date date,time time,duration integer,procedures jsonb,price integer,notes text,status text,"overlapConfirmed" boolean,"pricePending" boolean,"timeUnknown" boolean)',[owner,JSON.stringify(plan.entries.map(e=>e.appointment))]);
  await client.query('insert into public.nail_payments(owner_id,id,appointment_id,amount,payment_date,method,kind) select $1,x.id,x."appointmentId",x.amount,x.date,x.method,x.kind from jsonb_to_recordset($2::jsonb) as x(id uuid,"appointmentId" uuid,amount integer,date date,method text,kind text)',[owner,JSON.stringify(plan.entries.filter(e=>e.payment).map(e=>e.payment))]);
  const tracked=[...plan.entries.map(e=>({...e,appointmentId:e.appointment.id})),...plan.existing].map(e=>({sourceRow:e.sourceRow,recordHash:e.recordHash,appointmentId:e.appointmentId}));
  await client.query('insert into nail_private.import_rows(owner_id,source_hash,source_row,source_name,record_hash,appointment_id) select $1,$2,x."sourceRow",$3,x."recordHash",x."appointmentId" from jsonb_to_recordset($4::jsonb) as x("sourceRow" integer,"recordHash" text,"appointmentId" uuid)',[owner,plan.sourceHash,plan.sourceName,JSON.stringify(tracked)]);
  if(plan.entries.length||plan.newClients.length||plan.newProcedures.length)await client.query('update public.nail_accounts set revision=revision+1 where owner_id=$1',[owner]);
  const after=await workspace(owner);
  if(after.data.appointments.length-before.data.appointments.length!==plan.entries.length||after.data.payments.length-before.data.payments.length!==plan.summary.newPayments||after.data.payments.reduce((s,p)=>s+p.amount,0)-before.data.payments.reduce((s,p)=>s+p.amount,0)!==plan.summary.newReceivedCents)throw new Error('Os totais não conferem; importação revertida.');
  await client.query('commit');await writePrivate(output,{committed:true,summary:plan.summary,after:{clients:after.data.clients.length,appointments:after.data.appointments.length,payments:after.data.payments.length,revision:after.revision}});console.log(JSON.stringify({committed:true,summary:plan.summary}));
 }
}catch(e){try{await client.query('rollback')}catch{};console.error(e.code?`Falha (${e.code}). Nenhuma credencial foi exibida.`:e.message);process.exitCode=1;}finally{await client.end();}
