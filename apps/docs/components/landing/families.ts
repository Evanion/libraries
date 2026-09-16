import type { Platform } from '@evanion/baize-ui/tokens';
import {
  groups,
  packages,
  type DocumentedPackage,
  type PackageGroup,
} from '../../app/navigation';
import { platformsOf } from './platforms';

/**
 * A family: a core and the renderers/bindings sold alongside it.
 *
 * The landing renders one item per family, not one per package, so a core with
 * three adapters is one card carrying a chip per platform rather than three
 * cards. A standalone package is its own family of one. This is the only place
 * the grouping is computed; every section reads a `Family` and renders it.
 */
export interface Family {
  /** Stable key: the shared `familyId`, or the singleton's slug. */
  id: string;
  /** Every member, in `navigation.ts` order. */
  members: DocumentedPackage[];
  /**
   * The member that names the family: the framework-free core when there is
   * one, else the first member. Its title, hue and link lead the card, so the
   * family reads as "Widget", not "React Widget".
   */
  lead: DocumentedPackage;
  /**
   * The platforms the family runs on, unioned across members and deduped.
   *
   * The lead's platforms come first, so a family reads core-then-adapters --
   * `universal, React, Astro` -- whatever order `navigation.ts` lists its
   * members in. Ordering by member instead puts the core's own chip after the
   * adapters that wrap it whenever an adapter happens to be listed first.
   */
  platforms: { label: string; platform: Platform }[];
}

function toFamily(members: DocumentedPackage[]): Family {
  const lead =
    members.find((entry) => entry.framework === 'universal') ?? members[0]!;
  const seen = new Map<string, { label: string; platform: Platform }>();
  for (const entry of [lead, ...members]) {
    for (const chip of platformsOf(entry.framework)) {
      if (!seen.has(chip.platform)) seen.set(chip.platform, chip);
    }
  }
  return {
    id: lead.familyId ?? lead.slug,
    members,
    lead,
    platforms: [...seen.values()],
  };
}

/** The families under a group, in `navigation.ts` order. */
export function familiesOf(group: PackageGroup): Family[] {
  const byFamily = new Map<string, DocumentedPackage[]>();
  for (const entry of packages.filter((e) => e.group === group.id)) {
    const key = entry.familyId ?? entry.slug;
    const list = byFamily.get(key);
    if (list) list.push(entry);
    else byFamily.set(key, [entry]);
  }
  return [...byFamily.values()].map(toFamily);
}

/** Every family on the site, in `groups` then member order. */
export function allFamilies(): Family[] {
  return groups.flatMap(familiesOf);
}
