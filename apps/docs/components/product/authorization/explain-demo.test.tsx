import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ExplainDemo from './ExplainDemo';

describe('ExplainDemo', () => {
  it('opens on an allowed edit and names the rule', () => {
    render(<ExplainDemo />);
    expect(screen.getByText('Allowed')).toBeInTheDocument();
    expect(screen.getAllByText(/seller-edits-own/).length).toBeGreaterThan(0);
  });

  it('refuses a published listing and names the deny rule', () => {
    render(<ExplainDemo />);
    fireEvent.click(screen.getByLabelText('Published'));
    expect(screen.getByText('Refused')).toBeInTheDocument();
    expect(screen.getAllByText(/published-is-locked/).length).toBeGreaterThan(
      0,
    );
  });

  it('cannot tell until the listing is fetched', () => {
    render(<ExplainDemo />);
    fireEvent.click(
      screen.getByLabelText(/The listing is loaded/) as HTMLInputElement,
    );
    expect(screen.getByText('Cannot tell yet')).toBeInTheDocument();
    expect(screen.getAllByText(/object\.sellerId/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Fetch the listing' }));
    expect(screen.getByText('Allowed')).toBeInTheDocument();
  });
});
