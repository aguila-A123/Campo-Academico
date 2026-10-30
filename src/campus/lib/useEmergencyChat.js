import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabase.js';

const defaults={valor:50,x:null,y:null,ancho:null,alto:null};
const FIXED_REMITENTES=['Martin','Sully'];
const uniqueRows=rows=>[...new Map((rows||[]).map(row=>[row.id,row])).values()];

export function useEmergencyChat(userId,opened){
 const [prefs,setPrefs]=useState(defaults),[saved,setSaved]=useState(null),[ready,setReady]=useState(false),[saving,setSaving]=useState(false);
 const [chats,setChats]=useState([]),[messageSnapshot,setMessageSnapshot]=useState({chatId:null,rows:[]}),[selectedChat,selectChat]=useState(null);
 const selectedRef=useRef(null),revision=useRef(0),mutating=useRef(0),sendBusy=useRef(false),deleted=useRef(new Set());
 const [reload,setReload]=useState(0);
 const setSelectedChat=useCallback(value=>{
  const next=typeof value==='function'?value(selectedRef.current):value;
  if(next?.id!==selectedRef.current?.id)setMessageSnapshot({chatId:next?.id??null,rows:[]});
  selectedRef.current=next;selectChat(next);
 },[]);
 const selectedId=selectedChat?.id??null;
 const messages=messageSnapshot.chatId===selectedId?messageSnapshot.rows:[];
 function beginMutation(){mutating.current++;revision.current++;}
 function endMutation(){mutating.current--;revision.current++;setReload(value=>value+1);}
 const [incomingIds,setIncomingIds]=useState(new Set()),[alertIds,setAlertIds]=useState(new Set());
 const knownIncomingIds=useRef(null);
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[sending,setSending]=useState(false);
 const dirty=!saved||prefs.valor!==saved.valor||(prefs.x??null)!==(saved.x??null)||(prefs.y??null)!==(saved.y??null)||(prefs.ancho??null)!==(saved.ancho??null)||(prefs.alto??null)!==(saved.alto??null);
 useEffect(()=>{
  if(!userId)return;
  let alive=true;
  supabase.from('emergency_chat_preferences').select('valor,x,y,ancho,alto').eq('usuario_id',userId).maybeSingle().then(({data,error:loadError})=>{
   if(!alive)return;
   if(loadError){setError('No se pudieron cargar los ajustes de Emergencias.');return;}
   const next={...defaults,...(data||{})};setPrefs(next);setSaved(data?next:null);setReady(true);
  }).catch(()=>alive&&setError('No se pudieron cargar los ajustes de Emergencias.'));
  return()=>{alive=false;};
 },[userId]);
 useEffect(()=>{
  if(!ready||!dirty)return;
  let alive=true;const timer=setTimeout(async()=>{
   setSaving(true);
   try{const {data,error:saveError}=await supabase.from('emergency_chat_preferences').upsert({usuario_id:userId,...prefs},{onConflict:'usuario_id'}).select('valor,x,y,ancho,alto').single();if(saveError)throw saveError;if(alive)setSaved({...defaults,...data});}
   catch{if(alive)setError('No se guardaron los ajustes de Emergencias.');}
   finally{if(alive)setSaving(false);}
  },350);
  return()=>{alive=false;clearTimeout(timer);};
 },[prefs,ready,userId,dirty]);
 useEffect(()=>{
  if(!userId)return;
  let alive=true,inFlight=false;const controller=new AbortController();
  async function refresh(){
   if(inFlight||mutating.current)return;
   inFlight=true;const version=revision.current;
   const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(10000)]);
   try{
    const [{data,error:chatError},{data:incoming,error:incomingError}]=await Promise.all([
     supabase.from('emergency_chats').select('id,remitente,activo,inicio_enviado,origen,created_at,closed_at').order('created_at',{ascending:true}).abortSignal(signal),
     supabase.from('emergency_messages').select('id,chat_id').eq('direccion','entrada').order('created_at',{ascending:true}).abortSignal(signal)
    ]);
    if(chatError)throw chatError;if(incomingError)throw incomingError;
    if(alive&&version===revision.current){
     const rows=uniqueRows(data).filter(row=>!deleted.current.has(row.id));
     const existing=new Set(rows.map(row=>row.id));
     const entries=uniqueRows(incoming).filter(row=>existing.has(row.chat_id));
     const nextIncoming=new Set(entries.map(row=>row.chat_id));
     const nextIds=new Set(entries.map(row=>row.id));
     if(knownIncomingIds.current){
      setAlertIds(previous=>new Set([...previous,...entries.filter(row=>!knownIncomingIds.current.has(row.id)).map(row=>row.chat_id)].filter(id=>existing.has(id))));
     }
     knownIncomingIds.current=nextIds;
     setIncomingIds(nextIncoming);setChats(rows);setError('');
     const current=selectedRef.current;
     if(current&&!current.fixed){
      const latest=rows.find(row=>row.id===current.id);
      setSelectedChat(latest||null);
     }
    }
   }
   catch{if(alive&&version===revision.current)setError('No se pudieron cargar los chats de emergencia.');}
   finally{inFlight=false;if(alive)setLoading(false);}
  }
  refresh();const timer=setInterval(refresh,1500);return()=>{alive=false;controller.abort();clearInterval(timer);};
 },[userId,reload,setSelectedChat]);
 useEffect(()=>{
  if(!userId||!opened||selectedId==null||selectedChat?.fixed)return;
  const chatId=selectedId;
  let alive=true,inFlight=false;const controller=new AbortController();
  async function refresh(){
   if(inFlight||mutating.current)return;
   inFlight=true;const version=revision.current;
   try{
    const {data,error:loadError}=await supabase.from('emergency_messages').select('id,chat_id,remitente,mensaje,direccion,enviado,created_at,enviado_por').eq('chat_id',chatId).order('created_at',{ascending:true}).abortSignal(AbortSignal.any([controller.signal,AbortSignal.timeout(10000)]));
    if(loadError)throw loadError;
    if(alive&&selectedRef.current?.id===chatId&&version===revision.current&&!deleted.current.has(chatId)){
     setMessageSnapshot({chatId,rows:uniqueRows(data).filter(row=>row.chat_id===chatId)});setError('');
    }
   }
   catch{if(alive&&selectedRef.current?.id===chatId&&version===revision.current)setError('No se pudieron cargar los mensajes.');}
   finally{inFlight=false;}
  }
  refresh();const timer=setInterval(refresh,1500);return()=>{alive=false;controller.abort();clearInterval(timer);};
 },[userId,opened,selectedId,selectedChat?.fixed,reload]);
 async function send(raw){
  const source=selectedRef.current;
  const mensaje=raw.trim();if(!mensaje||!source||sendBusy.current||deleted.current.has(source.id))return false;
  sendBusy.current=true;beginMutation();
  setSending(true);setError('');
  try{
   let target=source;
   if(source.fixed){
    const {data:created,error:createError}=await supabase.from('emergency_chats').insert({remitente:source.remitente,activo:true,inicio_enviado:false,origen:'fijado'}).select('id,remitente,activo,inicio_enviado,origen,created_at,closed_at').single();
    if(createError)throw createError;
    target=created;setChats(rows=>uniqueRows([...rows,created]));if(selectedRef.current?.id===source.id)setSelectedChat(created);
   }else if(!source.activo){
    const {data:reopened,error:reopenError}=await supabase.from('emergency_chats').update({activo:true,closed_at:null}).eq('id',source.id).select('id,remitente,activo,inicio_enviado,origen,created_at,closed_at').single();
    if(reopenError)throw reopenError;
    target=reopened;setChats(rows=>rows.map(row=>row.id===reopened.id?reopened:row));if(selectedRef.current?.id===source.id)setSelectedChat(reopened);
   }
   const {data,error:sendError}=await supabase.from('emergency_messages').insert({chat_id:target.id,remitente:target.remitente,mensaje,direccion:'salida',enviado:false,enviado_por:userId}).select('id,chat_id,remitente,mensaje,direccion,enviado,created_at,enviado_por').single();
   if(sendError)throw sendError;
   if(selectedRef.current?.id===target.id&&!deleted.current.has(target.id)){
    setMessageSnapshot(snapshot=>({chatId:target.id,rows:uniqueRows([...(snapshot.chatId===target.id?snapshot.rows:[]),data])}));
   }
   setAlertIds(previous=>{
    const next=new Set(previous);
    if(target)next.delete(target.id);
    return next;
   });
   return true;
  }catch{setError('No se pudo enviar el mensaje de emergencia.');return false;}
  finally{sendBusy.current=false;setSending(false);endMutation();}
 }
 async function closeChat(chat){
  if(!chat)return false;
  beginMutation();
  setError('');
  try{
   const {data:closed,error:closeError}=await supabase.rpc('emergency_cerrar_chat',{p_chat:chat.id});
   if(closeError||closed!==true)throw closeError||new Error('No se confirmó el cierre');
   setAlertIds(previous=>{const next=new Set(previous);next.delete(chat.id);return next;});
   setChats(rows=>rows.map(row=>row.id===chat.id?{...row,activo:false,closed_at:new Date().toISOString()}:row));setSelectedChat(row=>row?.id===chat.id?{...row,activo:false,closed_at:new Date().toISOString()}:row);return true;
  }catch{setError('No se pudo cerrar el chat de emergencia.');return false;}
  finally{endMutation();}
 }
 async function deleteChat(chat){
  if(!chat||chat.activo)return false;
  beginMutation();
  setError('');
  try{
   const {error:messagesError}=await supabase.from('emergency_messages').delete().eq('chat_id',chat.id);
   if(messagesError)throw messagesError;
   if(selectedRef.current?.id===chat.id)setMessageSnapshot({chatId:chat.id,rows:[]});
   const {error:chatError}=await supabase.from('emergency_chats').delete().eq('id',chat.id);
   if(chatError)throw chatError;
   deleted.current.add(chat.id);
   setAlertIds(previous=>{const next=new Set(previous);next.delete(chat.id);return next;});
   setIncomingIds(previous=>{const next=new Set(previous);next.delete(chat.id);return next;});
   setChats(rows=>rows.filter(row=>row.id!==chat.id));if(selectedRef.current?.id===chat.id)setSelectedChat(null);return true;
  }catch{setError('No se pudo borrar el chat de emergencia.');return false;}
  finally{endMutation();}
 }
 const newest=[...chats].reverse();
 const fixedChats=FIXED_REMITENTES.map(name=>newest.find(chat=>chat.remitente===name&&chat.activo)||newest.find(chat=>chat.remitente===name)||{id:`fixed-${name}`,remitente:name,activo:false,fixed:true});
 const activeChats=chats.filter(chat=>incomingIds.has(chat.id)).map(chat=>({...chat,alertCard:true}));
 const hasEmergencyAlert=alertIds.size>0;
 function acknowledgeChat(chat){
  if(!chat)return;
  setAlertIds(previous=>{
   const next=new Set(previous);
   next.delete(chat.id);
   return next;
  });
 }
 function clearAlerts(){setAlertIds(new Set());}
 return {prefs,ready,saving,dirty,setPrefs,chats,messages,selectedChat,setSelectedChat,loading,error,sending,send,closeChat,deleteChat,fixedChats,activeChats,incomingIds,alertIds,hasEmergencyAlert,acknowledgeChat,clearAlerts};
}
