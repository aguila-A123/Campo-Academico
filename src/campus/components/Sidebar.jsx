import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';

const primary = [['home','Home'],['moodle','Moodle'],['teams','Teams'],['yedra','Yedra']];
const academic = [['examenes','Exámenes'],['horarios','Horarios']];

export default function Sidebar({page, onNavigate, onLogout, logoutError}) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const toggleWithSpace = event => {
      if (event.code !== 'Space' && event.key !== ' ') return;
      if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (target instanceof Element && (target.isContentEditable || target.closest('input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="textbox"], [role="checkbox"], [role="switch"], [role="slider"], [role="combobox"], [role="menuitem"]'))) return;
      event.preventDefault();
      setCollapsed(value => !value);
    };
    window.addEventListener('keydown', toggleWithSpace);
    return () => window.removeEventListener('keydown', toggleWithSpace);
  }, []);
  const label = collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral';
  const item = ([id,name]) => <button key={id} className="item" type="button" title={name} aria-label={name} aria-current={page===id?'page':undefined} onClick={()=>onNavigate(id)}><Icon name={id}/><span>{name}</span></button>;
  return <aside className={`sidebar${collapsed?' collapsed':''}`} id="sidebar" aria-label="Barra lateral">
    <button className="brand" type="button" aria-label={label} title={`${label} (Espacio)`} aria-keyshortcuts="Space" aria-controls="sidebar" aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>!v)}><img src="/logo.png" alt="Logo del campus" width="110" height="110"/></button>
    <nav aria-label="Navegación principal">{primary.map(item)}<a className="item" href="https://outlook.office.com/" target="_blank" rel="noopener noreferrer" aria-label="Outlook (abre en otra pestaña)" title="Outlook"><Icon name="outlook"/><span>Outlook</span><Icon name="external"/></a></nav>
    <hr/>
    <nav aria-label="Organización académica">{academic.map(item)}</nav>
  <hr/><button className="item" type="button" onClick={onLogout} title="Cerrar sesión" aria-label="Cerrar sesión"><Icon name="logout"/><span>Cerrar sesión</span></button>{logoutError && <p role="alert">{logoutError}</p>}</aside>;
}
