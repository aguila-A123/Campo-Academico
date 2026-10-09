import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { execute, validateFiles } from './core.mjs';
import { nativeFoldersAvailable, selectFolder, connectFolder, saveFolder, operateFolder } from './local-folders.mjs';
import { planTreeOperation } from '../src/tree-operations.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
const host = process.env.HOST || '127.0.0.1', port = Number(process.env.PORT || 4318);
const token = process.env.ACCESS_TOKEN || '', runner = process.env.RUNNER || 'local';
if (!['local', 'docker'].includes(runner)) throw new Error('RUNNER debe ser local o docker.');
if (!['127.0.0.1', 'localhost', '::1'].includes(host) && (runner !== 'docker' || token.length < 24)) throw new Error('Para acceso remoto configura RUNNER=docker y ACCESS_TOKEN de al menos 24 caracteres.');
await mkdir(data, { recursive: true });
const app = express();
app.disable('x-powered-by');
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  // Reject browser cross-origin requests, including DNS-rebinding hosts in local mode.
  const reqHost = req.headers.host || '';
  if (runner === 'local' && !/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(reqHost)) return res.status(403).json({ error: 'Host no permitido.' });
  if (req.headers.origin) {
    let origin; try { origin = new URL(req.headers.origin); } catch { return res.sendStatus(403); }
    if (origin.host !== reqHost) return res.status(403).json({ error: 'Origen no permitido.' });
  }
  if (token) {
    const sent = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, '')), expected = Buffer.from(token);
    if (sent.length !== expected.length || !timingSafeEqual(sent, expected)) return res.status(401).json({ error: 'Introduce tu clave de acceso.' });
  }
  next();
});
app.use(express.json({ limit: '2mb' }));
const projectPath = id => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Proyecto inválido.');
  return path.join(data, `${id}.json`);
};
const load = async id => JSON.parse(await readFile(projectPath(id), 'utf8'));
async function persist(project) {
  const destination = projectPath(project.id), temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(project), { mode: 0o600 }); await rename(temporary, destination);
}
const starter = 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hola, mundo ✨");\n\n        // Tu próxima idea empieza aquí.\n        for (int i = 1; i <= 3; i++) {\n            System.out.println("Aprendiendo Java · paso " + i);\n        }\n    }\n}\n';
app.get('/api/health', async (_, res) => res.json({ runner, java: 'Java 17', authenticated: !!token, nativeFolders: runner === 'local' && nativeFoldersAvailable }));
app.post('/api/local-folders/select', async (req, res) => {
  if (runner !== 'local' || !nativeFoldersAvailable) return res.status(403).json({ error: 'La selección de Windows solo está disponible en la versión local.' });
  if (req.body.create) validateFiles(req.body.files);
  const selected = await selectFolder();
  const folder = await connectFolder(selected, { create: !!req.body.create, name: req.body.name, files: req.body.files });
  res.json(folder || { cancelled: true });
});
app.put('/api/local-folders/:id', async (req, res) => {
  if (runner !== 'local') return res.status(403).json({ error: 'El acceso a carpetas Windows solo está disponible localmente.' });
  res.json(await saveFolder(req.params.id, req.body.files, req.body.revision));
});
app.post('/api/local-folders/:id/operate', async (req, res) => {
  if (runner !== 'local') return res.status(403).json({ error: 'El acceso a carpetas Windows solo está disponible localmente.' });
  res.json(await operateFolder(req.params.id, req.body.operation, req.body.revision));
});
app.get('/api/projects', async (_, res) => {
  const list = await Promise.all((await readdir(data)).filter(n => /^[a-f0-9-]{36}\.json$/.test(n)).map(async n => { const p = JSON.parse(await readFile(path.join(data, n), 'utf8')); return { id: p.id, name: p.name, updatedAt: p.updatedAt, count: Object.keys(p.files).length }; }));
  res.json(list.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)));
});
app.post('/api/projects', async (req, res) => {
  const name = req.body.name?.trim();
  if (!name || name.length > 60) return res.status(400).json({ error: 'Escribe un nombre de hasta 60 caracteres.' });
  const files = req.body.files || { 'Main.java': starter }; validateFiles(files);
  const project = { id: randomUUID(), name, files, revision: 1, updatedAt: new Date().toISOString() }; await persist(project); res.status(201).json(project);
});
app.get('/api/projects/:id', async (req, res) => res.json(await load(req.params.id)));
const locks = new Map();
app.post('/api/projects/:id/operate', async (req, res) => {
  const id = req.params.id, previous = locks.get(id) || Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    const p = await load(id);
    if (req.body.revision !== p.revision) return res.status(409).json({ error: 'Este proyecto cambió en otra pestaña. Vuelve a abrirlo.' });
    const plan = planTreeOperation(p.files, req.body.operation, p.folders || []);
    if (req.body.operation.target?.kind === 'root' && req.body.operation.action === 'delete') { await unlink(projectPath(id)); return res.json({ deleted: true }); }
    validateFiles(plan.files, true); p.files = plan.files; p.folders = plan.folders; p.revision++; p.updatedAt = new Date().toISOString();
    if (plan.newName) p.name = plan.newName;
    await persist(p); res.json(p);
  });
  locks.set(id, next); try { await next; } finally { if (locks.get(id) === next) locks.delete(id); }
});
app.put('/api/projects/:id', async (req, res) => {
  const id = req.params.id;
  const previous = locks.get(id) || Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    const p = await load(id);
    if (req.body.revision !== p.revision) return res.status(409).json({ error: 'Este proyecto cambió en otra pestaña. Exporta tus cambios y vuelve a abrirlo.' });
    validateFiles(req.body.files, true); p.files = req.body.files; p.revision++; p.updatedAt = new Date().toISOString(); await persist(p); res.json(p);
  });
  locks.set(id, next); try { await next; } finally { if (locks.get(id) === next) locks.delete(id); }
});
let active = 0;
app.post('/api/execute', async (req, res) => {
  if (active >= 2) return res.status(429).json({ error: 'Hay dos tareas en curso. Prueba de nuevo en unos segundos.' });
  active++;
  try { res.json(await execute(req.body.files, req.body.entry, req.body.input || '', !!req.body.checkOnly, runner)); } finally { active--; }
});
app.use(express.static(path.join(root, 'dist')));
app.get('/{*splat}', (req, res) => { if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Ruta no encontrada.' }); res.sendFile(path.join(root, 'dist/index.html')); });
app.use((error, req, res, next) => { console.error(error.message); res.status(error.code === 'ENOENT' ? 404 : 400).json({ error: error.code === 'ENOENT' ? 'Proyecto no encontrado.' : error.message, ...(error.recovery ? { recovery: error.recovery } : {}) }); });
app.listen(port, host, error => {
  if (error) { console.error(`No se pudo abrir el puerto ${port}: ${error.message}`); process.exitCode = 1; return; }
  console.log(`Java Noir listo: http://${host}:${port} · ejecución ${runner}`);
});
