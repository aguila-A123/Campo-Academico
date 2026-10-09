import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { connectFolder, saveFolder, readJavaFolder } from './local-folders.mjs';
import { javaFile, sourceRoot, packageOf, validPackage } from '../src/java-project.js';
import { writeDirectory, readDirectory } from '../src/disk.js';
import { execute } from './core.mjs';

test('new projects use physical package folders and compile their main class', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'noir-folder-test-'));
  try {
    const initial = javaFile('Main', 'com.fabrizio', 'src');
    const p = await connectFolder(parent, { create: true, name: 'Mis ejercicios', files: { [initial.filename]: initial.source } });
    assert.equal(p.location, path.join(parent, 'Mis ejercicios'));
    assert.equal(await readFile(path.join(p.location, 'src/com/fabrizio/Main.java'), 'utf8'), initial.source);
    const helper = javaFile('Ejercicio', 'com.fabrizio', sourceRoot(initial.filename, initial.source));
    const files = { ...p.files, [initial.filename]: initial.source.replace('Hola, mundo', 'Guardado real'), [helper.filename]: helper.source };
    const saved = await saveFolder(p.id, files, p.revision);
    assert.equal(saved.revision, 2);
    assert.match(await readFile(path.join(p.location, initial.filename), 'utf8'), /Guardado real/);
    assert.equal(await readFile(path.join(p.location, helper.filename), 'utf8'), helper.source);
    const r = await execute(await readJavaFolder(p.location), initial.filename);
    assert.equal(r.exitCode, 0); assert.match(r.stdout, /Guardado real/);
    await saveFolder(p.id, { [initial.filename]: files[initial.filename] }, saved.revision);
    await assert.rejects(readFile(path.join(p.location, helper.filename)), { code: 'ENOENT' });
  } finally { await rm(parent, { recursive: true, force: true }); }
});
test('opening an existing folder preserves package, unrelated files and external edits', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'noir-folder-test-'));
  try {
    await mkdir(path.join(parent, 'src/main/java/com/prueba'), { recursive: true });
    const f = javaFile('Main', 'com.prueba', 'src/main/java');
    await writeFile(path.join(parent, f.filename), f.source); await writeFile(path.join(parent, 'nota.txt'), 'No cambiar');
    const p = await connectFolder(parent);
    assert.equal(sourceRoot(f.filename, p.files[f.filename]), 'src/main/java');
    assert.equal(packageOf(p.files[f.filename]), 'com.prueba');
    await writeFile(path.join(parent, f.filename), f.source + '// cambio externo');
    await assert.rejects(saveFolder(p.id, p.files, p.revision), /fuera del editor/);
    assert.match(await readFile(path.join(parent, f.filename), 'utf8'), /cambio externo/);
    assert.equal(await readFile(path.join(parent, 'nota.txt'), 'utf8'), 'No cambiar');
    await assert.rejects(connectFolder(parent, { create: true, name: '..', files: p.files }), /nombre de carpeta/);
    await assert.rejects(saveFolder(p.id, { '../Main.java': 'bad' }, 1), /nombres Java/);
  } finally { await rm(parent, { recursive: true, force: true }); }
});
test('root folder name is not mistakenly inserted into a Java package', () => {
  const f = javaFile('Main', 'ejercicios', 'src');
  assert.equal(f.filename, 'src/ejercicios/Main.java');
  assert.equal(sourceRoot(f.filename, f.source), 'src');
  assert.equal(sourceRoot('src/Main.java', 'public class Main {}'), 'src');
  assert.equal(validPackage('com.class'), false);
  assert.throws(() => javaFile('while', 'ejercicios'), /clase válido/);
  assert.throws(() => javaFile('Main', 'src/ejercicios'), /package/);
});

// File System Access adapter backed by temporary real files, without opening a UI picker.
function directoryHandle(root) {
  return {
    name: path.basename(root), queryPermission: async () => 'granted',
    async *entries() {
      for (const item of await readdir(root, { withFileTypes: true })) {
        const target = path.join(root, item.name);
        const handle = item.isDirectory() ? { ...directoryHandle(target), kind: 'directory' } : { kind: 'file', getFile: async () => { const source = await readFile(target, 'utf8'); return { size: Buffer.byteLength(source), text: async () => source }; } };
        yield [item.name, handle];
      }
    },
    async getDirectoryHandle(name, { create } = {}) { if (create) await mkdir(path.join(root, name), { recursive: true }); return directoryHandle(path.join(root, name)); },
    async getFileHandle(name) { return { async createWritable() { let source; return { write: async value => { source = value; }, close: async () => writeFile(path.join(root, name), source), abort: async () => {} }; } }; },
    async removeEntry(name) { await rm(path.join(root, name)); }
  };
}
test('browser folder saving writes real files and detects an external change', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'noir-browser-folder-'));
  try {
    const connection = { handle: directoryHandle(root), baseline: {} };
    const f = javaFile('Main', 'ejercicios');
    await writeDirectory(connection, { [f.filename]: f.source });
    assert.equal(await readFile(path.join(root, f.filename), 'utf8'), f.source);
    await writeDirectory(connection, { [f.filename]: f.source.replace('Hola, mundo', 'Segundo guardado') });
    assert.match((await readDirectory(connection.handle))[f.filename], /Segundo guardado/);
    await writeFile(path.join(root, f.filename), 'edición externa');
    await assert.rejects(writeDirectory(connection, { [f.filename]: f.source }), /fuera del editor/);
    assert.equal(await readFile(path.join(root, f.filename), 'utf8'), 'edición externa');
  } finally { await rm(root, { recursive: true, force: true }); }
});
