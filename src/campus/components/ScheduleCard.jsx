import { useEffect, useState } from 'react';
import { getClassState } from '../lib/schedule.js';
import Icon from './Icon.jsx';

const clock = time => {const [h,m]=time.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;};
const duration = seconds => {const s=Math.max(0,Math.floor(seconds));return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(n=>String(n).padStart(2,'0')).join(':');};

export default function ScheduleCard({visible}) {
  const [schedule,setSchedule]=useState(null);
  const [error,setError]=useState(false);
  const [docked,setDocked]=useState(false);
  const [tick,setTick]=useState(()=>Date.now());
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/horario.json',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Horario no disponible');return r.json();}).then(setSchedule).catch(e=>{if(e.name!=='AbortError')setError(true);});
    return ()=>controller.abort();
  },[]);
  useEffect(()=>{const timer=setInterval(()=>setTick(Date.now()),1000);return ()=>clearInterval(timer);},[]);
  const now=new Date(tick);
  const state=schedule?getClassState(schedule,now):null;
  const subject=state?.active?schedule.subjects[state.active.subject]:null;
  const next=state?.next;
  const day=schedule?new Intl.DateTimeFormat('es-ES',{timeZone:schedule.timezone,weekday:'long'}).format(now):'Horario';
  return <section className={`class-card${docked?' is-docked':''}`} hidden={!visible} aria-label="Clase actual y siguiente">
    <button className="class-tab" type="button" aria-label={docked?'Mostrar tarjeta de horario':'Ocultar tarjeta de horario'} aria-expanded={!docked} aria-controls="class-content" onClick={()=>setDocked(v=>!v)}><Icon name="horarios"/><span>{day.charAt(0).toUpperCase()+day.slice(1)}</span></button>
    <div id="class-content" inert={docked}>
      <h2>{error?'No se pudo cargar el horario':!schedule?'Cargando horario…':subject?.name||'En espera del horario de clase'}</h2>
      {subject && <><p className="class-teacher">( {subject.teacher} )</p><div className="class-timing"><span>{clock(state.active.start)}</span><progress max="1" value={state.progress} aria-label="Progreso de la clase" aria-valuetext={`${Math.round(state.progress*100)} % de la clase transcurrido`}/><span>{clock(state.active.end)}</span></div></>}
      {(subject||(next?.daysAway===0)) && <p className="class-countdown" aria-label={subject?'Tiempo restante de clase':'Tiempo hasta la próxima clase'}>{duration(state.remaining||0)}</p>}
      <div className="class-next"><span className="class-next-label">Siguiente</span><div className="class-next-row"><span>{error?'Recarga la página para volver a intentarlo':next?schedule.subjects[next.subject].name:schedule?'Sin clases programadas':''}</span>{next&&<span className="class-next-duration" title="Horas lectivas de 50 minutos">{next.teachingPeriods}H</span>}</div></div>
    </div>
  </section>;
}

