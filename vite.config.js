import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const pseintPublic=fileURLToPath(new URL('./pseint/public/',import.meta.url));
const pseintAssets={name:'pseint-dev-assets',configureServer(server){
  server.middlewares.use(async(req,res,next)=>{
    if(!req.url?.startsWith('/pseint/'))return next();
    try{
      const relative=decodeURIComponent(req.url.split('?')[0].slice('/pseint/'.length));
      const file=path.resolve(pseintPublic,relative);
      const inside=path.relative(pseintPublic,file);
      if(inside.startsWith('..')||path.isAbsolute(inside))return next();
      const bytes=await readFile(file);
      const types={'.mjs':'text/javascript','.wasm':'application/wasm','.svg':'image/svg+xml','.ttf':'font/ttf'};
      res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(bytes);
    }catch{next();}
  });
}};
export default defineConfig({ plugins: [react(),pseintAssets] });
