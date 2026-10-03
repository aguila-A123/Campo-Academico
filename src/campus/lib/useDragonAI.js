import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabase.js';
const defaults={modelo:'chatgpt',modo:'fast',dragon:false,valor:50,x:null,y:null,ancho:null,alto:null};
const modePrefixes={fast:'Hola, el siguiente mensaje que te mandare, quiero que me respondas lo mas importante y lo mas corto posible',avanzado:'Hola, el siguiente mensaje que te mandare, respóndelo normal, no te limites, tranquilo'};
export function useDragonAI(userId,opened){
 const [prefs,setPrefs]=useState(defaults),[saved,setSaved]=useState(null),[ready,setReady]=useState(false),[saving,setSaving]=useState(false),[settingsError,setSettingsError]=useState(''),[reload,setReload]=useState(0),[saveRetry,setSaveRetry]=useState(0);
 const [messages,setMessages]=useState([]),[chatError,setChatError]=useState(''),[loading,setLoading]=useState(true),[sending,setSending]=useState(false),[chatReload,setChatReload]=useState(0);
 const busy=useRef(false),version=useRef(0),request=useRef(null);
 const dirty=!saved||prefs.modelo!==saved.modelo||(prefs.modo||defaults.modo)!==(saved.modo||defaults.modo)||Boolean(prefs.dragon)!==Boolean(saved.dragon)||prefs.valor!==saved.valor||(prefs.x??null)!==(saved.x??null)||(prefs.y??null)!==(saved.y??null)||(prefs.ancho??null)!==(saved.ancho??null)||(prefs.alto??null)!==(saved.alto??null);
 useEffect(()=>{
  let alive=true;const controller=new AbortController();setReady(false);
  if(!userId)return;
  supabase.from('ia_preferencias').select('modelo,modo,dragon,valor,x,y,ancho,alto').eq('usuario_id',userId).maybeSingle().abortSignal(controller.signal).then(({data,error})=>{if(!alive)return;if(error){setSettingsError('Ejecuta el SQL de IA en Supabase o revisa la conexión.');return;}const next={...defaults,...(data||{})};setPrefs(next);setSaved(data?next:null);setReady(true);setSettingsError('');}).catch(()=>{if(alive)setSettingsError('No se pudieron cargar las preferencias.');});
  return()=>{alive=false;controller.abort();};
 },[userId,reload]);
 useEffect(()=>{
  if(!ready||!dirty)return;
  let alive=true;const controller=new AbortController();
  const timer=setTimeout(async()=>{
   setSaving(true);setSettingsError('');
   try{const {data,error}=await supabase.from('ia_preferencias').upsert({usuario_id:userId,...prefs,modo:prefs.modo||defaults.modo,dragon:Boolean(prefs.dragon)},{onConflict:'usuario_id'}).select('modelo,modo,dragon,valor,x,y,ancho,alto').single().abortSignal(controller.signal);if(error)throw error;if(alive)setSaved({...defaults,...data});}
   catch{if(alive)setSettingsError('No se guardaron los ajustes. Pulsa Reintentar.');}
   finally{if(alive)setSaving(false);}
  },450);
  return()=>{alive=false;clearTimeout(timer);controller.abort();};
 },[prefs,ready,userId,dirty,saveRetry]);
 useEffect(()=>{
  if(!userId)return;
  let stopped=false,inFlight=false;const controller=new AbortController();
  async function refresh(){if(inFlight||busy.current)return;inFlight=true;const revision=version.current;
   try{const {data,error}=await supabase.from('ia_mensajes').select('id,modelo,dragon,valor,prompt,respuesta,estado,error,creado_en').eq('usuario_id',userId).order('creado_en',{ascending:false}).limit(50).abortSignal(controller.signal);if(error)throw error;if(!stopped&&revision===version.current){setMessages([...data].reverse());setChatError('');}}
   catch{if(!stopped)setChatError('No se pudieron cargar los mensajes. Revisa la conexión y el SQL de IA.');}
   finally{inFlight=false;if(!stopped)setLoading(false);}
  }
  refresh();const timer=setInterval(refresh,2000);return()=>{stopped=true;clearInterval(timer);controller.abort();};
 },[userId,chatReload]);
 async function send(raw){
  const prompt=raw.trim();if(!ready||dirty||saving||busy.current||!prompt)return false;
  const modelo=prefs.dragon?'gemini':prefs.modelo;
  const mensaje=`${modePrefixes[prefs.modo]||modePrefixes.fast}\n\n${prompt}`;
  if(mensaje.length>20000)return false;
  busy.current=true;version.current++;setSending(true);setChatError('');
  if(!request.current||request.current.prompt!==mensaje||request.current.modelo!==modelo||request.current.dragon!==Boolean(prefs.dragon)||request.current.valor!==prefs.valor)request.current={id:crypto.randomUUID(),usuario_id:userId,modelo,dragon:Boolean(prefs.dragon),valor:prefs.valor,prompt:mensaje};
  try{const payload=request.current;const {data,error}=await supabase.from('ia_mensajes').insert(payload).select('id,modelo,dragon,valor,prompt,respuesta,estado,error,creado_en').single();if(error){if(error.code==='23505'){request.current=null;setChatReload(n=>n+1);return true;}throw error;}setMessages(rows=>[...rows.filter(row=>row.id!==data.id),data].slice(-50));request.current=null;return true;}
  catch{setChatError('No se pudo confirmar el envío. El texto se conserva para reintentarlo.');return false;}
  finally{busy.current=false;version.current++;setSending(false);}
 }
 async function clearMessages(){
  if(!userId||busy.current)return false;
  const {error}=await supabase.from('ia_mensajes').delete().eq('usuario_id',userId);
  if(error){setChatError('No se pudo borrar el historial. Revisa la conexión y el SQL de IA.');return false;}
  version.current++;setMessages([]);setChatError('');return true;
 }
 const waiting=sending||messages.some(message=>message.estado==='pendiente'||message.estado==='procesando');
 return {prefs,ready,saving,dirty,settingsError,setPrefs,retrySettings:()=>ready?setSaveRetry(n=>n+1):setReload(n=>n+1),messages,chatError,loading,sending,waiting,send,clearMessages};
}
