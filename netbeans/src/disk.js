// Browser-backed folders are real user-selected folders, never imported copies.
import { planTreeOperation, validateTreePath } from './tree-operations.js';
export async function readDirectory(directory, folders = []) {
  const files = {};
  let size = 0;
  async function walk(handle, prefix = '') {
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === 'directory' && !['node_modules', '.git', 'target', 'build', 'dist', '.idea', 'nbproject'].includes(name)) { folders.push(prefix + name); await walk(entry, prefix + name + '/'); }
      else if (entry.kind === 'file' && name.endsWith('.java')) {
        const file = await entry.getFile(); size += file.size;
        if (size > 1024 * 1024 || Object.keys(files).length >= 100) throw new Error('Abre hasta 100 archivos Java y 1 MB de código.');
        files[prefix + name] = await file.text();
      }
    }
  }
  await walk(directory);
  return files;
}

async function folderHandle(directory, relative) {
  validateTreePath(relative, true);
  let handle = directory;
  for (const part of relative.split('/').filter(Boolean)) handle = await handle.getDirectoryHandle(part);
  return handle;
}
async function entryExists(directory, name) {
  try { await directory.getFileHandle(name); return true; }
  catch (error) { if (error.name === 'TypeMismatchError') return true; if (error.name !== 'NotFoundError') throw error; }
  try { await directory.getDirectoryHandle(name); return true; }
  catch (error) { if (error.name === 'TypeMismatchError') return true; if (error.name !== 'NotFoundError') throw error; }
  return false;
}
async function copyEntry(source, destination, name, kind) {
  if (kind === 'file') {
    const original = await source.getFile();
    const created = await destination.getFileHandle(name, { create: true });
    const writable = await created.createWritable();
    try { await writable.write(original); await writable.close(); }
    catch (error) { await writable.abort().catch(() => {}); throw error; }
    const after = await source.getFile();
    if (after.size !== original.size || after.lastModified !== original.lastModified) throw new Error('El archivo cambió mientras se copiaba; se ha conservado el original.');
  } else {
    const created = await destination.getDirectoryHandle(name, { create: true });
    const before = [];
    for await (const [childName, child] of source.entries()) { before.push(childName + ':' + child.kind); await copyEntry(child, created, childName, child.kind); }
    const after = []; for await (const [childName, child] of source.entries()) after.push(childName + ':' + child.kind);
    if (before.sort().join('|') !== after.sort().join('|')) throw new Error('La carpeta cambió mientras se copiaba; se ha conservado el original.');
  }
}
async function fingerprint(handle, kind) {
  if (kind === 'file') { const file = await handle.getFile(); return `${file.size}:${file.lastModified}`; }
  const entries = [];
  for await (const [name, child] of handle.entries()) entries.push([name, child.kind, await fingerprint(child, child.kind)]);
  return JSON.stringify(entries.sort((a,b) => a[0].localeCompare(b[0])));
}
export async function operateDirectory(connection, operation) {
  const folders = [], actual = await readDirectory(connection.handle, folders);
  if (JSON.stringify(Object.entries(actual).sort()) !== JSON.stringify(Object.entries(connection.baseline).sort())) throw new Error('La carpeta cambió fuera del editor. Vuelve a abrirla antes de modificarla.');
  const plan = planTreeOperation(actual, operation, folders);
  if (plan.unchanged) return { files: actual, folders };
  if (operation.action === 'create-folder') {
    const parent = await folderHandle(connection.handle,operation.destination), name = plan.newPath.split('/').at(-1);
    if (await entryExists(parent,name)) throw new Error('Ya existe un elemento con ese nombre.');
    await parent.getDirectoryHandle(name,{create:true});
    const nextFolders = []; await readDirectory(connection.handle,nextFolders);
    return {files:actual,folders:nextFolders,name:connection.handle.name,location:connection.handle.name};
  }
  const isRoot = operation.target.kind === 'root';
  if (isRoot && !connection.parent) throw new Error('Selecciona primero la carpeta que contiene este proyecto.');
  const oldName = isRoot ? connection.handle.name : plan.oldPath.split('/').at(-1);
  const oldParent = isRoot ? connection.parent : await folderHandle(connection.handle, plan.oldPath.split('/').slice(0,-1).join('/'));
  const kind = isRoot ? 'directory' : operation.target.kind === 'folder' ? 'directory' : 'file';
  const original = kind === 'directory' ? await oldParent.getDirectoryHandle(oldName) : await oldParent.getFileHandle(oldName);
  if (isRoot && !await original.isSameEntry(connection.handle)) throw new Error('La carpeta elegida no contiene este proyecto.');
  try {
    if (operation.action === 'delete') {
      await oldParent.removeEntry(oldName, { recursive: kind === 'directory' });
      if (isRoot) return { deleted: true };
    } else {
      const newName = isRoot ? plan.newName : plan.newPath.split('/').at(-1);
      const newParent = isRoot ? connection.parent : await folderHandle(connection.handle, plan.newPath.split('/').slice(0,-1).join('/'));
      if (await entryExists(newParent, newName)) throw new Error('Ya existe un elemento con ese nombre en el destino.');
      // Browser directories cannot be moved natively: copy complete contents, then remove the source.
      const before = await fingerprint(original, kind);
      await copyEntry(original, newParent, newName, kind);
      if (before !== await fingerprint(original, kind)) throw new Error('El origen cambió durante el movimiento; se ha conservado el original.');
      await oldParent.removeEntry(oldName, { recursive: kind === 'directory' });
      if (isRoot) connection.handle = await connection.parent.getDirectoryHandle(newName);
    }
    connection.baseline = await readDirectory(connection.handle);
    await writeDirectory(connection, plan.files);
    const nextFolders = [], files = await readDirectory(connection.handle, nextFolders);
    return { files, folders: nextFolders, name: connection.handle.name, location: connection.handle.name };
  } catch (error) {
    const nextFolders = [];
    try { connection.baseline = await readDirectory(connection.handle, nextFolders); error.recovery = { files: { ...connection.baseline }, folders: nextFolders, name: connection.handle.name, location: connection.handle.name }; } catch {}
    throw error;
  }
}
async function fileHandle(directory, filename, create) {
  const pieces = filename.split('/');
  let parent = directory;
  for (const part of pieces.slice(0, -1)) parent = await parent.getDirectoryHandle(part, { create });
  return { parent, handle: await parent.getFileHandle(pieces.at(-1), { create }), name: pieces.at(-1) };
}
export async function writeDirectory(connection, files) {
  if (await connection.handle.queryPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('La carpeta necesita permiso de escritura. Vuelve a abrirla con el botón Carpeta.');
  const actual = await readDirectory(connection.handle);
  if (JSON.stringify(Object.entries(actual).sort()) !== JSON.stringify(Object.entries(connection.baseline).sort())) throw new Error('La carpeta cambió fuera del editor. Conserva tus cambios y vuelve a abrirla antes de guardar.');
  // Save all changed/new files first; don't touch unrelated files or folders.
  for (const [filename, source] of Object.entries(files)) {
    if (connection.baseline[filename] === source) continue;
    const { handle } = await fileHandle(connection.handle, filename, true);
    const writable = await handle.createWritable();
    try { await writable.write(source); await writable.close(); }
    catch (error) { await writable.abort().catch(() => {}); throw error; }
    connection.baseline[filename] = source;
  }
  for (const filename of Object.keys(connection.baseline)) {
    if (Object.hasOwn(files, filename)) continue;
    const { parent, name } = await fileHandle(connection.handle, filename, false);
    await parent.removeEntry(name); delete connection.baseline[filename];
  }
  connection.baseline = { ...files };
}
