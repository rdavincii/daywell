// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { EntryRow } from './Timeline';
import type { Entry } from './Timeline';
import { ProgressBar, Sheet, Toast } from './ui';
import { FreshIds, usePresence } from './motion';



beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

const sleep = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

describe('usePresence', () => {
  it('keeps the last value for the exit, then drops it', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }: { v: string | null }) => usePresence(v, 200), { initialProps: { v: 'a' as string | null } });
    expect(result.current).toEqual({ value: 'a', exiting: false });
    rerender({ v: null });
    expect(result.current).toEqual({ value: 'a', exiting: true });
    act(() => { vi.advanceTimersByTime(199); });
    expect(result.current.value).toBe('a');
    act(() => { vi.advanceTimersByTime(2); });
    expect(result.current).toEqual({ value: null, exiting: false });
  });
  it('re-opening during the exit cancels the removal', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }: { v: string | null }) => usePresence(v, 200), { initialProps: { v: 'a' as string | null } });
    rerender({ v: null });
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ v: 'b' });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toEqual({ value: 'b', exiting: false });
  });
});

describe('Sheet', () => {
  it('starts closed, opens after layout, and goes inert while closing', () => {
    const { rerender } = render(<Sheet title="T" onClose={() => {}}>body</Sheet>);
    const backdrop = document.querySelector('.backdrop')!;
    expect(backdrop).toHaveAttribute('data-state', 'open'); // layout effect flipped it before paint
    rerender(<Sheet title="T" onClose={() => {}} closing>body</Sheet>);
    expect(backdrop).toHaveAttribute('data-state', 'closed');
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    expect(backdrop).toHaveAttribute('inert');
  });
  it('Escape closes once, and a changing onClose does not steal focus from inputs', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<Sheet title="T" onClose={onClose}><input aria-label="x" /></Sheet>);
    const input = screen.getByLabelText('x');
    input.focus();
    rerender(<Sheet title="T" onClose={() => onClose()}><input aria-label="x" /></Sheet>); // new function identity
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Toast', () => {
  it('slides out then unmounts; a new message reuses the element', async () => {
    const { rerender } = render(<Toast message="Saved." />);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('data-state', 'open');
    rerender(<Toast message="Saved again." />);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Saved again.');
    rerender(<Toast message={null} />);
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'closed');
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull(), { timeout: 600 });
  });
});

