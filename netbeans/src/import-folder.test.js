import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importFolder} from './import-folder.js';
const file=(path,text='class A {}')=>({name:path.split('/').at(-1),webkitRelativePath:path,size:text.length,text:async()=>text});
test('imports Firefox-style folder selection with packages and filters build output',async()=>{
 const p=await importFolder([file('Ejercicios/src/fabrizio/Actividad1.java'),file('Ejercicios/build/Other.java'),file('Ejercicios/README.txt')]);
 assert.equal(p.name,'Ejercicios');assert.deepEqual(Object.keys(p.files),['src/fabrizio/Actividad1.java']);assert.deepEqual(p.folders,['src','src/fabrizio']);
});
test('rejects empty, oversized and ambiguous inputs',async()=>{
 await assert.rejects(importFolder([file('P/README.txt')]));
 await assert.rejects(importFolder([{...file('P/A.java'),size:1048577}]));
 await assert.rejects(importFolder([file('P/A.java'),file('P/A.java')]));
});
