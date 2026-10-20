import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductPageView } from './ProductPageView';
import { productBySlug } from './registry';

describe('ProductPageView', () => {
  it('renders the hero, one section per scene, the install command, the code sample, the FAQ and the closing', () => {
    const page = productBySlug('feature-flags');
    render(<ProductPageView page={page} code="const x = 1;" />);
    expect(
      screen.getByRole('heading', { level: 1, name: page.hero.promise }),
    ).toBeInTheDocument();
    for (const scene of page.scenes)
      expect(
        screen.getByRole('heading', { level: 2, name: scene.title }),
      ).toBeInTheDocument();
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    for (const fact of page.facts)
      expect(screen.getByText(fact.title)).toBeInTheDocument();
    const sample = screen.getByRole('heading', {
      name: page.codeSample!.title,
    });
    expect(sample.closest('section')).toHaveAttribute(
      'id',
      page.codeSample!.id,
    );
    expect(screen.getByText(page.hero.install)).toBeInTheDocument();
    expect(screen.getByText(page.codeSample!.install)).toBeInTheDocument();
    for (const entry of page.faq)
      expect(screen.getByText(entry.q)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: page.closing.title }),
    ).toBeInTheDocument();
    for (const scene of page.scenes) {
      expect(screen.getByText(scene.why)).toBeInTheDocument();
      expect(screen.getByText(scene.how)).toBeInTheDocument();
    }
    const withDemo = page.scenes.filter((s) => s.demo);
    expect(screen.getAllByText('What you get')).toHaveLength(
      page.scenes.filter((s) => s.differs).length,
    );
    for (const scene of withDemo)
      expect(screen.getByText(scene.demo!.caption)).toBeInTheDocument();
  });

  it('renders the limits block after the scenes and before the code sample, and omits it when absent', () => {
    const base = productBySlug('feature-flags');
    const page = {
      ...base,
      limits: {
        title: 'What it does not do',
        items: [
          { title: 'No hosted service', text: 'It runs in your process.' },
          {
            title: 'No dashboard',
            text: 'Flags live in code.',
            link: { label: 'See the config', href: '/docs/feature/' },
          },
        ],
      },
    };
    render(<ProductPageView page={page} code="const x = 1;" />);
    const heading = screen.getByRole('heading', {
      level: 2,
      name: 'What it does not do',
    });
    for (const item of page.limits.items)
      expect(screen.getByText(item.title)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /See the config/ }),
    ).toHaveAttribute('href', '/docs/feature/');
    const lastScene = screen.getByRole('heading', {
      level: 2,
      name: base.scenes[base.scenes.length - 1]!.title,
    });
    const sample = screen.getByRole('heading', {
      name: base.codeSample!.title,
    });
    expect(
      lastScene.compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      heading.compareDocumentPosition(sample) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders no limits section when the page has none', () => {
    render(<ProductPageView page={productBySlug('feature-flags')} code="x" />);
    expect(screen.queryByText('What it does not do')).toBeNull();
  });

  it('renders a labelled install line per framework, the definition and the demo label', () => {
    const base = productBySlug('feature-flags');
    const page = {
      ...base,
      hero: {
        ...base.hero,
        installs: [
          { label: 'React', command: 'npm install a-react' },
          { label: 'Astro', command: 'npm install a-astro' },
        ],
        definition: 'A `block` is one part of a page.',
        demoLabel: 'This board is drawn by the React renderer.',
      },
    };
    render(<ProductPageView page={page} code="x" />);
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('npm install a-astro')).toBeInTheDocument();
    expect(screen.queryByText(base.hero.install)).toBeNull();
    expect(screen.getByText('block').tagName).toBe('CODE');
    expect(
      screen.getByText('This board is drawn by the React renderer.'),
    ).toBeInTheDocument();
  });

  it('shows a scene sample beside its claim, and a page without a code section renders none', () => {
    const base = productBySlug('feature-flags');
    const first = base.scenes[0]!;
    const page = {
      ...base,
      codeSample: undefined,
      scenes: [
        {
          ...first,
          sample: { install: 'npm install a-react', file: 'f', region: 'r' },
        },
      ],
    };
    render(
      <ProductPageView page={page} samples={{ [first.id]: 'const y = 2;' }} />,
    );
    expect(screen.getByText('const y = 2;')).toBeInTheDocument();
    expect(screen.getByText('npm install a-react')).toBeInTheDocument();
    expect(screen.queryByText(base.codeSample!.title)).toBeNull();
  });
});
