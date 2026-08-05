import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useModalFocus } from '@/hooks/useModalFocus';

const Harness = ({ onEscape = () => {} }) => {
  const [open, setOpen] = useState(false);
  const dialogRef = useModalFocus(open, { onEscape: () => {
    onEscape();
    setOpen(false);
  } });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
      {open && (
        <div ref={dialogRef} role="dialog" tabIndex={-1}>
          <button type="button">First action</button>
          <button type="button">Last action</button>
        </div>
      )}
    </>
  );
};

describe('useModalFocus', () => {
  beforeEach(() => {
    jest.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{ width: 1, height: 1 }]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('moves focus inside, wraps Tab, and restores focus after Escape', () => {
    const onEscape = jest.fn();
    render(<Harness onEscape={onEscape} />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });

    trigger.focus();
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First action' }));

    screen.getByRole('button', { name: 'Last action' }).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First action' }));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
  });

  it('wraps Shift+Tab to the final control', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Last action' }));
  });
});
