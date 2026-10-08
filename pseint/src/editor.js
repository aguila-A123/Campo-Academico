import {StreamLanguage} from '@codemirror/language';
import {EditorView} from '@codemirror/view';
import {EditorState} from '@codemirror/state';
import {operatorChanges} from './operators.js';
export const symbolicOperators=EditorState.transactionFilter.of(transaction=>{
  if(!transaction.docChanged)return transaction;
  const changes=operatorChanges(transaction.newDoc.toString());
  return changes.length?[transaction,{changes,sequential:true}]:transaction;
});
export const pseintLanguage=StreamLanguage.define({
  startState:()=>({}),
  token(stream){
    if(stream.eatSpace())return null;
    if(stream.match('//')){stream.skipToEnd();return 'comment';}
    if(stream.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/))return 'string';
    if(stream.match(/\b\d+(?:\.\d+)?\b/))return 'number';
    if(stream.match(/(?:<-|<=|>=|<>|[+*/^%=<>≥≤≠-])/))return 'operator';
    if(stream.match(/\b(?:Algoritmo|FinAlgoritmo|Proceso|FinProceso|SubProceso|FinSubProceso|Funcion|FinFuncion|Definir|Como|Dimension|Si|Entonces|SiNo|FinSi|Segun|Hacer|FinSegun|De|Otro|Modo|Para|Hasta|Con|Paso|FinPara|Mientras|FinMientras|Repetir|Que|Leer|Escribir|Imprimir|Sin|Saltar|Esperar|Tecla|Segundos|Milisegundos|Borrar|Limpiar|Pantalla|Por|Referencia)\b/i))return 'keyword';
    if(stream.match(/\b(?:Entero|Real|Numerico|Caracter|Cadena|Texto|Logico)\b/i))return 'typeName';
    if(stream.match(/\b(?:Verdadero|Falso)\b/i))return 'bool';
    if(stream.match(/\b(?:Y|O|No|Mod)\b/i))return 'operator';
    if(stream.match(/\b(?:RC|Raiz|Abs|Ln|Exp|Sen|Cos|Tan|Asen|Acos|Atan|Trunc|Redon|Azar|Aleatorio|Longitud|Subcadena|Concatenar|Mayusculas|Minusculas|ConvertirANumero|ConvertirATexto)\b/i))return 'builtin';
    if(stream.match(/[\wÁÉÍÓÚÑáéíóúñ]+/))return 'variableName';
    stream.next();return null;
  }
});
export const editorTheme=EditorView.theme({
  '&':{height:'100%',fontSize:'15px',backgroundColor:'transparent',color:'#e3e2de'},
  '.cm-scroller':{fontFamily:'"Inconsolata", Consolas, monospace',lineHeight:'1.85',overflow:'auto'},
  '.cm-content':{padding:'20px 0'},'.cm-line':{padding:'0 22px'},
  '.cm-gutters':{backgroundColor:'transparent',color:'#807c73',border:'none',paddingLeft:'12px'},
  '.cm-activeLineGutter':{backgroundColor:'#27231c',color:'#dac38c'},
  '.cm-activeLine':{backgroundColor:'#ffffff04'},
  '.cm-cursor':{borderLeftColor:'#e5c57c'},'.cm-selectionBackground, &.cm-focused .cm-selectionBackground':{backgroundColor:'#494133'},
  '.cm-tooltip':{backgroundColor:'#21201d',border:'1px solid #514a3b',color:'#e5e2d9'}
},{dark:true});
