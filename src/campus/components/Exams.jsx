import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabase.js';
import {readTable} from '../lib/moodle.js';
import {countdown,dateLabel} from '../lib/deadline.js';
import {examInstant,examTone} from '../lib/exams.js';
import Icon from './Icon.jsx';
import './Exams.css';

const storageError='No se pudo acceder a los exámenes. Comprueba que se haya ejecutado el SQL de exámenes en Supabase.';
export default function Exams({userId}){
 const [items,setItems]=useState([]),[courses,setCourses]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[courseError,setCourseError]=useState(''),[saving,setSaving]=useState(false),[formError,setFormError]=useState(''),[now,setNow]=useState(Date.now());
 const dialog=useRef(null),form=useRef(null),trigger=useRef(null),busy=useRef(false);
 const [reload,setReload]=useState(0);
 useEffect(()=>{let active=true;const controller=new AbortController();setLoading(true);setError('');setCourseError('');
  supabase.from('examenes').select('*').eq('usuario_id',userId).order('fecha').abortSignal(controller.signal).then(({data,error})=>{if(!active)return;if(error)setError(storageError);else setItems(data);setLoading(false);});
  readTable('cursos',controller.signal).then(data=>{if(active)setCourses(data);}).catch(()=>{if(active)setCourseError('No se pudieron cargar las asignaturas. Puedes dejarla sin asignar.');});
  return()=>{active=false;controller.abort();};
 },[userId,reload]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 function close(){if(busy.current)return;dialog.current.close();trigger.current?.focus();}
 async function save(event){event.preventDefault();if(busy.current)return;setFormError('');const values=new FormData(form.current);const title=String(values.get('title')).trim();if(!title){setFormError('El título es obligatorio.');return;}
  let date;try{date=examInstant(String(values.get('date')));}catch(e){setFormError(e.message);return;}
  const course=courses.find(c=>String(c.id)===values.get('course'));
  busy.current=true;setSaving(true);
  try{const {data,error}=await supabase.from('examenes').insert({usuario_id:userId,curso_id:course?String(course.id):null,asignatura:course?.nombre??null,titulo:title,descripcion:String(values.get('description')).trim(),fecha:date}).select().single();if(error)throw error;setItems(list=>[...list,data].sort((a,b)=>Date.parse(a.fecha)-Date.parse(b.fecha)));setError('');form.current.reset();dialog.current.close();trigger.current?.focus();}
  catch{setFormError('No se pudo guardar el examen en Supabase. Tus datos siguen en el formulario; revisa la conexión y la tabla de exámenes.');}
  finally{busy.current=false;setSaving(false);}
 }
 return <section className="exams-page" aria-labelledby="exams-title"><header className="exams-header"><div><span>CAMPUS · EVALUACIÓN</span><h1 id="exams-title">Exámenes</h1><p>Fechas y cuenta atrás, en hora de Cantabria.</p></div><button className="exams-add" type="button" ref={trigger} onClick={()=>{setFormError('');dialog.current.showModal();}}>+ Agregar examen</button></header>
 {error&&<p role="alert" className="exams-error">{error} <button type="button" onClick={()=>setReload(n=>n+1)}>Reintentar</button></p>}
 {loading?<p role="status">Cargando exámenes…</p>:!items.length&&!error?<div className="exams-empty"><Icon name="examenes"/><h2>Aún no tienes exámenes</h2><p>Agrega el primero para tener su fecha y cuenta atrás a mano.</p></div>:null}
 <div className="exams-grid">{items.map(exam=>{const end=Date.parse(exam.fecha);const tone=examTone(end,now);return <article className={`exam-card ${tone}`} key={exam.id}><header><span className="exam-subject"><Icon name="examenes"/>{exam.asignatura||'Sin asignatura'}</span><div className="exam-corner"><time dateTime={exam.fecha}>{dateLabel(exam.fecha)}</time><span className="exam-countdown" aria-label={tone==='past'?'Fecha alcanzada':`Tiempo restante: ${countdown(end,now)}`}>{tone==='past'?'Fecha alcanzada':countdown(end,now)}</span></div></header><h2>{exam.titulo}</h2>{exam.descripcion&&<p>{exam.descripcion}</p>}</article>;})}</div>
 <dialog ref={dialog} className="exam-dialog" aria-labelledby="exam-form-title" onCancel={event=>{event.preventDefault();close();}} onClose={()=>trigger.current?.focus()}><form ref={form} onSubmit={save}><header><h2 id="exam-form-title">Agregar examen</h2><button type="button" aria-label="Cerrar formulario" onClick={close} disabled={saving}>×</button></header><fieldset disabled={saving}><label htmlFor="exam-course">Asignatura</label><select id="exam-course" name="course"><option value="">Sin asignar (opcional)</option>{courses.map(course=><option key={course.id} value={course.id}>{course.nombre}</option>)}</select>{courseError&&<p role="status">{courseError}</p>}<label htmlFor="exam-title">Título <span>*</span></label><input id="exam-title" name="title" required maxLength={200} placeholder="Ej. Examen del tema 2" autoFocus/><label htmlFor="exam-description">Descripción</label><textarea id="exam-description" name="description" rows={4} maxLength={4000} placeholder="Temas, material o indicaciones…"/><label htmlFor="exam-date">Fecha y hora <span>*</span></label><input id="exam-date" name="date" type="datetime-local" required/><p className="exam-time-help">Hora de Cantabria (Europe/Madrid), con cambio de verano e invierno.</p></fieldset>{formError&&<p role="alert" className="exams-error">{formError}</p>}<footer><button type="button" onClick={close} disabled={saving}>Cancelar</button><button className="exams-add" type="submit" disabled={saving}>{saving?'Guardando…':'Guardar examen'}</button></footer></form></dialog>
 </section>;
}
