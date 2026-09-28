import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://ojhoiwaimwqucbjjyerq.supabase.co';
export const PUBLIC_KEY = 'sb_publishable_5zqnLi8sTSeGoD07fj0hlQ_C_XlzzBi';
export const supabase = createClient(SUPABASE_URL, PUBLIC_KEY);

export async function signIn({ username, password }) {
  const identifier = username.trim();
  if (identifier.includes('@')) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: identifier, password });
    if (error) {
      if (error.status >= 500 || error.name === 'AuthRetryableFetchError') throw new Error('No se pudo conectar. Inténtalo de nuevo.');
      if (error.status === 429) throw new Error('Demasiados intentos. Espera un momento e inténtalo de nuevo.');
      throw new Error('Usuario o contraseña incorrectos.');
    }
    return data.session;
  }
  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/login-usuario`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: PUBLIC_KEY },
      body: JSON.stringify({ identifier, password }), signal: AbortSignal.timeout(20000),
    });
  } catch { throw new Error('No se pudo conectar el acceso por usuario. Prueba con tu correo.'); }
  if (response.status === 404) throw new Error('El acceso por usuario aún no está activado. Entra con tu correo.');
  if (response.status === 429) throw new Error('Demasiados intentos. Espera un momento e inténtalo de nuevo.');
  if (response.status >= 500) throw new Error('El acceso por usuario no está disponible. Prueba con tu correo.');
  if (!response.ok) throw new Error('Usuario o contraseña incorrectos.');
  const tokens = await response.json();
  const { data, error } = await supabase.auth.setSession(tokens);
  if (error || !data.session) throw new Error('No se pudo establecer la sesión. Inténtalo de nuevo.');
  return data.session;
}
