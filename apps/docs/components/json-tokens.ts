/**
 * JSON as tokens, for text this site assembled or a reader typed.
 *
 * The site's code fences are highlighted by Shiki during the build. Text that
 * reaches a page after that -- a listing a reader reordered, a document a
 * reader pasted -- was never a fence, so it is tokenized here instead. A
 * tokenizer for JSON and nothing else: strings, numbers, the three literals,
 * punctuation, and a string followed by a colon read as a key.
 *
 * **Kinds, and no class names.** Two surfaces use this and their classes are
 * their own: `landing-items__token--key` on a tool screen would carry the
 * landing section's name onto a page that is not the landing page. What the
 * two share is the split, which is this module; what each owns is three class
 * names and the three colours behind them.
 */

/** What a token is, where it is one of the three the colours distinguish. */
export type TokenKind = 'key' | 'string' | 'literal';

export interface JsonToken {
  text: string;
  /** Absent for punctuation and whitespace, which take the reading colour. */
  kind?: TokenKind;
}

/**
 * The split. Capturing, so `String.split` returns the separators too, and an
 * odd index is a token while an even one is what sat between two.
 *
 * A key is a string the colon follows, so the string pattern takes the colon
 * with it rather than needing a second pass to look ahead.
 */
const PATTERN =
  /("(?:[^"\\]|\\.)*"\s*:?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b)/;

function kindOf(token: string): TokenKind {
  if (!token.startsWith('"')) return 'literal';
  return token.trimEnd().endsWith(':') ? 'key' : 'string';
}

/** One flat list of tokens, in the order they appear. */
export function jsonTokens(text: string): JsonToken[] {
  return text.split(PATTERN).flatMap((part, index) => {
    if (part === '') return [];
    return index % 2 === 0
      ? [{ text: part }]
      : [{ text: part, kind: kindOf(part) }];
  });
}

/**
 * The same tokens, one array per line.
 *
 * An editor draws its highlighted layer line by line, so a line can carry the
 * mark a reported error puts on it. A token holding a newline is split across
 * the lines it spans, which happens for whitespace in every document and for a
 * string only while a reader is midway through typing one.
 *
 * The result always holds at least one line, and its length is the line count
 * of the text, so a caller can join with `\n` and get the text back.
 */
export function jsonTokenLines(text: string): JsonToken[][] {
  const lines: JsonToken[][] = [[]];

  for (const token of jsonTokens(text)) {
    const parts = token.text.split('\n');

    parts.forEach((part, at) => {
      if (at > 0) lines.push([]);
      if (part !== '') lines[lines.length - 1]?.push({ ...token, text: part });
    });
  }

  return lines;
}
