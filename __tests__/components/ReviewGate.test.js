/**
 * ReviewGate — "Verify before you swear" review modal.
 *
 * Light coverage: renders content + provenance, and the confirm button
 * stays disabled until the truthfulness checkbox is ticked.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReviewGate from '@/components/app/ReviewGate';

const affidavitData = {
  affiantName: 'Jane Doe',
  state: 'California',
  county: 'Alameda',
  children: [{ name: 'Sam Doe', dob: '2015-03-02' }],
  facts: [
    {
      content: 'The parties separated on June 1, 2024.',
      category: 'separation',
      sourceQuote: 'we split up around the start of last June',
    },
    { content: 'Petitioner has resided in California since 2010.', category: 'residency' },
  ],
};

describe('ReviewGate', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ReviewGate isOpen={false} affidavitData={affidavitData} onConfirm={jest.fn()} onCancel={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows fields, children, facts and provenance when open', () => {
    render(
      <ReviewGate isOpen affidavitData={affidavitData} onConfirm={jest.fn()} onCancel={jest.fn()} />
    );

    expect(screen.getByText('Check your statements before you sign')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Sam Doe')).toBeInTheDocument();
    expect(screen.getByText('The parties separated on June 1, 2024.')).toBeInTheDocument();
    // Provenance line from sourceQuote
    expect(screen.getByText(/You said: .*we split up around the start of last June/)).toBeInTheDocument();
  });

  it('keeps confirm disabled until the checkbox is ticked, then confirms', () => {
    const onConfirm = jest.fn();
    render(
      <ReviewGate isOpen affidavitData={affidavitData} onConfirm={onConfirm} onCancel={jest.fn()} />
    );

    const confirmButton = screen.getByRole('button', { name: /Looks right — create my draft/ });
    expect(confirmButton).toBeDisabled();

    fireEvent.click(confirmButton);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancel button calls onCancel', () => {
    const onCancel = jest.fn();
    render(
      <ReviewGate isOpen affidavitData={affidavitData} onConfirm={jest.fn()} onCancel={onCancel} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Go back and fix something/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
