// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {renderHook,act,waitFor,cleanup} from '@testing-library/react';
import {useActivityState} from './useActivityState.js';
const mock=vi.hoisted(()=>({from:vi.fn()}));
vi.mock('../../lib/supabase.js',()=>({supabase:{from:mock.from}}));
let rows,fail,query,mode,payload,offset;
beforeEach(()=>{
 localStorage.clear();rows=[{clave:'actividad:a',valor:true},{clave:'ocultar_completadas',valor:true}];fail=false;mode='read';offset=0;
 query={select:vi.fn(()=>query),eq:vi.fn(()=>query),order:vi.fn(()=>query),range:vi.fn(start=>{offset=start;return query;}),abortSignal:vi.fn(()=>query),upsert:vi.fn(value=>{mode='write';payload=value;return query;}),single:vi.fn(async()=>fail?{error:Error('offline')}:{data:payload})};
 query.then=(resolve,reject)=>Promise.resolve(mode==='write'?{data:null,error:null}:{data:offset?[]:rows,error:null}).then(resolve,reject);
 mock.from.mockImplementation(()=>{mode='read';return query;});
});
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('loads activity marks and filter from the account, and persists unmarking',async()=>{
 const {result}=renderHook(()=>useActivityState('user'));await waitFor(()=>expect(result.current.ready).toBe(true));
 expect(result.current.completed.a).toBe(true);expect(result.current.hideCompleted).toBe(true);
 await act(()=>result.current.toggleActivity('a'));
 expect(query.upsert).toHaveBeenCalledWith({usuario_id:'user',clave:'actividad:a',valor:false},{onConflict:'usuario_id,clave'});expect(result.current.completed.a).toBe(false);
 expect(query.eq).toHaveBeenCalledWith('usuario_id','user');
});
it('does not apply or report success for a failed write',async()=>{
 const {result}=renderHook(()=>useActivityState('user'));await waitFor(()=>expect(result.current.ready).toBe(true));fail=true;
 await act(()=>result.current.toggleActivity('a'));expect(result.current.completed.a).toBe(true);expect(result.current.error).toContain('No se pudo guardar');
});
it('imports legacy marks without replacing cloud records and then removes local copy',async()=>{
 const key='campus:ojhoiwaimwqucbjjyerq:completed-tasks:v1:user';localStorage.setItem(key,JSON.stringify({a:true,b:false}));
 const {result}=renderHook(()=>useActivityState('user'));await waitFor(()=>expect(result.current.ready).toBe(true));
 expect(query.upsert).toHaveBeenCalledWith(expect.arrayContaining([{usuario_id:'user',clave:'actividad:b',valor:false}]),{onConflict:'usuario_id,clave',ignoreDuplicates:true});expect(localStorage.getItem(key)).toBeNull();
});
