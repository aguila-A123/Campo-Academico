import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const sdk=path.resolve(root,'../../.tools/emsdk');
const python=path.join(sdk,'python/3.13.3_64bit/python.exe');
const sources=readFileSync(path.join(root,'engine-source/pseint/Makefile.common'),'utf8').split('\n')[0].match(/\/([A-Za-z_]+)\.o/g).map(s=>s.slice(1,-2)+'.cpp');
const args=[path.join(sdk,'upstream/emscripten/em++.py'),...sources,'-O2','-DUSE_ZOCKETS','-std=c++17','-Wno-invalid-source-encoding','-sASYNCIFY','-sASYNCIFY_STACK_SIZE=131072','-sALLOW_MEMORY_GROWTH','-sSTACK_SIZE=5242880','-sMODULARIZE','-sEXPORT_ES6','-sENVIRONMENT=web,worker,node','-sFORCE_FILESYSTEM','-sEXIT_RUNTIME=1','-sEXPORTED_RUNTIME_METHODS=FS,callMain,HEAPU8','-sEXPORTED_FUNCTIONS=_main,_malloc,_free','-o',path.join(root,'public/engine/pseint.mjs')];
const result=spawnSync(python,args,{cwd:path.join(root,'engine-source/pseint'),stdio:'inherit'});process.exit(result.status??1);


