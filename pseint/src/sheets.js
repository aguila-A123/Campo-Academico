export const initialCode='Algoritmo SinTitulo\n    \nFinAlgoritmo';
const isEmptyTemplate=code=>/^\s*Algoritmo SinTitulo\s+FinAlgoritmo\s*$/.test(code);
export function hasUnsavedChanges(sheet){
  if(isEmptyTemplate(sheet.savedCode)&&isEmptyTemplate(sheet.code))return false;
  return sheet.code!==sheet.savedCode;
}
