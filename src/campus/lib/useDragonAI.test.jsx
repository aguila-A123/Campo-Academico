// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {renderHook,act,waitFor,cleanup,render,screen,fireEvent} from '@testing-library/react';
import {useState} from 'react';
import {useDragonAI} from './useDragonAI.js';
import {AISettings} from '../components/DragonAI.jsx';
const mock=vi.hoisted(()=>({from:vi.fn()}));
vi.mock('../../lib/supabase.js',()=>({supabase:{from:mock.from}}));
let fail,inserted,queries;
beforeEach(()=>{
 fail=false;inserted=null;queries=[];
 mock.from.mockImplementation(table=>{
  let operation='read',value;const q={};queries.push({table,q});
  for(const method of ['select','eq','order','limit','abortSignal','maybeSingle','single'])q[method]=vi.fn(()=>q);
  q.insert=vi.fn(v=>{operation='insert';value=v;inserted=v;return q;});q.upsert=vi.fn(v=>{operation='upsert';value=v;return q;});
  q.then=(resolve,reject)=>Promise.resolve(operation==='insert'?(fail?{error:{code:'500'}}:{data:{...value,estado:'pendiente',creado_en:'2026-10-02T10:00:00Z'}}):{data:table==='ia_preferencias'?(operation==='upsert'?{modelo:value.modelo,valor:value.valor}:{modelo:'gemini',valor:70}):[]}).then(resolve,reject);return q;
 });
});
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('loads account settings and snapshots provider/value into the queued prompt',async()=>{
 const {result}=renderHook(()=>useDragonAI('user-a',true));await waitFor(()=>expect(result.current.ready).toBe(true));
 await act(async()=>{expect(await result.current.send(' Hola ')).toBe(true);});
 expect(inserted).toMatchObject({usuario_id:'user-a',modelo:'gemini',valor:70,prompt:'Hola'});expect(result.current.messages[0].estado).toBe('pendiente');
 expect(queries.some(({q})=>q.eq.mock.calls.some(args=>args[0]==='usuario_id'&&args[1]==='user-a'))).toBe(true);
});
it('preserves the request id for retry after uncertain failure',async()=>{
 const {result}=renderHook(()=>useDragonAI('user-a',false));await waitFor(()=>expect(result.current.ready).toBe(true));fail=true;
 await act(async()=>{expect(await result.current.send('Hola')).toBe(false);});const id=inserted.id;expect(result.current.messages).toHaveLength(0);
 fail=false;await act(()=>result.current.send('Hola'));expect(inserted.id).toBe(id);
});
it('persists model selection automatically',async()=>{
 const {result}=renderHook(()=>useDragonAI('user-a',false));await waitFor(()=>expect(result.current.ready).toBe(true));
 act(()=>result.current.setPrefs({modelo:'chatgpt',valor:100}));await waitFor(()=>expect(queries.some(({q})=>q.upsert.mock.calls.length)).toBe(true));await waitFor(()=>expect(result.current.dirty).toBe(false));
});
it('allows exactly one provider and a range bounded 0 to 100',()=>{
 function Settings(){const [prefs,setPrefs]=useState({modelo:'chatgpt',valor:50});return <AISettings ai={{prefs,setPrefs,ready:true,saving:false,dirty:false}} onClose={()=>{}}/>;}
 render(<Settings/>);fireEvent.click(screen.getByRole('button',{name:'Gemini'}));expect(screen.getByRole('button',{name:'Gemini'}).getAttribute('aria-pressed')).toBe('true');expect(screen.getByRole('button',{name:'ChatGPT'}).getAttribute('aria-pressed')).toBe('false');expect(screen.getByRole('slider').min).toBe('0');expect(screen.getByRole('slider').max).toBe('100');
});
