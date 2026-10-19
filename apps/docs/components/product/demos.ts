import type { ComponentType } from 'react';
import AccessDemo from '../landing/AccessDemo';
import FeatureDemo from '../landing/FeatureDemo';
import DiffDemo from './authorization/DiffDemo';
import ExplainDemo from './authorization/ExplainDemo';
import CascadeDemo from './feature-flags/CascadeDemo';
import NoFlickerDemo from './feature-flags/NoFlickerDemo';
import ScheduleDemo from './feature-flags/ScheduleDemo';
import VariantsDemo from './feature-flags/VariantsDemo';
import type { DemoId } from './types';

/** Every demo a product page can name, by id. */
export const demos: Record<DemoId, ComponentType> = {
  rollout: FeatureDemo,
  schedule: ScheduleDemo,
  cascade: CascadeDemo,
  variants: VariantsDemo,
  'no-flicker': NoFlickerDemo,
  access: AccessDemo,
  'acl-explain': ExplainDemo,
  'acl-diff': DiffDemo,
};
