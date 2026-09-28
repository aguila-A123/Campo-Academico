import {memo,useCallback,useEffect,useRef,useState} from 'react';
import {loadCourses,counts,isTask,safeUrl} from '../lib/moodle.js';
import Icon from './Icon.jsx';
import ActivityIcon from './ActivityIcon.jsx';
import TaskCountdown from './TaskCountdown.jsx';
import {dateLabel} from '../lib/deadline.js';
import './Moodle.css';

const palettes=[['#064e3b','#10b981'],['#172554','#3b82f6'],['#450a0a','#ef4444']];
const STORAGE_KEY='campus:ojhoiwaimwqucbjjyerq:completed-tasks:v1';
function readCompleted(key){try{const value=JSON.parse(localStorage.getItem(key)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([,v])=>v===true)):{};}catch{return {};}}
function palette(id){let h=0;for(const c of String(id))h=(h*31+c.charCodeAt(0))>>>0;return palettes[h%palettes.length];}
function plainText(html){const doc=new DOMParser().parseFromString(html||'','text/html');return doc.body.textContent||'';}

export const CourseCard=memo(function CourseCard({course,pending,files,onOpen}){
  const [dark,light]=palette(course.id);
  const short=course.nombre.replace(/\s*\([^)]*\)\s*$/,'');
  return <article className="moodle-card" style={{'--course-dark':dark,'--course-light':light,'--course-border':pending?'#ef4444':'#22c55e'}}>
    <div className="moodle-card-inner">
      <div className="moodle-cover" aria-hidden="true"><div className="moodle-cover-content"><Icon name="yedra"/><strong>{course.nombre}</strong><span>Tareas: {pending} · Archivos: {files}</span></div></div>
      <div className="moodle-detail" aria-hidden="true"><div className="moodle-glows"><i/><i/><i/></div><div className="moodle-detail-content"><span className="moodle-badge" title={short}>{short}</span><div className="moodle-description"><strong>{course.nombre}</strong><p>Tareas: {pending}<span>Archivos: {files}</span></p></div></div></div>
    </div>
    <button className="moodle-card-open" type="button" onClick={()=>onOpen(course.id)} aria-label={`Abrir ${course.nombre}. ${pending} tareas pendientes y ${files} archivos.`}/>
  </article>;
});

export default function Moodle({visible,userId}) {
  const storageKey=STORAGE_KEY+':'+userId;
  const [courses,setCourses]=useState([]);
  const cache=useRef([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState(null);
  const [completed,setCompleted]=useState(()=>readCompleted(storageKey));
  const completedRef=useRef(completed);
  const [saveError,setSaveError]=useState('');
  const courseHeading=useRef(null);
  const opener=useRef(null);
  const toggleTask=useCallback(id=>{
    const next={...completedRef.current,[String(id)]:!completedRef.current[String(id)]};
    try{localStorage.setItem(storageKey,JSON.stringify(next));completedRef.current=next;setCompleted(next);setSaveError('');}
    catch{setSaveError('No se pudo guardar la tarea en este navegador. Comprueba que el almacenamiento esté permitido.');}
  },[]);
  useEffect(()=>{const sync=e=>{if(e.key===storageKey||e.key===null){const next=readCompleted(storageKey);completedRef.current=next;setCompleted(next);}};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
  useEffect(()=>{
    let stopped=false,timer;
    const controller=new AbortController();
    async function refresh(){try{const next=await loadCourses(cache.current,controller.signal);if(stopped)return;if(next!==cache.current){cache.current=next;setCourses(next);}setError('');}catch(e){if(!stopped&&e.name!=='AbortError')setError(e.message);}finally{if(!stopped){setLoading(false);timer=setTimeout(refresh,60000);}}}
    refresh();return()=>{stopped=true;clearTimeout(timer);controller.abort();};
  },[]);
  const open=useCallback(id=>{opener.current=document.activeElement;setSelected(id);},[]);
  const close=()=>{setSelected(null);requestAnimationFrame(()=>opener.current?.focus());};
  useEffect(()=>{if(selected!==null&&visible){courseHeading.current?.focus();courseHeading.current?.scrollIntoView({block:'start'});}},[selected,visible]);
  const course=courses.find(c=>String(c.id)===String(selected));
  return <div className="moodle-page" hidden={!visible}>
    <div hidden={selected!==null}><header className="moodle-heading"><span>CAMPUS</span><h1>Moodle</h1><p>Tus cursos y actividades</p></header>
    {error&&<p className="moodle-notice" role="status">{error}{courses.length>0?' Se conserva la última información disponible.':''} Se volverá a intentar en un minuto.</p>}
    {loading?<p className="moodle-empty" role="status">Cargando cursos…</p>:!courses.length&&!error?<div className="moodle-empty"><Icon name="yedra"/><h2>Aún no hay cursos disponibles</h2><p>Los cursos aparecerán aquí cuando Supabase tenga registros accesibles. Se comprueba automáticamente cada minuto.</p></div>:null}
    <div className="moodle-grid">{courses.map(c=>{const n=counts(c,completed);return <CourseCard key={c.id} course={c} pending={n.tasks} files={n.files} onOpen={open}/>;})}</div>
    </div><section className="moodle-course-panel" hidden={selected===null} aria-labelledby="course-title">
      <button className="moodle-back" type="button" onClick={close}>← Volver a los cursos</button><div className="moodle-course-header"><h2 id="course-title" tabIndex={-1} ref={courseHeading}>{course?.nombre||'Curso no disponible'}</h2></div>
      <p className="moodle-storage-note">Las tareas realizadas se guardan en este navegador.</p>
      {saveError&&<p className="moodle-notice" role="alert">{saveError}</p>}
      {!course?<p>El curso ya no está disponible.</p>:course.sections.length===0?<p>No hay secciones disponibles.</p>:course.sections.map(section=><section className="moodle-section" key={section.id}><h3>{section.nombre}</h3>{!section.activities.length?<p className="moodle-muted">Sin actividades.</p>:section.activities.map(a=><article className="moodle-activity" key={a.id}><div className="moodle-activity-heading">{isTask(a)&&<button className={`moodle-done${completed[String(a.id)]?' active':''}`} type="button" aria-pressed={!!completed[String(a.id)]} onClick={()=>toggleTask(a.id)}>✓ Realizada</button>}</div><div className="moodle-activity-title"><ActivityIcon type={a.tipo}/><h4>{safeUrl(a.url)?<a className="moodle-activity-link" href={safeUrl(a.url)} target="_blank" rel="noopener noreferrer">{a.titulo}{isTask(a)&&<Icon name="external"/>}</a>:a.titulo}</h4></div>{a.descripcion&&<p className="moodle-description-text">{plainText(a.descripcion)}</p>}<div className="moodle-dates">{a.fecha_apertura&&<span>Apertura: {dateLabel(a.fecha_apertura)}</span>}{a.fecha_cierre&&<span>Cierre: {dateLabel(a.fecha_cierre)}</span>}{isTask(a)&&a.fecha_cierre&&<TaskCountdown deadline={a.fecha_cierre}/>}</div></article>)}</section>)}
    </section>
  </div>;
}



