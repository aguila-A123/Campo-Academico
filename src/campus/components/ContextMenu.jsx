import {createPortal} from 'react-dom';
import {useEffect,useLayoutEffect,useRef} from 'react';
import './ContextMenu.css';

export default function ContextMenu({menu,onClose,actions}) {
 const ref=useRef(null);
 useLayoutEffect(()=>{
  if(!menu)return;
  const element=ref.current;
  element.style.left=`${Math.max(8,Math.min(menu.x,window.innerWidth-element.offsetWidth-8))}px`;
  element.style.top=`${Math.max(8,Math.min(menu.y,window.innerHeight-element.offsetHeight-8))}px`;
  element.querySelector('button')?.focus();
 },[menu]);
 useEffect(()=>{
  if(!menu)return;
  const dismiss=event=>{if(!ref.current?.contains(event.target))onClose();};
  const close=()=>onClose();
  document.addEventListener('pointerdown',dismiss);
  window.addEventListener('resize',close);
  window.addEventListener('scroll',close,true);
  return()=>{document.removeEventListener('pointerdown',dismiss);window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true);};
 },[menu,onClose]);
 if(!menu)return null;
 return createPortal(<div ref={ref} className="campus-context-menu" role="menu" aria-label="Acciones" onContextMenu={e=>e.preventDefault()} onKeyDown={e=>{
  if(e.key==='Escape'){e.preventDefault();onClose();menu.target?.focus();}
  if(e.key==='Tab')onClose();
  if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){
   e.preventDefault();const buttons=[...ref.current.querySelectorAll('button')];const index=buttons.indexOf(document.activeElement);
   buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
  }
 }}>{actions.map(action=><button key={action.label} type="button" role="menuitem" className={action.danger?'danger':''} onClick={()=>{onClose();action.run(menu.item);}}>{action.label}</button>)}</div>,document.body);
}

export function contextPosition(event,item){
 event.preventDefault();event.stopPropagation();
 const box=event.currentTarget.getBoundingClientRect();
 return {item,target:event.currentTarget,x:event.clientX||box.left+20,y:event.clientY||box.top+20};
}
