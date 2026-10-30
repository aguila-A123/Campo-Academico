// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {renderHook,act,waitFor,cleanup} from '@testing-library/react';
import {useEmergencyChat} from './useEmergencyChat.js';
const mock=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn(),writes:[]}));
vi.mock('../../lib/supabase.js',()=>({supabase:{from:mock.from,rpc:mock.rpc}}));
let chats,rows,nextId,gates,insertGate,deleteFailure;
const a={id:7,activo:true,remitente:'Martin',origen:'alerta'};
const b={id:8,activo:true,remitente:'Sully',origen:'alerta'};
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
const copy=value=>JSON.parse(JSON.stringify(value));
beforeEach(()=>{
 chats=[{...a},{...b}];rows=[{id:1,chat_id:7,mensaje:'Solo A',direccion:'entrada'},{id:2,chat_id:8,mensaje:'Solo B',direccion:'entrada'}];
 nextId=10;gates=new Map();insertGate=null;deleteFailure=false;mock.writes=[];
 mock.rpc.mockImplementation(async(name,{p_chat})=>{chats=chats.map(c=>c.id===p_chat?{...c,activo:false}:c);return {data:true,error:null};});
 mock.from.mockImplementation(table=>{
  let operation='read',value,single=false;const filters=new Map();const q={};
  q.select=()=>q;q.order=()=>q;q.abortSignal=()=>q;
  q.eq=(key,value)=>{filters.set(key,value);return q;};
  q.maybeSingle=q.single=()=>{single=true;return q;};
  for(const method of ['insert','update','delete'])q[method]=v=>{operation=method;value=v;mock.writes.push({table,operation,value:v});return q;};
  q.then=(resolve,reject)=>Promise.resolve().then(async()=>{
   if(table==='emergency_chat_preferences')return {data:{valor:50},error:null};
   const key=table+':'+(filters.get('chat_id')??'list');
   if(operation==='read'&&gates.get(key)?.length)return await gates.get(key).shift().promise;
   const matches=row=>[...filters].every(([key,value])=>row[key]===value);
   if(operation==='insert'){
    if(insertGate)await insertGate.promise;
    const result={id:nextId++,...value};
    if(table==='emergency_chats')chats.push(result);else rows.push(result);
    return {data:copy(single?result:[result]),error:null};
   }
   if(operation==='delete'){
    if(deleteFailure)return {error:{message:'offline'}};
    if(table==='emergency_chats')chats=chats.filter(c=>!matches(c));else rows=rows.filter(c=>!matches(c));
    return {data:null,error:null};
   }
   let data=(table==='emergency_chats'?chats:rows).filter(matches);
   if(operation==='update')data.forEach(row=>Object.assign(row,value));
   return {data:copy(single?data[0]:data),error:null};
  }).then(resolve,reject);return q;
 });
});
afterEach(()=>{cleanup();vi.clearAllMocks();});
async function ready(result){await waitFor(()=>expect(result.current.loading).toBe(false));}
it('closes using the atomic RPC without a second browser-side outgoing insert',async()=>{
 const {result}=renderHook(()=>useEmergencyChat('user',true));await ready(result);
 await act(async()=>{expect(await result.current.closeChat(a)).toBe(true);});
 expect(mock.rpc).toHaveBeenCalledWith('emergency_cerrar_chat',{p_chat:7});
 expect(mock.writes).toEqual([]);expect(result.current.chats[0].activo).toBe(false);
});
it('preserves the chat when closure is not confirmed',async()=>{
 mock.rpc.mockResolvedValue({data:null,error:{message:'offline'}});
 const {result}=renderHook(()=>useEmergencyChat('user',true));await ready(result);
 await act(async()=>{expect(await result.current.closeChat(a)).toBe(false);});
 expect(result.current.chats[0].activo).toBe(true);expect(mock.writes).toEqual([]);
});
it('clears the previous history immediately and ignores its late response after switching',async()=>{
 const pendingA=deferred(),pendingB=deferred();
 gates.set('emergency_messages:7',[pendingA]);gates.set('emergency_messages:8',[pendingB]);
 const {result}=renderHook(()=>useEmergencyChat('user',true));await ready(result);
 act(()=>result.current.setSelectedChat(a));
 act(()=>result.current.setSelectedChat(b));
 expect(result.current.messages).toEqual([]);
 await act(async()=>{pendingA.resolve({data:[{id:1,chat_id:7,mensaje:'late A'}]});});
 expect(result.current.messages).toEqual([]);
 await act(async()=>{pendingB.resolve({data:[{id:2,chat_id:8,mensaje:'B'}]});});
 expect(result.current.messages.map(m=>m.mensaje)).toEqual(['B']);
});
it('does not append a delayed send from A to B or select A again',async()=>{
 const {result}=renderHook(()=>useEmergencyChat('user',true));await ready(result);
 act(()=>result.current.setSelectedChat(a));
 await waitFor(()=>expect(result.current.messages[0]?.mensaje).toBe('Solo A'));
 insertGate=deferred();let sending;
 act(()=>{sending=result.current.send('mensaje para A');});
 act(()=>result.current.setSelectedChat(b));
 expect(result.current.messages).toEqual([]);
 await act(async()=>{insertGate.resolve();await sending;});
 await waitFor(()=>expect(result.current.messages[0]?.mensaje).toBe('Solo B'));
 expect(result.current.selectedChat.id).toBe(8);
 expect(result.current.messages.every(m=>m.chat_id===8)).toBe(true);
});
it('deleting the selected chat clears its history and incoming badge without refreshing the page',async()=>{
 chats[0].activo=false;
 const {result}=renderHook(()=>useEmergencyChat('user',true));await ready(result);
 act(()=>result.current.setSelectedChat(chats[0]));
 await waitFor(()=>expect(result.current.messages.length).toBe(1));
 expect(result.current.incomingIds.has(7)).toBe(true);
 await act(async()=>{expect(await result.current.deleteChat({...a,activo:false})).toBe(true);});
 expect(result.current.selectedChat).toBeNull();expect(result.current.messages).toEqual([]);
 expect(result.current.chats.some(c=>c.id===7)).toBe(false);expect(result.current.incomingIds.has(7)).toBe(false);
 act(()=>result.current.setSelectedChat(result.current.fixedChats.find(c=>c.remitente==='Martin')));
 expect(result.current.messages).toEqual([]);
});
it('a snapshot started before deletion cannot resurrect the deleted chat',async()=>{
 chats[0].activo=false;
 const oldList=deferred();gates.set('emergency_chats:list',[oldList]);
 const {result}=renderHook(()=>useEmergencyChat('user',true));
 await waitFor(()=>expect(result.current.ready).toBe(true));
 const stale=copy(chats);
 await act(async()=>{await result.current.deleteChat({...a,activo:false});});
 await act(async()=>{oldList.resolve({data:stale,error:null});});
 expect(result.current.chats.some(c=>c.id===7)).toBe(false);
});
it('late history reads cannot reintroduce messages after deletion',async()=>{
 chats[0].activo=false;
 const late=deferred();gates.set('emergency_messages:7',[late]);
 const {result}=renderHook(()=>useEmergencyChat('user',true));await ready(result);
 act(()=>result.current.setSelectedChat({...a,activo:false}));
 await act(async()=>{await result.current.deleteChat({...a,activo:false});});
 await act(async()=>{late.resolve({data:[{id:1,chat_id:7,mensaje:'obsolete'}]});});
 expect(result.current.messages).toEqual([]);expect(result.current.selectedChat).toBeNull();
});
it('duplicate rows in a snapshot render once per message ID',async()=>{
 rows.push({...rows[0]});
 const {result}=renderHook(()=>useEmergencyChat('user',true));await ready(result);
 act(()=>result.current.setSelectedChat(a));
 await waitFor(()=>expect(result.current.messages.length).toBe(1));
});
it('does not lose the current selection if deleting a different closed chat',async()=>{
 chats[0].activo=false;
 const {result}=renderHook(()=>useEmergencyChat('user',true));await ready(result);
 act(()=>result.current.setSelectedChat(b));
 await act(async()=>{await result.current.deleteChat({...a,activo:false});});
 expect(result.current.selectedChat.id).toBe(8);
});
it('a failed deletion preserves the selection and history',async()=>{
 chats[0].activo=false;deleteFailure=true;
 const {result}=renderHook(()=>useEmergencyChat('user',true));await ready(result);
 act(()=>result.current.setSelectedChat({...a,activo:false}));
 await waitFor(()=>expect(result.current.messages.length).toBe(1));
 expect(result.current.incomingIds.has(7)).toBe(true);
 await act(async()=>{expect(await result.current.deleteChat({...a,activo:false})).toBe(false);});
 expect(result.current.selectedChat.id).toBe(7);expect(result.current.messages.length).toBe(1);
});
