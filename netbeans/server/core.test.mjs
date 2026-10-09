import test from 'node:test';
import assert from 'node:assert/strict';
import { execute, validateFiles } from './core.mjs';

test('blocks paths outside the project and oversized source', () => {
  for (const name of ['../Main.java', '/Main.java', 'x/../../Main.java', 'Main.java;whoami']) assert.throws(() => validateFiles({ [name]: '' }));
  assert.throws(() => validateFiles({ 'Main.java': 'x'.repeat(1024*1024+1) }));
});
test('compiles multiple classes and runs real Java', async () => {
  const r = await execute({ 'Main.java': 'public class Main { public static void main(String[] args) { System.out.println(Helper.message()); } }', 'Helper.java': 'public class Helper { static String message() { return "Hola Java"; } }' }, 'Main.java');
  assert.equal(r.compiled, true); assert.equal(r.exitCode, 0); assert.match(r.stdout, /Hola Java/);
});
test('reports compiler error with its actual source line', async () => {
  const r = await execute({ 'Main.java': 'public class Main {\n public static void main(String[] args) {\n System.out.println(noExiste);\n }\n}' }, 'Main.java', '', true);
  assert.equal(r.compiled, false); assert.equal(r.diagnostics[0].file, 'Main.java'); assert.equal(r.diagnostics[0].line, 3); assert.match(r.compilerOutput, /cannot find symbol/);
});
test('Scanner reads supplied input, including packaged classes', async () => {
  const r = await execute({ 'ejercicios/Main.java': 'package ejercicios; import java.util.Scanner; public class Main { public static void main(String[] args) { Scanner s = new Scanner(System.in); System.out.println("Hola " + s.nextLine()); } }' }, 'ejercicios/Main.java', 'Fabrizio\n');
  assert.equal(r.exitCode, 0); assert.match(r.stdout, /Hola Fabrizio/);
});
test('runtime exceptions are shown as actual Java errors', async () => {
  const r = await execute({ 'Main.java': 'public class Main { public static void main(String[] args) { throw new IllegalStateException("Prueba"); } }' }, 'Main.java');
  assert.equal(r.compiled, true); assert.equal(r.exitCode, 1); assert.match(r.stderr, /IllegalStateException: Prueba/);
});
test('infinite loops are stopped', async () => {
  const r = await execute({ 'Main.java': 'public class Main { public static void main(String[] args) { while(true) {} } }' }, 'Main.java');
  assert.equal(r.timedOut, true);
});
