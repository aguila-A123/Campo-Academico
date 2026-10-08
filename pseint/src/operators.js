// Leave quoted text and comments untouched, including unfinished strings.
export function operatorChanges(text,toSymbols=true){
  const changes=[];let quote=null;
  const pairs=toSymbols?{'>=':'≥','<=':'≤','<>':'≠'}:{'≥':'>=','≤':'<=','≠':'<>'};
  for(let i=0;i<text.length;i++){
    if(quote){if(text[i]==='\\'){i++;continue;}if(text[i]===quote)quote=null;continue;}
    if(text[i]==='"'||text[i]==="'"){quote=text[i];continue;}
    if(text.slice(i,i+2)==='//'){const end=text.indexOf('\n',i);if(end<0)break;i=end;continue;}
    const token=text.slice(i,i+(toSymbols?2:1));
    if(pairs[token]){changes.push({from:i,to:i+token.length,insert:pairs[token]});i+=token.length-1;}
  }
  return changes;
}
export function engineOperators(text){
  for(const change of operatorChanges(text,false).reverse())text=text.slice(0,change.from)+change.insert+text.slice(change.to);
  return text;
}
