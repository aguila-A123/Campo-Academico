import { useEffect, useId, useRef, useState } from 'react';
import styles from './Login.module.css';

function Sparkle({ phase }) {
  const [style, setStyle] = useState(() => ({ '--x': Math.random()*100+'%', '--y': Math.random()*100+'%', '--size': (1.5+Math.random()*2.5)+'px', '--duration': (4+Math.random()*7)+'s', '--delay': (-Math.random()*14)+'s', '--opacity': .2+Math.random()*.5, '--burst-x': (Math.random()-.5)*160+'vw', '--burst-y': (Math.random()-.5)*160+'vh' }));
  return <i className={styles.spark} style={style} onAnimationIteration={() => { if (phase === 'idle' || phase === 'pending') setStyle(s => ({...s, '--x': Math.random()*100+'%', '--y': Math.random()*100+'%'})); }} />;
}

export default function Login({ logoSrc = import.meta.env.BASE_URL + 'logo.png', onLogin, onEntered }) {
  const usernameId = useId(), passwordId = useId(), titleId = useId();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState('idle');
  const pending = phase === 'pending' || phase === 'success';
  const busy = useRef(false), mounted = useRef(false), entered = useRef(onEntered);
  entered.current = onEntered;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (phase === 'error') { const timer = setTimeout(() => {setMessage('');setPhase('idle');}, 4200); return () => clearTimeout(timer); }
    if (phase === 'success') { const timer = setTimeout(() => entered.current?.(), 3200); return () => clearTimeout(timer); }
  }, [phase]);
  async function handleSubmit(event) {
    event.preventDefault();
    if (busy.current) return;
    const data = new FormData(event.currentTarget);
    busy.current = true; setPhase('pending'); setMessage('');
    try {
      await onLogin({ username: data.get('username'), password: data.get('password') });
      if (!mounted.current) return;
      setMessage('Credenciales correctas. Entrando al campus…'); setPhase('success');
    } catch (error) {
      if (!mounted.current) return;
      busy.current = false; setMessage(error.message || 'No se pudo iniciar sesión. Inténtalo de nuevo.'); setPhase('error');
    }
  }
  return <div className={styles.screen} data-phase={phase}>
<div className={styles.sparkles} aria-hidden="true">{Array.from({length:48}, (_,i) => <Sparkle key={i} phase={phase} />)}<div className={styles.energyRing}/></div>
<main className={styles.login}>
<header className={styles.brand}><img src={logoSrc} alt="Logo del campus" width="146" height="146" /><p>CAMPUS VIRTUAL</p></header>
<section className={styles.panel} aria-labelledby={titleId}><h1 id={titleId}>Iniciar sesión</h1><p className={styles.intro}>Bienvenido de nuevo a tu campus.</p>
<form onSubmit={handleSubmit}>
<label htmlFor={usernameId}>Usuario o correo</label><div className={styles.field}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20v-2a7 7 0 0 1 14 0v2"/></svg><input id={usernameId} name="username" autoComplete="username" placeholder="Tu usuario o correo" required disabled={pending} spellCheck={false} autoCapitalize="none" /></div>
<label htmlFor={passwordId}>Contraseña</label><div className={styles.field}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/></svg><input id={passwordId} name="password" type={visible ? "text" : "password"} autoComplete="current-password" placeholder="Tu contraseña" required disabled={pending} /><button className={styles.reveal} type="button" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible} onClick={() => setVisible(v => !v)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg></button></div>
{/* Button animation adapted from Uiverse.io by catraco */}<button disabled={pending} type="submit" className={styles.submit}><span className={styles.sweep} aria-hidden="true"></span>{pending ? "Entrando…" : "Entrar al campus"} <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></button><p className={`${styles.message} ${phase === 'error' ? styles.errorMessage : ''}`} role="status" aria-live="polite">{message}</p>
</form></section>
</main>
</div>;
}
