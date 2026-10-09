const methods = {
  String: [['length','length()'],['charAt','charAt(${1:indice})'],['substring','substring(${1:inicio}, ${2:fin})'],['equals','equals(${1:otroTexto})'],['toUpperCase','toUpperCase()'],['toLowerCase','toLowerCase()'],['trim','trim()'],['contains','contains(${1:texto})'],['split','split(${1:" "})']],
  Scanner: [['nextInt','nextInt()'],['nextLine','nextLine()'],['nextDouble','nextDouble()'],['next','next()'],['hasNext','hasNext()'],['hasNextInt','hasNextInt()'],['close','close()']],
  ArrayList: [['add','add(${1:elemento})'],['get','get(${1:indice})'],['size','size()'],['remove','remove(${1:indice})'],['isEmpty','isEmpty()'],['clear','clear()']],
  Math: [['sqrt','sqrt(${1:numero})'],['pow','pow(${1:base}, ${2:exponente})'],['abs','abs(${1:numero})'],['max','max(${1:a}, ${2:b})'],['min','min(${1:a}, ${2:b})'],['random','random()']],
  Integer: [['parseInt','parseInt(${1:texto})'],['toString','toString(${1:numero})']],
  Double: [['parseDouble','parseDouble(${1:texto})']],
  System: [['out','out'],['err','err'],['in','in'],['currentTimeMillis','currentTimeMillis()']],
  PrintStream: [['println','println(${1:valor});'],['print','print(${1:valor});'],['printf','printf(${1:"%s%n"}, ${2:valor});']]
};
export function contextualCompletions(source, line) {
  const clean = source.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ');
  const declarations = [...clean.matchAll(/\b(String|Scanner|ArrayList|List|int|double|boolean|float|long|char)(?:\s*<[^;=]+?>)?\s+(\w+)\b/g)];
  const chain = line.match(/([\w]+(?:\.[\w]+)*)\.([\w]*)$/);
  if (chain) {
    const receiver = chain[1], prefix = chain[2];
    let type = /System\.(out|err)$/.test(receiver) ? 'PrintStream' : receiver;
    const declaration = declarations.findLast(d => d[2] === receiver);
    if (declaration) type = declaration[1] === 'List' ? 'ArrayList' : declaration[1];
    return { member: true, suggestions:(methods[type] || []).filter(([label]) => label.startsWith(prefix)).map(([label,insertText]) => ({label,insertText,detail:type + ' · método o miembro Java'})) };
  }
  const symbols = declarations.map(d=>({label:d[2],insertText:d[2],detail:d[1]+' · variable de este archivo'}));
  for (const match of clean.matchAll(/\bclass\s+(\w+)/g)) symbols.push({label:match[1],insertText:match[1],detail:'Clase de este archivo'});
  return {member:false,suggestions:[...new Map(symbols.map(s=>[s.label,s])).values()]};
}
