// @vitest-environment jsdom
import {expect,it,vi,afterEach} from 'vitest';
import {render,fireEvent,cleanup,screen} from '@testing-library/react';
import {CourseCard} from './Moodle.jsx';
import {contextPosition} from './ContextMenu.jsx';
afterEach(cleanup);
it('cancels native context menu on course overlay',()=>{
 const open=vi.fn(),menu=vi.fn(event=>contextPosition(event,{id:1}));
 render(<CourseCard course={{id:1,nombre:'Curso'}} pending={0} files={0} onOpen={open} onContextMenu={menu}/>);
 const overlay=screen.getByRole('button',{name:/Abrir Curso/});
 expect(fireEvent.contextMenu(overlay)).toBe(false);
 expect(menu).toHaveBeenCalledTimes(1);
 expect(screen.queryByRole('button',{name:'Opciones de Curso'})).toBeNull();expect(open).not.toHaveBeenCalled();
});
