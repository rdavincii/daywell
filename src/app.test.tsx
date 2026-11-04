// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const tab = (name: string) => userEvent.click(screen.getByRole('button', { name }));

async function logText(text: string) {
  const u = userEvent.setup();
  await u.type(screen.getByLabelText('Quick log'), text);
  await u.click(screen.getByRole('button', { name: 'Log' }));
  return u;
}
const saveReview = async (u: ReturnType<typeof userEvent.setup>) => {
  const dlg = screen.getByRole('dialog', { name: 'Review before saving' });
  await u.click(within(dlg).getByRole('button', { name: /^Save/ }));
};
const spendCard = () => screen.getByText('Spending', { selector: '.label' }).parentElement!;
const calCard = () => screen.getByText('Calories', { selector: '.label' }).parentElement!;

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('app flows (jsdom)', () => {
  it('shows empty states for a new user', async () => {
    render(<App />);
    expect(screen.getByText('Log your first entry')).toBeInTheDocument();
    await tab('Health');
    expect(screen.getByText('No meals yet')).toBeInTheDocument();
    await tab('Finance');
    expect(screen.getByText('No spending yet')).toBeInTheDocument();
    await tab('Activity');
    expect(screen.getByText('Nothing logged yet')).toBeInTheDocument();
  });

  it('1+10: "Nasi Lemak RM5" saves expense + meal and survives a refresh', async () => {
    const { unmount } = render(<App />);
    const u = await logText('Nasi Lemak RM5');
    expect(screen.getByRole('dialog', { name: 'Review before saving' })).toBeInTheDocument();
    await saveReview(u);
    expect(within(spendCard()).getByText('RM5.00')).toBeInTheDocument();
    expect(within(calCard()).getByText('600')).toBeInTheDocument();
    unmount();
    render(<App />); // simulated browser refresh
    expect(within(spendCard()).getByText('RM5.00')).toBeInTheDocument();
    expect(within(calCard()).getByText('600')).toBeInTheDocument();
  });

  it('2: "Petrol RM50" adds no calories', async () => {
    render(<App />);
    const u = await logText('Petrol RM50');
    await saveReview(u);
    expect(within(spendCard()).getByText('RM50.00')).toBeInTheDocument();
    expect(within(calCard()).getByText('0')).toBeInTheDocument();
    expect(within(calCard()).getByText('No meals logged yet')).toBeInTheDocument();
  });

  it('3: bought-but-not-eaten keeps calories at 0 until confirmed', async () => {
    render(<App />);
    const u = await logText('I bought chicken rice for RM8');
    const dlg = screen.getByRole('dialog', { name: 'Review before saving' });
    expect(within(dlg).getByRole('switch')).not.toBeChecked();
    await saveReview(u);
    expect(within(spendCard()).getByText('RM8.00')).toBeInTheDocument();
    expect(within(calCard()).getByText('0')).toBeInTheDocument();
  });

  it('4: several items in one sentence appear as separate editable rows', async () => {
    render(<App />);
    const u = await logText('I had chicken rice for RM8 and teh tarik for RM2.50');
    const dlg = screen.getByRole('dialog', { name: 'Review before saving' });
    expect(within(dlg).getAllByLabelText('Remove this entry')).toHaveLength(2);
    await saveReview(u);
    expect(within(spendCard()).getByText('RM10.50')).toBeInTheDocument();
    expect(within(calCard()).getByText('750')).toBeInTheDocument();
  });

  it('5+6: editing calories and price updates totals on Home and Finance', async () => {
    render(<App />);
    const u = await logText('Nasi Lemak RM5');
    await saveReview(u);
    await tab('Activity');
    await u.click(screen.getByRole('button', { name: /Edit Nasi lemak/ }));
    const dlg = screen.getByRole('dialog', { name: 'Edit entry' });
    const price = within(dlg).getByLabelText('Price (RM)');
    await u.clear(price); await u.type(price, '6.50');
    const kcal = within(dlg).getByLabelText('Calories (kcal)');
    await u.clear(kcal); await u.type(kcal, '450');
    await u.click(within(dlg).getByRole('button', { name: 'Save changes' }));
    await tab('Home');
    expect(within(spendCard()).getByText('RM6.50')).toBeInTheDocument();
    expect(within(calCard()).getByText('450')).toBeInTheDocument();
    await tab('Finance');
    expect(screen.getAllByText('RM6.50').length).toBeGreaterThan(0);
  });

  it('7: deleting spending only keeps the meal and its calories', async () => {
    render(<App />);
    const u = await logText('Nasi Lemak RM5');
    await saveReview(u);
    await tab('Activity');
    await u.click(screen.getByRole('button', { name: /Edit Nasi lemak/ }));
    await u.click(screen.getByRole('button', { name: 'Delete…' }));
    await u.click(screen.getByRole('button', { name: 'Delete spending only (keep calories)' }));
    await tab('Home');
    expect(within(spendCard()).getByText('RM0.00')).toBeInTheDocument();
    expect(within(calCard()).getByText('600')).toBeInTheDocument();
  });

  it('rejects an invalid price in the edit form instead of saving it', async () => {
    render(<App />);
    const u = await logText('Petrol RM50');
    await saveReview(u);
    await tab('Activity');
    await u.click(screen.getByRole('button', { name: /Edit Petrol/ }));
    const dlg = screen.getByRole('dialog', { name: 'Edit entry' });
    const price = within(dlg).getByLabelText('Price (RM)');
    await u.clear(price); await u.type(price, 'abc');
    await u.click(within(dlg).getByRole('button', { name: 'Save changes' }));
    expect(within(dlg).getByRole('alert')).toHaveTextContent(/valid price/i);
  });

  it('12: manual entry works with no AI at all', async () => {
    render(<App />);
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Add manually' }));
    const dlg = screen.getByRole('dialog', { name: 'Review before saving' });
    await u.type(within(dlg).getByLabelText('Item'), 'Parking');
    await u.type(within(dlg).getByLabelText('Price (RM)'), '3');
    await u.selectOptions(within(dlg).getByLabelText('Category'), 'Transport');
    await u.click(within(dlg).getByRole('button', { name: /^Save/ }));
    expect(within(spendCard()).getByText('RM3.00')).toBeInTheDocument();
  });

  it('refuses to save a zero price', async () => {
    render(<App />);
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Add manually' }));
    const dlg = screen.getByRole('dialog', { name: 'Review before saving' });
    await u.type(within(dlg).getByLabelText('Item'), 'Mystery');
    await u.click(within(dlg).getByRole('button', { name: /^Save/ }));
    expect(within(dlg).getByRole('alert')).toHaveTextContent(/price/i);
  });

  it('13: microphone permission denied shows a clear message', async () => {
    localStorage.setItem('daywell:voiceAck', '1');
    class FakeSR {
      lang = ''; interimResults = false; continuous = false;
      onresult: unknown = null; onend: (() => void) | null = null; onerror: ((e: { error: string }) => void) | null = null;
      start() { setTimeout(() => { this.onerror?.({ error: 'not-allowed' }); this.onend?.(); }, 0); }
      stop() {} abort() {}
    }
    vi.stubGlobal('webkitSpeechRecognition', FakeSR);
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeSR;
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Speak your entry' }));
    expect(await screen.findByText(/permission was denied/i)).toBeInTheDocument();
    // typing still works afterwards
    expect(screen.getByLabelText('Quick log')).toBeEnabled();
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  });

  it('voice: unsupported browser falls back with a message', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Speak your entry' }));
    expect(screen.getByText(/doesn't support voice input/i)).toBeInTheDocument();
  });

  it('voice: transcript lands in the editable box and is reviewed before saving', async () => {
    localStorage.setItem('daywell:voiceAck', '1');
    class FakeSR {
      lang = ''; interimResults = false; continuous = false;
      onresult: ((e: { results: { transcript: string }[][] }) => void) | null = null;
      onend: (() => void) | null = null; onerror: unknown = null;
      start() { setTimeout(() => { this.onresult?.({ results: [[{ transcript: 'beli roti canai RM2.50' }]] }); this.onend?.(); }, 0); }
      stop() {} abort() {}
    }
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeSR;
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Speak your entry' }));
    expect(await screen.findByDisplayValue('beli roti canai RM2.50')).toBeInTheDocument();
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  });

  it('voice: asks for consent before first use', async () => {
    class FakeSR { start() {} stop() {} abort() {} }
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeSR;
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Speak your entry' }));
    expect(screen.getByText(/sends audio to its own speech service/i)).toBeInTheDocument();
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  });

  it('settings: changing the calorie target changes the dashboard', async () => {
    render(<App />);
    const u = userEvent.setup();
    await tab('Settings');
    const f = screen.getByLabelText('Calories (kcal)');
    await u.clear(f); await u.type(f, '1800'); await u.tab();
    await tab('Home');
    expect(screen.queryByText(/of 1,800 kcal/)).toBeNull(); // no meals yet: shows empty text
    await logText('Nasi Lemak RM5');
    const dlg = screen.getByRole('dialog', { name: 'Review before saving' });
    await u.click(within(dlg).getByRole('button', { name: /^Save/ }));
    expect(within(calCard()).getByText('of 1,800 kcal')).toBeInTheDocument();
  });

  it('delete all data empties everything', async () => {
    render(<App />);
    const u = await logText('Petrol RM50');
    await saveReview(u);
    await tab('Settings');
    await u.click(screen.getByRole('button', { name: 'Delete all data…' }));
    await u.click(screen.getByRole('button', { name: 'Yes, delete everything' }));
    await tab('Finance');
    expect(screen.getByText('No spending yet')).toBeInTheDocument();
  });
});
