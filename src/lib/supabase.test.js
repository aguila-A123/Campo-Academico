import { afterEach, expect, it, vi } from 'vitest';
const auth=vi.hoisted(()=>({signInWithPassword:vi.fn(),setSession:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth})}));
import { signIn } from './supabase.js';
afterEach(()=>{vi.resetAllMocks();vi.unstubAllGlobals();});
it('uses Supabase Auth directly for email and preserves the password',async()=>{
  auth.signInWithPassword.mockResolvedValue({data:{session:{access_token:'test'}},error:null});
  await signIn({username:' user@example.com ',password:' exact password '});
  expect(auth.signInWithPassword).toHaveBeenCalledWith({email:'user@example.com',password:' exact password '});
});
it('does not disclose whether an email exists',async()=>{
  auth.signInWithPassword.mockResolvedValue({error:{status:400,message:'Internal auth details'}});
  await expect(signIn({username:'user@example.com',password:'wrong'})).rejects.toThrow('Usuario o contraseña incorrectos.');
});
it('exchanges a username for a session through the function, not a public email lookup',async()=>{
  const request=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({access_token:'test',refresh_token:'refresh'})});
  vi.stubGlobal('fetch',request);auth.setSession.mockResolvedValue({data:{session:{user:{id:'test'}}}});
  await signIn({username:'Fabrizio',password:'test-password'});
  expect(request.mock.calls[0][0]).toMatch(/functions\/v1\/login-usuario$/);
  expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({identifier:'Fabrizio',password:'test-password'});
  expect(auth.setSession).toHaveBeenCalledWith({access_token:'test',refresh_token:'refresh'});
});
it('keeps access closed when the username function is not installed',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:404}));
  await expect(signIn({username:'Fabrizio',password:'test'})).rejects.toThrow('aún no está activado');
  expect(auth.setSession).not.toHaveBeenCalled();
});
