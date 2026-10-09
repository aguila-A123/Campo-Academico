import {campusApi} from './campusApi.js';
import React, { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Code2, FolderOpen, FolderPlus, FileCode2, FilePlus2, Plus, Play, Check, ChevronRight, ChevronDown, ChevronUp, Terminal, X, Download, Upload, Save, Settings2, CircleHelp, Loader2, PanelLeftClose, PanelLeftOpen, Trash2, LockKeyhole, Search } from 'lucide-react';
import { monaco, setProjectContext } from './editor';
import { javaFile, packageOf, sourceRoot, suggestPackage } from './java-project';
import { readDirectory, writeDirectory, operateDirectory } from './disk';
import { planTreeOperation } from './tree-operations';

const IconButton = ({ label, children, ...props }) => <button className="icon-button" title={label} aria-label={label} {...props}>{children}</button>;
export default function App() {
  const [project, setProject] = useState(null), [files, setFiles] = useState({}), [active, setActive] = useState('Main.java'), [entry, setEntry] = useState('Main.java');
  const [tabs, setTabs] = useState([]), [projects, setProjects] = useState([]), [modal, setModal] = useState('projects'), [name, setName] = useState(''), [query, setQuery] = useState('');
  const [message, setMessage] = useState(''), [token, setToken] = useState(sessionStorage.getItem('noir-token') || ''), [auth, setAuth] = useState(false), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [saving, setSaving] = useState(false), [dirty, setDirty] = useState(false), [result, setResult] = useState(null), [checking, setChecking] = useState(false), [diagnostics, setDiagnostics] = useState([]), [consoleTab, setConsoleTab] = useState('output'), [input, setInput] = useState(''), [sidebar, setSidebar] = useState(window.innerWidth > 700), [size, setSize] = useState(15), [wrap, setWrap] = useState(false), [runner, setRunner] = useState('');
  const [nativePicker, setNativePicker] = useState(false), [folderWorking, setFolderWorking] = useState(false), [filePackage, setFilePackage] = useState('ejercicios'), [consoleVisible, setConsoleVisible] = useState(true), [collapsedFolders, setCollapsedFolders] = useState(new Set());
  const [creationFolder, setCreationFolder] = useState('');
  const [folders, setFolders] = useState([]), [contextMenu, setContextMenu] = useState(null), [selectedNode, setSelectedNode] = useState(null), [renameValue, setRenameValue] = useState(''), [dropTarget, setDropTarget] = useState(null);
  const contextRef = useRef(), mutationRef = useRef(false);
  const folderColors = useRef(new Map());
  const rootColor = '#B69A60';
  function folderColor(path) {
    const key = project.id + ':' + path;
    if (!folderColors.current.has(key)) {
      const palette = ['#638F99','#A46B73','#7389AE','#8D79A5','#739681','#AE8065','#7F929B','#9A7890'];
      const index = folderColors.current.size;
      folderColors.current.set(key, palette[index] || `hsl(${(index * 137.508) % 360} 24% ${46 + (index % 7)}%)`);
    }
    return folderColors.current.get(key);
  }
  const connections = useRef(new Map());
  const editorRef = useRef(), state = useRef(), revision = useRef(1), saveChain = useRef(Promise.resolve()), backupInput = useRef(), generation = useRef(0), toolActions = useRef();
  state.current = { project, files, dirty, entry, input, busy };
  const api=campusApi;
  const report = error => setMessage(error.message);
  async function refresh() { try { const [list, health] = await Promise.all([api('/projects'), api('/health')]); setProjects(list); setRunner(health.runner); setNativePicker(!!health.nativeFolders); setAuth(false); } catch (error) { report(error); } }
  useEffect(() => { refresh(); }, [token]);
  useEffect(() => {
    if (!modal && !auth) return;
    const previousFocus = document.activeElement;
    const dialog = document.querySelector('[role="dialog"]');
    const focusable = () => [...dialog.querySelectorAll('button:not(:disabled), input:not([hidden]), select, textarea')].filter(el => el.offsetParent !== null);
    if (!dialog.contains(document.activeElement)) focusable()[0]?.focus();
    const trap = e => {
      if (e.key === 'Escape' && project && !auth && !folderWorking) { setModal(null); return; }
      if (e.key !== 'Tab') return;
      const list = focusable(), first = list[0], last = list.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [modal, auth, project?.id, folderWorking]);
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(''), 7000); return () => clearTimeout(t); }, [message]);
  useEffect(() => {
    if (!contextMenu) return;
    contextRef.current?.querySelector('button')?.focus();
    const close = e => { if (!contextRef.current?.contains(e.target)) setContextMenu(null); };
    const keyboard = e => {
      if (e.key === 'Escape') { setContextMenu(null); return; }
      if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
      e.preventDefault(); const buttons = [...contextRef.current.querySelectorAll('button')];
      const index = buttons.indexOf(document.activeElement), delta = e.key === 'ArrowDown' ? 1 : -1;
      buttons[(index + delta + buttons.length) % buttons.length]?.focus();
    };
    const resized = () => setContextMenu(null);
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', keyboard); window.addEventListener('resize', resized);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', keyboard); window.removeEventListener('resize', resized); };
  }, [contextMenu]);
  function save() {
    const operation = saveChain.current.catch(() => {}).then(async () => {
      const snapshot = state.current;
      if (!snapshot.project || !snapshot.dirty) return;
      setSaving(true);
      try {
        let updated;
        if (snapshot.project.storage === 'browser') {
          const connection = connections.current.get(snapshot.project.id);
          if (!connection) throw new Error('Vuelve a abrir la carpeta para poder guardar.');
          await writeDirectory(connection, snapshot.files); updated = { revision: revision.current + 1 };
        } else {
          const endpoint = snapshot.project.storage === 'native' ? '/local-folders/' : '/projects/';
          updated = await api(endpoint + snapshot.project.id, { method: 'PUT', body: JSON.stringify({ files: snapshot.files, revision: revision.current }) });
        }
        if (state.current.project?.id === snapshot.project.id) { revision.current = updated.revision; if (state.current.files === snapshot.files) { state.current.dirty = false; setDirty(false); } }
      } finally { setSaving(false); }
    });
    saveChain.current = operation; return operation;
  }
  toolActions.current = { save };
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(context.registerTool({
        name: 'save_current_java_project', title: 'Guardar el proyecto Java abierto',
        description: 'Guarda los cambios del proyecto abierto usando la misma acción que el botón Guardar. No compila ni ejecuta código.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input) {
          if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Esta acción no acepta parámetros.');
          if (!state.current.project) throw new Error('Abre un proyecto primero.');
          await toolActions.current.save();
          return { project: state.current.project.name, saved: !state.current.dirty };
        }
      }, { signal: lifecycle.signal })).catch(error => console.debug('WebMCP:', error.message));
    } catch (error) { console.debug('WebMCP:', error.message); }
    return () => lifecycle.abort();
  }, []);
  useEffect(() => { if (!dirty) return; const t = setTimeout(() => save().catch(report), 900); return () => clearTimeout(t); }, [files, dirty]);
  useEffect(() => { const handler = e => { if (state.current.dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, []);
  function adopt(p) { generation.current++; revision.current = p.revision; const first = Object.keys(p.files).find(f => f.endsWith('Main.java')) || Object.keys(p.files)[0] || ''; const next = { ...p, sourceRoot: first ? sourceRoot(first, p.files[first]) : '', basePackage: first ? packageOf(p.files[first]) : suggestPackage(p.name) }; state.current = { ...state.current, project: next, files: p.files, dirty: false, entry: first, input: '' }; setProjectContext(p.id, p.name); setCreationFolder(first.split('/').slice(0,-1).join('/')); setProject(next); setFiles(p.files); setFolders(p.folders || []); setActive(first); setEntry(first); setTabs(first ? [first] : []); setDirty(false); setResult(null); setDiagnostics([]); setInput(''); setCollapsedFolders(new Set()); setContextMenu(null); setModal(null); setName(''); }
  async function openProject(id) { try { await save(); adopt(await api('/projects/' + id)); } catch (error) { report(error); } }
  function folderMenu() { setName(''); refresh(); setModal('folder-options'); }
  function newFile() { setName(''); setModal('file'); }
  async function chooseFolder(createNew = false) {
    let handle;
    try {
      let initialFiles;
      if (createNew) {
        if (!name.trim()) throw new Error('Escribe el nombre de la nueva carpeta.');
        if (/[<>:"/\\|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name) || name === '.' || name === '..') throw new Error('Usa un nombre de carpeta válido.');
        initialFiles = { 'Main.java': '' };
      }
      // The browser picker must start directly within the click, before any network await.
      if (!nativePicker) {
        if (!window.showDirectoryPicker) throw new Error('Para guardar en carpetas reales abre esta web en Chrome o Edge de escritorio, para seleccionar y guardar carpetas.');
        handle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents', id: createNew ? 'noir-create' : 'noir-open' });
      }
      setFolderWorking(true); await save();
      if (nativePicker) {
        const selected = await api('/local-folders/select', { method: 'POST', body: JSON.stringify({ create: createNew, name: name.trim(), files: initialFiles }) });
        if (!selected.cancelled) adopt(selected);
      } else {
        const parentHandle = createNew ? handle : undefined;
        if (createNew) {
          // Refuse to overwrite a folder already present in the chosen parent.
          let existing = false;
          try { await handle.getDirectoryHandle(name.trim()); existing = true; } catch (error) { if (error.name !== 'NotFoundError') throw error; }
          if (existing) throw new Error('Ya existe esa carpeta. Usa otro nombre o ábrela como carpeta existente.');
          handle = await handle.getDirectoryHandle(name.trim(), { create: true });
        }
        const initialFolders = [], initial = await readDirectory(handle, initialFolders), connection = { handle, parent: parentHandle, baseline: { ...initial } };
        if (createNew) await writeDirectory(connection, initialFiles);
        const id = crypto.randomUUID(); connections.current.set(id, connection);
        const finalFolders = []; if (createNew) await readDirectory(handle, finalFolders);
        adopt({ id, name: handle.name, files: createNew ? initialFiles : initial, folders: createNew ? finalFolders : initialFolders, revision: 1, storage: 'browser', location: handle.name });
      }
    } catch (error) { if (error.name !== 'AbortError') report(error); }
    finally { setFolderWorking(false); }
  }
  function changeFiles(next) { setFiles(next); setDirty(true); state.current = { ...state.current, files: next, dirty: true }; }
  function openFile(file) { setCreationFolder(file.split('/').slice(0,-1).join('/')); setActive(file); setTabs(t => t.includes(file) ? t : [...t, file]); if (window.innerWidth <= 700) setSidebar(false); }
  function closeTab(file) { const next = tabs.filter(t => t !== file); setTabs(next); if (active === file) setActive(next.at(-1) || ''); }
  async function addFile(e) {
    e.preventDefault();
    try {
      const { filename } = javaFile(name, '', creationFolder);
      const source = '';
      if (files[filename] !== undefined) throw new Error('Ya existe un archivo con ese nombre en el package.');
      changeFiles({ ...state.current.files, [filename]: source }); openFile(filename);
      if (!entry) { setEntry(filename); state.current.entry = filename; }
      setCollapsedFolders(new Set()); setModal(null); setName(''); await save();
    } catch (error) { report(error); }
  }
  function showContext(event, target) {
    event.preventDefault(); event.stopPropagation();
    if (!project || folderWorking || busy) return;
    setContextMenu({ target, x: Math.min(event.clientX, window.innerWidth - 225), y: Math.min(event.clientY, window.innerHeight - 130) });
  }
  function nodeAction(action, target) {
    setSelectedNode(target); setContextMenu(null);
    setRenameValue(target.kind === 'root' ? project.name : target.path.split('/').at(-1));
    setModal(action === 'rename' ? 'rename-node' : 'delete-node');
  }
  function clearProject() {
    generation.current++; state.current = { ...state.current, project:null, files:{}, entry:'', dirty:false };
    setProject(null); setFiles({}); setFolders([]); setTabs([]); setActive(''); setEntry(''); setDirty(false); setDiagnostics([]); setResult(null); setModal('projects'); setSelectedNode(null); refresh();
  }
  function applyOperation(updated, plan) {
    if (updated.deleted) { clearProject(); return; }
    const first = Object.keys(updated.files)[0] || '';
    const mapFile = file => Object.hasOwn(plan.mapping, file) ? plan.mapping[file] : Object.hasOwn(updated.files, file) ? file : null;
    const nextActive = mapFile(active) || first, nextEntry = mapFile(entry) || first;
    const nextProject = { ...project, ...updated, sourceRoot: first ? sourceRoot(first, updated.files[first]) : project.sourceRoot, basePackage: first ? packageOf(updated.files[first]) : project.basePackage };
    revision.current = updated.revision;
    state.current = { ...state.current, project:nextProject, files:updated.files, entry:nextEntry, dirty:false };
    setProject(nextProject); setFiles(updated.files); setFolders(updated.folders || plan.folders); setActive(nextActive); setEntry(nextEntry);
    setTabs(previous => { const next = [...new Set(previous.map(mapFile).filter(Boolean))]; if (nextActive && !next.includes(nextActive)) next.push(nextActive); return next; });
    setDirty(false); setDiagnostics([]); setCollapsedFolders(new Set()); setModal(null); setSelectedNode(null); setContextMenu(null);
  }
  async function operate(operation) {
    if (mutationRef.current || busy) return;
    let parentHandle;
    try {
      if (project.storage === 'browser' && operation.target?.kind === 'root' && !connections.current.get(project.id)?.parent) {
        parentHandle = await window.showDirectoryPicker({ mode:'readwrite', id:'noir-project-parent' });
      }
      const plan = planTreeOperation(state.current.files, operation, folders);
      if (plan.unchanged) { setModal(null); return; }
      mutationRef.current = true; setFolderWorking(true); generation.current++;
      await save();
      let updated;
      if (project.storage === 'browser') {
        const connection = connections.current.get(project.id); if (parentHandle) connection.parent = parentHandle;
        updated = { ...await operateDirectory(connection, operation), revision:revision.current + 1 };
      } else {
        const endpoint = project.storage === 'native' ? '/local-folders/' : '/projects/';
        updated = await api(endpoint + project.id + '/operate', { method:'POST', body:JSON.stringify({ operation, revision:revision.current }) });
      }
      applyOperation(updated, plan);
      if (operation.action === 'create-folder') { setCreationFolder(plan.newPath); setCollapsedFolders(new Set()); }
    } catch (error) {
      if (error.recovery) applyOperation({ ...error.recovery, revision:error.recovery.revision || revision.current + 1 }, { mapping:{}, folders:[] });
      if (error.name !== 'AbortError') report(error);
    } finally { mutationRef.current = false; setFolderWorking(false); setDropTarget(null); }
  }
  function dragStart(event, target) {
    if (folderWorking || busy || target.kind === 'root') { event.preventDefault(); return; }
    setContextMenu(null); event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-java-noir-tree', JSON.stringify({ projectId:project.id, target }));
    event.dataTransfer.setData('text/plain', target.path);
  }
  function dragOver(event, destination) {
    if (folderWorking || busy || ![...event.dataTransfer.types].includes('application/x-java-noir-tree')) return;
    event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move'; setDropTarget(destination);
  }
  function drop(event, destination) {
    event.preventDefault(); event.stopPropagation(); setDropTarget(null);
    try { const item = JSON.parse(event.dataTransfer.getData('application/x-java-noir-tree')); if (item.projectId !== project?.id) throw new Error('Solo puedes mover elementos dentro de la carpeta abierta.'); operate({ action:'move', target:item.target, destination }); } catch (error) { report(error); }
  }
  function exportProject() { const blob = new Blob([JSON.stringify({ name: project.name, files }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = project.name.replace(/[^\w-]/g,'_') + '.java-noir.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  async function importBackup(e) { try { const f = e.target.files[0]; if (!f) return; if (f.size > 2*1024*1024) throw new Error('La copia supera 2 MB.'); const p = JSON.parse(await f.text()); await save(); adopt(await api('/projects', { method: 'POST', body: JSON.stringify(p) })); await refresh(); } catch (error) { report(error); } finally { e.target.value=''; } }
  async function run(checkOnly = false) {
    const snapshot = state.current; if (!snapshot.project || !snapshot.entry || snapshot.busy || mutationRef.current) return;
    setBusy(true); generation.current++; setMessage(''); setConsoleVisible(true); if (!checkOnly) setConsoleTab('output');
    try { await save(); const r = await api('/execute', { method: 'POST', body: JSON.stringify({ files: snapshot.files, entry: snapshot.entry, input: snapshot.input, checkOnly }) }); setResult(r); if (state.current.files === snapshot.files) setDiagnostics(r.diagnostics); if (checkOnly) setConsoleTab('problems'); } catch (error) { report(error); } finally { setBusy(false); }
  }
  useEffect(() => {
    if (!project || !entry || !Object.keys(files).length || busy || folderWorking) return;
    const currentGeneration = ++generation.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setChecking(true);
      try { const r = await api('/execute', { method: 'POST', body: JSON.stringify({ files, entry, checkOnly: true }), signal: controller.signal }); if (generation.current === currentGeneration) setDiagnostics(r.diagnostics); }
      catch (error) { if (error.name !== 'AbortError' && generation.current === currentGeneration) setMessage('No se pudo comprobar Java: ' + error.message); }
      finally { if (generation.current === currentGeneration) setChecking(false); }
    }, 1800);
    return () => { clearTimeout(timer); controller.abort(); setChecking(false); };
  }, [files, project?.id, entry, busy, folderWorking]);
  useEffect(() => { for (const model of monaco.editor.getModels()) { const filename = decodeURIComponent(model.uri.path.split('/').slice(2).join('/')); const relevant = model.uri.authority === project?.id ? diagnostics.filter(d => d.file === filename || d.file.endsWith('/' + filename)) : []; monaco.editor.setModelMarkers(model, 'javac', relevant.map(d => ({ startLineNumber: d.line, endLineNumber: d.line, startColumn: d.column, endColumn: d.column + 1, severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning, message: d.message }))); } }, [diagnostics, active, project?.id]);
  useEffect(() => { const handler = e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save().catch(report); } if (e.key === 'F5') { e.preventDefault(); if (!modal && !auth && !folderWorking) run(); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); });
  const errorCount = diagnostics.filter(d => d.severity === 'error').length;
  const folderFiles = Object.keys(files).sort().filter(f => f.toLowerCase().includes(query.toLowerCase()));
  const tree = { dirs: Object.create(null), files: [] };
  for (const folder of folders.filter(f => !query || f.toLowerCase().includes(query.toLowerCase()))) { let node = tree; for (const part of folder.split('/')) node = node.dirs[part] ||= { dirs:Object.create(null), files:[] }; }
  for (const file of folderFiles) {
    const parts = file.split('/'); let node = tree;
    for (const part of parts.slice(0, -1)) node = node.dirs[part] ||= { dirs: Object.create(null), files: [] };
    node.files.push(file);
  }
  function toggleFolder(key) { setCollapsedFolders(previous => { const next = new Set(previous); next.has(key) ? next.delete(key) : next.add(key); return next; }); }
  function renderTree(node, prefix = '', depth = 0, parentColor = rootColor) {
    return <>{Object.entries(node.dirs).map(([folder, child]) => {
      const key = prefix + folder, closed = collapsedFolders.has(key);
      const ownColor = folderColor(key), color = closed ? parentColor : ownColor;
      return <React.Fragment key={key}><button className={'tree-folder ' + (dropTarget === key ? 'drop-target' : '')} style={{ paddingLeft: 15 + depth * 14, '--tree-color':color }} onClick={() => { setCreationFolder(key); toggleFolder(key); }} onContextMenu={e => showContext(e, {kind:'folder',path:key})} draggable={!folderWorking && !busy} onDragStart={e => dragStart(e,{kind:'folder',path:key})} onDragEnd={() => setDropTarget(null)} onDragOver={e => dragOver(e,key)} onDragLeave={() => setDropTarget(null)} onDrop={e => drop(e,key)} aria-expanded={!closed}><ChevronRight size={13} className={closed ? '' : 'down'}/><FolderOpen size={15}/><span>{folder}</span></button>{!closed && renderTree(child, key + '/', depth + 1, ownColor)}</React.Fragment>;
    })}{node.files.map(file => <button key={file} className={'file-row ' + (active === file ? 'active' : '')} style={{ paddingLeft: 29 + depth * 14, '--tree-color':parentColor }} onClick={() => openFile(file)} onContextMenu={e => showContext(e,{kind:'file',path:file})} draggable={!folderWorking && !busy} onDragStart={e => dragStart(e,{kind:'file',path:file})} onDragEnd={() => setDropTarget(null)}><FileCode2 size={16}/><span>{file.split('/').at(-1)}</span>{file === entry && <span className="entry-dot" title="Archivo de inicio"/>}</button>)}</>;
  }
  function goToDiagnostic(d) { const file = Object.keys(files).find(f => f === d.file || d.file.endsWith('/' + f)); if (!file) return; openFile(file); setTimeout(() => { editorRef.current?.revealLineInCenter(d.line); editorRef.current?.setPosition({ lineNumber:d.line,column:d.column }); editorRef.current?.focus(); }, 150); }
  return <div className="app">
    <header className="topbar compact-topbar">
      <div className="document-actions">
        <IconButton label="Nueva hoja Java" onClick={newFile} disabled={!project || folderWorking || busy}><FilePlus2 size={22}/></IconButton>
        <IconButton label="Abrir o crear carpeta" onClick={folderMenu}><FolderOpen size={22}/></IconButton>
        <IconButton label="Guardar · Ctrl+S" onClick={() => save().catch(report)} disabled={!project || folderWorking || busy}>{saving ? <Loader2 size={22} className="spin"/> : <Save size={22}/>}</IconButton>
      </div>
      <div className="top-actions"><span className="save-status">{saving ? <Loader2 size={14} className="spin"/> : dirty ? <span className="unsaved"/> : <Check size={14}/>}<span>{saving ? 'Guardando' : dirty ? 'Cambios pendientes' : project ? 'Guardado' : 'Sin carpeta abierta'}</span></span><IconButton label="Ajustes del editor" onClick={() => setModal('settings')}><Settings2 size={18}/></IconButton><IconButton label="Ayuda y atajos" onClick={() => setModal('help')}><CircleHelp size={18}/></IconButton></div>
    </header>
    <div className="workspace">
      <aside className={'explorer ' + (sidebar ? '' : 'collapsed')}>
        <div className="section-title"><span>EXPLORADOR</span><IconButton label={sidebar ? 'Ocultar carpetas y hojas' : 'Mostrar carpetas y hojas'} onClick={() => setSidebar(!sidebar)} aria-expanded={sidebar}>{sidebar ? <PanelLeftClose size={18}/> : <PanelLeftOpen size={18}/>}</IconButton></div>
        {sidebar && <><div className="search"><Search size={14}/><input aria-label="Buscar archivo" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar archivo…"/></div><button className={'folder-label root-folder ' + (dropTarget === '' ? 'drop-target' : '')} style={{ '--tree-color':rootColor }} title={project?.location || project?.name} onClick={() => { setCreationFolder(''); toggleFolder('$root'); }} onContextMenu={e => showContext(e,{kind:'root',path:''})} onDragOver={e => dragOver(e,'')} onDragLeave={() => setDropTarget(null)} onDrop={e => drop(e,'')} aria-expanded={!collapsedFolders.has('$root')}><ChevronRight size={14} className={collapsedFolders.has('$root') ? '' : 'down'}/><FolderOpen size={16}/><strong>{project?.name || 'Sin carpeta'}</strong></button><div className="file-list">{!collapsedFolders.has('$root') && renderTree(tree)}{project && !folderFiles.length && <p className="muted padded">{query ? 'No hay coincidencias.' : 'Esta carpeta aún no tiene archivos Java.'}</p>}</div></>}
      </aside>
      <main className="main">
        <div className="editor-toolbar breadcrumb-toolbar"><div className="breadcrumb"><span>{project?.name || 'Mi espacio'}</span><ChevronRight size={12}/><span>{active || 'Editor'}</span>{active && packageOf(files[active]) && <span className="package-badge">package {packageOf(files[active])}</span>}</div></div>
        <div className="tabs" role="tablist" aria-label="Archivos abiertos">{tabs.map(file => <div key={file} className={'editor-tab ' + (file === active ? 'active' : '')}><button role="tab" aria-selected={file === active} onClick={() => setActive(file)}><FileCode2 size={15}/>{file.split('/').at(-1)}</button><IconButton label={'Cerrar ' + file} onClick={() => closeTab(file)}><X size={13}/></IconButton></div>)}</div>
        <div className="editor-area">{active && project ? <Editor height="100%" theme="noir" language="java" path={'java://' + project.id + '/sources/' + active} value={files[active] || ''} onChange={v => changeFiles({ ...state.current.files, [active]: v || '' })} onMount={editor => { editorRef.current = editor; }} loading={<div className="editor-empty">Preparando tu editor…</div>} options={{ readOnly:folderWorking, fontSize:size, fontFamily:'Consolas, "Cascadia Code", monospace', minimap:{enabled:false}, padding:{top:22}, lineHeight:26, scrollBeyondLastLine:false, automaticLayout:true, tabSize:4, wordWrap:wrap ? 'on' : 'off', smoothScrolling:true, bracketPairColorization:{enabled:true}, suggest:{showWords:true}, quickSuggestions:true, tabCompletion:'on', fixedOverflowWidgets:true }}/>:<div className="editor-empty"><Code2 size={44}/><h1>{project ? 'Tu carpeta está lista.' : 'Abre tu carpeta de Java.'}</h1><p>{project ? 'Crea una hoja con el botón de arriba.' : 'Elige dónde trabajar y guarda tus archivos en esa carpeta.'}</p><button className="run-button" onClick={project ? newFile : folderMenu}>{project ? <FilePlus2 size={17}/> : <FolderOpen size={17}/>}{project ? 'Nueva hoja' : 'Elegir carpeta'}</button></div>}</div>
        <section className={'console ' + (consoleVisible ? '' : 'console-collapsed')}>
          <div className="console-heading"><div className="console-tabs"><button className={consoleTab === 'output' ? 'selected' : ''} onClick={() => { setConsoleTab('output'); setConsoleVisible(true); }}><Terminal size={15}/>Consola</button><button className={consoleTab === 'problems' ? 'selected' : ''} onClick={() => { setConsoleTab('problems'); setConsoleVisible(true); }}>Problemas<span className={'count ' + (errorCount ? 'error' : '')}>{diagnostics.length}</span></button><button className={consoleTab === 'input' ? 'selected' : ''} onClick={() => { setConsoleTab('input'); setConsoleVisible(true); }}>Entrada · Scanner</button></div>
          <div className="console-actions"><select className="console-entry" aria-label="Archivo con main para ejecutar" value={entry} onChange={e => setEntry(e.target.value)} disabled={!project || !entry}>{Object.keys(files).map(f => <option key={f}>{f}</option>)}</select><IconButton label="Comprobar Java" disabled={!project || !entry || busy || folderWorking} onClick={() => run(true)}><Check size={17}/></IconButton><IconButton label="Ejecutar · F5" disabled={!project || !entry || busy || folderWorking} onClick={() => run()}>{busy ? <Loader2 className="spin" size={18}/> : <Play size={18} fill="currentColor"/>}</IconButton><IconButton label="Limpiar consola" onClick={() => setResult(null)}><Trash2 size={17}/></IconButton><IconButton label={consoleVisible ? 'Ocultar consola abajo' : 'Mostrar consola'} onClick={() => setConsoleVisible(!consoleVisible)} aria-expanded={consoleVisible}>{consoleVisible ? <ChevronDown size={19}/> : <ChevronUp size={19}/>}</IconButton></div>
          </div>
          {consoleVisible && <div className="console-body">{consoleTab === 'input' ? <><label className="input-label" htmlFor="stdin">Escribe los datos que leerá Scanner, uno por línea, antes de ejecutar.</label><textarea id="stdin" value={input} onChange={e => setInput(e.target.value)} placeholder={'Fabrizio\n25'} spellCheck={false}/></>:consoleTab === 'problems' ? diagnostics.length ? diagnostics.map((d,i) => <button key={i} className="diagnostic" onClick={() => goToDiagnostic(d)}><span className={d.severity === 'error' ? 'red' : 'gold'}>{d.severity === 'error' ? '×' : '!'}</span><span>{d.message}</span><small>{d.file}:{d.line}</small></button>) : <div className="console-placeholder"><Check size={17}/>{checking ? 'Comprobando con javac…' : project ? 'Sin errores detectados en la última comprobación.' : 'Abre una carpeta para comprobarla.'}</div> : result ? <><div className={'execution-meta ' + (result.compiled && result.exitCode === 0 ? 'success' : 'red')}>{result.timedOut ? 'Proceso detenido: límite de tiempo o salida alcanzado.' : !result.compiled ? 'La compilación encontró errores.' : result.exitCode === 0 ? 'Proceso terminado · código 0' : 'Proceso terminado · código ' + result.exitCode}</div><pre>{result.stdout}</pre>{result.compilerOutput && <pre className="red">{result.compilerOutput}</pre>}{result.stderr && <pre className="red">{result.stderr}</pre>}{result.compiled && !result.stdout && !result.stderr && <p className="muted">El programa no escribió nada en la consola.</p>}</> : <div className="console-welcome"><span className="prompt">❯</span><div><strong>Tu consola está lista.</strong><p>Ejecuta tu programa con <kbd>F5</kbd> para ver el resultado aquí.</p></div></div>}</div>}
        </section>
      </main>
    </div>
    <footer className="statusbar"><div><Code2 size={13}/><span>Java 17</span><span className="status-separator">/</span><span>{checking ? 'Comprobando…' : errorCount + ' errores'}</span></div><div><span>{project?.storage === 'native' || project?.storage === 'browser' ? 'Carpeta real' : runner === 'docker' ? 'Ejecución aislada' : 'Java en el navegador'}</span><span>UTF-8</span><span>Espacios: 4</span></div></footer>
    {message && <div className="toast" role="alert"><span>{message}</span><IconButton label="Cerrar aviso" onClick={() => setMessage('')}><X size={16}/></IconButton></div>}
    {contextMenu && <div ref={contextRef} className="tree-context-menu" role="menu" aria-label="Acciones del explorador" style={{left:Math.max(8,contextMenu.x),top:Math.max(8,contextMenu.y)}}><div className="context-title">{contextMenu.target.kind === 'root' ? project.name : contextMenu.target.path.split('/').at(-1)}</div><button role="menuitem" onClick={() => nodeAction('rename',contextMenu.target)}><FileCode2 size={16}/>Cambiar nombre</button><button role="menuitem" className="context-delete" onClick={() => nodeAction('delete',contextMenu.target)}><Trash2 size={16}/>Eliminar</button></div>}
    <input ref={backupInput} type="file" accept=".json" hidden onChange={importBackup}/>
    {(modal || auth) && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && project && !auth && !folderWorking) setModal(null); }}><section className={'modal ' + (modal === 'projects' ? 'project-modal' : '')} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-top"><span className="eyebrow">{auth ? 'ACCESO PRIVADO' : modal === 'projects' ? 'CARPETAS DE JAVA' : 'HERRAMIENTAS'}</span>{project && !auth && <IconButton label="Cerrar ventana" onClick={() => setModal(null)} disabled={folderWorking}><X size={19}/></IconButton>}</div>
      {auth ? <form onSubmit={e => { e.preventDefault(); sessionStorage.setItem('noir-token',password); setToken(password); }}><LockKeyhole className="gold" size={32}/><h2 id="modal-title">Tu espacio es privado.</h2><p className="muted">Introduce la clave de acceso de tu servidor.</p><label>Clave de acceso<input autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)} required/></label><button className="run-button full" type="submit">Entrar</button></form>
      :modal === 'folder-options' ? <><h2 id="modal-title">Abrir o crear carpeta.</h2><button className="secondary-button full" onClick={() => { setName(''); setModal('projects'); }}><FolderOpen size={18}/>Abrir</button><p className="muted">Abre una carpeta existente o crea un nuevo proyecto con el selector de ubicación.</p><button className="run-button full" disabled={!project} onClick={() => { setName(''); setModal('create-subfolder'); }}><FolderPlus size={18}/>Crear</button><p className="muted">{project ? 'Crea una subcarpeta dentro de ' + project.name + '.' : 'Primero abre una carpeta de trabajo.'}</p></>
      :modal === 'create-subfolder' ? <form onSubmit={e => { e.preventDefault(); operate({action:'create-folder',destination:creationFolder,newName:name.trim()}); }}><h2 id="modal-title">Crear dentro de {project.name}.</h2><label>Ubicación<select value={creationFolder} onChange={e => setCreationFolder(e.target.value)} disabled={folderWorking}><option value="">{project.name} (carpeta principal)</option>{[...new Set([...folders,...Object.keys(files).flatMap(f => { const p=f.split('/').slice(0,-1); return p.map((_,i)=>p.slice(0,i+1).join('/')); })])].sort().map(f => <option key={f} value={f}>{project.name}/{f}</option>)}</select></label><label>Nombre de la carpeta<input autoFocus value={name} onChange={e => setName(e.target.value)} required disabled={folderWorking} placeholder="tema2"/></label><p className="node-path">Ruta: {project.name}/{creationFolder ? creationFolder + '/' : ''}{name || 'NuevaCarpeta'}</p><button className="run-button full" disabled={folderWorking} type="submit">{folderWorking ? 'Creando…' : 'Crear carpeta'}</button></form>
      :modal === 'projects' ? <><h2 id="modal-title">Elige tu carpeta de trabajo.</h2><p className="muted">Tus hojas Java se guardan en la carpeta real que elijas.</p><div className="project-modal-grid"><div><h3>Entrar en una carpeta</h3><button className="secondary-button full" onClick={() => chooseFolder(false)} disabled={folderWorking}><FolderOpen size={18}/>{folderWorking ? 'Seleccionando carpeta…' : 'Abrir carpeta existente'}</button><p className="import-note">Se abrirá el explorador para seleccionar una carpeta de tu ordenador. Los cambios se guardarán allí.</p>{projects.length > 0 && <details className="legacy-projects"><summary>Copias abiertas en esta pestaña</summary><div className="project-list">{projects.map(p => <button className="project-card" key={p.id} onClick={() => openProject(p.id)} disabled={folderWorking}><FolderOpen size={20}/><span><strong>{p.name}</strong><small>{p.count} archivos · copia en esta pestaña</small></span></button>)}</div></details>}</div><form onSubmit={e => { e.preventDefault(); chooseFolder(true); }}><h3>Crear una carpeta</h3><label>Nombre de la carpeta<input autoFocus value={name} maxLength={60} onChange={e => { setName(e.target.value); setFilePackage(suggestPackage(e.target.value)); }} placeholder="Ejercicios de Java" required disabled={folderWorking}/></label><button className="run-button full" type="submit" disabled={folderWorking}>{folderWorking ? <Loader2 size={16} className="spin"/> : <FolderPlus size={18}/>}Crear y elegir ubicación</button><p className="import-note">Elige la carpeta donde crearla, por ejemplo el Escritorio. Se creará Main.java directamente en esa carpeta.</p></form></div></>
      :modal === 'file' ? <form onSubmit={addFile}><h2 id="modal-title">Una nueva hoja Java.</h2><label>Nombre de la clase<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ejercicio.java" required/></label><p className="node-path">Ruta: {project?.name}/{creationFolder ? creationFolder + '/' : ''}{name || 'Nombre.java'}</p><button className="run-button full">Crear y guardar hoja</button></form>
      :modal === 'settings' ? <><h2 id="modal-title">A tu medida.</h2><label>Tamaño de letra · {size}px<input type="range" min="12" max="24" value={size} onChange={e => setSize(Number(e.target.value))}/></label><label className="checkbox-label"><input type="checkbox" checked={wrap} onChange={e => setWrap(e.target.checked)}/>Ajustar líneas largas al ancho del editor</label>{project && active && <button className="danger-button" onClick={() => nodeAction('delete',{kind:'file',path:active})}>Eliminar {active}</button>}{project && <button className="secondary-button" onClick={exportProject}><Download size={15}/>Guardar copia del proyecto</button>}</>
      :modal === 'rename-node' ? <form onSubmit={e => { e.preventDefault(); operate({action:'rename',target:selectedNode,newName:renameValue.trim()}); }}><h2 id="modal-title">Cambiar nombre.</h2><label>Nuevo nombre<input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} required disabled={folderWorking}/></label><p className="muted">{selectedNode?.kind === 'root' ? 'Se cambiará el nombre de la carpeta del proyecto. Sus packages se conservarán.' : 'Se actualizará la ruta real y, cuando corresponda, el nombre de la clase y su package.'}</p><button className="run-button full" type="submit" disabled={folderWorking}>{folderWorking ? <Loader2 className="spin" size={16}/> : <Check size={16}/>}Guardar nombre</button></form>
      :modal === 'delete-node' ? <><h2 id="modal-title">¿Eliminar {selectedNode?.kind === 'root' ? project.name : selectedNode?.path.split('/').at(-1)}?</h2><p className="muted">{project.storage === 'native' || project.storage === 'browser' ? selectedNode?.kind === 'file' ? 'Se eliminará la hoja de tu carpeta real.' : 'Se eliminará la carpeta real y todo su contenido, incluidos los archivos que no sean Java.' : 'Se eliminará de esta copia en la pestaña.'}</p><p className="node-path">{selectedNode?.kind === 'root' ? project.location || project.name : selectedNode?.path}</p><button className="danger-button" disabled={folderWorking} onClick={() => operate({action:'delete',target:selectedNode})}>{folderWorking ? 'Eliminando…' : 'Eliminar'}</button><button className="secondary-button" disabled={folderWorking} onClick={() => setModal(null)}>Cancelar</button></>
      :<><h2 id="modal-title">Atajos de Java.</h2><div className="shortcut-list">{[['imprimir (o impri) + Tab','System.out.println(…);'],['main + Tab','Package, clase y método principal'],['fori + Tab','Crear un bucle for'],['Ctrl + Espacio','Mostrar sugerencias'],['Ctrl + S','Guardar en la carpeta abierta'],['F5','Compilar y ejecutar']].map(([a,b]) => <div key={a}><kbd>{a}</kbd><span>{b}</span></div>)}</div><p className="muted">Las sugerencias son atajos y palabras del archivo. Los errores se comprueban con javac; pulsa un problema para ir a la línea.</p><p className="muted">Para Scanner, abre «Entrada» y escribe los datos antes de ejecutar. Junto a la papelera de la consola puedes elegir la clase con main y ejecutarla.</p></>}
    </section></div>}
  <a className="java-runtime-credit" href="https://cheerpj.com" target="_blank" rel="noopener noreferrer">Java 17 con CheerpJ</a></div>;
}

