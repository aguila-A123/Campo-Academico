// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {renderHook,act,waitFor,cleanup} from '@testing-library/react';
import {useEmergencyChat} from './useEmergencyChat.js';
const mock=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn(),writes:[]}));
vi.mock('../../lib/supabase.js',()=>({supabase:{from:mock.from,rpc:mock.rpc}}));
beforeEach(()=>{
 mock.writes=[];mock.rpc.mockResolvedValue({data:true,error:null});
 mock.from.mockImplementation(table=>{
  const q={};for(const method of ['select','eq','order','maybeSingle'])q[method]=()=>q;
  q.insert=value=>{mock.writes.push({table,value});return q;};
  q.update=value=>{mock.writes.push({table,value});return q;};
  const data=table==='emergency_chat_preferences'?{valor:50}:
   table==='emergency_chats'?[{id:7,activo:true,remitente:'Test',origen:'alerta'}]:[{id:1,chat_id:7}];
  q.then=(resolve,reject)=>Promise.resolve({data,error:null}).then(resolve,reject);return q;
 });
});
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('closes using the atomic RPC without a second browser-side outgoing insert',async()=>{
 const {result}=renderHook(()=>useEmergencyChat('user',true));
 await waitFor(()=>expect(result.current.loading).toBe(false));
 await act(async()=>{expect(await result.current.closeChat({id:7})).toBe(true);});
 expect(mock.rpc).toHaveBeenCalledWith('emergency_cerrar_chat',{p_chat:7});
 expect(mock.writes).toEqual([]);
 expect(result.current.chats[0].activo).toBe(false);
});
it('preserves the chat when closure is not confirmed',async()=>{
 mock.rpc.mockResolvedValue({data:null,error:{message:'offline'}});
 const {result}=renderHook(()=>useEmergencyChat('user',true));
 await waitFor(()=>expect(result.current.loading).toBe(false));
 await act(async()=>{expect(await result.current.closeChat({id:7})).toBe(false);});
 expect(result.current.chats[0].activo).toBe(true);
 expect(result.current.error).toMatch(/cerrar/);
 expect(mock.writes).toEqual([]);
});
