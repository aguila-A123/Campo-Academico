let frame,ready,pending,counter=0;
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
export async function executeJava(request,signal){
  if(signal?.aborted)throw new DOMException('Cancelado','AbortError');
  const {files,entry,input=''}=request;
  const entries=Object.entries(files||{});
  if(!entries.length||entries.length>100||!files[entry])throw Error('Selecciona un proyecto y su clase principal.');
  if(entries.some(([name,source])=>! /^(?:[A-Za-z_$][\w$]*\/)*(?:[A-Za-z_$][\w$]*|package-info|module-info)\.java$/.test(name)||typeof source!=='string'))throw Error('Archivos Java inválidos.');
  if(new TextEncoder().encode(entries.map(([,s])=>s).join('')).length>1048576||input.length>64000)throw Error('El proyecto o la entrada supera el tamaño permitido.');
  await initialize();if(signal?.aborted)throw new DOMException('Cancelado','AbortError');
  if(pending)await pending.catch(()=>{});
  if(signal?.aborted)throw new DOMException('Cancelado','AbortError');
  await initialize();
  const task=new Promise((resolve,reject)=>{
    const id=++counter;
    const cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',listen);signal?.removeEventListener('abort',abort);};
    const abort=()=>{cleanup();destroy();reject(new DOMException('Cancelado','AbortError'));};
    const timer=setTimeout(()=>{cleanup();destroy();resolve({compiled:false,diagnostics:[],compilerOutput:'Proceso detenido por límite de tiempo.',stdout:'',stderr:'',exitCode:1,timedOut:true});},45000);
    function listen(event){if(event.source!==frame?.contentWindow||event.origin!==location.origin||!event.data?.campusJava||event.data.id!==id)return;cleanup();if(event.data.type==='result')resolve(event.data.result);else reject(Error(event.data.message));}
    window.addEventListener('message',listen);signal?.addEventListener('abort',abort,{once:true});
    frame.contentWindow.postMessage({type:'execute',id,...request},location.origin);
  });pending=task;
  try{return await task;}finally{if(pending===task)pending=null;}
}
