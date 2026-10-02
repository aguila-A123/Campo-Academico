import {useDragonAI} from '../lib/useDragonAI.js';
import {AISettings,AIChat} from './DragonAI.jsx';
import {useEffect,useRef,useState,useId,useCallback} from 'react';
import {createPortal} from 'react-dom';
import './DragonIndicator.css';
export default function DragonIndicator({userId}){
 const [active,setActive]=useState(false),[locked,setLocked]=useState(false);
 const [settings,setSettings]=useState(false);
 const ai=useDragonAI(userId,locked);
 const closeSettings=useCallback(()=>setSettings(false),[]);
 function openSettings(event){event?.preventDefault();event?.stopPropagation();setSettings(value=>!value);}
 const dialog=useRef(null),banner=useRef(null),gradient=useId();
 useEffect(()=>{
  function toggle(event){
   if(event.defaultPrevented||event.repeat||event.isComposing||!event.ctrlKey||!event.altKey||event.metaKey||event.shiftKey||event.getModifierState?.('AltGraph')||!(event.code==='KeyH'||event.key?.toLowerCase()==='h'))return;
   event.preventDefault();setSettings(false);setLocked(false);setActive(value=>!value);
  }
  window.addEventListener('keydown',toggle);return()=>window.removeEventListener('keydown',toggle);
 },[]);
 useEffect(()=>{
  if(!locked){if(dialog.current.open)dialog.current.close();return;}
  const overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';dialog.current.showModal();
  return()=>{document.body.style.overflow=overflow;};
 },[locked]);
 const emblem=<><img src={`${import.meta.env.BASE_URL}dragon-emblem.svg`} alt="Emblema de dragón azul y violeta" width="48" height="48" draggable="false"/><span className="dragon-indicator-light" aria-hidden="true"/></>;
 function unlock(){setSettings(false);setLocked(false);requestAnimationFrame(()=>banner.current?.focus());}
 return <><div className="dragon-announcement" role="status">{active?'Indicador del dragón activado':''}</div><button ref={banner} type="button" data-ai-settings-toggle className={`dragon-indicator${active?' is-active':''}`} aria-hidden={!active} tabIndex={active?0:-1} aria-label="Activar borde del dragón" aria-haspopup="dialog" onContextMenu={openSettings} onClick={()=>{setSettings(false);setLocked(true);}}>{emblem}</button>{settings&&!locked&&createPortal(<AISettings ai={ai} onClose={closeSettings}/>,document.body)}{createPortal(<dialog ref={dialog} className="dragon-screen" aria-label="Chat de IA del campus" onCancel={event=>{event.preventDefault();unlock();}} onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();unlock();}else if(event.ctrlKey&&event.altKey&&(event.code==='KeyH'||event.key.toLowerCase()==='h')){event.preventDefault();unlock();setActive(false);}}}>
 <svg className="dragon-screen-border" aria-hidden="true" width="100%" height="100%"><defs><linearGradient id={gradient} x1="0%" y1="0%" x2="100%" y2="100%"><stop stopColor="#32b4ef"/><stop offset=".55" stopColor="#7652e8"/><stop offset="1" stopColor="#a053df"/></linearGradient></defs><rect x="2" y="2" width="calc(100% - 4px)" height="calc(100% - 4px)" rx="9" pathLength="1" fill="none" stroke={`url(#${gradient})`} strokeWidth="3"/></svg>
 <button type="button" autoFocus data-ai-settings-toggle className="dragon-indicator is-active" aria-label="Desactivar borde del dragón" onContextMenu={openSettings} onClick={unlock}>{emblem}</button>
 {locked&&<AIChat ai={ai} onSettings={()=>setSettings(v=>!v)} onClose={unlock}/>}
 {settings&&locked&&<AISettings ai={ai} onClose={closeSettings}/>}
 </dialog>,document.body)}</>;
}
