import { describe, expect, it } from 'vitest';
import { regionCode } from './region';

describe('regionCode', () => {
  it('drops the test plumbing above the cut and the assertion below cut-after', () => {
    const code = regionCode(
      'libs/react-feature/docs/examples.md',
      'react-landing',
    );
    expect(code).toContain('useFeatureEnabled');
    expect(code).toContain('<FeatureProvider');
    expect(code).not.toContain('renderToStaticMarkup');
    expect(code).not.toContain('cut-after');
    expect(code).not.toContain('// ->');
  });
});
