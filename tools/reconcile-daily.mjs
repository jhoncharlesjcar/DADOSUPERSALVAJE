// Schedule once daily after the provider closes its previous day's report (America/Lima).
// Deployment scheduling is external; this script creates no automation or cloud resource.
const base=process.env.APP_SERVER_URL,secret=process.env.CONCILIACION_CRON_SECRET,provider=process.env.PAYMENT_PROVIDER;
try {
  if(!base || !secret || secret.length<32 || !provider) throw new Error('Configuración incompleta');
  const url=new URL('/api/pagos/conciliacion',base);
  if(url.protocol!=='https:' && !['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('HTTPS requerido');
  const yesterday=new Date(Date.now()-86400000);
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(yesterday).map(p=>[p.type,p.value]));
  const date=process.argv[2] || `${parts.year}-${parts.month}-${parts.day}`;
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`},body:JSON.stringify({pasarela:provider,fecha:date}),signal:AbortSignal.timeout(60000)});
  if(!response.ok) throw new Error('Conciliación no completada');
  const result=await response.json();
  console.log(JSON.stringify({date,provider,expected:result.expected,received:result.received,difference:result.difference,mismatches:result.differences?.length??0}));
  if(result.differences?.length) process.exitCode=2;
} catch {console.error('Conciliación diaria pendiente o fallida; revisar configuración/proveedor en el servidor.');process.exitCode=1;}
