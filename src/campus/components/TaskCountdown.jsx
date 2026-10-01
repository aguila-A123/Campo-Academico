import {memo,useEffect,useState} from 'react';
import {deadlineTime,countdown} from '../lib/deadline.js';
export default memo(function TaskCountdown({opening,deadline}){
  const start=deadlineTime(opening);
  const end=deadlineTime(deadline);
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{setNow(Date.now());if((!Number.isFinite(start)||start<=Date.now())&&(!Number.isFinite(end)||end<=Date.now()))return;const id=setInterval(()=>{const time=Date.now();setNow(time);if((!Number.isFinite(start)||time>=start)&&(!Number.isFinite(end)||time>=end))clearInterval(id);},1000);return()=>clearInterval(id);},[start,end]);
  const text=Number.isFinite(start)&&now<start?`Abre en ${countdown(start,now)}`:countdown(end,now);
  return text?<strong className="task-countdown" role="timer" aria-label={`Estado de la tarea: ${text}`} title="Tiempo de apertura y cierre · Cantabria (Europe/Madrid)">{text}</strong>:null;
});
