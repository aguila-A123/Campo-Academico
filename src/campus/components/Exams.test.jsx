// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import Exams from './Exams.jsx';
const mock=vi.hoisted(()=>({from:vi.fn(),read:vi.fn()}));
vi.mock('../../lib/supabase.js',()=>({supabase:{from:mock.from}}));
vi.mock('../lib/moodle.js',()=>({readTable:mock.read}));
const exam={id:'exam-1',usuario_id:'user-1',curso_id:'bd',asignatura:'Bases de datos',titulo:'Prueba SQL',descripcion:'Consultas',fecha:'2026-10-02T15:00:00Z'};
let result,query;
beforeEach(()=>{
 result={data:[exam],error:null};
 query={};for(const key of ['select','eq','order','abortSignal','update','insert','delete'])query[key]=vi.fn(()=>query);
 query.then=(resolve,reject)=>Promise.resolve(result).then(resolve,reject);
 query.single=vi.fn(async()=>({data:{...exam,titulo:'Nuevo título'},error:null}));
 mock.from.mockReturnValue(query);mock.read.mockResolvedValue([{id:'bd',nombre:'Bases de datos'}]);
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 vi.spyOn(window,'confirm').mockReturnValue(true);
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.clearAllMocks();});
async function menu(){render(<Exams userId="user-1"/>);const card=(await screen.findByText('Prueba SQL')).closest('article');fireEvent.contextMenu(card,{clientX:50,clientY:80});}
it('edits existing exam with Madrid local time and scopes update to its owner',async()=>{
 await menu();fireEvent.click(screen.getByRole('menuitem',{name:'Editar'}));
 expect(screen.getByLabelText(/Fecha y hora/).value).toBe('2026-10-02T17:00');
 expect(screen.getByLabelText(/Título/).value).toBe('Prueba SQL');
 fireEvent.change(screen.getByLabelText(/Título/),{target:{value:'Nuevo título'}});
 fireEvent.submit(screen.getByRole('button',{name:'Guardar examen'}).closest('form'));
 await screen.findByText('Nuevo título');
 expect(query.update).toHaveBeenCalledWith(expect.objectContaining({titulo:'Nuevo título',fecha:exam.fecha.replace('Z','.000Z')}));
 expect(query.eq).toHaveBeenCalledWith('id','exam-1');expect(query.eq).toHaveBeenCalledWith('usuario_id','user-1');
 expect(document.querySelectorAll('.exam-card')).toHaveLength(1);
});
it('keeps exam visible when deletion returns no rows (RLS denial)',async()=>{
 await menu();result={data:[],error:null};fireEvent.click(screen.getByRole('menuitem',{name:'Eliminar'}));
 expect(query.delete).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Sí, eliminar'}));await screen.findByRole('alert');expect(document.querySelector('.exam-card')).toBeTruthy();
});
it('removes only after confirmed server deletion',async()=>{
 await menu();result={data:[{id:'exam-1'}],error:null};fireEvent.click(screen.getByRole('menuitem',{name:'Eliminar'}));
 expect(query.delete).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Sí, eliminar'}));await waitFor(()=>expect(screen.queryByText('Prueba SQL')).toBeNull());
});
it('cancelled deletion does not call the database',async()=>{
 await menu();window.confirm.mockReturnValue(false);fireEvent.click(screen.getByRole('menuitem',{name:'Eliminar'}));
 fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));expect(query.delete).not.toHaveBeenCalled();expect(document.querySelector('.exam-card')).toBeTruthy();
});
