import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'node:stream';
import { describe, it, expect } from 'vitest';
import { createWidgets } from './index.js';

/**
 * What `chrome.suspense` is for, asserted against React's streaming SSR rather
 * than against the renderer's element tree.
 *
 * React outlines a `<Suspense>` boundary it has not finished by the time the
 * shell passes `progressiveChunkSize` (12,800 bytes by default), whether or not
 * anything in it suspended. The content goes into a trailing `<div hidden>` and
 * an inline `$RC` script moves it into place, so a client that does not run
 * that script -- scripts off, or a CSP rejecting inline script without a nonce
 * -- never sees it.
 *
 * The fixture is sized past that budget on purpose: below it every mode
 * produces identical bytes and there is nothing to measure.
 */

/** ~1,000 bytes of markup, so a few dozen rows clear the chunk budget. */
function Row({ n }: { n: number }) {
  return (
    <div className="row">
      {Array.from({ length: 8 }, (_, i) => (
        <span className="cell" key={i}>
          {`row-${n}-cell-${i}-urn:game:some-fairly-long-identifier-padding`}
        </span>
      ))}
      <span className="cell">{`row-${n}-END`}</span>
    </div>
  );
}

const ROWS = 150;

const { Widgets } = createWidgets({ components: { row: Row } });

const items = Array.from({ length: ROWS }, (_, n) => ({
  id: `r${n}`,
  type: 'row' as const,
  props: { n },
}));

/**
 * Streams to completion, piping on the shell so the bytes arrive in the order a
 * browser would receive them. Piping `onAllReady` instead would buffer the
 * outlined segments back into place and hide the thing under test.
 */
function stream(element: React.ReactElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const sink = new PassThrough();
    sink.on('data', (chunk: Buffer) => chunks.push(chunk));
    sink.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    sink.on('error', reject);

    const { pipe } = renderToPipeableStream(element, {
      onShellReady() {
        pipe(sink);
      },
      onError: reject,
    });
  });
}

const occurrences = (haystack: string, needle: string) =>
  haystack.split(needle).length - 1;

/** Rows a client that never runs `$RC` can see: those before the first outline. */
function rowsVisibleWithoutScripts(html: string) {
  const firstOutlined = html.indexOf('<div hidden');
  const visible = firstOutlined === -1 ? html : html.slice(0, firstOutlined);
  let seen = 0;
  for (let n = 0; n < ROWS; n++) {
    if (visible.includes(`row-${n}-END`)) seen++;
  }
  return seen;
}

describe('streaming a synchronous region', () => {
  it('defers most of it when every item gets a boundary', async () => {
    // The regression guard on the measurement in #140, and on React's default
    // chunk size not changing underneath it. Nothing here suspends.
    const html = await stream(<Widgets items={items} />);

    expect(occurrences(html, '<div hidden id="S:')).toBeGreaterThan(100);
    expect(occurrences(html, '$RC(')).toBeGreaterThan(100);
    expect(occurrences(html, '<!--$?-->')).toBeGreaterThan(100);
    expect(rowsVisibleWithoutScripts(html)).toBeLessThan(10);
  });

  it('defers none of it under chrome.suspense: none', async () => {
    const html = await stream(
      <Widgets chrome={{ suspense: 'none' }} items={items} />,
    );

    expect(html).not.toContain('<div hidden id="S:');
    expect(html).not.toContain('$RC(');
    expect(html).not.toContain('<!--$?-->');
    expect(rowsVisibleWithoutScripts(html)).toBe(ROWS);
  });

  it('keeps items in document order under chrome.suspense: none', async () => {
    const html = await stream(
      <Widgets chrome={{ suspense: 'none' }} items={items} />,
    );

    const positions = items.map((_, n) => html.indexOf(`row-${n}-END`));
    expect(positions.every((at) => at !== -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('costs fewer bytes without the boundaries', async () => {
    const withBoundaries = await stream(<Widgets items={items} />);
    const without = await stream(
      <Widgets chrome={{ suspense: 'none' }} items={items} />,
    );

    expect(without.length).toBeLessThan(withBoundaries.length);
  });

  it('lets an instance turn the boundaries back on', async () => {
    const { Widgets: Off } = createWidgets({
      components: { row: Row },
      chrome: { suspense: 'none' },
    });

    const html = await stream(
      <Off chrome={{ suspense: 'per-item' }} items={items} />,
    );

    expect(occurrences(html, '<div hidden id="S:')).toBeGreaterThan(100);
  });
});
