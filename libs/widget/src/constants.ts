export const ERROR_MESSAGES = {
  UNKNOWN_WIDGET: (type: string, id: string) =>
    `Unknown widget type "${type}" for widget ID "${id}". Skipping render.`,
  WIDGET_ERROR: (type: string, id: string) =>
    `Widget Error: ${type} (ID: ${id})`,
  WIDGET_FAILED: (type: string) => `Widget failed to render: ${type}`,
  MALFORMED_ITEMS:
    'Widget items must be an array. Received non-array value; skipping render.',
  INVALID_ITEM: (id: string | number, reason: string) =>
    `Skipping malformed widget item (id=${id}): ${reason}.`,
  LOADING: 'Loading widget...',
  UNKNOWN: 'unknown',
} as const;

export const DEFAULT_STYLES = {
  ERROR: {
    padding: '8px',
    border: '1px solid #ff6b6b',
    borderRadius: '4px',
    backgroundColor: '#ffe0e0',
    color: '#d63031',
  },
  LOADING: {
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: '#f8f9fa',
    color: '#666',
  },
} as const;
