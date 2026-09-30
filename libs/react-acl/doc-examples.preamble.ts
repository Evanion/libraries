import * as React from 'react';
import { useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { hydratePolicy, policy } from '@evanion/acl';
import { PolicyProvider, useCan } from '@evanion/react-acl';
