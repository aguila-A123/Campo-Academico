const encoder=new TextEncoder();
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function header(size){const bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)};}
function safePath(path){if(!path||path.includes('\\')||path.split('/').some(p=>!p||p==='.'||p==='..')||/[\x00-\x1f:]/.test(path))throw Error('Ruta inválida para exportar.');return path;}
// Standard ZIP, stored entries and UTF-8 names. Code projects are limited to 1 MB.
export function projectZip(project,files,folders=[],target=''){
  if(target)safePath(target);
  const root=(target?target.split('/').at(-1):project.name).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')||'Proyecto';
  const entries=new Map([[root+'/',new Uint8Array()]]);
  const relative=path=>target?path.slice(target.length+1):path;
  for(const folder of folders){safePath(folder);if(!target||folder.startsWith(target+'/'))entries.set(root+'/'+relative(folder)+'/',new Uint8Array());}
  for(const [path,source] of Object.entries(files)){
    safePath(path);if(!path.endsWith('.java')||(target&&!path.startsWith(target+'/')))continue;
    const name=root+'/'+relative(path);const parts=name.split('/');
    for(let i=1;i<parts.length;i++)entries.set(parts.slice(0,i).join('/')+'/',new Uint8Array());
    entries.set(name,encoder.encode(source));
  }
  const chunks=[],central=[];let offset=0,centralSize=0;
  for(const [path,data] of entries){
    const name=encoder.encode(path),crc=crc32(data),local=header(30),index=header(46);
    const l=local.view,c=index.view;
    l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint16(12,33,true);
    l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true);
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);
    c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(38,path.endsWith('/')?16:0,true);c.setUint32(42,offset,true);
    chunks.push(local.bytes,name,data);central.push(index.bytes,name);offset+=30+name.length+data.length;centralSize+=46+name.length;
  }
  const end=header(22);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,entries.size,true);end.view.setUint16(10,entries.size,true);end.view.setUint32(12,centralSize,true);end.view.setUint32(16,offset,true);
  return {blob:new Blob([...chunks,...central,end.bytes],{type:'application/zip'}),name:root+'.zip'};
}
