import * as React from 'react';
import { useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { createFeatures } from '@evanion/feature';
import {
  createFeatureContext,
  FeatureProvider,
  useFeature,
  useFeatureEnabled,
  useFeatures,
  useVariant,
} from '@evanion/react-feature';
