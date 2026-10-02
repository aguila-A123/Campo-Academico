import {useActivityState} from '../lib/useActivityState.js';
import ActivityEditor from './ActivityEditor.jsx';
import DeleteDialog from './DeleteDialog.jsx';
import {memo,useCallback,useEffect,useRef,useState} from 'react';
import {loadCourses,counts,isFolder,isTask,safeUrl} from '../lib/moodle.js';
import Icon from './Icon.jsx';
import {supabase} from '../../lib/supabase.js';
import ContextMenu,{contextPosition} from './ContextMenu.jsx';
import ActivityIcon from './ActivityIcon.jsx';
import TaskCountdown from './TaskCountdown.jsx';
import {dateLabel} from '../lib/deadline.js';
import './Moodle.css';

const palettes=[['#064e3b','#10b981'],['#172554','#3b82f6'],['#450a0a','#ef4444']];
function palette(id){let h=0;for(const c of String(id))h=(h*31+c.charCodeAt(0))>>>0;return palettes[h%palettes.length];}
function plainText(html){const doc=new DOMParser().parseFromString(html||'','text/html');return doc.body.textContent||'';}
function taskDetails(activity){
  const text=plainText(activity.descripcion);
  try{
    const data=JSON.parse(text);
    if(data&&typeof data==='object')return {text:plainText(data.descripcion||data.description||''),grade:data.estado_calificacion||data.estadoCalificacion||'',files:Array.isArray(data.archivos)?data.archivos:[]};
  }catch{}
  return {text,grade:'',files:[]};
}
function folderElements(activity){
  try{
    const data=JSON.parse(plainText(activity.descripcion));
    return Array.isArray(data?.elementos)?data.elementos.filter(element=>element&&safeUrl(element.url)):[];
  }catch{return[];}
}

function ExternalArrow(){return <svg className="moodle-external-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg>;}

function TaskDetail({activity,completed,onToggle,onBack}){
  const details=taskDetails(activity);
  const graded=/calificad/i.test(String(details.grade));
  const files=details.files.filter(file=>file&&safeUrl(file.url));
  return <article className="moodle-task-detail">
    <button className="moodle-back" type="button" onClick={onBack}>← Volver a las actividades</button>
    <div className="moodle-task-detail-header"><ActivityIcon type={activity.tipo}/><h3>{activity.titulo}</h3></div>
    <div className="moodle-task-meta"><span>{activity.fecha_apertura?`Apertura: ${dateLabel(activity.fecha_apertura)}`:'Apertura no indicada'}</span><span>{activity.fecha_cierre?`Cierre: ${dateLabel(activity.fecha_cierre)}`:'Cierre no indicado'}</span></div>
    <div className="moodle-task-countdown">{(activity.fecha_apertura||activity.fecha_cierre)&&<TaskCountdown opening={activity.fecha_apertura} deadline={activity.fecha_cierre}/>}</div>
    <p className="moodle-task-grade"><strong>Calificación:</strong> {graded?'Ya está calificada':'Aún no está calificada'}</p>
    {details.grade&&<p className="moodle-task-status"><strong>Estado de entrega:</strong> {details.grade}</p>}
    {details.text&&<p className="moodle-description-text">{details.text}</p>}
    {files.length>0&&<div className="moodle-task-files"><h4>Archivos</h4>{files.map((file,index)=><a key={`${file.url}-${index}`} href={safeUrl(file.url)} target="_blank" rel="noopener noreferrer"><span>{file.nombre||file.name||'Abrir archivo'}</span><ExternalArrow/></a>)}</div>}
    <div className="moodle-task-actions"><button className={`moodle-done${completed?' active':''}`} type="button" aria-pressed={completed} onClick={onToggle}>{completed?'✓ Realizada':'Marcar realizada'}</button>{safeUrl(activity.url)&&<a className="moodle-submit" href={safeUrl(activity.url)} target="_blank" rel="noopener noreferrer">Entregar tarea <ExternalArrow/></a>}</div>
  </article>;
}

function FolderDetail({activity,onBack}){
  const elements=folderElements(activity);
  return <article className="moodle-folder-detail">
    <button className="moodle-back" type="button" onClick={onBack}>← Volver a las actividades</button>
    <div className="moodle-task-detail-header"><ActivityIcon type={activity.tipo}/><h3>{activity.titulo}</h3></div>
    {elements.length?<div className="moodle-task-files moodle-folder-files"><h4>Contenido de la carpeta</h4>{elements.map((element,index)=><a key={`${element.url}-${index}`} href={safeUrl(element.url)} target="_blank" rel="noopener noreferrer"><span>{element.nombre||element.name||'Abrir archivo'}</span><ExternalArrow/></a>)}</div>:<p className="moodle-muted">Esta carpeta no tiene elementos disponibles.</p>}
  </article>;
}

export const CourseCard=memo(function CourseCard({course,pending,files,onOpen,onContextMenu}){
  const [dark,light]=palette(course.id);
  const short=course.nombre.replace(/\s*\([^)]*\)\s*$/,'');
  return <article className="moodle-card" onContextMenuCapture={onContextMenu} style={{'--course-dark':dark,'--course-light':light,'--course-border':pending?'#ef4444':'#22c55e'}}>
    <div className="moodle-card-inner">
      <div className="moodle-cover" aria-hidden="true"><div className="moodle-cover-content"><Icon name="yedra"/><strong>{course.nombre}</strong><span>Tareas: {pending} · Archivos: {files}</span></div></div>
      <div className="moodle-detail" aria-hidden="true"><div className="moodle-glows"><i/><i/><i/></div><div className="moodle-detail-content"><span className="moodle-badge" title={short}>{short}</span><div className="moodle-description"><strong>{course.nombre}</strong><p>Tareas: {pending}<span>Archivos: {files}</span></p></div></div></div>
    </div>
    
    <button className="moodle-card-open" type="button" onClick={()=>onOpen(course.id)} aria-label={`Abrir ${course.nombre}. ${pending} tareas pendientes y ${files} archivos.`}/>
  </article>;
});

