import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabase.js';
const prefix='campus:ojhoiwaimwqucbjjyerq:completed-tasks:v1:';
export function useActivityState(userId){
 const [completed,setCompleted]=useState({}),[hideCompleted,setHideCompleted]=useState(false),[ready,setReady]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const state=useRef({}),busy=useRef(false),revision=useRef(0);
 useEffect(()=>{
  let stopped=false,loading=false,migrated=false;const controller=new AbortController();
  async function refresh(){
   if(loading||busy.current)return;loading=true;const version=revision.current;
   try{
    if(!migrated){
     let old={};try{old=JSON.parse(localStorage.getItem(prefix+userId)||'{}');}catch{}
     const rows=old&&typeof old==='object'?Object.entries(old).filter(([,value])=>typeof value==='boolean').map(([id,value])=>({usuario_id:userId,clave:'actividad:'+id,valor:value})):[];
     if(rows.length){const {error}=await supabase.from('campus_estado').upsert(rows,{onConflict:'usuario_id,clave',ignoreDuplicates:true}).abortSignal(controller.signal);if(error)throw error;}
     migrated=true;try{localStorage.removeItem(prefix+userId);}catch{}
    }
    const rows=[];for(let offset=0;;){const {data,error}=await supabase.from('campus_estado').select('clave,valor').eq('usuario_id',userId).order('clave').range(offset,offset+499).abortSignal(controller.signal);if(error)throw error;if(!data.length)break;rows.push(...data);offset+=data.length;}
    if(stopped||busy.current||version!==revision.current)return;
    const next=Object.fromEntries(rows.filter(r=>r.clave.startsWith('actividad:')).map(r=>[r.clave.slice(10),r.valor]));state.current=next;setCompleted(next);setHideCompleted(rows.find(r=>r.clave==='ocultar_completadas')?.valor||false);setReady(true);setError('');
   }catch(e){if(!stopped&&e.name!=='AbortError')setError('No se pudo sincronizar con Supabase. Revisa la conexión y ejecuta el SQL de sincronización de actividades.');}
   finally{loading=false;}
  }
  refresh();const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);
  return()=>{stopped=true;controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[userId]);
 async function save(key,value){
  if(!ready||busy.current)return;busy.current=true;revision.current++;setSaving(true);setError('');
  try{
   const {data,error}=await supabase.from('campus_estado').upsert({usuario_id:userId,clave:key,valor:value},{onConflict:'usuario_id,clave'}).select('clave,valor').single();
   if(error||!data)throw Error();
   if(key==='ocultar_completadas')setHideCompleted(data.valor);
   else{state.current={...state.current,[key.slice(10)]:data.valor};setCompleted(state.current);}
  }catch{setError('No se pudo guardar en Supabase. El cambio no se ha aplicado; vuelve a intentarlo.');}
  finally{busy.current=false;revision.current++;setSaving(false);}
 }
 return {completed,hideCompleted,ready,saving,error,toggleActivity:id=>save('actividad:'+id,!state.current[String(id)]),toggleFilter:()=>save('ocultar_completadas',!hideCompleted)};
}
