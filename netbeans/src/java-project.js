const keywords = new Set('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null _'.split(' '));
export function validPackage(value) {
  return value === '' || value.split('.').every(part => /^[A-Za-z_$][\w$]*$/.test(part) && !keywords.has(part));
}
export function suggestPackage(name) {
  let value = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!value || !/^[a-z_]/.test(value) || keywords.has(value)) value = 'ejercicios';
  return value;
}
export function packageOf(source = '') {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return withoutComments.match(/^\s*package\s+([\w.$]+)\s*;/m)?.[1] || '';
}
export function sourceRoot(filename, source) {
  const pkg = packageOf(source).replaceAll('.', '/');
  const directory = filename.split('/').slice(0, -1).join('/');
  if (pkg && (directory === pkg || directory.endsWith('/' + pkg))) return directory.slice(0, -pkg.length).replace(/\/$/, '');
  if (!pkg) return directory;
  return filename.startsWith('src/main/java/') ? 'src/main/java' : filename.startsWith('src/') ? 'src' : '';
}
export function javaFile(name, pkg, root = 'src') {
  const className = name.replace(/\.java$/, '').trim();
  if (!/^[A-Za-z_$][\w$]*$/.test(className) || keywords.has(className)) throw new Error('Escribe un nombre de clase válido, por ejemplo Ejercicio.java.');
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(className)) throw new Error('Ese nombre está reservado en Windows. Elige otro nombre para la clase.');
  if (!validPackage(pkg)) throw new Error('El package debe tener nombres Java válidos, como ejercicios o com.fabrizio.');
  return {
    filename: [root, pkg.replaceAll('.', '/'), className + '.java'].filter(Boolean).join('/'),
    source: `${pkg ? `package ${pkg};\n\n` : ''}public class ${className} {\n    public static void main(String[] args) {\n        System.out.println("Hola, mundo");\n    }\n}\n`
  };
}
