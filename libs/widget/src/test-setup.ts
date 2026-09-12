import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';
import { resetWarnings } from './warn.js';

// Dev warnings are reported once per process, so without this one case's
// warning silences the next case that produces the same message.
beforeEach(resetWarnings);
