import * as React from 'react';
import { useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { hydratePolicy, policy } from '@evanion/acl';
import {
  createPolicyContext,
  PolicyProvider,
  useCan,
} from '@evanion/react-acl';
