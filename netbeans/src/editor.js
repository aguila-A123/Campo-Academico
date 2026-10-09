import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/edcore.main';
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { contextualCompletions } from './java-completions';
import { packageOf, suggestPackage, validPackage } from './java-project';
const projectNames = new Map();
export function setProjectContext(id, name) { projectNames.set(id, name); }
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

monaco.editor.defineTheme('noir', {
  base: 'vs-dark', inherit: true,
  rules: [{ token: 'keyword', foreground: 'DAB972' }, { token: 'string', foreground: '97BEA0' }, { token: 'comment', foreground: '68747E', fontStyle: 'italic' }, { token: 'number', foreground: 'BCA6D9' }, { token: 'type.identifier', foreground: 'D7DCE2' }],
  colors: { 'editor.background': '#0D1013', 'editor.foreground': '#CBD2DA', 'editorLineNumber.foreground': '#48515C', 'editorLineNumber.activeForeground': '#DAB972', 'editor.lineHighlightBackground': '#151A20', 'editor.selectionBackground': '#64552A55', 'editorCursor.foreground': '#E7C781', 'editorIndentGuide.background1': '#222830', 'editorSuggestWidget.background': '#161C22', 'editorSuggestWidget.border': '#3B424B', 'editorSuggestWidget.selectedBackground': '#353024' }
});
const snippets = [
  ['imprimir', 'System.out.println(${1:});', 'Imprimir una línea en la consola'],
  ['sout', 'System.out.println(${1:"Hola, mundo"});', 'Imprimir una línea en la consola'],
  ['System', 'System.out.println(${1:"Hola, mundo"});', 'System.out.println · imprimir con salto de línea'],
  ['System.out.println', 'System.out.println(${1:"Hola, mundo"});', 'Imprimir con salto de línea'],
  ['System.out.print', 'System.out.print(${1:"Texto"});', 'Imprimir sin salto de línea'],
  ['main', 'public static void main(String[] args) {\n\t${0}\n}', 'Punto de entrada de tu programa'],
  ['fori', 'for (int ${1:i} = 0; ${1:i} < ${2:10}; ${1:i}++) {\n\t${0}\n}', 'Bucle con contador'],
  ['if', 'if (${1:condicion}) {\n\t${0}\n}', 'Condición'],
  ['while', 'while (${1:condicion}) {\n\t${0}\n}', 'Bucle while'],
  ['Scanner', 'Scanner ${1:scanner} = new Scanner(System.in);', 'Leer entrada · añade import java.util.Scanner;'],
  ['importScanner', 'import java.util.Scanner;', 'Importar Scanner'],
  ['trycatch', 'try {\n\t${1}\n} catch (Exception e) {\n\tSystem.err.println(e.getMessage());\n}', 'Capturar una excepción'],
  ['class', 'public class ${1:Nombre} {\n\t${0}\n}', 'Crear una clase']
];
monaco.languages.registerCompletionItemProvider('java', {
  triggerCharacters: ['.'],
  provideCompletionItems(model, position) {
    const word = model.getWordUntilPosition(position);
    const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
    const chain = line.match(/System(?:\.out(?:\.[a-z]*)?)?$/i);
    const start = chain ? position.column - chain[0].length : word.startColumn;
    const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: start, endColumn: position.column };
    const context = contextualCompletions(model.getValue(), line);
    const filename = decodeURIComponent(model.uri.path.split('/').slice(2).join('/'));
    const className = filename.split('/').at(-1)?.replace(/\.java$/, '') || 'Main';
    const directory = filename.split('/').slice(0,-1).join('/').replace(/^src\/(?:main\/java\/)?/, '').replace(/^src$/, '');
    const detectedPackage = packageOf(model.getValue()) || (directory ? directory.replaceAll('/', '.') : suggestPackage(projectNames.get(model.uri.authority) || ''));
    const pkg = validPackage(detectedPackage) ? detectedPackage : '';
    const main = /\bclass\s+\w+/.test(model.getValue())
      ? 'public static void main(String[] args) {\n\t${0}\n};'
      : `${pkg && !packageOf(model.getValue()) ? 'package ' + pkg + ';\n\n' : ''}public class ${className} {\n\tpublic static void main(String[] args) {\n\t\t\${0}\n\t};\n}`;
    const memberRange = { ...range, startColumn:word.startColumn };
    const extra = context.suggestions.map(s => ({...s, range:context.member ? memberRange : range, kind:context.member ? monaco.languages.CompletionItemKind.Method : monaco.languages.CompletionItemKind.Variable, insertTextRules:monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet}));
    return { suggestions: [...extra, ...(context.member ? [] : snippets.map(([label, insertText, documentation]) => ({ label, insertText:label === 'main' ? main : insertText, filterText:label, sortText:label === 'imprimir' ? '0' : label, documentation, detail: 'Java Noir · atajo', kind: monaco.languages.CompletionItemKind.Snippet, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range })))] };
  }
});
export { monaco };
