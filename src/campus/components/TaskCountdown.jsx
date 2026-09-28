import {memo,useEffect,useState} from 'react';
import {deadlineTime,countdown} from '../lib/deadline.js';
export default memo(function TaskCountdown({deadline}){
  const end=deadlineTime(deadline);
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{setNow(Date.now());if(!Number.isFinite(end)||end<=Date.now())return;const id=setInterval(()=>{const time=Date.now();setNow(time);if(time>=end)clearInterval(id);},1000);return()=>clearInterval(id);},[end]);
  const text=countdown(end,now);
  return text?<strong className="task-countdown" role="timer" aria-label={`Tiempo hasta el cierre: ${text}`} title="Tiempo hasta el cierre · Cantabria (Europe/Madrid)">{text}</strong>:null;
});
