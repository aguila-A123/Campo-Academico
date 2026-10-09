import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir, readdir, readFile, lstat, realpath, writeFile, rename, unlink, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { validateFiles } from './core.mjs';
import { planTreeOperation, validateTreePath } from '../src/tree-operations.js';

export const nativeFoldersAvailable = process.platform === 'win32';
const sessions = new Map();
const savingRoots = new Set();
let pickerActive = false;
export function selectFolder() {
  if (!nativeFoldersAvailable) throw new Error('Abre la web en Chrome o Edge para seleccionar una carpeta real.');
  if (pickerActive) throw new Error('Ya hay un selector de carpetas abierto.');
  pickerActive = true;
  return new Promise((resolve, reject) => {
    const script = `$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.Windows.Forms; Add-Type -Path $env:NOIR_PICKER_SOURCE; [System.Windows.Forms.Application]::EnableVisualStyles(); $owner = New-Object System.Windows.Forms.Form; $owner.TopMost = $true; $owner.ShowInTaskbar = $false; $owner.Opacity = 0; $owner.Show(); $timer = New-Object System.Windows.Forms.Timer; $timer.Interval = 200; $timer.Add_Tick({ [JavaNoir.FolderPicker]::PromoteWindows() }); $timer.Start(); try { $selected = [JavaNoir.FolderPicker]::Pick($owner.Handle, 'Java Noir - elegir carpeta'); if ($selected) { [Console]::Write([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($selected))) } } finally { $timer.Stop(); $timer.Dispose(); $owner.Dispose() }`;
    const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, env: { ...process.env, NOIR_PICKER_SOURCE: fileURLToPath(new URL('./FolderPicker.cs', import.meta.url)) } });
    let output = '', errors = '';
    const timer = setTimeout(() => child.kill(), 5 * 60 * 1000);
    child.stdout.on('data', d => output += d.toString()); child.stderr.on('data', d => errors += d.toString());
    child.on('error', error => { clearTimeout(timer); pickerActive = false; reject(error); });
    child.on('close', code => {
      clearTimeout(timer); pickerActive = false;
      if (code !== 0) return reject(new Error('No se pudo abrir el selector de Windows. ' + errors));
      resolve(output.trim() ? Buffer.from(output.trim(), 'base64').toString('utf8') : null);
    });
  });
}
export async function readJavaFolder(root, folders = []) {
  const files = {}; let size = 0;
  async function visit(directory, prefix = '') {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, item.name), info = await lstat(target);
      if (info.isSymbolicLink()) continue;
      if (info.isDirectory() && !['.git', 'node_modules', 'build', 'target', 'dist', '.idea', 'nbproject'].includes(item.name)) { folders.push(prefix + item.name); await visit(target, prefix + item.name + '/'); }
      else if (info.isFile() && item.name.endsWith('.java')) {
        size += info.size;
        if (size > 1024 * 1024 || Object.keys(files).length >= 100) throw new Error('Abre hasta 100 archivos Java y 1 MB de código.');
        files[prefix + item.name] = await readFile(target, 'utf8');
      }
    }
  }
  await visit(root);
  if (Object.keys(files).length) validateFiles(files);
  return files;
}
function folderName(name) {
  if (typeof name !== 'string' || !name.trim() || name.length > 60 || /[<>:"/\\|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name) || name === '.' || name === '..' || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) throw new Error('Usa un nombre de carpeta válido.');
  return name;
}
async function safeTarget(root, filename, create = false) {
  let current = root;
  const parts = filename.split('/');
  for (const part of parts.slice(0,-1)) {
    current = path.join(current, part);
    if (create) await mkdir(current, { recursive: false }).catch(error => { if (error.code !== 'EEXIST') throw error; });
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('La ruta contiene un enlace o no es una carpeta real.');
  }
  const target = path.join(current, parts.at(-1));
  const info = await lstat(target).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
  if (info && (!info.isFile() || info.isSymbolicLink())) throw new Error('El archivo no es un archivo Java regular.');
  return target;
}
export async function connectFolder(selected, options = {}) {
  if (!selected) return null;
  let root = await realpath(selected);
  if (options.create) {
    validateFiles(options.files);
    root = path.join(root, folderName(options.name));
    try { await mkdir(root); } catch (error) { if (error.code === 'EEXIST') throw new Error('Ya existe esa carpeta. Usa otro nombre o ábrela como carpeta existente.'); throw error; }
    for (const [filename, source] of Object.entries(options.files)) {
      const target = await safeTarget(root, filename, true); await writeFile(target, source, { flag: 'wx' });
    }
  }
  const folders = [], files = await readJavaFolder(root, folders), id = randomUUID();
  const session = { id, root, files: { ...files }, revision: 1 };
  sessions.set(id, session);
  return { id, name: path.basename(root), location: root, files, folders, revision: 1, storage: 'native' };
}
const equalFiles = (a,b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
export async function saveFolder(id, files, revision) {
  validateFiles(files, true);
  const session = sessions.get(id);
  if (!session) throw new Error('Vuelve a abrir la carpeta: el servidor se ha reiniciado.');
  if (savingRoots.has(session.root)) throw new Error('Esta carpeta se está guardando en otra operación. Espera un momento.');
  session.saving = true;
  savingRoots.add(session.root);
  try {
    if (revision !== session.revision) throw new Error('La carpeta cambió en otra pestaña. Vuelve a abrirla.');
    if (await realpath(session.root) !== session.root) throw new Error('La ubicación de la carpeta ha cambiado.');
    if (!equalFiles(await readJavaFolder(session.root), session.files)) throw new Error('La carpeta cambió fuera del editor. Conserva tus cambios y vuelve a abrirla antes de guardar.');
    for (const [filename, source] of Object.entries(files)) {
      if (session.files[filename] === source) continue;
      const target = await safeTarget(session.root, filename, true);
      const temporary = path.join(path.dirname(target), `.noir-${randomUUID()}.tmp`);
      await writeFile(temporary, source, { flag: 'wx' });
      try { await rename(temporary, target); } catch (error) { await unlink(temporary).catch(() => {}); throw error; }
      session.files[filename] = source;
    }
    for (const filename of Object.keys(session.files)) {
      if (Object.hasOwn(files, filename)) continue;
      await unlink(await safeTarget(session.root, filename)); delete session.files[filename];
    }
    session.files = { ...files }; session.revision++;
    return { revision: session.revision };
  } finally { session.saving = false; savingRoots.delete(session.root); }
}

async function safeDirectory(root, relative, create = false) {
  validateTreePath(relative, true);
  let current = root;
  for (const part of relative.split('/').filter(Boolean)) {
    current = path.join(current, part);
    if (create) await mkdir(current).catch(error => { if (error.code !== 'EEXIST') throw error; });
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('La ruta contiene un enlace o no es una carpeta real.');
  }
  const absolute = await realpath(current);
  const relation = path.relative(root, absolute);
  if (relation.startsWith('..' + path.sep) || relation === '..' || path.isAbsolute(relation)) throw new Error('La ruta sale de la carpeta elegida.');
  return absolute;
}
function protectRoot(root) {
  const homes = [homedir(), process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial].filter(Boolean);
  const protectedPaths = [path.parse(root).root, ...homes, ...homes.flatMap(home => ['Desktop','Documents','Downloads','Escritorio','Documentos'].map(name => path.join(home,name))), process.env.SystemRoot, process.env.ProgramFiles].filter(Boolean).map(p => path.resolve(p).toLowerCase());
  if (protectedPaths.includes(path.resolve(root).toLowerCase())) throw new Error('Abre una carpeta de proyecto: no se puede renombrar ni eliminar una ubicación del sistema.');
}
export async function operateFolder(id, operation, revision) {
  const session = sessions.get(id);
  if (!session) throw new Error('Vuelve a abrir la carpeta: el servidor se ha reiniciado.');
  const originalRoot = session.root;
  if (savingRoots.has(originalRoot)) throw new Error('Espera a que termine el guardado.');
  savingRoots.add(originalRoot);
  try {
    if (revision !== session.revision) throw new Error('La carpeta cambió en otra pestaña. Vuelve a abrirla.');
    if (await realpath(originalRoot) !== originalRoot) throw new Error('La ubicación de la carpeta ha cambiado.');
    const folders = [], actual = await readJavaFolder(originalRoot, folders);
    if (!equalFiles(actual, session.files)) throw new Error('La carpeta cambió fuera del editor. Guarda una copia de tus cambios y vuelve a abrirla.');
    const plan = planTreeOperation(actual, operation, folders);
    if (plan.unchanged) return { ...session, name: path.basename(originalRoot), location: originalRoot, folders, storage: 'native' };
    validateFiles(plan.files, true);
    if (operation.action === 'create-folder') {
      const parent = await safeDirectory(originalRoot, operation.destination);
      await mkdir(path.join(parent, plan.newPath.split('/').at(-1)));
      const nextFolders = []; session.files = await readJavaFolder(originalRoot,nextFolders); session.revision++;
      return {id,name:path.basename(originalRoot),location:originalRoot,files:session.files,folders:nextFolders,revision:session.revision,storage:'native'};
    }
    let source, destination;
    if (operation.target.kind === 'root') {
      protectRoot(originalRoot); source = originalRoot;
      if (operation.action === 'rename') destination = path.join(path.dirname(originalRoot), folderName(plan.newName));
    } else {
      source = operation.target.kind === 'file' ? await safeTarget(originalRoot, plan.oldPath) : await safeDirectory(originalRoot, plan.oldPath);
      const info = await lstat(source);
      if (info.isSymbolicLink()) throw new Error('No se pueden modificar enlaces.');
      if (operation.action !== 'delete') {
        const parent = plan.newPath.split('/').slice(0,-1).join('/');
        await safeDirectory(originalRoot, parent, true);
        destination = path.join(originalRoot, plan.newPath);
      }
    }
    if (destination) {
      const collision = await lstat(destination).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
      if (collision) throw new Error('Ya existe un elemento con ese nombre en el destino.');
      await rename(source, destination);
      if (operation.target.kind === 'root') session.root = await realpath(destination);
    } else {
      // Absolute source was checked against the explicitly selected project root above.
      await rm(source, { recursive: operation.target.kind !== 'file' });
      if (operation.target.kind === 'root') { sessions.delete(id); return { deleted: true }; }
    }
    // Preserve all non-Java files by moving the physical folder as a whole.
    session.files = await readJavaFolder(session.root);
    for (const [filename, content] of Object.entries(plan.files)) {
      if (session.files[filename] === content) continue;
      const target = await safeTarget(session.root, filename);
      const temporary = path.join(path.dirname(target), '.noir-' + randomUUID() + '.tmp');
      await writeFile(temporary, content, { flag: 'wx' });
      try { await rename(temporary, target); } finally { await unlink(temporary).catch(() => {}); }
      session.files[filename] = content;
    }
    const nextFolders = []; session.files = await readJavaFolder(session.root, nextFolders); session.revision++;
    return { id, name: path.basename(session.root), location: session.root, files: session.files, folders: nextFolders, revision: session.revision, storage: 'native' };
  } catch (error) {
    // If a filesystem operation completed before a later write failed, return actual disk state.
    const folders = [];
    try {
      session.files = await readJavaFolder(session.root, folders);
      session.revision++;
      error.recovery = { id, name: path.basename(session.root), location: session.root, files: session.files, folders, revision: session.revision, storage: 'native' };
    } catch {}
    throw error;
  } finally { savingRoots.delete(originalRoot); }
}
