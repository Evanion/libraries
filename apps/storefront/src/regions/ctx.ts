/**
 * The page-level data every region hands its blocks as `ctx`.
 *
 * `Widgets` types `ctx` as `Record<string, unknown>`, because a registry's
 * blocks are `.astro` modules whose props it cannot see. So every block would
 * otherwise cast the prop itself; {@link regionCtx} is that cast, written once.
 */
import type { Game } from '../lib/shop-api.js';

export interface RegionCtx {
  /** The catalogue, fetched once per request and shared by every region. */
  games: Game[];
  /** Copies in the cart, for the navigation region's cart link. */
  cartCopies: number;
  /** The current path, so a nav block can mark itself current. */
  path: string;
  /** The mechanism slug being browsed, on a category page. */
  category?: string;
}

/** An empty context, for a region rendered before anything filled one in. */
const EMPTY: RegionCtx = { games: [], cartCopies: 0, path: '/' };

/**
 * Narrows a block's `ctx` prop to {@link RegionCtx}.
 *
 * Tolerant rather than asserting: a block that renders with no usable context
 * should show nothing, not throw mid-page.
 */
export function regionCtx(value: unknown): RegionCtx {
  if (typeof value !== 'object' || value === null) return EMPTY;

  const ctx = value as Partial<RegionCtx>;
  return {
    games: Array.isArray(ctx.games) ? ctx.games : [],
    cartCopies: typeof ctx.cartCopies === 'number' ? ctx.cartCopies : 0,
    path: typeof ctx.path === 'string' ? ctx.path : '/',
    category: typeof ctx.category === 'string' ? ctx.category : undefined,
  };
}
