import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import factory from './public/engine/pseint.mjs';
import {executeEngine} from './src/browserEngine.js';
import {examples} from './src/examples.js';
const wasmBinary=new Uint8Array(await readFile(new URL('./public/engine/pseint.wasm',import.meta.url)));
const profile=new Uint8Array(await readFile(new URL('./public/engine/Flexible',import.meta.url)));
const analyze=source=>executeEngine({factory,wasmBinary,profile,source,analyze:true});
async function run(source,inputs=[]){const events=[];await executeEngine({factory,wasmBinary,profile,source,send:e=>events.push(e),readLine:async()=>{await new Promise(r=>setTimeout(r,5));return inputs.shift()??'';}});return {output:events.filter(e=>e.type==='output').map(e=>e.text).join(''),events};}
test('Todos los ejemplos generan diagramas con conexiones válidas',async()=>{
  for(const source of Object.values(examples)){const result=await analyze(source);assert.equal(result.valid,true,result.errors);for(const diagram of result.diagrams){const ids=new Set(diagram.nodes.map(n=>n.id));for(const edge of diagram.edges){assert.ok(ids.has(edge.source));assert.ok(ids.has(edge.target));}}}
});
test('Entradas interactivas, acentos y ambas ramas',async()=>{
  assert.match((await run(examples.Bienvenida,['José'])).output,/Hola, José/);
  assert.match((await run(examples['Mayor de edad'],['22'])).output,/Eres mayor/);
  assert.match((await run(examples['Mayor de edad'],['12'])).output,/Eres menor/);
});
test('Bucles, funciones, arreglos y entradas sucesivas',async()=>{
  assert.match((await run(examples['Tabla de multiplicar'],['7'])).output,/7 x 10 = 70/);
  const arrays=await run(examples['Arreglos y subprocesos']);assert.match(arrays.output,/Posición 3: 6/);
  const menu=await run(examples['Menú con Según'],['1','2','0']);assert.match(menu.output,/¡Hola!/);assert.match(menu.output,/¡Hasta luego!/);
});
test('Errores de sintaxis y ejecución del motor original',async()=>{
  const result=await analyze('Algoritmo X\nSi Verdadero Entonces\nFinAlgoritmo');assert.equal(result.valid,false);assert.match(result.errors,/ERROR/);
  const result2=await run('Algoritmo X\nDefinir n Como Real\nn <- 1 / 0\nEscribir n\nFinAlgoritmo');assert.match(result2.output,/ERROR/);assert.equal(result2.events.at(-1).errors,true);
});
test('Esperar Tecla y Esperar tiempo reanudan y finalizan',async()=>{
  const result=await run('Algoritmo X\nEscribir "Antes"\nEsperar Tecla\nEsperar 10 Milisegundos\nEscribir "Después"\nFinAlgoritmo');assert.match(result.output,/Después/);assert.ok(result.events.some(e=>e.type==='input'&&e.mode==='key'));assert.equal(result.events.at(-1).type,'exit');
});
