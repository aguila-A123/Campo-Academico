import {deadlineTime} from './deadline.js';
export function examTone(end,now){const remaining=end-now;return remaining<=0?'past':remaining<=86400000?'urgent':remaining<=259200000?'soon':'calm';}
export function examInstant(value){
 const instant=deadlineTime(value);
 if(!Number.isFinite(instant))throw Error('Introduce una fecha válida.');
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant).map(p=>[p.type,p.value]));
 if(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`!==value)throw Error('Esa hora no existe por el cambio de horario. Elige otra hora.');
 return new Date(instant).toISOString();
}
