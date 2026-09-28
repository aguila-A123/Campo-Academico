// Paste into Supabase > Edge Functions > Deploy a new function > Via Editor.
// Function name: login-usuario. Disable gateway JWT verification for this login endpoint.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';

const origins = new Set([
  'https://campus-acceso-fabrizio.lacaprichosa38.chatgpt.site',
  'http://localhost:5173', 'http://127.0.0.1:5173', 'http://127.0.0.1:4173',
]);
Deno.serve(async (request) => {
  const origin = request.headers.get('origin') ?? '';
  const headers = {
    'Access-Control-Allow-Origin': origins.has(origin) ? origin : 'https://campus-acceso-fabrizio.lacaprichosa38.chatgpt.site',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin', 'Cache-Control': 'no-store', 'Content-Type': 'application/json',
  };
  const reply = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (origin && !origins.has(origin)) return reply(403, { error: 'Origen no permitido.' });
  if (request.method !== 'POST') return reply(405, { error: 'Método no permitido.' });
  try {
    const body = await request.text();
    if (body.length > 4096) return reply(400, { error: 'Solicitud no válida.' });
    const { identifier, password } = JSON.parse(body);
    if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier.trim() || !password || identifier.length > 320 || password.length > 1024) return reply(400, { error: 'Solicitud no válida.' });
    const url = Deno.env.get('SUPABASE_URL')!;
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, options);
    const auth = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, options);
    let email = identifier.trim();
    if (!email.includes('@')) {
      // Escape LIKE wildcards: the identifier must match exactly, ignoring letter case.
      const escaped = email.replace(/[\\%_]/g, '\\$&');
      const { data: row, error } = await admin.from('credenciales').select('id').ilike('usuario', escaped).limit(1).maybeSingle();
      if (error) return reply(503, { error: 'Acceso temporalmente no disponible.' });
      email = 'unknown-login@invalid.invalid';
      if (row) {
        const { data, error: lookupError } = await admin.auth.admin.getUserById(row.id);
        if (lookupError) return reply(503, { error: 'Acceso temporalmente no disponible.' });
        email = data.user?.email ?? email;
      }
    }
    // Supabase Auth verifies the password and applies its authentication rate limits.
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error || !data.session) return reply(error?.status === 429 ? 429 : 401, { error: 'Usuario o contraseña incorrectos.' });
    return reply(200, { access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  } catch { return reply(400, { error: 'No se pudo procesar el acceso.' }); }
});
