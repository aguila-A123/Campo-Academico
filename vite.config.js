import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const publicRoots=Object.fromEntries(['pseint','netbeans'].map(name=>[name,fileURLToPath(new URL(`./${name}/public/`,import.meta.url))]));
const pseintAssets={name:'pseint-dev-assets',configureServer(server){
  server.middlewares.use(async(req,res,next)=>{
    const name=req.url?.split('/')[1];
    const pseintPublic=publicRoots[name];
    if(!pseintPublic)return next();
    try{
      const relative=decodeURIComponent(req.url.split('?')[0].slice(name.length+2));
      const file=path.resolve(pseintPublic,relative);
      const inside=path.relative(pseintPublic,file);
      if(inside.startsWith('..')||path.isAbsolute(inside))return next();
      const bytes=await readFile(file);
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.jar':'application/java-archive','.mjs':'text/javascript','.wasm':'application/wasm','.svg':'image/svg+xml','.ttf':'font/ttf'};
      res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(bytes);
    }catch{next();}
  });
}};
export default defineConfig({ plugins: [react(),pseintAssets] });
