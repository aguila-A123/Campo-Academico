import {executeEngine} from './browserEngine.js';
let resolveInput;
self.onmessage=async({data})=>{
  if(data.type==='input'){resolveInput?.(data.text);resolveInput=null;return;}
  if(data.type!=='run'&&data.type!=='analyze')return;
  try{
    const base=new URL('/pseint/engine/',self.location.origin);
    const factory=(await import(/* @vite-ignore */new URL('pseint.mjs',base).href)).default;
    const [wasmResponse,profileResponse]=await Promise.all([fetch(new URL('pseint.wasm',base)),fetch(new URL('Flexible',base))]);
    if(!wasmResponse.ok||!profileResponse.ok)throw Error('No se pudo cargar el motor de PSeInt. Recarga e inténtalo de nuevo.');
    const result=await executeEngine({factory,wasmBinary:new Uint8Array(await wasmResponse.arrayBuffer()),profile:new Uint8Array(await profileResponse.arrayBuffer()),source:data.source,analyze:data.type==='analyze',send:message=>postMessage(message),readLine:()=>new Promise(resolve=>{resolveInput=resolve;})});
    if(data.type==='analyze')postMessage({type:'analysis',result});
  }catch(error){postMessage({type:'failure',message:error.message||String(error)});}
};
