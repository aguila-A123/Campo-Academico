// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import Moodle from './Moodle.jsx';
import {examCourses,subjectCode} from '../lib/subjects.js';
vi.mock('../lib/useActivityState.js',async()=>{const {useState}=await import('react');return {useActivityState:()=>{const [completed,setCompleted]=useState({}),[hideCompleted,setHideCompleted]=useState(false);return {completed,hideCompleted,ready:true,saving:false,error:'',toggleActivity:id=>setCompleted(c=>({...c,[id]:!c[id]})),toggleFilter:()=>setHideCompleted(v=>!v)};}};});
vi.mock('../lib/moodle.js',async()=>{const actual=await vi.importActual('../lib/moodle.js');return {...actual,loadCourses:vi.fn(async()=>[{id:'c',nombre:'Curso prueba',sections:[{id:'s',nombre:'Tema',activities:[{id:'t',tipo:'Tarea',titulo:'Ejercicio'},{id:'a',tipo:'Archivo',titulo:'Apuntes'}]}]}])};});
beforeEach(()=>{localStorage.clear();Element.prototype.scrollIntoView=vi.fn();HTMLDialogElement.prototype.close=vi.fn();HTMLDialogElement.prototype.showModal=vi.fn();});
afterEach(cleanup);
it('marks non-tasks seen, filters completed items, and resets the course view',async()=>{
 const view=render(<Moodle visible userId="test" resetKey={0}/>);
 fireEvent.click(await screen.findByRole('button',{name:/Abrir Curso prueba/}));
 fireEvent.click(screen.getByRole('button',{name:'Marcar visto'}));
 expect(screen.getByRole('button',{name:'✓ Visto'}).className).toContain('moodle-seen');
 fireEvent.click(screen.getByRole('button',{name:'Ocultar realizadas y vistas'}));
 expect(screen.queryByText('Apuntes')).toBeNull();expect(screen.getByText('Ejercicio')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Mostrar realizadas y vistas'}));expect(screen.getByText('Apuntes')).toBeTruthy();
 view.rerender(<Moodle visible userId="test" resetKey={1}/>);
 expect(screen.getByRole('button',{name:/Abrir Curso prueba/})).toBeTruthy();expect(screen.queryByRole('button',{name:'Volver a los cursos'})).toBeNull();
});
it('keeps all timetable subjects and deduplicates Moodle abbreviations',()=>{
 const courses=examCourses([{id:4,nombre:'BD (1ºDAW)'},{id:5,nombre:'Tutoría'}]);
 expect(courses).toHaveLength(9);expect(courses.find(c=>c.code==='BD').id).toBe(4);expect(subjectCode('Programación (1ºDAW)')).toBe('Prg');
});
