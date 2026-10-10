// File input fallback for browsers without writable directory handles.
export async function importFolder(selection) {
  const files = Object.create(null), folders = new Set();
  let bytes = 0, name = 'Proyecto Java';
  for (const file of selection) {
    const parts = (file.webkitRelativePath || file.name).split('/');
    if (parts.length > 1) name = parts.shift();
    if (parts.some(p => ['node_modules','.git','target','build','dist','.idea','nbproject'].includes(p))) continue;
    if (!file.name.endsWith('.java')) continue;
    if (parts.some(p => !p || p === '.' || p === '..')) throw Error('Ruta de archivo inválida.');
    bytes += file.size;
    if (bytes > 1048576 || Object.keys(files).length >= 100) throw Error('Abre hasta 100 archivos Java y 1 MB de código.');
    const path = parts.join('/');
    if (Object.hasOwn(files,path)) throw Error('Hay archivos con la misma ruta.');
    files[path] = await file.text();
    for(let i=1;i<parts.length;i++) folders.add(parts.slice(0,i).join('/'));
  }
  if (!Object.keys(files).length) throw Error('La carpeta no contiene archivos .java.');
  return {name,files,folders:[...folders]};
}
