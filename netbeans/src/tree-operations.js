import { javaFile, packageOf, sourceRoot, validPackage } from './java-project.js';

export function validNodeName(name, kind) {
  if (typeof name !== 'string' || !name.trim() || name.length > 80 || /[<>:"/\\|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name) || ['.', '..'].includes(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) throw new Error('Usa un nombre válido, sin barras ni caracteres especiales.');
  if (kind === 'file') { javaFile(name, ''); return name.endsWith('.java') ? name : name + '.java'; }
  if (kind === 'folder' && !validPackage(name)) throw new Error('Esta carpeta forma parte de una ruta Java: usa un nombre como ejercicios o tema2.');
  return name;
}
export function validateTreePath(value, allowRoot = false) {
  if (allowRoot && value === '') return;
  if (typeof value !== 'string' || !/^(?:[A-Za-z_$][\w$]*\/)*(?:[A-Za-z_$][\w$]*(?:\.java)?|package-info\.java|module-info\.java)$/.test(value) || value.length > 180) throw new Error('Ruta inválida dentro del proyecto.');
}
const parentOf = value => value.split('/').slice(0,-1).join('/');
const baseOf = value => value.split('/').at(-1);
const inside = (value, folder) => value === folder || value.startsWith(folder + '/');
const literals = /"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g;
function mask(source) { return source.replace(literals, text => text.replace(/[^\r\n]/g, ' ')); }
function replaceCode(source, pattern, replacement) {
  const clean = mask(source), matches = [...clean.matchAll(pattern)];
  for (const match of matches.reverse()) source = source.slice(0, match.index) + replacement(match) + source.slice(match.index + match[0].length);
  return source;
}
function setPackage(source, pkg) {
  const match = mask(source).match(/^[ \t]*package\s+[\w.$]+\s*;[ \t]*(?:\r?\n)?/m);
  if (match) return source.slice(0, match.index) + (pkg ? 'package ' + pkg + ';\n' : '') + source.slice(match.index + match[0].length);
  return pkg ? 'package ' + pkg + ';\n\n' + source : source;
}
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function planTreeOperation(files, operation, folders = []) {
  const { action, target } = operation || {};
  if (action === 'create-folder') {
    validateTreePath(operation.destination, true);
    const newPath = [operation.destination, validNodeName(operation.newName, 'folder')].filter(Boolean).join('/');
    if (folders.includes(newPath) || Object.hasOwn(files, newPath) || Object.keys(files).some(f => inside(f,newPath))) throw new Error('Ya existe un elemento con ese nombre.');
    return { files:{...files}, mapping:{}, folders:[...folders,newPath], newPath };
  }
  if (!['rename', 'move', 'delete'].includes(action) || !target || !['file','folder','root'].includes(target.kind)) throw new Error('Operación inválida.');
  const oldPath = target.kind === 'root' ? '' : target.path;
  validateTreePath(oldPath, target.kind === 'root');
  if (target.kind === 'root') {
    if (action === 'move') throw new Error('La carpeta principal no se puede mover dentro de sí misma.');
    return { files: action === 'delete' ? {} : { ...files }, mapping: Object.fromEntries(Object.keys(files).map(f => [f, action === 'delete' ? null : f])), folders: action === 'delete' ? [] : folders, oldPath, newPath: '', newName: action === 'rename' ? validNodeName(operation.newName, 'root') : undefined };
  }
  const selected = Object.keys(files).filter(f => target.kind === 'file' ? f === oldPath : inside(f, oldPath));
  if (target.kind === 'file' && !selected.length) throw new Error('La hoja ya no existe.');
  if (target.kind === 'folder' && !selected.length && !folders.includes(oldPath)) throw new Error('La carpeta ya no existe.');
  let newPath;
  if (action === 'rename') newPath = [parentOf(oldPath), validNodeName(operation.newName, target.kind)].filter(Boolean).join('/');
  if (action === 'move') {
    validateTreePath(operation.destination, true);
    if (target.kind === 'folder' && (operation.destination === oldPath || inside(operation.destination, oldPath))) throw new Error('No puedes mover una carpeta dentro de sí misma.');
    if (operation.destination && Object.hasOwn(files, operation.destination)) throw new Error('El destino debe ser una carpeta.');
    newPath = [operation.destination, baseOf(oldPath)].filter(Boolean).join('/');
  }
  if (action !== 'delete') {
    validateTreePath(newPath);
    if (newPath === oldPath) return { files: { ...files }, mapping: {}, folders, oldPath, newPath, unchanged: true };
    if (Object.hasOwn(files, newPath) || folders.includes(newPath) || Object.keys(files).some(f => inside(f, newPath))) throw new Error('Ya existe un elemento con ese nombre en el destino.');
  }
  const mapPath = value => (target.kind === 'file' ? value === oldPath : inside(value, oldPath)) ? action === 'delete' ? null : newPath + value.slice(oldPath.length) : value;
  const mapping = {}, result = {}, moved = [];
  const knownRoots = [...new Set(Object.entries(files).map(([f,s]) => mapPath(sourceRoot(f,s))).filter(root => root !== null))].sort((a,b) => b.length-a.length);
  for (const [filename, source] of Object.entries(files)) {
    const next = mapPath(filename); mapping[filename] = next;
    if (next === null) continue;
    let content = source;
    if (next !== filename) {
      const oldRoot = sourceRoot(filename, source), rootAfterMove = mapPath(oldRoot);
      let root = rootAfterMove && inside(next, rootAfterMove) ? rootAfterMove : knownRoots.find(r => r && inside(next, r)) || next.match(/^(src\/(?:main|test)\/java|src)\//)?.[1] || '';
      const directory = parentOf(next), relative = root ? directory.slice(root.length).replace(/^\//, '') : directory;
      const pkg = relative.replaceAll('/', '.');
      if (!validPackage(pkg)) throw new Error('El destino no corresponde a un package Java válido.');
      content = setPackage(content, pkg);
      moved.push({ oldFile: filename, newFile: next, oldPackage: packageOf(source), newPackage: pkg, oldClass: baseOf(filename).replace('.java',''), newClass: baseOf(next).replace('.java','') });
    }
    result[next] = content;
  }
  // Update identifier references, constructors and qualified imports without altering strings/comments.
  for (const change of moved) {
    if (change.oldClass !== change.newClass && !['package-info','module-info'].includes(change.oldClass)) {
      for (const file of Object.keys(result)) result[file] = replaceCode(result[file], new RegExp('\\b' + escapeRegex(change.oldClass) + '\\b', 'g'), () => change.newClass);
    }
    const oldQualified = [change.oldPackage, change.oldClass].filter(Boolean).join('.');
    const newQualified = [change.newPackage, change.newClass].filter(Boolean).join('.');
    for (const [oldFile, oldSource] of Object.entries(files)) {
      const newFile = mapping[oldFile]; if (!newFile) continue;
      if (change.oldPackage && change.oldPackage !== change.newPackage) result[newFile] = replaceCode(result[newFile], new RegExp('\\b' + escapeRegex([change.oldPackage, change.newClass].join('.')) + '\\b', 'g'), () => newQualified);
      if (oldFile === change.oldFile || packageOf(oldSource) !== change.oldPackage || packageOf(result[newFile]) === change.newPackage) continue;
      if (new RegExp('\\b' + escapeRegex(change.oldClass) + '\\b').test(mask(oldSource))) {
        if (!change.newPackage) throw new Error('Una clase usada por un package no puede moverse al package sin nombre.');
        if (!mask(result[newFile]).includes('import ' + newQualified + ';')) result[newFile] = setPackage(result[newFile], packageOf(result[newFile])).replace(/(^[ \t]*package[^;]+;\n)?/, match => match + 'import ' + newQualified + ';\n');
      }
    }
  }
  const nextFolders = new Set(folders.map(mapPath).filter(f => f !== null));
  for (const file of Object.keys(result)) { const pieces = file.split('/').slice(0,-1); for (let i=1;i<=pieces.length;i++) nextFolders.add(pieces.slice(0,i).join('/')); }
  return { files: result, mapping, folders: [...nextFolders], oldPath, newPath };
}
