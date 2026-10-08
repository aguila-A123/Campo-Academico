import {engineOperators} from './operators.js';
import {parseDump,makeDiagrams} from './diagram.mjs';
import {TerminalProtocol} from './terminalProtocol.js';

const decoder=new TextDecoder('windows-1252');
const characters=new Map(Array.from({length:256},(_,i)=>[decoder.decode(new Uint8Array([i])),i]));
export function encode(text){
  const bytes=[];
  for(const character of text){const byte=characters.get(character);if(byte===undefined)throw Error('PSeInt necesita caracteres compatibles con Windows-1252. Elimina emojis u otros símbolos no compatibles.');bytes.push(byte);}
  return new Uint8Array(bytes);
}

// Each task has its own instance and virtual filesystem, just as the local server
// used a separate native process. Only terminal I/O and sleeping were adapted.
export async function executeEngine({factory,wasmBinary,profile,source,analyze=false,send=()=>{},readLine=async()=>''}){
  if(typeof source!=='string'||new TextEncoder().encode(source).length>200000)throw Error('El código debe tener menos de 200 KB.');
  const code=encode(engineOperators(source));
  let output='',pending=[],runtimeErrors=false,outputSize=0;
  const protocol=new TerminalProtocol(message=>{if(message.type==='error-position'||(message.type==='output'&&/ERROR\s*\d+\s*:/i.test(message.text)))runtimeErrors=true;send(message);});
  function flush(){if(!pending.length)return;const text=decoder.decode(new Uint8Array(pending));pending=[];output+=text;if(!analyze)protocol.push(text);}
  let complete,fail;
  const finished=new Promise((resolve,reject)=>{complete=resolve;fail=reject;});
  const mod=await factory({wasmBinary,noInitialRun:true,onExit:complete,onAbort:reason=>fail(Error(String(reason))),printErr:()=>{},preRun:[m=>{
    m.FS.init(()=>null,byte=>{if(byte===null)return;if(++outputSize>2000000)throw Error('Límite de salida alcanzado.');pending.push(byte);if(byte===10||pending.length>=256)flush();},byte=>{if(byte!==null)pending.push(byte);});
  }]});
  mod.completed=()=>complete(0);
  mod.readLine=async key=>{
    flush();
    const text=await readLine(key?'key':'line');
    const bytes=encode(key?'\n':text);
    const pointer=mod._malloc(bytes.length+1);
    mod.HEAPU8.set(bytes,pointer);mod.HEAPU8[pointer+bytes.length]=0;
    return pointer;
  };
  mod.FS.writeFile('/programa.psc',code);
  mod.FS.writeFile('/Flexible',profile);
  const args=['/programa.psc','--nouser','--profile=/Flexible',...(analyze?['--draw','/diagram.psd','--writepositions']:['--forpseintterminal','--withioreferences'])];
  if(!analyze)send({type:'started'});
  try{mod.callMain(args);}catch(error){if(error.name==='ExitStatus')complete(error.status);else throw error;}
  const status=await finished;
  flush();protocol.flush();
  if(analyze){
    let raw;try{raw=decoder.decode(mod.FS.readFile('/diagram.psd'));}catch{return {valid:false,errors:output.trim()||'No se pudo generar el diagrama.',diagrams:[]};}
    return {valid:true,errors:'',diagrams:makeDiagrams(parseDump(raw))};
  }
  const result={type:'exit',code:status,errors:runtimeErrors};send(result);return result;
}
