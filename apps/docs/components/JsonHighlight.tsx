import { jsonTokens } from './json-tokens';
import './json-tokens.css';

/**
 * JSON text as tokens, each in the colour its kind takes.
 *
 * `json-tokens.ts` does the splitting and `json-tokens.css` holds the three
 * colours. Every surface that draws JSON it assembled itself renders through
 * this, so the site holds one tokenizer and one palette.
 */
export function JsonHighlight({ text }: { text: string }) {
  return jsonTokens(text).map((token, index) =>
    token.kind === undefined ? (
      token.text
    ) : (
      <span key={index} className={`json-token--${token.kind}`}>
        {token.text}
      </span>
    ),
  );
}
