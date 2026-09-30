/**
 * The items a CMS saved for one Baize listing page, typed.
 *
 * The CMS writes `brass-birmingham.json`. The annotation is where the compiler
 * checks that every entry in it carries an `id`, a `type` and a `props` object,
 * against the file as it is when the compiler runs.
 */
// #region items
import type { AnyWidgetItem } from '@evanion/astro-widget';

import saved from './brass-birmingham.json';

export const items: AnyWidgetItem[] = saved;
// #endregion items
