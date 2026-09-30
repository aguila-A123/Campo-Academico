import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Login from './Login.jsx';
import { signIn, supabase } from './lib/supabase.js';

const Campus = lazy(() => import('./campus/App.jsx'));

export default function App() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState('loading');
  const [logoutError, setLogoutError] = useState('');
  const signingIn = useRef(false);
  const sessionRef = useRef(null);
  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      sessionRef.current = next;
      if (!active) return;
      setSession(next);
      if (event === 'SIGNED_OUT') setView('login');
      // A newly authenticated login stays visible until its particle sequence ends.
    });
    (async () => {
      try {
        const { data: { session: saved } } = await supabase.auth.getSession();
        if (!saved) { if (active) setView('login'); return; }
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!active || signingIn.current) return;
        if (error || !user) { setView('login'); return; }
        sessionRef.current = saved; setSession(saved); setView('campus');
      } catch { if (active) setView('login'); }
    })();
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  useEffect(()=>{document.title=view==='campus'&&session?'Campus Académico':'Campus · Iniciar sesión';},[view,session]);
  async function login(credentials) {
    signingIn.current = true;
    try {
      const next = await signIn(credentials);
      sessionRef.current = next; setSession(next);
    } finally { signingIn.current = false; }
  }
  async function logout() {
    setLogoutError('');
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) { setLogoutError('No se pudo cerrar la sesión. Inténtalo de nuevo.'); return; }
    sessionRef.current = null; setSession(null); setView('login');
  }
  if (view === 'loading') return <div className="session-loading" role="status">Preparando tu campus…</div>;
  if (view !== 'campus' || !session) return <Login onLogin={login} onEntered={() => { if (sessionRef.current) setView('campus'); }} />;
  return <Suspense fallback={<div className="session-loading" role="status">Abriendo el campus…</div>}><Campus onLogout={logout} userId={session.user.id} logoutError={logoutError} /></Suspense>;
}
