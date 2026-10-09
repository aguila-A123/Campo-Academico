import {executeJava} from './browserRunner.js';
import {planTreeOperation} from './tree-operations.js';
const copies=new Map();
export async function campusApi(url,options={}){
  const body=options.body?JSON.parse(options.body):{};
  if(url==='/health')return {runner:'Java 17 · navegador',nativeFolders:false};
  if(url==='/execute')return executeJava(body,options.signal);
  if(url==='/projects'&&options.method==='POST'){
    const p={id:crypto.randomUUID(),name:body.name||'Proyecto importado',files:body.files||{},folders:body.folders||[],revision:1,storage:'session'};copies.set(p.id,p);return p;
  }
  if(url==='/projects')return [...copies.values()].map(p=>({...p,count:Object.keys(p.files).length}));
  const match=url.match(/^\/projects\/([^/]+)(\/operate)?$/);
  if(match){const p=copies.get(match[1]);if(!p)throw Error('La copia ya no está en esta pestaña. Abre de nuevo el archivo de respaldo.');
    if(match[2]){const plan=planTreeOperation(p.files,body.operation,p.folders);if(body.operation.action==='delete'&&body.operation.target.kind==='root'){copies.delete(p.id);return {deleted:true};}Object.assign(p,{files:plan.files,folders:plan.folders,revision:p.revision+1});if(body.operation.target?.kind==='root'&&body.operation.action==='rename')p.name=plan.newName;}
    else if(options.method==='PUT')Object.assign(p,{files:body.files,revision:p.revision+1});
    return {...p};
  }
  throw Error('Esta acción necesita una carpeta seleccionada en el navegador.');
}
