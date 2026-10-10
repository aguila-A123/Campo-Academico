let frame,ready,counter=0;
let queue=Promise.resolve();
export function executeJava(request,signal,onEvent) {
  const task=queue.then(()=>runJava(request,signal,onEvent));
  queue=task.catch(()=>{});
  return task;
}
function destroy(){frame?.remove();frame=null;ready=null;}
function initialize(){
  if(ready)return ready;
  ready=new Promise((resolve,reject)=>{
    frame=document.createElement('iframe');frame.hidden=true;frame.title='Motor Java 17';
    const fail=error=>{clearTimeout(timer);window.removeEventListener('message',listen);destroy();reject(error);};
    const timer=setTimeout(()=>fail(Error('Java está tardando en cargar. Comprueba la conexión y vuelve a intentarlo.')),120000);
    function listen(event){
      if(event.source!==frame?.contentWindow||event.origin!==location.origin||!event.data?.campusJava)return;
      if(event.data.type==='ready'){clearTimeout(timer);window.removeEventListener('message',listen);resolve();}
      else if(event.data.type==='failure')fail(Error(event.data.message));
    }
    window.addEventListener('message',listen);
    // Runtime is a public asset under the same deployed application.
    frame.src='/netbeans/runner.html';document.body.append(frame);
  });return ready;
}
async function runJava(request,signal,onEvent){
  if(signal?.aborted)throw new DOMException('Cancelado','AbortError');
  const {files,entry,input=''}=request;
  const entries=Object.entries(files||{});
  if(!entries.length||entries.length>100||!files[entry])throw Error('Selecciona un proyecto y su clase principal.');
  if(entries.some(([name,source])=>! /^(?:[A-Za-z_$][\w$]*\/)*(?:[A-Za-z_$][\w$]*|package-info|module-info)\.java$/.test(name)||typeof source!=='string'))throw Error('Archivos Java inválidos.');
  if(new TextEncoder().encode(entries.map(([,s])=>s).join('')).length>1048576||input.length>64000)throw Error('El proyecto o la entrada supera el tamaño permitido.');
  await new Promise((resolve,reject)=>{
    const abort=()=>{signal?.removeEventListener('abort',abort);reject(new DOMException('Cancelado','AbortError'));};
    signal?.addEventListener('abort',abort,{once:true});
    initialize().then(()=>{signal?.removeEventListener('abort',abort);resolve();},error=>{signal?.removeEventListener('abort',abort);reject(error);});
  });
  if(signal?.aborted)throw new DOMException('Cancelado','AbortError');
  const task=new Promise((resolve,reject)=>{
    const id=++counter;
    let timer,remaining=45000,started=performance.now(),waiting=false;
    const cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',listen);signal?.removeEventListener('abort',abort);};
    const abort=()=>{cleanup();destroy();reject(new DOMException('Cancelado','AbortError'));};
    const expired=()=>{cleanup();destroy();resolve({compiled:false,diagnostics:[],compilerOutput:'Proceso detenido por límite de tiempo.',stdout:'',stderr:'',exitCode:1,timedOut:true});};
    const resumeTimer=()=>{started=performance.now();timer=setTimeout(expired,Math.max(1,remaining));};
    function listen(event){
      const data=event.data;
      if(event.source!==frame?.contentWindow||event.origin!==location.origin||!data?.campusJava||data.id!==id)return;
      if(data.type==='output'){onEvent?.(data);return;}
      if(data.type==='input-request'){
        clearTimeout(timer);remaining-=performance.now()-started;waiting=true;
        onEvent?.({type:'input-request',reply:(text,eof=false)=>{
          if(!waiting||signal?.aborted||!frame)return;
          waiting=false;resumeTimer();frame.contentWindow.postMessage({type:'stdin',id,text,eof},location.origin);
        }});return;
      }
      cleanup();if(data.type==='result')resolve(data.result);else reject(Error(data.message));
    }
    resumeTimer();
    window.addEventListener('message',listen);signal?.addEventListener('abort',abort,{once:true});
    frame.contentWindow.postMessage({type:'execute',id,...request},location.origin);
  });
  return task;
}
