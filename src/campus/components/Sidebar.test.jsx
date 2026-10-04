// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Sidebar from './Sidebar.jsx';
import { vi } from 'vitest';
vi.mock('../../lib/supabase.js',()=>({supabase:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})})})}}));
afterEach(cleanup);
it('toggles with Space and ignores repeats, typing and interactive controls', () => {
  render(<><Sidebar page="home" onNavigate={()=>{}} onLogout={()=>{}}/><input aria-label="Texto"/></>);
  const sidebar=screen.getByRole('complementary');
  fireEvent.keyDown(document.body,{key:' ',code:'Space'});
  expect(sidebar.classList.contains('collapsed')).toBe(true);
  fireEvent.keyDown(document.body,{key:' ',code:'Space',repeat:true});
  expect(sidebar.classList.contains('collapsed')).toBe(true);
  fireEvent.keyDown(screen.getByLabelText('Texto'),{key:' ',code:'Space'});
  fireEvent.keyDown(screen.getByRole('button',{name:'Moodle'}),{key:' ',code:'Space'});
  expect(sidebar.classList.contains('collapsed')).toBe(true);
  fireEvent.keyDown(document.body,{key:' ',code:'Space'});
  expect(sidebar.classList.contains('collapsed')).toBe(false);
});
