import {analyzeSource,createEngineSession} from './engineClient.js';
import React,{useState,useEffect,useRef,useCallback,useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import CodeMirror from '@uiw/react-codemirror';
import {HighlightStyle,syntaxHighlighting} from '@codemirror/language';
import {tags} from '@lezer/highlight';
import {lintGutter,linter} from '@codemirror/lint';
import {Terminal} from '@xterm/xterm';
import {FitAddon} from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {Play,Square,FilePlus2,FolderOpen,Save,Workflow,TerminalSquare,Check,AlertCircle,ChevronDown,Trash2,ArrowUp,Minus,Plus,BookOpen} from 'lucide-react';
import Diagram from './Diagram.jsx';
import Starfield from './Starfield';
import {pseintLanguage,editorTheme,symbolicOperators} from './editor';
import {pseintAutocomplete} from './completion';
import './style.css';
import './metallic.css';
import {initialCode,hasUnsavedChanges} from './sheets';
const colors=HighlightStyle.define([{tag:tags.keyword,color:'#e5c57c'},{tag:tags.string,color:'#d7d6ce'},{tag:tags.number,color:'#f0dca8'},{tag:tags.typeName,color:'#bec6d1'},{tag:tags.comment,color:'#85817a',fontStyle:'italic'},{tag:tags.operator,color:'#d6bb7c'},{tag:tags.bool,color:'#f0dca8'},{tag:tags.standard(tags.variableName),color:'#bec6d1'}]);
function App(){
  const [code,setCode]=useState(initialCode),[fileName,setFileName]=useState('Hoja nueva.psc');
  const profile='Flexible';
  const [sheets,setSheets]=useState([{id:0,name:'Hoja nueva',code:initialCode,savedCode:initialCode}]),[activeSheet,setActiveSheet]=useState(0),[sheetMenu,setSheetMenu]=useState(false),[renameTarget,setRenameTarget]=useState(null),[renameName,setRenameName]=useState(''),[saving,setSaving]=useState(false);
  const nextSheet=useRef(1);
  useEffect(()=>{
    if(!sheets.some(hasUnsavedChanges))return;
    const warn=e=>{e.preventDefault();e.returnValue='';};
    window.addEventListener('beforeunload',warn);
    return()=>window.removeEventListener('beforeunload',warn);
  },[sheets]);
  const [analysis,setAnalysis]=useState({valid:false,diagrams:[],errors:''}),[analyzing,setAnalyzing]=useState(true),[connected,setConnected]=useState(false),[serviceError,setServiceError]=useState('');
  const [running,setRunning]=useState(false),[waiting,setWaiting]=useState(null),[input,setInput]=useState(''),[consoleStatus,setConsoleStatus]=useState('Lista para ejecutar');
  const [selectedProc,setSelectedProc]=useState(''),[fontSize,setFontSize]=useState(15),[cursor,setCursor]=useState({line:1,column:1}),[split,setSplit]=useState(50),[top,setTop]=useState(60),[dirty,setDirty]=useState(false);
  const editor=useRef(null),terminalElement=useRef(null),terminal=useRef(null),socket=useRef(null),inputElement=useRef(null),openFile=useRef(null),workspace=useRef(null),right=useRef(null),previousCode=useRef(code);
  const current=useRef({code,profile,running,analysis});current.current={code,profile,running,analysis,activeSheet};
  useEffect(()=>{
    const context=document.modelContext;if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    try{Promise.resolve(context.registerTool({name:'read_pseint_workspace',title:'Leer el algoritmo de PSeInt',description:'Devuelve el código y el diagnóstico visibles en este editor.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>{const state=current.current;return {source:state.code,profile:state.profile,running:state.running,valid:state.analysis.valid,errors:state.analysis.errors};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
    return()=>lifecycle.abort();
  },[]);
  useEffect(()=>{
    const term=new Terminal({fontFamily:'Inconsolata, Consolas, monospace',fontSize:14,lineHeight:1.35,cursorBlink:false,convertEol:true,disableStdin:true,scrollback:5000,theme:{background:'#080809',foreground:'#dededc',cursor:'#d6bb7c',selectionBackground:'#494133'}});
    const fit=new FitAddon();term.loadAddon(fit);term.open(terminalElement.current);terminal.current=term;
    const observer=new ResizeObserver(()=>{try{fit.fit();}catch{}});observer.observe(terminalElement.current);
    term.writeln('\x1b[38;2;103;120;153mLa salida de tu algoritmo aparecerá aquí.\x1b[0m');
    return()=>{observer.disconnect();term.dispose();};
  },[]);
  useEffect(()=>{
    const session=createEngineSession(m=>{const term=terminal.current;
          if(m.type==='output')term?.write(m.text);
          else if(m.type==='input'){setWaiting(m.mode);setConsoleStatus(m.mode==='key'?'Esperando una tecla':'Esperando entrada');}
          else if(m.type==='started'){setRunning(true);setConsoleStatus('Ejecutando');}
          else if(m.type==='exit'){setRunning(false);setWaiting(null);const success=m.code===0&&!m.errors;setConsoleStatus(m.stopped?'Ejecución detenida':success?'Ejecución finalizada':'Ejecución finalizada con errores');term?.writeln(`\x1b[38;2;103;120;153m${m.stopped?'■ Detenido':success?'✓ Ejecución finalizada':'Revisa los errores de ejecución.'}\x1b[0m`);}
          else if(m.type==='failure'){setRunning(false);setWaiting(null);setConsoleStatus('Error de ejecución');term?.writeln(`\r\n${m.message}`);}
    });
    socket.current=session;setConnected(true);setServiceError('');
    return()=>session.close();
  },[]);
  useEffect(()=>{if(waiting)inputElement.current?.focus();},[waiting]);
  useEffect(()=>{
    const abort=new AbortController();setAnalyzing(true);
    const timeout=setTimeout(async()=>{try{const data=await analyzeSource(code,abort.signal);if(abort.signal.aborted)return;if(data.error)throw Error(data.error);setAnalysis(data);setServiceError('');}catch(e){if(e.name!=='AbortError'){setAnalysis({valid:false,diagrams:[],errors:e.message});}}finally{if(!abort.signal.aborted)setAnalyzing(false);}},400);
    return()=>{clearTimeout(timeout);abort.abort();};
  },[code,profile,connected,activeSheet]);
  const jump=useCallback(line=>{const view=editor.current?.view;if(!view)return;const pos=view.state.doc.line(Math.max(1,Math.min(line,view.state.doc.lines))).from;view.dispatch({selection:{anchor:pos},scrollIntoView:true});view.focus();},[]);
  const diagnostics=useMemo(()=>{
    const items=[];for(const text of analysis.errors.split('\n')){const m=text.match(/(?:LIN(?:EA|E|ÉA)?\.?|L[ií]nea)\s*(\d+).*?(?:ERROR\s*(\d+))?[:：]\s*(.*)/i);if(m)items.push({line:+m[1],message:text.trim()});}return items;
  },[analysis.errors]);
  const extensions=useMemo(()=>[pseintLanguage,symbolicOperators,pseintAutocomplete,editorTheme,syntaxHighlighting(colors),lintGutter(),linter(view=>diagnostics.map(d=>{const line=view.state.doc.line(Math.min(Math.max(d.line,1),view.state.doc.lines));return {from:line.from,to:line.to,severity:'error',message:d.message};}))],[diagnostics]);
  function run(){const state=current.current;if(!connected||state.running)return;terminal.current?.reset();setWaiting(null);setRunning(true);setConsoleStatus('Iniciando…');socket.current.send(JSON.stringify({type:'run',source:state.code,profile:state.profile}));}
  function stop(){socket.current?.send(JSON.stringify({type:'stop'}));setWaiting(null);setConsoleStatus('Deteniendo…');}
  function sendInput(e){e?.preventDefault();if(!waiting)return;socket.current?.send(JSON.stringify({type:'input',text:waiting==='key'?'':input}));terminal.current?.writeln(waiting==='key'?'':input);setInput('');setWaiting(null);setConsoleStatus('Ejecutando');}
  async function save(){
    if(saving)return;
    const source=code,id=activeSheet;setSaving(true);
    try{
      let name=fileName;
      if(window.showSaveFilePicker){
        const handle=await window.showSaveFilePicker({suggestedName:fileName,types:[{description:'Algoritmo PSeInt',accept:{'text/plain':['.psc']}}]});
        const writer=await handle.createWritable();await writer.write(source);await writer.close();name=handle.name;
      }else{
        const url=URL.createObjectURL(new Blob([source],{type:'text/plain;charset=utf-8'}));
        const link=document.createElement('a');link.href=url;link.download=fileName;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
      setSheets(items=>items.map(s=>s.id===id?{...s,name:name.replace(/\.psc$/i,''),savedCode:source}:s));
      if(current.current.activeSheet===id){previousCode.current=source;setDirty(current.current.code!==source);setFileName(name);}
    }catch(e){if(e.name!=='AbortError')setServiceError(e.message);}finally{setSaving(false);}
  }
  function selectSheet(sheet){if(running)return;setActiveSheet(sheet.id);setCode(sheet.code);setFileName(sheet.name+'.psc');previousCode.current=sheet.savedCode;setDirty(sheet.code!==sheet.savedCode);setSheetMenu(false);setSelectedProc('');setAnalysis({valid:false,diagrams:[],errors:''});}
  function newSheet(text=initialCode,name){if(running)return;const id=nextSheet.current++;const sheet={id,name:name||`Hoja nueva ${id}`,code:text,savedCode:text};setSheets(items=>[...items,sheet]);selectSheet(sheet);}
  function closeSheet(sheet){
    if(running||saving)return;
    if(hasUnsavedChanges(sheet)&&!window.confirm(`La hoja «${sheet.name}» tiene cambios sin guardar. Si la cierras, se perderán. ¿Quieres cerrarla?`))return;
    const remaining=sheets.filter(s=>s.id!==sheet.id);
    if(!remaining.length){
      const blank={id:nextSheet.current++,name:'Hoja nueva',code:initialCode,savedCode:initialCode};
      setSheets([blank]);selectSheet(blank);
    }else{
      setSheets(remaining);
      if(sheet.id===activeSheet)selectSheet(remaining[Math.max(0,sheets.findIndex(s=>s.id===sheet.id)-1)]);
    }
  }
  function renameSheet(e,sheet){e.preventDefault();if(running)return;setRenameTarget(sheet.id);setRenameName(sheet.name);setSheetMenu(false);}
  function submitRename(e){e.preventDefault();const name=renameName.trim().replace(/\.psc$/i,'');if(!name)return;setSheets(items=>items.map(s=>s.id===renameTarget?{...s,name}:s));if(renameTarget===activeSheet)setFileName(name+'.psc');setRenameTarget(null);}
  async function loadFile(e){const f=e.target.files?.[0];if(!f)return;const bytes=await f.arrayBuffer();let text=new TextDecoder('utf-8',{fatal:false}).decode(bytes);if(text.includes('\uFFFD'))text=new TextDecoder('windows-1252').decode(bytes);newSheet(text.replace(/^\uFEFF/,''),f.name.replace(/\.psc$/i,''));e.target.value='';}
  useEffect(()=>{const onKey=e=>{if(e.key==='F9'){e.preventDefault();run();}if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();save();}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);});
  function drag(e,vertical){e.preventDefault();const move=event=>{const rect=(vertical?right:workspace).current.getBoundingClientRect();const value=vertical?(event.clientY-rect.top)/rect.height*100:(event.clientX-rect.left)/rect.width*100;(vertical?setTop:setSplit)(Math.min(vertical?78:72,Math.max(vertical?30:28,value)));};const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);document.body.classList.remove('resizing');};document.body.classList.add('resizing');window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);}
  const diagram=analysis.diagrams.find(d=>d.name===selectedProc)||analysis.diagrams.find(d=>d.main)||analysis.diagrams[0];
  const status=analyzing?'Actualizando…':analysis.valid?'Sin errores de sintaxis':'Revisa tu código';
  return <div className="app"><Starfield/>
    {serviceError&&<div className="service-banner" role="alert"><AlertCircle size={16}/>{serviceError}</div>}
    <main className="workspace" ref={workspace} style={{'--split':`${split}%`,'--top':`${top}%`}}>
      <section className="editor-panel panel"><div className="panel-header editor-controls"><div className="file-actions"><button title="Nueva hoja" aria-label="Nueva hoja" disabled={running} onClick={()=>newSheet()}><FilePlus2 size={18}/></button><button title="Abrir archivo .psc" aria-label="Abrir archivo .psc" disabled={running} onClick={()=>openFile.current.click()}><FolderOpen size={18}/></button><button title="Guardar como… (Ctrl+S)" aria-label="Guardar como" disabled={saving} onClick={save}><Save size={18}/></button><input ref={openFile} type="file" accept=".psc,.txt" hidden onChange={loadFile}/></div><span className="toolbar-divider"/><div className="sheet-selector"><button className="sheet-trigger" aria-label="Seleccionar hoja" aria-haspopup="menu" aria-expanded={sheetMenu} disabled={running} title="Clic derecho para cambiar el nombre" onClick={()=>setSheetMenu(!sheetMenu)} onContextMenu={e=>renameSheet(e,sheets.find(s=>s.id===activeSheet))}><BookOpen size={16}/><span>{sheets.find(s=>s.id===activeSheet)?.name}</span>{dirty&&<span className="dirty-dot" title="Cambios sin guardar"/>}<ChevronDown size={14}/></button>{sheetMenu&&<><div className="menu-dismiss" onClick={()=>setSheetMenu(false)}/><div className="sheet-menu" role="menu" aria-label="Hojas abiertas">{sheets.map(sheet=><div key={sheet.id} className="sheet-row"><button role="menuitem" className={sheet.id===activeSheet?'selected':''} onClick={()=>selectSheet(sheet)} onContextMenu={e=>renameSheet(e,sheet)}>{sheet.name}{hasUnsavedChanges(sheet)&&<span className="dirty-dot"/>}</button><button className="sheet-close" aria-label={'Cerrar '+sheet.name} title="Cerrar hoja" disabled={running||saving} onClick={()=>closeSheet(sheet)}>×</button></div>)}</div></>}</div><div className="topbar-spacer"/><button className="small-button" aria-label="Reducir tamaño del texto" onClick={()=>setFontSize(Math.max(12,fontSize-1))}><Minus size={14}/></button><span className="font-size">{fontSize}</span><button className="small-button" aria-label="Aumentar tamaño del texto" onClick={()=>setFontSize(Math.min(24,fontSize+1))}><Plus size={14}/></button></div>
        <div className="editor-body" style={{'--editor-font':`${fontSize}px`}}><Starfield/><CodeMirror ref={editor} value={code} height="100%" theme="dark" extensions={extensions} editable={!running} onChange={value=>{setCode(value);setDirty(value!==previousCode.current);setSheets(items=>items.map(s=>s.id===activeSheet?{...s,code:value}:s));}} onUpdate={update=>{if(update.selectionSet||update.docChanged){const head=update.state.selection.main.head,line=update.state.doc.lineAt(head);setCursor({line:line.number,column:head-line.from+1});}}} basicSetup={{foldGutter:true,highlightActiveLine:true,autocompletion:false,tabSize:4}}/></div>
        {analysis.errors&&!analyzing&&<div className="diagnostics" role="alert"><div><AlertCircle size={15}/><strong>Errores de PSeInt</strong></div>{diagnostics.length?diagnostics.map((d,i)=><button key={i} onClick={()=>jump(d.line)}>{d.message}</button>):<pre>{analysis.errors}</pre>}</div>}
        <footer className="editor-footer"><span>Lín {cursor.line}, Col {cursor.column}</span><span>{code.split('\n').length} líneas</span><span>Tab: 4</span></footer>
      </section>
      <div className="splitter vertical" role="separator" aria-label="Ancho del editor" aria-orientation="vertical" tabIndex={0} aria-valuenow={Math.round(split)} aria-valuemin={28} aria-valuemax={72} onPointerDown={e=>drag(e,false)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();setSplit(Math.max(28,Math.min(72,split+(e.key==='ArrowRight'?2:-2))));}}}/>
      <div className="right-panels" ref={right}><section className="diagram-panel panel"><div className="panel-header"><Workflow size={16}/><span>Diagrama de flujo</span><span className="live-tag">EN VIVO</span><div className="topbar-spacer"/>{analysis.diagrams.length>1&&<select className="proc-select" aria-label="Proceso del diagrama" value={diagram?.name||''} onChange={e=>setSelectedProc(e.target.value)}>{analysis.diagrams.map(d=><option key={d.name}>{d.name}</option>)}</select>}</div><div className="diagram-body">{analysis.valid&&diagram?<Diagram diagram={diagram} onLine={jump}/>:<div className="diagram-empty"><Workflow size={34}/><strong>{analyzing?'Generando diagrama…':'El diagrama aparecerá aquí'}</strong><p>{analyzing?'Analizando tu algoritmo.':'Corrige los errores de sintaxis para continuar.'}</p></div>}{analyzing&&analysis.valid&&<div className="diagram-updating">Actualizando…</div>}</div><footer className="diagram-footer"><span>Arrastra para mover · Rueda para acercar</span><span>Haz clic en un bloque para ver su código</span></footer></section>
        <div className="splitter horizontal" role="separator" aria-label="Altura del diagrama" aria-orientation="horizontal" tabIndex={0} aria-valuenow={Math.round(top)} aria-valuemin={30} aria-valuemax={78} onPointerDown={e=>drag(e,true)} onKeyDown={e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();setTop(Math.max(30,Math.min(78,top+(e.key==='ArrowDown'?2:-2))));}}}/>
        <section className="console-panel panel"><div className="panel-header"><TerminalSquare size={16}/><span>Consola</span><span className={`console-status ${waiting?'waiting':''}`}>{consoleStatus}</span><div className="topbar-spacer"/><button className="small-button console-run" title="Ejecutar (F9)" aria-label="Ejecutar" disabled={!connected||running} onClick={run}><Play size={16} fill="currentColor"/></button><button className="small-button" title="Detener" aria-label="Detener" disabled={!running} onClick={stop}><Square size={15}/></button><button className="small-button" title="Limpiar consola" aria-label="Limpiar consola" onClick={()=>terminal.current?.clear()}><Trash2 size={15}/></button></div><div className="terminal-area" ref={terminalElement}/><form className={`console-input ${waiting?'active':''}`} onSubmit={sendInput}><span className="input-prompt">›</span><input ref={inputElement} aria-label="Entrada de la consola" disabled={!waiting} value={input} onChange={e=>setInput(e.target.value)} placeholder={waiting==='key'?'Pulsa Enter para continuar':waiting?'Escribe un valor y pulsa Enter':'La entrada se activa cuando el algoritmo la necesita'}/><button type="submit" disabled={!waiting} aria-label="Enviar entrada"><ArrowUp size={17}/></button></form></section>
      </div>
    </main>{renameTarget!==null&&<div className="rename-backdrop"><form className="rename-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-title" onSubmit={submitRename}><h2 id="rename-title">Cambiar nombre de la hoja</h2><input autoFocus aria-label="Nombre de la hoja" value={renameName} maxLength={100} onChange={e=>setRenameName(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setRenameTarget(null);}}/><div><button type="button" onClick={()=>setRenameTarget(null)}>Cancelar</button><button type="submit" disabled={!renameName.trim()}>Guardar nombre</button></div></form></div>}<footer className="statusbar"><span className={`syntax-state ${!analyzing&&!analysis.valid?'error':''}`}>{!analyzing&&analysis.valid?<Check size={14}/>:<AlertCircle size={14}/>} {status}</span><div className="topbar-spacer"/><span>{running?'Editor bloqueado durante la ejecución':'Pseudocódigo en español'}</span><span className="status-version">PSeInt 20250314</span></footer>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);

