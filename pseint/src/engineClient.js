function worker(){return new Worker(new URL('./engine.worker.js',import.meta.url),{type:'module'});}
export function analyzeSource(source,signal){return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('Cancelado','AbortError'));return;}
  const task=worker();
  const cancel=()=>{cleanup();reject(new DOMException('Cancelado','AbortError'));};
  const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);task.terminate();};
  const timer=setTimeout(()=>{cleanup();reject(Error('El análisis tardó demasiado.'));},20000);
  signal?.addEventListener('abort',cancel,{once:true});
  task.onmessage=({data})=>{if(data.type==='analysis'){cleanup();resolve(data.result);}else if(data.type==='failure'){cleanup();reject(Error(data.message));}};
  task.onerror=()=>{cleanup();reject(Error('No se pudo iniciar el motor del navegador.'));};
  task.postMessage({type:'analyze',source});
});}
export function createEngineSession(onMessage){
  let task=null,timer;
  const stop=()=>{clearTimeout(timer);task?.terminate();task=null;};
  return {
    send(json){const message=JSON.parse(json);
      if(message.type==='stop'){stop();onMessage({type:'exit',stopped:true,code:null});}
      else if(message.type==='input')task?.postMessage(message);
      else if(message.type==='run'){
        stop();task=worker();
        task.onmessage=({data})=>{onMessage(data);if(['exit','failure'].includes(data.type))stop();};
        task.onerror=()=>{stop();onMessage({type:'failure',message:'No se pudo ejecutar PSeInt en el navegador.'});};
        timer=setTimeout(()=>{stop();onMessage({type:'failure',message:'Límite de ejecución de 10 minutos alcanzado.'});},600000);
        task.postMessage(message);
      }
    },close:stop
  };
}
