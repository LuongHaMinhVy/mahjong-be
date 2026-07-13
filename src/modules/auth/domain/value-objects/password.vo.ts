import bcrypt from 'bcrypt';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

export class Password {
  private constructor(private readonly hash: string) {}

  public static create(plainText: string): Password {
    if (!plainText || plainText.length < 8) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Password must be at least 8 characters long',
      );
    }
    const salt = bcrypt.genSaltSync(12);
    const hash = bcrypt.hashSync(plainText, salt);
    return new Password(hash);
  }

  public static fromHash(hash: string): Password {
    if (!hash) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Password hash is required',
      );
    }
    return new Password(hash);
  }

  public getHash(): string {
    return this.hash;
  }

  public compare(plainText: string): boolean {
    return bcrypt.compareSync(plainText, this.hash);
  }
}
