// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TrendChart, HistoryList } from './Trend';
import { FinanceScreen } from './Screens';
import { saveFile } from './lib/save';
import { spendSeries } from './lib/stats';
import { QuickLog } from './QuickLog';
import { emptyState } from './lib/store';
import type { AppState } from './lib/types';

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const TODAY = '2026-11-13';
const at = (day: string, sen: number, id: string) => ({ id, ts: Date.parse(day + 'T12:00:00+08:00'), amountSen: sen, category: 'Food & Drinks', item: 'x' }) as any;
const withSpend = (): AppState => ({ ...emptyState(), expenses: [at('2026-11-13', 500, 'a'), at('2026-11-13', 250, 'b'), at('2026-11-11', 1000, 'c')] });

describe('spendSeries', () => {
  it('sums per day, oldest first, and keeps empty days as 0', () => {
    const r = spendSeries(withSpend(), TODAY, 3);
    expect(r.map((x) => [x.day, x.sen, x.count])).toEqual([['2026-11-11', 1000, 1], ['2026-11-12', 0, 0], ['2026-11-13', 750, 2]]);
  });
});

describe('TrendChart hover', () => {
  it('shows the value and date of the nearest point', () => {
    const pts = [1, 2, 3].map((d) => ({ ts: d * 86400000, value: d * 10, label: `Day ${d}` }));
    const { container } = render(<TrendChart points={pts} format={(v) => `${v} kg`} ariaLabel="t" />);
    const box = container.querySelector('svg')!.parentElement!;
    box.getBoundingClientRect = () => ({ left: 0, width: 320, top: 0, height: 140, right: 320, bottom: 140, x: 0, y: 0, toJSON() {} });
    fireEvent.pointerMove(box, { clientX: 315 });
    expect(screen.getByTestId('trend-tip')).toHaveTextContent('30 kg');
    expect(screen.getByTestId('trend-tip')).toHaveTextContent('Day 3');
    fireEvent.pointerMove(box, { clientX: 5 });
    expect(screen.getByTestId('trend-tip')).toHaveTextContent('Day 1');
  });
  it('says so when there is nothing to draw', () => {
    render(<TrendChart points={[]} format={String} ariaLabel="t" />);
    expect(screen.getByText(/Nothing recorded/)).toBeInTheDocument();
  });
});

describe('HistoryList', () => {
  it('shows 5 then all', () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ key: String(i), label: `r${i}`, value: 'v' }));
    render(<HistoryList rows={rows} empty="none" />);
    expect(screen.queryByText('r5')).toBeNull();
    fireEvent.click(screen.getByText('Show all (8)'));
    expect(screen.getByText('r7')).toBeInTheDocument();
  });
});

describe('Finance mirrors Health', () => {
  it('has a hero ring, a spending history chart and a day list', () => {
    render(<FinanceScreen state={withSpend()} today={TODAY} />);
    expect(screen.getByText('Spending History')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Spending per day' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Spending period' }) ?? screen.getByLabelText('Spending period')).toBeTruthy();
    expect(screen.getByText('2 items')).toBeInTheDocument();
  });
});

describe('saveFile', () => {
  it('uses the share sheet when files can be shared', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, canShare: () => true });
    expect(await saveFile('a.json', '{}', 'application/json')).toBe('shared');
    expect(share.mock.calls[0][0].files[0].name).toBe('a.json');
  });
  it('reports a closed share sheet as cancelled, not failed', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })), canShare: () => true });
    expect(await saveFile('a.json', '{}', 'application/json')).toBe('cancelled');
  });
  it('falls back to a blob download', async () => {
    vi.stubGlobal('navigator', {});
    URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect(await saveFile('a.json', '{}', 'application/json')).toBe('downloaded');
    expect(click).toHaveBeenCalled();
  });
});

describe('Scan sits next to Log', () => {
  it('is an icon button inside the quick-input form', () => {
    render(<QuickLog now={Date.now()} tz="Asia/Kuala_Lumpur" onCommit={() => {}} lang="en-MY" suggestions={[]} draftText="" setDraftText={() => {}} customFoods={[]} />);
    const scan = screen.getByRole('button', { name: 'Scan' });
    expect(scan.closest('form')).toBe(screen.getByLabelText('Quick log').closest('form'));
  });
});
