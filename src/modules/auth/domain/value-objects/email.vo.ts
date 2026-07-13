import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

export class Email {
  private readonly value: string;

  constructor(email: string) {
    if (!email) {
      throw new DomainException('VALIDATION_ERROR', 'Email is required');
    }

    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Invalid email address format',
      );
    }

    this.value = trimmed;
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.getValue();
  }
}
