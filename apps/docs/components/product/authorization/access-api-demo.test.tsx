import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AccessApiDemo from './AccessApiDemo';

describe('AccessApiDemo', () => {
  it('opens with the bookseller allowed to edit a draft', () => {
    render(<AccessApiDemo />);
    expect(screen.getByText('PUT /listings/42 → 200')).toBeInTheDocument();
    expect(
      screen.getByText('POST /listings/42/publish → 403'),
    ).toBeInTheDocument();
  });

  it('follows the signed-in role', () => {
    render(<AccessApiDemo />);
    fireEvent.click(screen.getByLabelText('Customer'));
    expect(screen.getByText('PUT /listings/42 → 403')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Owner'));
    expect(
      screen.getByText('POST /listings/42/publish → 200'),
    ).toBeInTheDocument();
  });

  it('names the deny rule once the listing is published', () => {
    render(<AccessApiDemo />);
    fireEvent.click(screen.getByLabelText('Owner'));
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(
      screen.getByText('PUT /listings/42 → 403 · published-is-locked'),
    ).toBeInTheDocument();
  });

  it('labels the toggling controls in plain words', () => {
    render(<AccessApiDemo />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(
      screen.getByRole('button', { name: 'Finish editing' }),
    ).toBeInTheDocument();
  });
});
