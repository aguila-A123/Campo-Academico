// Reads the official 20250314 ProgramaDump format, not the user's pseudocode.
// Field order follows PSeInt/pseint/ProgramaDump.cpp (GPL-2.0).
export function parseDump(text) {
  const lines = text.replace(/\r/g, '').split('\n'); let cursor = 0;
  const read = () => { if(cursor >= lines.length) throw Error('Diagrama incompleto'); return lines[cursor++]; };
  const count = Number(read()); const result = [];
  if(!Number.isInteger(count) || count < 0 || count > 20000) throw Error('Formato de diagrama no reconocido');
  for(let index=0; index<count; index++) {
    const header = read().match(/^(\d+) (\d+) (\d+) (.*)$/);
    if(!header) throw Error('Cabecera de diagrama no válida');
    const item = {index, type:+header[1], line:+header[2], instruction:+header[3], text:header[4]};
    const list = n => Array.from({length:n}, read);
    switch(item.type) {
      case 2: item.comment = read(); break;
      case 3: {const [main,end]=read().split(' ').map(Number); Object.assign(item,{main:!!main,end,returnId:read(),name:read(),args:read()}); break;}
      case 4: read(); break;
      case 5: item.variables=list(+read()); break;
      case 6: item.variable=read(); item.value=read(); break;
      case 7: {const [newline,n]=read().split(' ').map(Number); item.newline=!!newline; item.expressions=list(n); break;}
      case 8: {const n=+read(); item.dimensions=Array.from({length:n},()=>[read(),read()]); break;}
      case 9: item.variables=list(+read()); item.variableType=read(); break;
      case 11: {const m=read().match(/^(\d+) (.*)$/); item.factor=+m[1]; item.time=m[2]; break;}
      case 13: item.name=read(); item.args=read(); break;
      case 14: {const m=read().match(/^(-?\d+) (.*)$/); item.end=+m[1]; item.condition=m[2]; break;}
      case 16: item.end=+read(); break;
      case 17: {const m=read().match(/^(\d+) (.*)$/); item.whileVariant=!!+m[1]; item.condition=m[2]; break;}
      case 18: {const m=read().match(/^(-?\d+) (-?\d+) (.*)$/); item.otherwise=+m[1]; item.end=+m[2]; item.condition=m[3]; break;}
      case 22: {item.expression=read(); const [end,n,...options]=read().split(' ').map(Number); item.end=end; item.options=options.slice(0,n); break;}
      case 23: {const [next,n]=read().split(' ').map(Number); item.next=next; item.expressions=list(n); break;}
      case 26: item.end=+read(); item.counter=read(); item.initial=read(); item.step=read(); item.limit=read(); break;
      case 27: item.end=+read(); item.variable=read(); item.array=read(); break;
      default: break;
    }
    result.push(item);
  }
  return result;
}

export function makeDiagrams(instructions) {
  const diagrams=[];
  for(const proc of instructions.filter(i=>i.type===3)) {
    const nodes=[], edges=[];
    const node=(id,label,kind,line)=>{id=String(id); nodes.push({id,type:'statement',data:{label,kind,line},position:{x:0,y:0}}); return id;};
    const connect=(tails,id)=>tails.forEach(t=>edges.push({id:`e${edges.length}`,source:t.id,target:id,label:t.label||'',data:{back:!!t.back}}));
    const tail=(id,label='',back=false)=>({id:String(id),label,back});
    function sequence(begin,end,incoming) {
      let tails=incoming;
      for(let j=begin;j<end;j++) {
        const i=instructions[j]; if(!i)break;
        if([0,2,19,20,21,15,25,28].includes(i.type))continue;
        if(i.type===18) {
          const id=node(j,i.condition,'decision',i.line); connect(tails,id);
          const split=i.otherwise>=0?i.otherwise:i.end;
          const yes=sequence(j+1,split,[tail(id,'Sí')]);
          const no=i.otherwise>=0?sequence(i.otherwise+1,i.end,[tail(id,'No')]):[tail(id,'No')];
          tails=[...yes,...no]; j=i.end;
        } else if([14,26,27].includes(i.type)) {
          let initial=tails;
          if(i.type===26) {const init=node(`${j}-init`,`${i.counter} ← ${i.initial}`,'assignment',i.line); connect(tails,init); initial=[tail(init)];}
          const label=i.type===14?i.condition:i.type===26?`${i.counter} hasta ${i.limit} · paso ${i.step}`:`Cada ${i.variable} en ${i.array}`;
          const id=node(j,label,'decision',i.line); connect(initial,id);
          let body=sequence(j+1,i.end,[tail(id,'Sí')]);
          if(i.type===26) {const step=node(`${j}-step`,`${i.counter} ← ${i.counter} + (${i.step})`,'assignment',i.line); connect(body,step); body=[tail(step)];}
          connect(body.map(t=>({...t,back:true})),id); tails=[tail(id,'No')]; j=i.end;
        } else if(i.type===16) {
          const entry=node(j,'Repetir','junction',i.line); connect(tails,entry);
          const body=sequence(j+1,i.end,[tail(entry)]); const ending=instructions[i.end];
          const condition=node(i.end,ending.condition,'decision',ending.line); connect(body,condition);
          connect([tail(condition,ending.whileVariant?'Sí':'No',true)],entry);
          tails=[tail(condition,ending.whileVariant?'No':'Sí')]; j=i.end;
        } else if(i.type===22) {
          const id=node(j,i.expression,'decision',i.line); connect(tails,id); const exits=[];
          // Native option indices include De Otro Modo when present.
          const opts=i.options.filter(k=>k>j && k<i.end);
          let hasDefault=false;
          for(let o=0;o<opts.length;o++) {
            const option=instructions[opts[o]]; hasDefault ||= option.type===24;
            const label=option.type===24?'Otro':option.expressions.join(', ');
            exits.push(...sequence(opts[o]+1,opts[o+1]??i.end,[tail(id,label)]));
          }
          if(!hasDefault)exits.push(tail(id,'Otro'));
          tails=exits; j=i.end;
        } else if([23,24,17].includes(i.type)) {
          throw Error('Estructura de control inesperada en el diagrama');
        } else {
          const kind=[3,4].includes(i.type)?'terminal':[5,7].includes(i.type)?'io':i.type===13?'call':'assignment';
          const label=i.type===3?`${proc.main?'Algoritmo':'Subproceso'} ${proc.name}${proc.args}`:i.type===4?'Fin':i.text.replace(/;$/, '');
          const id=node(j,label,kind,i.line); connect(tails,id); tails=[tail(id)];
        }
      }
      return tails;
    }
    sequence(proc.index,proc.end+1,[]);
    diagrams.push({name:proc.name,main:proc.main,nodes,edges});
  }
  return diagrams;
}