describe('ProgressBar animates from the last value you saw', () => {
  const clip = () => (document.querySelector('.bar > span') as HTMLElement).style.clipPath;
  it('first render is static; a remount with a new value starts at the old one then moves', async () => {
    const first = render(<ProgressBar id="t1" value={20} max={100} />);
    expect(clip()).toContain('80.00%'); // 20% filled, no animation on first sight
    first.unmount();
    render(<ProgressBar id="t1" value={60} max={100} />);
    expect(clip()).toContain('80.00%'); // painted at the old value first
    await waitFor(() => expect(clip()).toContain('40.00%'), { timeout: 500 }); // then moves to 60%
  });
  it('an unchanged value does not move', async () => {
    render(<ProgressBar id="t2" value={50} max={100} />).unmount();
    render(<ProgressBar id="t2" value={50} max={100} />);
    await sleep(60);
    expect(clip()).toContain('50.00%');
  });
  it('has no id: no memory, still correct', () => {
    render(<ProgressBar value={100} max={100} />);
    expect(clip()).toContain('0.00%');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
});

describe('EntryRow gestures and row motion', () => {
  const entry: Entry = {
    id: 'e-1', ts: Date.now(), title: 'Nasi lemak',
    expense: { id: 'x1', ts: Date.now(), item: 'Nasi lemak', category: 'Food & Drinks', amountSen: 500, currency: 'MYR', source: 'manual' },
  };
  const row = () => document.querySelector('.swipe-content') as HTMLElement;
  // Time is controlled so velocity is deterministic: each touch event happens `after` ms after the last.
  let clock = 0;
  beforeEach(() => { clock = 1000; vi.spyOn(performance, 'now').mockImplementation(() => clock); });
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y = 0, after = 100) => {
    clock += after;
    fireEvent[type](row(), { touches: type === 'touchEnd' ? [] : [{ clientX: x, clientY: y }] });
  };

  it('follows the finger with no transition, then settles open past halfway', () => {
    render(<EntryRow entry={entry} tz="Asia/Kuala_Lumpur" onOpen={() => {}} onDelete={() => {}} />);
    touch('touchStart', 200);
    touch('touchMove', 150);
    expect(row()).toHaveAttribute('data-dragging');
    expect(row().style.transform).toBe('translateX(-50px)'); // 1:1, no lag
    touch('touchMove', 100);
    expect(row().style.transform).toBe('translateX(-100px)');
    touch('touchEnd', 100);
    expect(row()).not.toHaveAttribute('data-dragging'); // transition is back on for the settle
    expect(row().style.transform).toBe('translateX(-130px)');
  });
  it('a quick short flick still opens the row (velocity projection)', () => {
    render(<EntryRow entry={entry} tz="Asia/Kuala_Lumpur" onOpen={() => {}} onDelete={() => {}} />);
    touch('touchStart', 200);
    touch('touchMove', 180, 0, 16);
    touch('touchMove', 150, 0, 16);
    touch('touchEnd', 150, 0, 16);
    expect(row().style.transform).toBe('translateX(-130px)'); // only dragged 50px, but fast
  });
  it('a short drag snaps back closed', () => {
    render(<EntryRow entry={entry} tz="Asia/Kuala_Lumpur" onOpen={() => {}} onDelete={() => {}} />);
    touch('touchStart', 200);
    touch('touchMove', 180);
    touch('touchEnd', 180);
    expect(row().style.transform).toBe('translateX(0px)');
  });
  it('resists past the open position instead of hard clamping, and never goes right of closed', () => {
    render(<EntryRow entry={entry} tz="Asia/Kuala_Lumpur" onOpen={() => {}} onDelete={() => {}} />);
    touch('touchStart', 300);
    touch('touchMove', 100); // raw -200
    const x = Number(/-?[\d.]+/.exec(row().style.transform)![0]);
    expect(x).toBeLessThan(-130);
    expect(x).toBeGreaterThan(-200);
    touch('touchMove', 400); // raw +100
    expect(Number(/-?[\d.]+/.exec(row().style.transform)![0])).toBeLessThan(30);
  });
  it('a vertical scroll never moves the row', () => {
    render(<EntryRow entry={entry} tz="Asia/Kuala_Lumpur" onOpen={() => {}} onDelete={() => {}} />);
    touch('touchStart', 200, 100);
    touch('touchMove', 195, 160);
    expect(row()).not.toHaveAttribute('data-dragging');
    expect(row().style.transform).toBe('translateX(0px)');
  });
  it('delete collapses first and removes the record after the animation', async () => {
    vi.useFakeTimers();
    const onDelete = vi.fn();
    render(<EntryRow entry={entry} tz="Asia/Kuala_Lumpur" onOpen={() => {}} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText('Delete Nasi lemak'));
    expect(document.querySelector('.swipe-collapse')).toHaveAttribute('data-leaving');
    expect(onDelete).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(230); });
    expect(onDelete).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText('Delete Nasi lemak')); // double tap must not delete twice
    act(() => { vi.advanceTimersByTime(300); });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
  it('without an onDelete handler the delete button does nothing destructive', () => {
    render(<EntryRow entry={entry} tz="Asia/Kuala_Lumpur" onOpen={() => {}} />);
    fireEvent.click(screen.getByLabelText('Delete Nasi lemak'));
    expect(document.querySelector('.swipe-collapse')).not.toHaveAttribute('data-leaving');
  });
  it('a just-added row is marked fresh and staggered; others are not', () => {
    render(
      <FreshIds.Provider value={['other', 'x1']}>
        <EntryRow entry={entry} tz="Asia/Kuala_Lumpur" onOpen={() => {}} />
      </FreshIds.Provider>,
    );
    const c = document.querySelector('.swipe-collapse') as HTMLElement;
    expect(c).toHaveAttribute('data-fresh');
    expect(c.style.animationDelay).toBe('50ms');
    cleanup();
    render(<EntryRow entry={entry} tz="Asia/Kuala_Lumpur" onOpen={() => {}} />);
    expect(document.querySelector('.swipe-collapse')).not.toHaveAttribute('data-fresh');
  });
});

describe('full log flow with the new timing', () => {
  it('Save: sheet slides out (inert, then gone), badge shows, Home arrives well before the old 1.4s, nothing is lost', async () => {
    render(<App />);
    const u = userEvent.setup();
    await u.click(document.querySelector('.tab-log')!);
    await u.type(screen.getByLabelText('Quick log'), 'Petrol RM50');
    await u.click(screen.getByRole('button', { name: /^Log$/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Review before saving' });
    expect(dialog.closest('.backdrop')).toHaveAttribute('data-state', 'open');

    await u.click(screen.getByRole('button', { name: /^Save/ }));
    // exiting: still in the DOM so it can animate, but hidden from assistive tech and not clickable
    const backdrop = document.querySelector('.backdrop')!;
    expect(backdrop).toHaveAttribute('data-state', 'closed');
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    expect(document.querySelector('.celebration-overlay')).toHaveAttribute('data-state', 'open');
    expect(screen.getByRole('status')).toHaveTextContent(/Saved 1 expense/);

    await waitFor(() => expect(document.querySelector('.backdrop')).toBeNull(), { timeout: 600 });
    await waitFor(() => expect(document.querySelector('.tab[aria-current="page"]')).toHaveTextContent('Home'), { timeout: 900 });
    // the badge fades out afterwards and is removed
    await waitFor(() => expect(document.querySelector('.celebration-overlay')).toBeNull(), { timeout: 1500 });
    // the record was actually saved and the new row is marked to animate in
    expect(JSON.parse(localStorage.getItem('daywell:v1')!).expenses).toHaveLength(1);
  }, 8000);
});
