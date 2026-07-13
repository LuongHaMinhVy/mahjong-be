import { ErrorCode } from '../constants/error-codes';

export class DomainException extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'DomainException';
  }
}

export class NotFoundException extends DomainException {
  constructor(entity: string, id: string) {
    super('NOT_FOUND', `${entity} with id ${id} not found`, 404);
  }
}

export class UnauthorizedException extends DomainException {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ConflictException extends DomainException {
  constructor(message: string, code: ErrorCode = 'VALIDATION_ERROR') {
    super(code, message, 409);
  }
}
