// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ScanSheet } from './Scan';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Scan from gallery', () => {
  it('gallery inputs have no capture attribute (camera ones do)', () => {
    render(<ScanSheet now={0} tz="Asia/Kuala_Lumpur" customFoods={[]} onDrafts={() => {}} onClose={() => {}} />);
    const meal = screen.getByLabelText('Meal photo from gallery');
    expect(meal).not.toHaveAttribute('capture');
    expect(document.querySelectorAll('input[type=file][capture]').length).toBe(2);
  });
  it('a gallery meal photo goes through the same meal flow (asks for the key first)', async () => {
    localStorage.clear();
    render(<ScanSheet now={0} tz="Asia/Kuala_Lumpur" customFoods={[]} onDrafts={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Meal photo from gallery'), { target: { files: [new File(['x'], 'm.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Gemini/));
  });
});
