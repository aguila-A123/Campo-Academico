// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import DragonIndicator from './DragonIndicator.jsx';
vi.mock('../lib/useDragonAI.js',()=>({useDragonAI:()=>({prefs:{modelo:'chatgpt',valor:50},ready:true,saving:false,dirty:false,messages:[],loading:false,setPrefs:vi.fn(),send:vi.fn(),retrySettings:vi.fn()})}));
beforeEach(()=>{Element.prototype.scrollIntoView=vi.fn();HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};});
afterEach(cleanup);
const toggle=()=>fireEvent.keyDown(window,{key:'h',code:'KeyH',ctrlKey:true,altKey:true});
it('opens a modal blocker from the banner and releases it by second click or Escape',()=>{
 render(<DragonIndicator/>);toggle();fireEvent.click(screen.getByRole('button',{name:'Activar borde del dragón'}));
 expect(screen.getByRole('dialog')).toBeTruthy();expect(document.body.style.overflow).toBe('hidden');
 fireEvent.click(screen.getByRole('button',{name:'Desactivar borde del dragón'}));expect(screen.queryByRole('dialog')).toBeNull();expect(document.body.style.overflow).toBe('');
 fireEvent.click(screen.getByRole('button',{name:'Activar borde del dragón'}));fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});expect(screen.queryByRole('dialog')).toBeNull();
});
it('hides the banner via its shortcut and ignores repeated presses',()=>{
 render(<DragonIndicator/>);toggle();fireEvent.keyDown(window,{key:'h',code:'KeyH',ctrlKey:true,altKey:true,repeat:true});expect(screen.getByRole('button',{name:'Activar borde del dragón'})).toBeTruthy();toggle();expect(screen.queryByRole('button',{name:'Activar borde del dragón'})).toBeNull();
});

it('opens the provider panel on right click without opening the chat',()=>{render(<DragonIndicator/>);toggle();expect(fireEvent.contextMenu(screen.getByRole('button',{name:'Activar borde del dragón'}))).toBe(false);expect(screen.getByRole('slider')).toBeTruthy();expect(screen.queryByRole('dialog')).toBeNull();});
