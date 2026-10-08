import {autocompletion,acceptCompletion,completionStatus,startCompletion} from '@codemirror/autocomplete';
import {Prec} from '@codemirror/state';
import {keymap,EditorView} from '@codemirror/view';

const commands = {
  Algoritmo:'Inicia un algoritmo', FinAlgoritmo:'Finaliza el algoritmo',
  Proceso:'Inicia un proceso', FinProceso:'Finaliza el proceso',
  SubProceso:'Declara un subproceso', FinSubProceso:'Finaliza el subproceso',
  Funcion:'Declara una función', FinFuncion:'Finaliza la función',
  Definir:'Declara variables', Como:'Indica el tipo de una variable',
  Dimension:'Declara un arreglo', Leer:'Lee un dato de la consola',
  Escribir:'Muestra valores en la consola', Imprimir:'Muestra valores en la consola',
  Si:'Inicia una condición', Entonces:'Inicia la rama verdadera',
  SiNo:'Inicia la rama alternativa', FinSi:'Finaliza la condición',
  Segun:'Selecciona entre varios casos', Hacer:'Inicia un bloque',
  'De Otro Modo':'Caso por defecto', FinSegun:'Finaliza la selección',
  Para:'Inicia un bucle con contador', Hasta:'Indica el límite del bucle',
  'Con Paso':'Indica el incremento', FinPara:'Finaliza el bucle Para',
  Mientras:'Inicia un bucle condicional', FinMientras:'Finaliza el bucle Mientras',
  Repetir:'Inicia un bucle de repetición', 'Hasta Que':'Condición de salida del bucle',
  'Esperar Tecla':'Espera una tecla', Esperar:'Espera un tiempo',
  'Limpiar Pantalla':'Limpia la consola', 'Borrar Pantalla':'Limpia la consola',
  'Sin Saltar':'Escribe sin salto de línea', 'Por Referencia':'Pasa un argumento por referencia',
};
const types=['Entero','Real','Numerico','Caracter','Cadena','Texto','Logico'];
const functions=['RC','Raiz','Abs','Ln','Exp','Sen','Cos','Tan','Asen','Acos','Atan','Trunc','Redon','Azar','Aleatorio','Longitud','Subcadena','Concatenar','Mayusculas','Minusculas','ConvertirANumero','ConvertirATexto'];
const options=[...Object.entries(commands).map(([label,detail])=>({label,detail,type:'keyword'})),...types.map(label=>({label,detail:'Tipo de variable',type:'type'})),...functions.map(label=>({label,detail:'Función de PSeInt',type:'function'})),...['Verdadero','Falso'].map(label=>({label,type:'constant'}))];

const identifier=/^[A-Za-z_ÁÉÍÓÚÑáéíóúñ][\wÁÉÍÓÚÑáéíóúñ]*$/;
const validWord=/^[\wÁÉÍÓÚÑáéíóúñ]*$/;
export function collectVariables(doc,currentLine){
  const lines=doc.split('\n');let begin=0,end=lines.length;
  for(let i=0;i<lines.length;i++)if(/^\s*(?:Algoritmo|Proceso|SubProceso|Funcion|SubAlgoritmo)\b/i.test(lines[i])){
    if(i<=currentLine-1)begin=i;else {end=i;break;}
  }
  const found=new Map();const add=value=>{const name=value.trim().split(/[\[(]/)[0];if(identifier.test(name)&&!options.some(o=>o.label.toLowerCase()===name.toLowerCase()))found.set(name.toLowerCase(),name);};
  for(let i=begin;i<end;i++){
    // Ignore strings and comments so their words never become variables.
    const line=lines[i].replace(/"[^"]*"|'[^']*'/g,'').split('//')[0];
    const declaration=line.match(/^\s*(?:Definir|Dimension)\s+(.+?)(?:\s+Como\b|;|$)/i);
    if(declaration)declaration[1].split(',').forEach(add);
    const read=i!==currentLine-1&&line.match(/^\s*Leer\s+(.+?);?$/i);
    if(read)read[1].replace(/;$/,'').split(',').forEach(add);
    const assignment=line.match(/^\s*(?:Para\s+)?([\wÁÉÍÓÚÑáéíóúñ]+)(?:\s*\[[^\]]*\])?\s*<-/i);
    if(assignment)add(assignment[1]);
    const prototype=line.match(/^\s*(?:SubProceso|Funcion|SubAlgoritmo)\s+(?:([\wÁÉÍÓÚÑáéíóúñ]+)\s*<-\s*)?[\wÁÉÍÓÚÑáéíóúñ]+\s*\(([^)]*)\)/i);
    if(prototype){if(prototype[1])add(prototype[1]);prototype[2].split(',').forEach(p=>add(p.replace(/\s+Por\s+(?:Referencia|Valor)/i,'')));}
  }
  return [...found.values()].map(label=>({label,type:'variable',detail:'Variable del algoritmo'}));
}

