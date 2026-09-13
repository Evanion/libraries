import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/react-widget` in. The playground comes last
 * because it is the only page that needs the rest to make sense.
 *
 * Filename order would open the section on the advanced patterns. The labels drop
 * the package name the pages repeat: the section is already called React Widget.
 */
export default {
  index: 'Overview',
  'getting-started': 'Getting Started',
  api: 'API Reference',
  examples: 'Examples',
  advanced: 'Advanced Patterns',
  playground: 'Playground',
} satisfies MetaRecord;
