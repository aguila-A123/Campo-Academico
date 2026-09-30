import {colors,SubjectIcon} from './SubjectStyle.jsx';
import {examCourses,subjectCode} from '../lib/subjects.js';
import DeleteDialog from './DeleteDialog.jsx';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabase.js';
import {readTable} from '../lib/moodle.js';
import {countdown,dateLabel} from '../lib/deadline.js';
import {examInstant,examTone} from '../lib/exams.js';
import Icon from './Icon.jsx';
import ContextMenu,{contextPosition} from './ContextMenu.jsx';
import './Exams.css';

const storageError='No se pudo acceder a los exámenes. Comprueba que se haya ejecutado el SQL de exámenes en Supabase.';
export default function Exams({userId}){
 const [pendingDelete,setPendingDelete]=useState(null),[chosenCourse,setChosenCourse]=useState('');
 const [items,setItems]=useState([]),[courses,setCourses]=useState(()=>examCourses([])),[loading,setLoading]=useState(true),[error,setError]=useState(''),[courseError,setCourseError]=useState(''),[saving,setSaving]=useState(false),[formError,setFormError]=useState(''),[now,setNow]=useState(Date.now());
 const dialog=useRef(null),form=useRef(null),trigger=useRef(null),busy=useRef(false);
 const [reload,setReload]=useState(0),[menu,setMenu]=useState(null),[editing,setEditing]=useState(null);
 function openForm(exam=null){
  setEditing(exam);setFormError('');form.current.reset();setChosenCourse(exam?String(courses.find(c=>String(c.id)===String(exam.curso_id)||c.code&&c.code===subjectCode(exam.asignatura))?.id||exam.curso_id||''):'');
  if(exam){
   const fields=form.current.elements;fields.title.value=exam.titulo;fields.description.value=exam.descripcion||'';
   const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(exam.fecha)).map(p=>[p.type,p.value]));
   fields.date.value=p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute;
  }
  dialog.current.showModal();
 }
 async function remove(exam){
  if(busy.current)return;
  busy.current=true;
  try{const {data,error}=await supabase.from('examenes').delete().eq('id',exam.id).eq('usuario_id',userId).select('id');if(error||!data?.length)throw Error();setItems(list=>list.filter(item=>item.id!==exam.id));setError('');}
  catch{setError('No se pudo eliminar el examen. Revisa la conexión y ejecuta el SQL de permisos para editar y eliminar.');}
  finally{busy.current=false;}
 }
 useEffect(()=>{let active=true;const controller=new AbortController();setLoading(true);setError('');setCourseError('');
  supabase.from('examenes').select('*').eq('usuario_id',userId).order('fecha').abortSignal(controller.signal).then(({data,error})=>{if(!active)return;if(error)setError(storageError);else setItems(data);setLoading(false);});
  readTable('cursos',controller.signal).then(data=>{if(active)setCourses(examCourses(data));}).catch(()=>{if(active)setCourseError('No se pudieron cargar los cursos adicionales. Las asignaturas del horario siguen disponibles.');});
  return()=>{active=false;controller.abort();};
 },[userId,reload]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 function close(){if(busy.current)return;dialog.current.close();trigger.current?.focus();}
 async function save(event){event.preventDefault();if(busy.current)return;setFormError('');const values=new FormData(form.current);const title=String(values.get('title')).trim();if(!title){setFormError('El título es obligatorio.');return;}
  let date;try{date=examInstant(String(values.get('date')));}catch(e){setFormError(e.message);return;}
  const course=courses.find(c=>String(c.id)===values.get('course'));
  busy.current=true;setSaving(true);
  try{const payload={curso_id:course?String(course.id):null,asignatura:course?.nombre??null,titulo:title,descripcion:String(values.get('description')).trim(),fecha:date};const query=editing?supabase.from('examenes').update(payload).eq('id',editing.id).eq('usuario_id',userId):supabase.from('examenes').insert({...payload,usuario_id:userId});const {data,error}=await query.select().single();if(error)throw error;setItems(list=>[...list.filter(item=>item.id!==data.id),data].sort((a,b)=>Date.parse(a.fecha)-Date.parse(b.fecha)));setError('');form.current.reset();dialog.current.close();trigger.current?.focus();}
  catch{setFormError('No se pudo guardar el examen en Supabase. Tus datos siguen en el formulario; revisa la conexión y ejecuta el SQL de permisos para editar y eliminar.');}
  finally{busy.current=false;setSaving(false);}
 }
 return <section className="exams-page" aria-labelledby="exams-title"><header className="exams-header"><div><span>CAMPUS · EVALUACIÓN</span><h1 id="exams-title">Exámenes</h1><p>Fechas y cuenta atrás, en hora de Cantabria.</p></div><button className="exams-add" type="button" ref={trigger} onClick={()=>openForm()}>+ Agregar examen</button></header>
 {error&&<p role="alert" className="exams-error">{error} <button type="button" onClick={()=>setReload(n=>n+1)}>Reintentar</button></p>}
 {loading?<p role="status">Cargando exámenes…</p>:!items.length&&!error?<div className="exams-empty"><Icon name="examenes"/><h2>Aún no tienes exámenes</h2><p>Agrega el primero para tener su fecha y cuenta atrás a mano.</p></div>:null}
 <div className="exams-grid">{items.map(exam=>{const end=Date.parse(exam.fecha);const tone=examTone(end,now);return <article className={`exam-card ${tone}`} key={exam.id} tabIndex={0} onContextMenuCapture={event=>setMenu(contextPosition(event,exam))}><header><span className="exam-subject" style={{color:colors[subjectCode(exam.asignatura)]||'#c7bb91'}}><SubjectIcon subject={subjectCode(exam.asignatura)}/>{exam.asignatura||'Sin asignatura'}</span><div className="exam-corner"><time dateTime={exam.fecha}>{dateLabel(exam.fecha)}</time><span className="exam-countdown" aria-label={tone==='past'?'Fecha alcanzada':`Tiempo restante: ${countdown(end,now)}`}>{tone==='past'?'Fecha alcanzada':countdown(end,now)}</span></div></header><h2>{exam.titulo}</h2>{exam.descripcion&&<p>{exam.descripcion}</p>}</article>;})}</div>
 <dialog ref={dialog} className="exam-dialog" aria-labelledby="exam-form-title" onCancel={event=>{event.preventDefault();close();}} onClose={()=>trigger.current?.focus()}><form ref={form} onSubmit={save}><header><h2 id="exam-form-title">{editing?'Editar examen':'Agregar examen'}</h2><button type="button" aria-label="Cerrar formulario" onClick={close} disabled={saving}>×</button></header><fieldset disabled={saving}><fieldset className="exam-course-picker"><legend>Asignatura</legend><input type="hidden" name="course" value={chosenCourse}/><div className="exam-course-options">{[{id:'',nombre:'Sin asignar (opcional)'},...courses].map(course=><button type="button" key={course.id} aria-pressed={chosenCourse===String(course.id)} style={{'--subject-color':colors[course.code]||'#c7bb91'}} onClick={()=>setChosenCourse(String(course.id))}><SubjectIcon subject={course.code}/><span>{course.nombre}</span></button>)}</div></fieldset>{courseError&&<p role="status">{courseError}</p>}<label htmlFor="exam-title">Título <span>*</span></label><input id="exam-title" name="title" required maxLength={200} placeholder="Ej. Examen del tema 2" autoFocus/><label htmlFor="exam-description">Descripción</label><textarea id="exam-description" name="description" rows={4} maxLength={4000} placeholder="Temas, material o indicaciones…"/><label htmlFor="exam-date">Fecha y hora <span>*</span></label><input id="exam-date" name="date" type="datetime-local" required/><p className="exam-time-help">Hora de Cantabria (Europe/Madrid), con cambio de verano e invierno.</p></fieldset>{formError&&<p role="alert" className="exams-error">{formError}</p>}<footer><button type="button" onClick={close} disabled={saving}>Cancelar</button><button className="exams-add" type="submit" disabled={saving}>{saving?'Guardando…':'Guardar examen'}</button></footer></form></dialog>
 <DeleteDialog item={pendingDelete} onCancel={()=>setPendingDelete(null)} onConfirm={remove}/>
 <ContextMenu menu={menu} onClose={()=>setMenu(null)} actions={[{label:'Editar',run:openForm},{label:'Eliminar',danger:true,run:setPendingDelete}]}/>
 </section>;
}
