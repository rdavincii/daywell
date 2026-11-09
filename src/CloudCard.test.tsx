// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CloudCard } from './CloudCard';
import type { CloudApi } from './useCloud';

afterEach(cleanup);
const api = (o: Partial<CloudApi> = {}): CloudApi => ({ status: 'signed-out', email: null, error: null, lastSynced: null, sendLink: vi.fn().mockResolvedValue(true),
  signOut: vi.fn(), syncNow: vi.fn(), configure: vi.fn(() => null), deleteCopy: vi.fn(), ...o } as CloudApi);

describe('email sign-in card', () => {
  it('only allows a real-looking email, then sends the link and says so', async () => {
    const cloud = api();
    render(<CloudCard cloud={cloud} />);
    const u = userEvent.setup();
    const btn = screen.getByRole('button', { name: /email me a sign-in link/i });
    expect(btn).toBeDisabled();
    await u.type(screen.getByLabelText('Your email'), 'not-an-email');
    expect(btn).toBeDisabled();
    await u.clear(screen.getByLabelText('Your email'));
    await u.type(screen.getByLabelText('Your email'), 'me@example.com');
    await u.click(btn);
    expect(cloud.sendLink).toHaveBeenCalledWith('me@example.com');
    expect(await screen.findByText(/Link sent/)).toBeInTheDocument();
  });
  it('does not claim the link was sent when it failed', async () => {
    render(<CloudCard cloud={api({ sendLink: vi.fn().mockResolvedValue(false), error: 'rate limit' })} />);
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('Your email'), 'me@example.com');
    await u.click(screen.getByRole('button', { name: /email me/i }));
    expect(screen.queryByText(/Link sent/)).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('rate limit');
  });
  it('signed in: shows the email and sign out', () => {
    render(<CloudCard cloud={api({ email: 'me@example.com', status: 'synced' })} />);
    expect(screen.getByText('me@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });
});
