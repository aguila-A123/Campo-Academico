import { supabase } from '../../lib/supabase.js';
export const SUPABASE_URL = 'https://ojhoiwaimwqucbjjyerq.supabase.co';
// Public browser key supplied by the project owner. Never use a service-role key here.
const PUBLIC_KEY = 'sb_publishable_5zqnLi8sTSeGoD07fj0hlQ_C_XlzzBi';
const columns = {
  cursos: 'id,nombre',
  secciones: 'id,curso_id,nombre',
  actividades: 'id,seccion_id,titulo,tipo,descripcion,url,fecha_apertura,fecha_cierre,hash,actualizado',
};

export async function readTable(table, signal, fetcher = fetch) {
  const rows=[];
  const {data:{session}}=await supabase.auth.getSession();
  const headers={apikey:PUBLIC_KEY,...(session?{Authorization:`Bearer ${session.access_token}`}:{})};
  // Offset advances by the actual response size, including projects with a lower API row limit.
  for(let offset=0;;) {
    const url=new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    url.search=new URLSearchParams({select:columns[table],order:'id.asc',offset:String(offset),limit:'500'});
    const response=await fetcher(url,{signal,headers});
    if(!response.ok) throw new Error(`No se pudo leer ${table} (${response.status}). Comprueba la conexión y los permisos de lectura.`);
    const batch=await response.json();
    if(!Array.isArray(batch))throw new Error('Respuesta de Supabase no válida.');
    if(!batch.length) return rows;
    rows.push(...batch);offset+=batch.length;
  }
}

export function reconcileCourses(previous, {cursos,secciones,actividades}) {
  const old=new Map(previous.map(c=>[String(c.id),c]));
  const bySection=new Map();
  for(const activity of actividades){const key=String(activity.seccion_id);if(!bySection.has(key))bySection.set(key,[]);bySection.get(key).push(activity);}
  const byCourse=new Map();
  for(const section of secciones){const key=String(section.curso_id);if(!byCourse.has(key))byCourse.set(key,[]);byCourse.get(key).push({...section,activities:bySection.get(String(section.id))||[]});}
  const next=cursos.map(course=>{
    const sections=byCourse.get(String(course.id))||[];
    // Includes hash/actualizado as well as metadata: course renames and deletions also refresh.
    const signature=JSON.stringify([course,sections]);
    const existing=old.get(String(course.id));
    return existing?.signature===signature?existing:{...course,sections,signature};
  });
  return next.length===previous.length&&next.every((c,i)=>c===previous[i])?previous:next;
}

export async function loadCourses(previous, signal) {
  const [cursos,secciones,actividades]=await Promise.all(Object.keys(columns).map(t=>readTable(t,signal)));
  return reconcileCourses(previous,{cursos,secciones,actividades});
}
export const isTask = activity => activity.tipo?.trim().toLocaleLowerCase('es')==='tarea';
export const isFile = activity => activity.tipo?.trim().toLocaleLowerCase('es')==='archivo';
export function safeUrl(raw) {try{const u=new URL(raw);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}}
export function counts(course,completed){const all=course.sections.flatMap(s=>s.activities);return {tasks:all.filter(a=>isTask(a)&&!completed[String(a.id)]).length,files:all.filter(isFile).length};}
