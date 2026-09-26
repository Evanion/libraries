import { createToken } from '@evanion/token';

import { quote, type Probe } from './probe';

/**
 * The default token, as the README's `validate` block constructs it. The block
 * writes `token.validate(...)`, so the name here is the name there.
 */
const token = createToken();

/**
 * `token.validate` over a code the reader types.
 *
 * Three rejections that look alike in a table and do not behave alike: change
 * the last character and it is `check-failed`, type an `o` for a `0` and it is
 * `outside-alphabet`, drop one and it is `wrong-length`. Which one comes back
 * is also the order they are checked in, which the page states and the field
 * demonstrates. Regrouping the separators or typing the code in capitals
 * leaves it valid, because both are presentation.
 */
export const validate: Probe = {
  label: 'code',
  hint: 'Change the last character, type an o for a 0, or drop one.',
  call: (code) => token.validate(code),
  source: (code) => `token.validate(${quote(code)})`,
  region: { file: 'libs/token/README.md', name: 'validate' },
};

export const probes = { validate };