function completeThen(view,_completion,from,to){
  const line=view.state.doc.lineAt(from),indent=line.text.match(/^\s*/)[0];
  const prefix=from>line.from&&!/\s/.test(view.state.doc.sliceString(from-1,from))?' ':'';
  // A closing block at this indentation already belongs to this Si.
  let closed=false;
  for(let n=line.number+1;n<=view.state.doc.lines;n++){
    const next=view.state.doc.line(n).text;if(!next.trim())continue;
    const depth=next.match(/^\s*/)[0].length;
    if(depth<=indent.length){closed=depth===indent.length&&/^\s*(?:FinSi|SiNo)\b/i.test(next);break;}
  }
  const insertion=prefix+'Entonces'+(closed?'':`\n${indent}    \n${indent}FinSi`);
  const anchor=closed?from+prefix.length+8:from+prefix.length+8+1+indent.length+4;
  view.dispatch({changes:{from,to,insert:insertion},selection:{anchor},scrollIntoView:true,userEvent:'input.complete'});
}

export function pseintCompletion(context){
  const before=context.state.doc.sliceString(context.state.doc.lineAt(context.pos).from,context.pos);
  let quote=null;
  for(let i=0;i<before.length;i++){
    const char=before[i];
    if(quote){if(char===quote)quote=null;}
    else if(char==='"'||char==="'")quote=char;
    else if(char==='/'&&before[i+1]==='/')return null;
  }
  if(quote)return null;
  const word=context.matchBefore(/[\wÁÉÍÓÚÑáéíóúñ]+/);
  const line=context.state.doc.lineAt(context.pos);
  const variables=collectVariables(context.state.doc.toString(),line.number);
  if(/^\s*Leer\s+/i.test(before)){
    return {from:word?.from??context.pos,options:variables,validFor:validWord};
  }
  const condition=before.match(/^\s*Si\s+(.*)$/i);
  if(condition&&!/\bEntonces\b/i.test(condition[1])){
    const body=condition[1],trimmed=body.trim();
    const thenPrefix=body.match(/\b(Ent\w*)$/i);
    const known=variables.some(v=>v.label.toLowerCase()===word?.text.toLowerCase());
    const complete=trimmed&&(/\s$/.test(body)||known||/[\d)]$/.test(body)||/\b(?:Verdadero|Falso)$/i.test(body));
    if(thenPrefix||complete){
      return {from:thenPrefix?context.pos-thenPrefix[1].length:context.pos,options:[{label:'Entonces',detail:'Completa Si y añade FinSi',type:'keyword',apply:completeThen}],filter:false};
    }
    return {from:word?.from??context.pos,options:[...variables,...options.filter(o=>o.type==='function'||o.type==='constant')],validFor:validWord};
  }
  if(!word&&!context.explicit)return null;
  return {from:word?.from??context.pos,options,validFor:/^[\wÁÉÍÓÚÑáéíóúñ]*$/};
}

export const pseintAutocomplete=[
  autocompletion({override:[pseintCompletion],activateOnTyping:true,selectOnOpen:true,interactionDelay:0,icons:true}),
  EditorView.updateListener.of(update=>{
    // CodeMirror normally waits for a word. Whitespace also changes the context
    // of Leer and Si, but it never accepts the selected completion.
    if(update.docChanged&&update.view.hasFocus&&completionStatus(update.state)!=='pending'){
      const pos=update.state.selection.main.head;
      const before=update.state.doc.sliceString(update.state.doc.lineAt(pos).from,pos);
      if(/\s$/.test(before)&&/^\s*(?:Leer|Si)\s+/i.test(before))queueMicrotask(()=>{if(update.view.state===update.state&&update.view.hasFocus)startCompletion(update.view);});
    }
  }),
  Prec.highest(keymap.of([{key:'Tab',run:acceptCompletion}]))
];