export default function Moodle({visible,userId,resetKey=0}) {
  const [pendingDelete,setPendingDelete]=useState(null),[editing,setEditing]=useState(null);
  const {completed,hideCompleted,ready,saving,error:saveError,toggleActivity:toggleTask,toggleFilter}=useActivityState(userId);
  const [courses,setCourses]=useState([]);
  const cache=useRef([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState(null),[selectedActivity,setSelectedActivity]=useState(null);

  const pageTop=useRef(null);
  useEffect(()=>{setSelected(null);setSelectedActivity(null);setMenu(null);if(resetKey)requestAnimationFrame(()=>pageTop.current?.scrollIntoView({block:'start'}));},[resetKey]);
  const [menu,setMenu]=useState(null),[mutationError,setMutationError]=useState('');
  const deleting=useRef(false),revision=useRef(0);
  useEffect(()=>{if(!visible)setMenu(null);},[visible]);
  async function remove(item){
    const isCourse=item.kind==='course';
    if(deleting.current)return;
    deleting.current=true;revision.current++;
    try{
      const result=isCourse?await supabase.rpc('campus_eliminar_curso',{curso:String(item.id)}):await supabase.from('actividades').delete().eq('id',item.id).select('id');
      if(result.error||(isCourse?result.data!==true:!result.data?.length))throw Error();
      const next=isCourse?cache.current.filter(c=>String(c.id)!==String(item.id)):cache.current.map(c=>({...c,sections:c.sections.map(section=>({...section,activities:section.activities.filter(a=>String(a.id)!==String(item.id))}))}));
      cache.current=next;setCourses(next);if(isCourse&&String(selected)===String(item.id))setSelected(null);setMutationError('');
    }catch{setMutationError('No se pudo eliminar de Supabase. Revisa la conexión y ejecuta el SQL de permisos con tu cuenta autorizada.');}
    finally{deleting.current=false;revision.current++;}
  }
  async function saveActivity(item,changes){
    if(deleting.current)throw Error('Operación en curso');
    deleting.current=true;revision.current++;
    try{
      const {data,error}=await supabase.from('actividades').update(changes).eq('id',item.id).select().single();
      if(error||!data)throw Error('No se pudo guardar');
      const next=cache.current.map(c=>({...c,sections:c.sections.map(section=>({...section,activities:section.activities.map(a=>String(a.id)===String(item.id)?{...a,...data}:a)}))}));
      cache.current=next;setCourses(next);
    }finally{deleting.current=false;revision.current++;}
  }
  const courseHeading=useRef(null);
  const opener=useRef(null);
  useEffect(()=>{
    let stopped=false,timer;
    const controller=new AbortController();
    async function refresh(){const version=revision.current;try{const next=await loadCourses(cache.current,controller.signal);if(stopped||deleting.current||version!==revision.current)return;if(next!==cache.current){cache.current=next;setCourses(next);}setError('');}catch(e){if(!stopped&&e.name!=='AbortError')setError(e.message);}finally{if(!stopped){setLoading(false);timer=setTimeout(refresh,60000);}}}
    refresh();return()=>{stopped=true;clearTimeout(timer);controller.abort();};
  },[]);
  const open=useCallback(id=>{opener.current=document.activeElement;setSelected(id);setSelectedActivity(null);},[]);
  const close=()=>{setSelected(null);setSelectedActivity(null);requestAnimationFrame(()=>opener.current?.focus());};
  useEffect(()=>{if(selected!==null&&visible){courseHeading.current?.focus();courseHeading.current?.scrollIntoView({block:'start'});}},[selected,visible]);
  const course=courses.find(c=>String(c.id)===String(selected));
  const activity=course?.sections.flatMap(section=>section.activities).find(item=>String(item.id)===String(selectedActivity));
  return <div className="moodle-page" ref={pageTop} hidden={!visible}>
    {saveError&&<p className="moodle-notice" role="alert">{saveError}</p>}
    {mutationError&&<p className="moodle-notice" role="alert">{mutationError}</p>}
    <div hidden={selected!==null}><header className="moodle-heading"><span>CAMPUS</span><h1>Moodle</h1><p>Tus cursos y actividades</p></header>
    {error&&<p className="moodle-notice" role="status">{error}{courses.length>0?' Se conserva la última información disponible.':''} Se volverá a intentar en un minuto.</p>}
    {loading?<p className="moodle-empty" role="status">Cargando cursos…</p>:!courses.length&&!error?<div className="moodle-empty"><Icon name="yedra"/><h2>Aún no hay cursos disponibles</h2><p>Los cursos aparecerán aquí cuando Supabase tenga registros accesibles. Se comprueba automáticamente cada minuto.</p></div>:null}
    <div className="moodle-grid">{courses.map(c=>{const n=counts(c,completed);return <CourseCard key={c.id} course={c} pending={n.tasks} files={n.files} onOpen={open} onContextMenu={event=>setMenu(contextPosition(event,{...c,kind:'course'}))}/>;})}</div>
    </div><section className="moodle-course-panel" hidden={selected===null} aria-labelledby="course-title">
      <button className="moodle-back" type="button" onClick={close}>← Volver a los cursos</button><div className="moodle-course-header"><h2 id="course-title" tabIndex={-1} ref={courseHeading}>{course?.nombre||'Curso no disponible'}</h2><button className="moodle-filter" type="button" aria-pressed={hideCompleted} aria-label={hideCompleted?'Mostrar realizadas y vistas':'Ocultar realizadas y vistas'} title={hideCompleted?'Mostrar realizadas y vistas':'Ocultar realizadas y vistas'} disabled={!ready||saving} onClick={toggleFilter}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{hideCompleted&&<path d="m3 3 18 18"/>}</svg></button></div>
      <p className="moodle-storage-note">{saving?'Guardando en tu cuenta…':ready?'Actividades y filtro sincronizados con tu cuenta.':'Conectando con tu cuenta…'}</p>

      {hideCompleted&&course&&course.sections.every(section=>section.activities.every(a=>completed[String(a.id)]))&&<p className="moodle-muted">No quedan actividades pendientes. Usa el ojo para mostrar todas.</p>}
      {!course?<p>El curso ya no está disponible.</p>:selectedActivity&&activity?(isFolder(activity)?<FolderDetail activity={activity} onBack={()=>setSelectedActivity(null)}/>:<TaskDetail activity={activity} completed={!!completed[String(activity.id)]} onToggle={()=>toggleTask(activity.id)} onBack={()=>setSelectedActivity(null)}/>):course.sections.length===0?<p>No hay secciones disponibles.</p>:course.sections.map(section=>({...section,activities:section.activities.filter(a=>!hideCompleted||!completed[String(a.id)])})).filter(section=>!hideCompleted||section.activities.length).map(section=><section className="moodle-section" key={section.id}><h3>{section.nombre}</h3>{!section.activities.length?<p className="moodle-muted">Sin actividades.</p>:section.activities.map(a=><article className="moodle-activity" key={a.id} tabIndex={0} onContextMenuCapture={event=>setMenu(contextPosition(event,{...a,kind:'activity'}))}><div className="moodle-activity-heading"><button className={`moodle-done${isTask(a)?'':' moodle-seen'}${completed[String(a.id)]?' active':''}`} type="button" aria-pressed={!!completed[String(a.id)]} disabled={!ready||saving} onClick={()=>toggleTask(a.id)}>{isTask(a)?(completed[String(a.id)]?'✓ Realizada':'Marcar realizada'):(completed[String(a.id)]?'✓ Visto':'Marcar visto')}</button></div><div className="moodle-activity-title"><ActivityIcon type={a.tipo}/><h4>{isTask(a)||isFolder(a)?<button className="moodle-activity-link moodle-task-open" type="button" onClick={()=>setSelectedActivity(a.id)}>{a.titulo}</button>:safeUrl(a.url)?<a className="moodle-activity-link" href={safeUrl(a.url)} target="_blank" rel="noopener noreferrer">{a.titulo}<Icon name="external"/></a>:a.titulo}</h4></div><div className="moodle-dates">{a.fecha_apertura&&<span>Apertura: {dateLabel(a.fecha_apertura)}</span>}{a.fecha_cierre&&<span>Cierre: {dateLabel(a.fecha_cierre)}</span>}{isTask(a)&&a.fecha_cierre&&<TaskCountdown deadline={a.fecha_cierre}/>}</div></article>)}</section>)}
    </section>
    <ActivityEditor item={editing} onClose={()=>setEditing(null)} onSave={saveActivity}/>
    <DeleteDialog item={pendingDelete} onCancel={()=>setPendingDelete(null)} onConfirm={remove} shared/>
    <ContextMenu menu={menu} onClose={()=>setMenu(null)} actions={[...(menu?.item.kind==='activity'?[{label:'Editar',run:setEditing}]:[]),{label:'Eliminar',danger:true,run:setPendingDelete}]}/>
  </div>;
}



