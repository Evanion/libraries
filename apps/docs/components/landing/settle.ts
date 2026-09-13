import { useEffect, useRef, useState } from 'react';

/** How often a scrambling character changes, and how long the scramble runs. */
const FRAME_MS = 40;
const SETTLE_MS = 200;

/**
 * Whether the reader asked for no motion. False where the query cannot be
 * asked -- a test runner has no `matchMedia` -- so a test sees the motion.
 */
function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** One character from the alphabet, for a frame nobody reads. */
function scrambled(alphabet: string): string {
  return alphabet[Math.floor(Math.random() * alphabet.length)] as string;
}

/** A frame of the scramble, and which value it was drawn for. */
interface Frame {
  of: string;
  text: string;
}

/**
 * `value`, shown settling: for a moment after it changes, each character
 * that is in `alphabet` cycles through the alphabet before landing on the
 * real one. The frames are never the value; the value is what is left when
 * the frames stop.
 *
 * `stagger` delays each character's landing by that many milliseconds per
 * position, so a code settles left to right; zero settles every character
 * at once. Characters outside the alphabet -- a separator -- are shown as
 * they are throughout, so the shape of the value holds while its letters
 * turn.
 *
 * A frame is only shown while it belongs to the current value: what is
 * returned is the value itself unless a frame drawn for that exact value is
 * in hand. So the first render is the value as it is, the server's markup
 * and the client's first paint agree, and a change while a settle is running
 * shows the new value at once until its own first frame arrives -- a frame
 * from an old value cannot land after a new one, however fast the reader
 * types. Under `prefers-reduced-motion` no frames are drawn at all.
 *
 * Visual only. Whatever shows this must hide it from assistive technology
 * and expose `value` itself, because six random characters per keystroke
 * read aloud is not an effect.
 */
export function useSettled(
  value: string | undefined,
  alphabet: string,
  stagger = 0,
): string | undefined {
  const [frame, setFrame] = useState<Frame | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (value === undefined || reducedMotion()) return;

    const started = performance.now();
    const chars = [...value];
    const lands = chars.map((char, index) =>
      alphabet.includes(char) ? SETTLE_MS + index * stagger : 0,
    );
    const last = Math.max(...lands, 0);

    const draw = () => {
      const elapsed = performance.now() - started;
      setFrame({
        of: value,
        text: chars
          .map((char, index) =>
            elapsed >= (lands[index] ?? 0) ? char : scrambled(alphabet),
          )
          .join(''),
      });
      if (elapsed >= last) clearInterval(timer);
    };

    // The first frame on the next tick rather than in this effect: the value
    // shows for one task, which no eye catches, and a state change scheduled
    // rather than made inside an effect is what keeps the render from
    // cascading.
    const first = setTimeout(draw, 0);
    const timer = setInterval(draw, FRAME_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [value, alphabet, stagger]);

  return frame && frame.of === value ? frame.text : value;
}
