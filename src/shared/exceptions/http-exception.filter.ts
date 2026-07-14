import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainException } from './domain.exception.js';
import { I18nService } from '../i18n/i18n.service.js';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly i18nService: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof DomainException) {
      const translationKey = `errors.${exception.code}`;
      let translatedMessage = this.i18nService.translate(
        translationKey,
        exception.args,
      );
      if (translatedMessage === translationKey) {
        translatedMessage = exception.message;
      }

      response.status(exception.statusCode).json({
        statusCode: exception.statusCode,
        code: exception.code,
        message: translatedMessage,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message: unknown = 'HTTP Error';
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        exceptionResponse &&
        typeof exceptionResponse === 'object' &&
        'message' in exceptionResponse
      ) {
        message = (exceptionResponse as Record<string, unknown>).message;
      }

      let translatedMessage = message;
      if (typeof message === 'string') {
        const errorKey = `errors.${message}`;
        const translatedError = this.i18nService.translate(errorKey);
        if (translatedError !== errorKey) {
          translatedMessage = translatedError;
        } else {
          const valKey = `validation.${message}`;
          const translatedVal = this.i18nService.translate(valKey);
          if (translatedVal !== valKey) {
            translatedMessage = translatedVal;
          }
        }
      } else if (Array.isArray(message)) {
        translatedMessage = message.map((msg: unknown) => {
          if (typeof msg === 'string') {
            const errorKey = `errors.${msg}`;
            const translatedError = this.i18nService.translate(errorKey);
            if (translatedError !== errorKey) {
              return translatedError;
            }
            const valKey = `validation.${msg}`;
            const translatedVal = this.i18nService.translate(valKey);
            if (translatedVal !== valKey) {
              return translatedVal;
            }
          }
          return msg;
        });
      }

      response.status(status).json({
        statusCode: status,
        code: 'HTTP_ERROR',
        message: translatedMessage,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    this.logger.error('Unhandled exception', exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
}
