import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { planTreeOperation } from '../src/tree-operations.js';
import { connectFolder, operateFolder } from './local-folders.mjs';
import { execute } from './core.mjs';
import { operateDirectory, readDirectory } from '../src/disk.js';
const files = {
  'src/a/Main.java':'package a; public class Main { public static void main(String[] args) { System.out.println(new Helper().value()); } }',
  'src/a/Helper.java':'package a; public class Helper { public Helper() {} public String value() { return "Helper"; } }'
};
test('class rename preserves literals and updates constructors and references', async () => {
  const p = planTreeOperation(files, {action:'rename',target:{kind:'file',path:'src/a/Helper.java'},newName:'Support'});
  assert.match(p.files['src/a/Support.java'], /public Support\(\)/);
  assert.match(p.files['src/a/Support.java'], /return "Helper"/);
  const r = await execute(p.files, 'src/a/Main.java'); assert.equal(r.exitCode,0); assert.match(r.stdout,/Helper/);
});
function browserHandle(root) {
  const missing = () => Object.assign(new Error('Missing'),{name:'NotFoundError'});
  async function info(filename,kind,create) {
    let s = await stat(filename).catch(e=>{ if(e.code!=='ENOENT')throw e; return null; });
    if(!s && !create) throw missing();
    if(s && s.isDirectory() !== (kind==='directory')) throw Object.assign(new Error('Wrong type'),{name:'TypeMismatchError'});
    if(!s && create) { if(kind==='directory')await mkdir(filename); else await writeFile(filename,''); }
  }
  const file = filename => ({kind:'file',name:path.basename(filename),async getFile(){const bytes=await readFile(filename),s=await stat(filename);const blob=new Blob([bytes]);blob.lastModified=s.mtimeMs;return blob;},async createWritable(){let bytes;return {async write(value){bytes=typeof value==='string'?value:Buffer.from(await value.arrayBuffer());},async close(){await writeFile(filename,bytes);},async abort(){}};}});
  return {kind:'directory',name:path.basename(root),queryPermission:async()=>'granted',isSameEntry:async other=>other.root===root,root,
    async *entries(){for(const item of await readdir(root,{withFileTypes:true}))yield [item.name,item.isDirectory()?browserHandle(path.join(root,item.name)):file(path.join(root,item.name))];},
    async getDirectoryHandle(name,{create=false}={}){const dest=path.join(root,name);await info(dest,'directory',create);return browserHandle(dest);},
    async getFileHandle(name,{create=false}={}){const dest=path.join(root,name);await info(dest,'file',create);return file(dest);},
    async removeEntry(name,{recursive=false}={}){await rm(path.join(root,name),{recursive});}
  };
}
test('browser physical folder moves copy assets, refactor Java and reject collisions',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'noir-browser-move-'));
  try{
    await mkdir(path.join(root,'src/a'),{recursive:true});await mkdir(path.join(root,'src/b'));
    for(const [f,s] of Object.entries(files))await writeFile(path.join(root,f),s);
    await writeFile(path.join(root,'src/a/nota.txt'),'Asset real');
    const connection={handle:browserHandle(root),baseline:{...files}};
    const created=await operateDirectory(connection,{action:'create-folder',destination:'src/b',newName:'tema2'});
    assert.ok(created.folders.includes('src/b/tema2'));
    await assert.rejects(operateDirectory(connection,{action:'create-folder',destination:'src/b',newName:'tema2'}),/Ya existe/);
    let p=await operateDirectory(connection,{action:'move',target:{kind:'folder',path:'src/a'},destination:'src/b'});
    assert.equal(await readFile(path.join(root,'src/b/a/nota.txt'),'utf8'),'Asset real');
    assert.equal((await execute(p.files,'src/b/a/Main.java')).exitCode,0);
    await assert.rejects(operateDirectory(connection,{action:'rename',target:{kind:'file',path:'src/b/a/Helper.java'},newName:'Main'}),/Ya existe/);
    p=await operateDirectory(connection,{action:'delete',target:{kind:'folder',path:'src/b/a'}});
    assert.deepEqual(await readDirectory(connection.handle),{});
  }finally{await rm(root,{recursive:true,force:true});}
});
test('moving a class updates its package and dependent imports', async () => {
  const p = planTreeOperation(files,{action:'move',target:{kind:'file',path:'src/a/Helper.java'},destination:'src/b'},['src/b']);
  assert.match(p.files['src/b/Helper.java'],/^package b;/);
  assert.match(p.files['src/a/Main.java'],/import b.Helper;/);
  assert.equal((await execute(p.files,'src/a/Main.java')).exitCode,0);
});
test('tree operations reject collisions, traversal and descendant moves', () => {
  assert.throws(()=>planTreeOperation(files,{action:'rename',target:{kind:'file',path:'src/a/Helper.java'},newName:'Main'}),/Ya existe/);
  assert.throws(()=>planTreeOperation(files,{action:'move',target:{kind:'folder',path:'src/a'},destination:'src/a/sub'}),/sí misma/);
  assert.throws(()=>planTreeOperation(files,{action:'delete',target:{kind:'file',path:'../Main.java'}}),/Ruta inválida/);
});
test('physical rename, folder move, root rename and deletion preserve real contents', async () => {
  const parent = await mkdtemp(path.join(tmpdir(),'noir-operations-'));
  try {
    let p = await connectFolder(parent,{create:true,name:'Proyecto',files});
    await mkdir(path.join(p.location,'src/b'));
    await writeFile(path.join(p.location,'src/a/nota.txt'),'Conservar');
    const run = async operation => p = await operateFolder(p.id,operation,p.revision);
    await run({action:'create-folder',destination:'src/b',newName:'tema2'});
    assert.ok(p.folders.includes('src/b/tema2'));
    await run({action:'rename',target:{kind:'file',path:'src/a/Helper.java'},newName:'Support'});
    await run({action:'move',target:{kind:'folder',path:'src/a'},destination:'src/b'});
    assert.equal(await readFile(path.join(p.location,'src/b/a/nota.txt'),'utf8'),'Conservar');
    assert.match(p.files['src/b/a/Main.java'],/^package b.a;/);
    assert.equal((await execute(p.files,'src/b/a/Main.java')).exitCode,0);
    await run({action:'rename',target:{kind:'root',path:''},newName:'Renombrado'});
    assert.equal(path.basename(p.location),'Renombrado');
    await run({action:'delete',target:{kind:'folder',path:'src/b/a'}});
    assert.deepEqual(p.files,{});
    assert.ok(p.folders.includes('src/b'));
    const result = await run({action:'delete',target:{kind:'root',path:''}});
    assert.equal(result.deleted,true);
    await assert.rejects(readFile(path.join(parent,'Renombrado/src/b/a/nota.txt')),{code:'ENOENT'});
  } finally { await rm(parent,{recursive:true,force:true}); }
});
