export interface CorrelationConfig {
  header: string;
  generator: () => string;
  validate?: (value: string) => boolean;
}
