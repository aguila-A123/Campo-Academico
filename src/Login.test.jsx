// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import Login from './Login.jsx';

afterEach(() => { cleanup(); vi.useRealTimers(); });
function submit() {
  fireEvent.change(screen.getByLabelText('Usuario o correo'), { target: { value: 'Fabrizio' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'only-a-test-password' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Entrar al campus' }).closest('form'));
}
describe('Login transitions', () => {
  it('shows red error state for 4.2 seconds, restores particles, and never enters', async () => {
    vi.useFakeTimers();
    const enter = vi.fn();
    const { container } = render(<Login onLogin={async () => { throw Error('Usuario o contraseña incorrectos.'); }} onEntered={enter} />);
    await act(async () => submit());
    expect(container.querySelector('[data-phase="error"]')).not.toBeNull();
    expect(screen.getByRole('status').textContent).toContain('incorrectos');
    await act(async () => vi.advanceTimersByTime(4199));
    expect(screen.getByRole('status').textContent).toContain('incorrectos');
    await act(async () => vi.advanceTimersByTime(1));
    expect(container.querySelector('[data-phase="idle"]')).not.toBeNull();
    expect(screen.getByRole('status').textContent).toBe('');
    expect(enter).not.toHaveBeenCalled();
  });
  it('awaits real authentication, blocks duplicate submits, then enters after 3.2 seconds', async () => {
    vi.useFakeTimers(); let resolve;
    const auth = vi.fn(() => new Promise(r => { resolve = r; })); const enter = vi.fn();
    const { container } = render(<Login onLogin={auth} onEntered={enter} />);
    await act(async () => submit());
    fireEvent.submit(container.querySelector('form'));
    expect(auth).toHaveBeenCalledTimes(1);
    expect(auth).toHaveBeenCalledWith({ username: 'Fabrizio', password: 'only-a-test-password' });
    expect(enter).not.toHaveBeenCalled();
    await act(async () => resolve());
    expect(container.querySelector('[data-phase="success"]')).not.toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Credenciales correctas');
    await act(async () => vi.advanceTimersByTime(3199)); expect(enter).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1)); expect(enter).toHaveBeenCalledTimes(1);
  });
  it('cancels the delayed entry if the login unmounts', async () => {
    vi.useFakeTimers(); const enter=vi.fn();
    const { unmount }=render(<Login onLogin={async()=>{}} onEntered={enter}/>);
    await act(async()=>submit()); unmount();
    await act(async()=>vi.advanceTimersByTime(5000)); expect(enter).not.toHaveBeenCalled();
  });
});
