import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabase.js';

const defaults={valor:50,x:null,y:null,ancho:null,alto:null};
const FIXED_REMITENTES=['Martin','Sully'];

export function useEmergencyChat(userId,opened){
 const [prefs,setPrefs]=useState(defaults),[saved,setSaved]=useState(null),[ready,setReady]=useState(false),[saving,setSaving]=useState(false);
 const [chats,setChats]=useState([]),[messages,setMessages]=useState([]),[selectedChat,setSelectedChat]=useState(null);
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
  let alive=true;
  async function refresh(){
   try{
    const [{data,error:chatError},{data:incoming,error:incomingError}]=await Promise.all([
     supabase.from('emergency_chats').select('id,remitente,activo,inicio_enviado,origen,created_at,closed_at').order('created_at',{ascending:true}),
     supabase.from('emergency_messages').select('id,chat_id').eq('direccion','entrada').order('created_at',{ascending:true})
    ]);
    if(chatError)throw chatError;if(incomingError)throw incomingError;
    if(alive){
     const nextIncoming=new Set((incoming||[]).map(row=>row.chat_id));
     const nextIds=new Set((incoming||[]).map(row=>row.id));
     if(knownIncomingIds.current){
      setAlertIds(previous=>new Set([...previous,...(incoming||[]).filter(row=>!knownIncomingIds.current.has(row.id)).map(row=>row.chat_id)]));
     }
     knownIncomingIds.current=nextIds;
     setIncomingIds(nextIncoming);setChats(data||[]);setError('');
    }
   }
   catch{if(alive)setError('No se pudieron cargar los chats de emergencia.');}
   finally{if(alive)setLoading(false);}
  }
  refresh();const timer=setInterval(refresh,1500);return()=>{alive=false;clearInterval(timer);};
 },[userId]);
 useEffect(()=>{
  if(!userId||!opened||!selectedChat)return;
  let alive=true;
  async function refresh(){
   try{const {data,error:loadError}=await supabase.from('emergency_messages').select('id,chat_id,remitente,mensaje,direccion,enviado,created_at,enviado_por').eq('chat_id',selectedChat.id).order('created_at',{ascending:true});if(loadError)throw loadError;if(alive){setMessages(data||[]);setError('');}}
   catch{if(alive)setError('No se pudieron cargar los mensajes.');}
  }
  refresh();const timer=setInterval(refresh,1500);return()=>{alive=false;clearInterval(timer);};
 },[userId,opened,selectedChat]);
 async function send(raw){
  const mensaje=raw.trim();if(!mensaje||!selectedChat||sending)return false;
  setSending(true);setError('');
  try{
   let target=selectedChat;
   if(selectedChat.fixed){
    const {data:created,error:createError}=await supabase.from('emergency_chats').insert({remitente:selectedChat.remitente,activo:true,inicio_enviado:false,origen:'fijado'}).select('id,remitente,activo,inicio_enviado,origen,created_at,closed_at').single();
    if(createError)throw createError;
    target=created;setChats(rows=>[...rows,created]);setSelectedChat(created);
   }else if(!selectedChat.activo){
    const {data:reopened,error:reopenError}=await supabase.from('emergency_chats').update({activo:true,closed_at:null}).eq('id',selectedChat.id).select('id,remitente,activo,inicio_enviado,origen,created_at,closed_at').single();
    if(reopenError)throw reopenError;
    target=reopened;setChats(rows=>rows.map(row=>row.id===reopened.id?reopened:row));setSelectedChat(reopened);
   }
   const {data,error:sendError}=await supabase.from('emergency_messages').insert({chat_id:target.id,remitente:target.remitente,mensaje,direccion:'salida',enviado:false,enviado_por:userId}).select('id,chat_id,remitente,mensaje,direccion,enviado,created_at,enviado_por').single();
   if(sendError)throw sendError;
   setMessages(rows=>rows.some(row=>row.id===data.id)?rows:[...rows,data]);
   setAlertIds(previous=>{
    const next=new Set(previous);
    if(target)next.delete(target.id);
    return next;
   });
   return true;
  }catch{setError('No se pudo enviar el mensaje de emergencia.');return false;}
  finally{setSending(false);}
 }
 async function closeChat(chat){
  if(!chat)return false;
  setError('');
  try{
   const {error:updateError}=await supabase.from('emergency_chats').update({activo:false,closed_at:new Date().toISOString()}).eq('id',chat.id);
   if(updateError)throw updateError;
   const {error:messageError}=await supabase.from('emergency_messages').insert({chat_id:chat.id,remitente:chat.remitente,mensaje:'🚨 El Chat de Emergencia se cerró. Si necesitas ayuda, escribe /alerta <mensaje>.',direccion:'salida',enviado:false,enviado_por:userId});
   if(messageError)throw messageError;
   setAlertIds(previous=>{const next=new Set(previous);next.delete(chat.id);return next;});
   setChats(rows=>rows.map(row=>row.id===chat.id?{...row,activo:false,closed_at:new Date().toISOString()}:row));setSelectedChat(row=>row?.id===chat.id?{...row,activo:false,closed_at:new Date().toISOString()}:row);return true;
  }catch{setError('No se pudo cerrar el chat de emergencia.');return false;}
 }
 async function deleteChat(chat){
  if(!chat)return false;
  setError('');
  try{
   const {error:messagesError}=await supabase.from('emergency_messages').delete().eq('chat_id',chat.id);
   if(messagesError)throw messagesError;
   const {error:chatError}=await supabase.from('emergency_chats').delete().eq('id',chat.id);
   if(chatError)throw chatError;
   setAlertIds(previous=>{const next=new Set(previous);next.delete(chat.id);return next;});
   setChats(rows=>rows.filter(row=>row.id!==chat.id));setSelectedChat(null);return true;
  }catch{setError('No se pudo borrar el chat de emergencia.');return false;}
 }
 const fixedChats=FIXED_REMITENTES.map(name=>chats.find(chat=>chat.remitente===name)||{id:`fixed-${name}`,remitente:name,activo:false,fixed:true});
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
