import React from 'react';
import { createWidgets } from '@evanion/react-widget';

/**
 * Every name a playground snippet may use.
 *
 * react-live evaluates a snippet against this object alone: there is no module
 * resolution inside a snippet, so a name that is not here surfaces as a runtime
 * error in the preview pane. `createWidgets` is the library's own export, which
 * is what makes the preview the output of the code the page shows.
 *
 * A module of its own rather than a field of WidgetPlayground, so a test can
 * evaluate a snippet against it without rendering the playground.
 */
export const playgroundScope = {
  createWidgets,
  useState: React.useState,
  useEffect: React.useEffect,
  useMemo: React.useMemo,
  useCallback: React.useCallback,
  React,
  // `noInline` makes react-live run the snippet as statements and render
  // whatever it hands to `render`, which it expects the scope to provide.
  render: (element: React.ReactElement) => element,
};
