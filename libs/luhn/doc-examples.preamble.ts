import {
  ALTERNATING_CASE_DICTIONARY,
  DEFAULT_DICTIONARY,
  InvalidDictionaryError,
  Luhn,
  createLuhn,
} from '@evanion/luhn';

// The instance the `pickup-dictionary` region builds, for the later regions
// that check pickup codes against it.
const pickup = createLuhn({ dictionary: '0123456789abcdefghjkmnpqrstuvxyz' });
