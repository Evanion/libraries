import { cleanup, render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  CodeBlock,
  CopyButton,
  CopyValue,
  Dialog,
  dialogCommand,
  EmptyState,
  Field,
  PageHeader,
  Select,
  Switch,
} from './index.js';

afterEach(cleanup);

describe('Button', () => {
  it('is a plain button unless it says it submits', () => {
    render(
      <form>
        <Button>Cancel</Button>
        <Button type="submit" variant="primary">
          Save
        </Button>
      </form>,
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute(
      'type',
      'button',
    );
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute(
      'data-variant',
      'primary',
    );
  });
});

describe('Button danger', () => {
  it('marks a destructive action with the danger variant', () => {
    render(<Button variant="danger">Delete flag</Button>);

    expect(screen.getByRole('button', { name: 'Delete flag' })).toHaveAttribute(
      'data-variant',
      'danger',
    );
  });
});

describe('Checkbox', () => {
  it('is a native checkbox named by its label and described by its hint', () => {
    render(
      <Checkbox
        id="enabled"
        name="enabled"
        label="Enabled"
        hint="Off means off for everyone."
        defaultChecked
      />,
    );

    const box = screen.getByRole('checkbox', { name: 'Enabled' });

    expect(box).toBeChecked();
    expect(box).toHaveAttribute('name', 'enabled');
    expect(box).toHaveAccessibleDescription('Off means off for everyone.');
  });

  it('has no description without a hint', () => {
    render(<Checkbox id="beta" name="beta" label="Beta" />);

    expect(screen.getByRole('checkbox', { name: 'Beta' })).not.toHaveAttribute(
      'aria-describedby',
    );
  });
});

describe('Select', () => {
  it('is a native select named by its label, with its hint and error', () => {
    render(
      <Select
        id="op"
        name="op"
        label="Operator"
        hint="How the value is compared."
        error="Pick an operator."
        defaultValue="in"
      >
        <option value="eq">equals</option>
        <option value="in">is one of</option>
      </Select>,
    );

    const select = screen.getByRole('combobox', { name: 'Operator' });

    expect(select).toHaveValue('in');
    expect(select).toHaveClass('input');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription(
      'How the value is compared. Pick an operator.',
    );
  });
});

describe('ButtonLink', () => {
  it('keeps the caller’s class next to its own', () => {
    render(
      <ButtonLink href="/flags/new" className="wide">
        New flag
      </ButtonLink>,
    );

    const link = screen.getByRole('link', { name: 'New flag' });

    expect(link).toHaveClass('button', 'wide');
    expect(link).toHaveAttribute('data-variant', 'secondary');
  });
});

describe('Field', () => {
  it('labels its input and points it at the hint and the error', () => {
    render(
      <Field
        id="slug"
        label="Identifier"
        name="slug"
        hint="Lowercase only"
        error="Taken"
      />,
    );
    const input = screen.getByLabelText('Identifier');
    const described = (input.getAttribute('aria-describedby') ?? '').split(' ');

    expect(
      described.map((id) => document.getElementById(id)?.textContent),
    ).toEqual(['Lowercase only', 'Taken']);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Lowercase only Taken');
  });

  it('describes the input by its hint alone when there is no error', () => {
    render(
      <Field id="name" label="Name" name="name" hint="Shown to members" />,
    );
    const input = screen.getByLabelText('Name');

    expect(input).toHaveAttribute('aria-describedby', 'name-hint');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('carries no aria-describedby with neither hint nor error', () => {
    render(<Field id="email" label="Email" name="email" type="email" />);

    expect(screen.getByLabelText('Email')).not.toHaveAttribute(
      'aria-describedby',
    );
  });
});

describe('Switch', () => {
  it('is a named switch that reports its state and submits its form', () => {
    render(<Switch checked label="checkout-v2" />);
    const toggle = screen.getByRole('switch', { name: 'checkout-v2' });

    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveAttribute('type', 'submit');
  });

  it('reports off as aria-checked false', () => {
    render(<Switch checked={false} label="search-v3" name="flag" value="on" />);
    const toggle = screen.getByRole('switch', { name: 'search-v3' });

    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveAttribute('name', 'flag');
  });
});

describe('Badge', () => {
  it('carries its tone as data-tone, and none without one', () => {
    render(
      <>
        <Badge tone="positive">On</Badge>
        <Badge tone="production">Production</Badge>
        <Badge>Staging</Badge>
      </>,
    );

    expect(screen.getByText('On')).toHaveAttribute('data-tone', 'positive');
    expect(screen.getByText('Production')).toHaveAttribute(
      'data-tone',
      'production',
    );
    expect(screen.getByText('Staging')).not.toHaveAttribute('data-tone');
  });
});

describe('Alert', () => {
  it('interrupts for a negative tone by default', () => {
    render(<Alert>Could not save</Alert>);

    expect(screen.getByRole('alert')).toHaveAttribute('data-tone', 'negative');
  });

  it('waits its turn for a positive tone', () => {
    render(<Alert tone="positive">Saved</Alert>);

    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Card', () => {
  it('is a region named by its title', () => {
    render(
      <Card title="Members">
        <p>Three people</p>
      </Card>,
    );

    const region = screen.getByRole('region', { name: 'Members' });

    expect(
      within(region).getByRole('heading', { level: 2, name: 'Members' }),
    ).toBeInTheDocument();
  });
});

describe('PageHeader', () => {
  it('renders the page heading, its description and its actions', () => {
    render(
      <PageHeader
        title="Flags"
        description="Every flag in this project"
        actions={<ButtonLink href="/new">New flag</ButtonLink>}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Flags' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Every flag in this project')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New flag' })).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders its children', () => {
    render(<EmptyState>No flags yet</EmptyState>);

    expect(screen.getByText('No flags yet')).toHaveClass('empty-state');
  });
});

describe('CopyValue', () => {
  it('shows the full value and a labelled copy button carrying it', () => {
    render(<CopyValue value="v1.abc" copyLabel="Copy" copiedLabel="Copied" />);
    const button = screen.getByRole('button', { name: 'Copy' });

    expect(screen.getByText('v1.abc')).toHaveAttribute('title', 'v1.abc');
    expect(button).toHaveAttribute('data-copy', 'v1.abc');
    expect(button).toHaveAttribute('data-copied-label', 'Copied');
    expect(button.nextElementSibling).toHaveAttribute('role', 'status');
  });

  const key = 'v1.eyJyZWFsbSI6InBsYXRmb3JtIiwicHJvamVjdCI6ImNvbnNvbGUifQ';

  it('shows the start and end of a long value, and keeps the whole value for copy and tooltip', () => {
    render(
      <CopyValue value={key} copyLabel="Copy" copiedLabel="Copied" truncate />,
    );
    const shown = screen.getByTitle(key);

    expect(shown.textContent).toBe(`${key.slice(0, 8)}…${key.slice(-6)}`);
    expect(shown).toHaveAttribute('aria-label', key);
    expect(screen.getByRole('button', { name: 'Copy' })).toHaveAttribute(
      'data-copy',
      key,
    );
  });

  it('leaves a short value whole', () => {
    render(
      <CopyValue
        value="v1.short"
        copyLabel="Copy"
        copiedLabel="Copied"
        truncate
      />,
    );

    expect(screen.getByTitle('v1.short').textContent).toBe('v1.short');
  });
});

describe('CodeBlock', () => {
  it('names the block by its label and copies the whole code', () => {
    const code = 'npm install @evanion/ui';
    render(
      <CodeBlock
        code={code}
        label="Shell"
        copyLabel="Copy command"
        copiedLabel="Copied"
      />,
    );

    expect(screen.getByLabelText('Shell')).toHaveTextContent(code);
    expect(screen.getByLabelText('Shell')).toHaveAttribute('tabindex', '0');
    expect(
      screen.getByRole('button', { name: 'Copy command' }),
    ).toHaveAttribute('data-copy', code);
  });

  it('renders no head and no button with neither label nor copy label', () => {
    const html = renderToStaticMarkup(<CodeBlock code="x" />);

    expect(html).not.toContain('code-block-head');
    expect(html).not.toContain('<button');
  });
});

describe('CopyButton', () => {
  it('renders a live region right after its button, which the client helper writes to', () => {
    const html = renderToStaticMarkup(
      <CopyButton value="v1" copyLabel="Copy key" copiedLabel="Key copied" />,
    );
    document.body.innerHTML = html;
    const button = screen.getByRole('button', { name: 'Copy key' });

    expect(button).toHaveAttribute('data-copy', 'v1');
    expect(button).toHaveAttribute('data-copied-label', 'Key copied');
    expect(button.nextElementSibling).toHaveAttribute('data-copy-status');
    expect(button.nextElementSibling).toHaveAttribute('role', 'status');
    expect(button.nextElementSibling).toBeEmptyDOMElement();
  });
});

describe('dialogCommand', () => {
  it('opens the dialog it names by default, and closes it on request', () => {
    expect(dialogCommand('invite')).toEqual({
      commandfor: 'invite',
      command: 'show-modal',
    });
    expect(dialogCommand('invite', 'close')).toEqual({
      commandfor: 'invite',
      command: 'close',
    });
  });
});

describe('Dialog', () => {
  it('is named by its title, and its close button commands it', () => {
    const html = renderToStaticMarkup(
      <>
        <Button {...dialogCommand('invite')}>Invite</Button>
        <Dialog id="invite" title="Invite a member" closeLabel="Close">
          <p>Body</p>
        </Dialog>
      </>,
    );
    document.body.innerHTML = html;

    const dialog = document.getElementById('invite');

    expect(dialog?.tagName).toBe('DIALOG');
    expect(dialog).toHaveAttribute('closedby', 'any');
    expect(
      document.getElementById(dialog?.getAttribute('aria-labelledby') ?? ''),
    ).toHaveTextContent('Invite a member');

    const [open, close] = document.querySelectorAll('button');
    expect(open).toHaveAttribute('commandfor', 'invite');
    expect(open).toHaveAttribute('command', 'show-modal');
    expect(close).toHaveAttribute('commandfor', 'invite');
    expect(close).toHaveAttribute('command', 'close');
  });
});
