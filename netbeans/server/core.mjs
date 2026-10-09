import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export function validateFiles(files, allowEmpty = false) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('Archivos inválidos.');
  const entries = Object.entries(files);
  if ((!entries.length && !allowEmpty) || entries.length > 100) throw new Error('El proyecto debe tener entre 1 y 100 archivos.');
  let size = 0;
  for (const [name, source] of entries) {
    if (!/^(?:[A-Za-z_$][\w$]*\/)*(?:[A-Za-z_$][\w$]*|package-info|module-info)\.java$/.test(name) || name.length > 180) throw new Error('Usa nombres Java válidos, por ejemplo src/Main.java.');
    if (typeof source !== 'string') throw new Error('Contenido inválido.');
    size += Buffer.byteLength(source);
  }
  if (size > 1024 * 1024) throw new Error('El proyecto supera 1 MB de código.');
  return entries;
}

export function parseDiagnostics(output) {
  const lines = output.split(/\r?\n/), diagnostics = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(.+\.java):(\d+): (error|warning): (.+)$/);
    if (match) {
      const caret = lines[i + 2]?.indexOf('^');
      diagnostics.push({ file: match[1].replaceAll('\\', '/').replace(/^.*?\/sources\//, '').replace(/^\/workspace\//, ''), line: Number(match[2]), column: caret >= 0 ? caret + 1 : 1, severity: match[3], message: match[4] + (lines[i + 3]?.trim().startsWith('symbol:') ? '\n' + lines[i + 3].trim() : '') });
    }
  }
  return diagnostics;
}

export function command(program, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { cwd: options.cwd, windowsHide: true, shell: false });
    let stdout = '', stderr = '', killed = false, settled = false;
    const stop = () => {
      killed = true;
      child.kill('SIGKILL');
    };
    const timer = setTimeout(stop, options.timeout || 15000);
    child.on('error', e => { clearTimeout(timer); if (!settled) { settled = true; reject(new Error(`${program} no está disponible. ${e.message}`)); } });
    const collect = key => data => {
      if (stdout.length + stderr.length > 128000) { if (!killed) stop(); return; }
      if (key === 'out') stdout += data.toString(); else stderr += data.toString();
    };
    child.stdout.on('data', collect('out')); child.stderr.on('data', collect('err'));
    child.on('close', code => { clearTimeout(timer); if (!settled) { settled = true; resolve({ code, stdout, stderr, timedOut: killed }); } });
    child.stdin.on('error', () => {}); child.stdin.end(options.input || '');
  });
}

export async function execute(files, entry, input = '', checkOnly = false, runner = process.env.RUNNER || 'local') {
  const entries = validateFiles(files);
  if (!files[entry]) throw new Error('Selecciona un archivo Java del proyecto.');
  if (typeof input !== 'string' || input.length > 64000) throw new Error('Entrada demasiado grande.');
  const folder = await mkdtemp(path.join(tmpdir(), 'java-noir-'));
  const sourceDir = path.join(folder, 'sources'), classes = path.join(folder, 'classes');
  const containerName = `java-noir-${randomUUID()}`;
  let dockerStarted = false;
  try {
    await mkdir(classes); await mkdir(sourceDir);
    for (const [name, content] of entries) {
      const target = path.join(sourceDir, name); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, content);
    }
    const pack = files[entry].match(/^\s*package\s+([\w.]+)\s*;/m)?.[1];
    const mainClass = (pack ? pack + '.' : '') + path.basename(entry, '.java');
    let compile, run;
    if (runner === 'docker') {
      const base = ['run', '--name', containerName, '--network=none', '--memory=384m', '--cpus=1', '--pids-limit=96', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--read-only', '--user=65534:65534', '--tmpfs', '/tmp:rw,exec,nosuid,size=96m', '-v', `${sourceDir}:/workspace:ro`, '-w', '/workspace', '-e', `NOIR_MAIN=${mainClass}`, '-e', `NOIR_CHECK=${checkOnly ? '1' : '0'}`, '-i', process.env.JAVA_IMAGE || 'eclipse-temurin:17-jdk'];
      // Shell source is fixed; only validated filenames and class names enter positional arguments.
      dockerStarted = true;
      const result = await command('docker', [...base, 'sh', '-c', 'mkdir -p /tmp/classes; javac -J-Xmx192m -J-Duser.language=en -J-Duser.country=US -encoding UTF-8 -d /tmp/classes "$@" 2>/tmp/diagnostics; result=$?; cat /tmp/diagnostics >&2; if [ "$result" -ne 0 ]; then exit "$result"; fi; if [ "$NOIR_CHECK" = "1" ]; then exit 0; fi; printf "\\n__NOIR_COMPILED__\\n"; exec java -Xmx128m -XX:ActiveProcessorCount=1 -cp /tmp/classes "$NOIR_MAIN"', 'noir', ...entries.map(([name]) => name)], { input, timeout: 20000, ...{} });
      compile = result;
    } else {
      compile = await command('javac', ['-J-Xmx192m', '-J-Duser.language=en', '-J-Duser.country=US', '-encoding', 'UTF-8', '-d', classes, ...entries.map(([name]) => path.join(sourceDir, name))], { cwd: sourceDir });
      if (compile.code === 0 && !checkOnly) run = await command('java', ['-Xmx128m', '-XX:ActiveProcessorCount=1', '-cp', classes, mainClass], { cwd: classes, input, timeout: 10000 });
    }
    if (runner === 'docker') {
      const marker = '\n__NOIR_COMPILED__\n', split = compile.stdout.indexOf(marker);
      if (split >= 0) { run = { ...compile, stdout: compile.stdout.slice(split + marker.length) }; compile = { code: 0, stderr: '', stdout: '', timedOut: false }; }
    }
    return { compiled: compile.code === 0, diagnostics: parseDiagnostics(compile.stderr), compilerOutput: compile.stderr.replaceAll(sourceDir + path.sep, '').replaceAll('/workspace/', ''), stdout: run?.stdout || '', stderr: run?.stderr || '', exitCode: run?.code ?? compile.code, timedOut: compile.timedOut || run?.timedOut || false };
  } finally {
    if (dockerStarted) await command('docker', ['rm', '-f', containerName], { timeout: 5000 }).catch(() => {});
    await rm(folder, { recursive: true, force: true });
  }
}
