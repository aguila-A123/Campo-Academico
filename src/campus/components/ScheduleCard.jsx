import { useEffect, useState } from 'react';
import schedule from '../../../public/horario.json';
import { getClassState } from '../lib/schedule.js';
import Icon from './Icon.jsx';

const clock = time => { const [h,m]=time.split(':').map(Number); return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
const duration = seconds => { const s=Math.max(0,Math.floor(seconds)); return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(n=>String(n).padStart(2,'0')).join(':'); };

export default function ScheduleCard({visible}) {
  const [docked,setDocked]=useState(false);
  const [tick,setTick]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setTick(Date.now()),1000);return ()=>clearInterval(timer);},[]);
  const now=new Date(tick);
  const state=getClassState(schedule,now);
  const subject=state.active?schedule.subjects[state.active.subject]:null;
  const interval=state.recess||state.active;
  const next=state.showNext?state.next:null;
  const day=new Intl.DateTimeFormat('es-ES',{timeZone:schedule.timezone,weekday:'long'}).format(now);
  return <section className={`class-card${docked?' is-docked':''}${state.recess?' is-recess':''}`} hidden={!visible} aria-label="Clase actual y siguiente">
    <button className="class-tab" type="button" aria-label={docked?'Mostrar tarjeta de horario':'Ocultar tarjeta de horario'} aria-expanded={!docked} aria-controls="class-content" onClick={()=>setDocked(v=>!v)}><Icon name="horarios"/><span>{day.charAt(0).toUpperCase()+day.slice(1)}</span></button>
    <div id="class-content" inert={docked}>
      <h2>{state.recess?'Estamos en receso':subject?.name||'En espera del horario de clase'}</h2>
      {subject && <p className="class-teacher">( {subject.teacher} )</p>}
      {interval && <div className="class-timing"><span>{clock(interval.start)}</span><progress max="1" value={state.progress} aria-label={state.recess?'Progreso del receso':'Progreso de la clase'} aria-valuetext={`${Math.round(state.progress*100)} % transcurrido`}/><span>{clock(interval.end)}</span></div>}
      <p className="class-countdown" aria-label={state.recess?'Tiempo restante de receso':subject?'Tiempo restante de clase':'Tiempo hasta la próxima clase'}>{Number.isFinite(state.remaining)?duration(state.remaining):'Sin clases programadas'}</p>
      {next && <div className="class-next"><span className="class-next-label">Siguiente</span><div className="class-next-row"><span>{schedule.subjects[next.subject].name}</span><span className="class-next-duration" title="Horas lectivas de 50 minutos">{next.teachingPeriods}H</span></div></div>}
    </div>
  </section>;
}
