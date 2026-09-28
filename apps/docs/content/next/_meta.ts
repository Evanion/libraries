import type { MetaRecord } from 'nextra';
import { packageGroups } from '../../app/sidebar';

/**
 * The sidebar under `/next/`, where every package serves the pages written on
 * `main`.
 *
 * The same groups as `content/_meta.ts`, in the same order, so a reader moving
 * between the released pages and these finds each package where they left it.
 * The two entries that are not package sections link out: the landing page is
 * outside the MDX content, and the testing section has no version, so its one
 * copy is at `/testing/`.
 */
export default {
  index: { title: 'All packages', href: '/' },
  ...packageGroups('next'),
  'group-repository': { type: 'separator', title: 'This repository' },
  testing: { title: 'How it is tested', href: '/testing/' },
} satisfies MetaRecord;
