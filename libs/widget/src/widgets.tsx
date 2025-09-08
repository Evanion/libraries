import React, { HTMLProps, Suspense, Component, ReactNode } from 'react';
import { ERROR_MESSAGES, DEFAULT_STYLES } from './constants';

export function DefaultWrapper(props: HTMLProps<HTMLDivElement>) {
  return <section {...props} />;
}

// Error boundary for individual widgets
class WidgetErrorBoundary extends Component<
  { children: ReactNode; widgetId: string; widgetType: string },
  { hasError: boolean; error?: Error }
> {
  constructor(props: {
    children: ReactNode;
    widgetId: string;
    widgetType: string;
  }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      ERROR_MESSAGES.WIDGET_ERROR(this.props.widgetType, this.props.widgetId),
      error,
      errorInfo
    );
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div style={DEFAULT_STYLES.ERROR}>
          {ERROR_MESSAGES.WIDGET_FAILED(this.props.widgetType)}
        </div>
      );
    }

    return this.props.children;
  }
}

// Default loading fallback
const DefaultLoadingFallback = () => (
  <div style={DEFAULT_STYLES.LOADING}>{ERROR_MESSAGES.LOADING}</div>
);

export function DefaultItem(
  props: HTMLProps<HTMLDivElement> & {
    'data-widget-id'?: string;
    'data-widget-type'?: string;
  }
) {
  const {
    'data-widget-id': widgetId,
    'data-widget-type': widgetType,
    ...restProps
  } = props;

  return (
    <div {...restProps}>
      <WidgetErrorBoundary
        widgetId={widgetId || ERROR_MESSAGES.UNKNOWN}
        widgetType={widgetType || ERROR_MESSAGES.UNKNOWN}
      >
        <Suspense fallback={<DefaultLoadingFallback />}>
          {props.children}
        </Suspense>
      </WidgetErrorBoundary>
    </div>
  );
}
