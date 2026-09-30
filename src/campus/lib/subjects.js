import schedule from '../../../public/horario.json';
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\([^)]*\)/g,'').trim().toLowerCase();
const aliases={ED:['entornos de desarrollo'],BD:['bases de datos'],IPE1:['ipe','ipe i','ipe1','itinerario personal para la empleabilidad i'],Prg:['programacion'],SI:['sistemas informaticos'],LMSGI:['lenguajes de marcas','lenguaje de marcas'],INGPR:['ingles','ingles profesional'],SOS:['sostenibilidad']};
export function subjectCode(name){const text=normalize(name);return Object.keys(schedule.subjects).find(code=>normalize(code)===text||normalize(schedule.subjects[code].name)===text||aliases[code]?.some(alias=>normalize(alias)===text));}
export function examCourses(rows){
 const result=Object.entries(schedule.subjects).map(([code,subject])=>{const row=rows.find(c=>subjectCode(c.nombre)===code);return {id:row?.id||`schedule:${code}`,nombre:subject.name,code};});
 return [...result,...rows.filter(c=>!subjectCode(c.nombre)).map(c=>({...c,code:null}))];
}
