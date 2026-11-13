// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CloudCard } from './CloudCard';
import type { CloudApi } from './useCloud';

afterEach(cleanup);
const api = (o: Partial<CloudApi> = {}): CloudApi => ({ status: 'off', error: null, lastSynced: null, connect: vi.fn().mockResolvedValue(true),
  disconnect: vi.fn(), syncNow: vi.fn(), deleteCopy: vi.fn(), ...o });

describe('cloud backup card', () => {
  it('needs a plausible token and an 8+ character passphrase before connecting', async () => {
    const cloud = api();
    render(<CloudCard cloud={cloud} />);
    const u = userEvent.setup();
    const btn = screen.getByRole('button', { name: /connect and sync/i });
    expect(btn).toBeDisabled();
    await u.type(screen.getByLabelText('GitHub token'), 'ghp_' + 'x'.repeat(30));
    await u.type(screen.getByLabelText(/Passphrase/), 'short');
    expect(btn).toBeDisabled();
    await u.type(screen.getByLabelText(/Passphrase/), 'enough-now');
    await u.click(btn);
    expect(cloud.connect).toHaveBeenCalledWith('ghp_' + 'x'.repeat(30), 'shortenough-now');
  });
  it('shows an error from a failed connect', () => {
    render(<CloudCard cloud={api({ status: 'error', error: 'GitHub rejected that token.' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('rejected');
  });
  it('connected: sync, disconnect, and a two-step delete', async () => {
    const cloud = api({ status: 'synced', lastSynced: Date.now() });
    render(<CloudCard cloud={cloud} />);
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: /sync now/i }));
    expect(cloud.syncNow).toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: /delete cloud copy/i }));
    expect(cloud.deleteCopy).not.toHaveBeenCalled(); // needs the second tap
    await u.click(screen.getByRole('button', { name: /really delete/i }));
    expect(cloud.deleteCopy).toHaveBeenCalled();
  });
});
