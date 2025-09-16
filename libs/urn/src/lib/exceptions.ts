export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class InvalidError extends ValidationError {
  constructor(property: string, value: string, invalidChar?: string) {
    const message = invalidChar
      ? `${property} contains invalid character '${invalidChar}' in '${value}'`
      : `${property} contains invalid characters in '${value}'`;
    super(message);
    this.name = 'InvalidError';
    this.property = property;
    this.value = value;
    this.invalidChar = invalidChar;
  }
  readonly property: string;
  readonly value: string;
  readonly invalidChar?: string;
}
