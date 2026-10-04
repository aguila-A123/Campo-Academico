const zone='Europe/Madrid';
function wallTime(value){
  const text=String(value).trim().replace(' ','T').replace(/(?:Z|[+-]\d{2}(?::?\d{2})?)$/i,'');
  const m=text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/);
  if(!m)return NaN;
  const wall=Date.UTC(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0),+(m[6]||0));
  let instant=wall;
  for(let i=0;i<3;i++){
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
    const represented=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
    instant=wall-(represented-instant);
  }
  return instant;
}
// Offset-bearing timestamps are instants; timezone-less database timestamps are Cantabria wall time.
export function deadlineTime(value,{assumeWallTime=false}={}){
  if(!value)return NaN;
  const text=String(value).trim();
  if(assumeWallTime)return wallTime(text);
  if(/(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(text)&&/[T ]\d{2}:/.test(text))return Date.parse(text.replace(' ','T').replace(/([+-]\d{2})$/,'$1:00'));
  return wallTime(text);
}
export function dateLabel(value,options){const t=deadlineTime(value,options);return Number.isFinite(t)?new Intl.DateTimeFormat('es-ES',{timeZone:zone,dateStyle:'short',timeStyle:'short'}).format(t):String(value||'');}
export function countdown(end,now){
  if(!Number.isFinite(end))return null;
  const seconds=Math.max(0,Math.ceil((end-now)/1000));
  if(!seconds)return 'Finalizada';
  const days=Math.floor(seconds/86400);
  const clock=[Math.floor(seconds%86400/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
  return `${days?days+' d · ':''}${clock}`;
}
