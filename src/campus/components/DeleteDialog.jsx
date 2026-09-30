import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './DeleteDialog.css';
export default function DeleteDialog({item,onCancel,onConfirm,shared=false}){
 const ref=useRef(null),busy=useRef(false),id=useId();const [saving,setSaving]=useState(false);
 useEffect(()=>{if(item){ref.current.showModal();}else ref.current.close();},[item]);
 async function submit(event){event.preventDefault();if(busy.current)return;busy.current=true;setSaving(true);try{await onConfirm(item);onCancel();}finally{busy.current=false;setSaving(false);}}
 return createPortal(<dialog ref={ref} className="campus-delete-dialog" aria-labelledby={id} onCancel={event=>{event.preventDefault();if(!busy.current)onCancel();}}><form onSubmit={submit}><span className="delete-eyebrow">CONFIRMAR ELIMINACIÓN</span><h2 id={id}>¿Deseas eliminarlo?</h2><p className="delete-name">{item?.nombre||item?.titulo}</p><p>{item?.kind==='course'?'Se eliminará este curso y todas sus actividades para todos.':shared?'Se eliminará este elemento para todos.':'Se eliminará este examen.'} Esta acción no se puede deshacer.</p><footer><button type="button" autoFocus disabled={saving} onClick={onCancel}>Cancelar</button><button type="submit" className="delete-confirm" disabled={saving}>{saving?'Eliminando…':'Sí, eliminar'}</button></footer></form></dialog>,document.body);
}
