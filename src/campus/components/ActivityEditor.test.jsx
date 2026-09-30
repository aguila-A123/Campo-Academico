// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import ActivityEditor from './ActivityEditor.jsx';
afterEach(cleanup);
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
it('previews selected SVG and saves only title and type',async()=>{
 const save=vi.fn().mockResolvedValue(),close=vi.fn(),item={id:3,titulo:'Tema 1',tipo:'Tarea'};
 render(<ActivityEditor item={item} onClose={close} onSave={save}/>);
 fireEvent.click(screen.getByRole('radio',{name:/Archivo/}));
 expect(screen.getByRole('img',{name:'Archivo'}).closest('label').className).toBe('selected');
 fireEvent.click(screen.getByRole('button',{name:'Guardar cambios'}));
 await waitFor(()=>expect(close).toHaveBeenCalled());expect(save).toHaveBeenCalledWith(item,{titulo:'Tema 1',tipo:'Archivo'});
});
it('keeps the editor open and shows error when saving fails',async()=>{
 const close=vi.fn();render(<ActivityEditor item={{id:3,titulo:'Tema 1',tipo:'Foro'}} onClose={close} onSave={vi.fn().mockRejectedValue(Error())}/>);
 fireEvent.click(screen.getByRole('button',{name:'Guardar cambios'}));await screen.findByRole('alert');expect(close).not.toHaveBeenCalled();expect(screen.getByLabelText('Título').value).toBe('Tema 1');
});
