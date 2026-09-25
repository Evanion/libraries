import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { hydratePolicy } from '@evanion/acl';
import { PolicyProvider, useCan } from '@evanion/react-acl';
