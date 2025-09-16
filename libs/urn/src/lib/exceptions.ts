export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class InvalidError extends ValidationError {
  constructor(property: string) {
    super(`${property} contains invalid characters`);
    this.name = 'InvalidError';
    this.property = property;
  }
  readonly property: string;
}
