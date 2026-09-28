import { getPageMap } from 'nextra/page-map';
import { PropsWithChildren } from 'react';
import Chrome from '../chrome';

/**
 * The docs chrome over `/next/`, where every package serves the pages written
 * on `main`.
 *
 * Its sidebar is the `next` folder alone, ordered by `content/next/_meta.ts`,
 * so every link in it stays in `main`. The theme builds one sidebar from the
 * page map it is given, which is why this is a route group of its own rather
 * than a branch of `(site)`.
 */
export default async function NextLayout({ children }: PropsWithChildren) {
  return <Chrome pageMap={await getPageMap('/next')}>{children}</Chrome>;
}
