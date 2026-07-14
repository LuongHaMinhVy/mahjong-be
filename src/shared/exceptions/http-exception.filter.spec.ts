import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { GlobalExceptionFilter } from './http-exception.filter.js';
import { I18nService } from '../i18n/i18n.service.js';
import { DomainException } from './domain.exception.js';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let i18nService: any;

  beforeEach(async () => {
    i18nService = {
      translate: jest.fn((key: string, args?: any) => {
        if (key === 'errors.NOT_FOUND') {
          return `Không tìm thấy ${args?.resource || ''}`;
        }
        if (key === 'validation.isEmail') {
          return 'Email không đúng định dạng';
        }
        if (key === 'errors.UNAUTHORIZED') {
          return 'Không có quyền truy cập';
        }
        return key;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlobalExceptionFilter,
        { provide: I18nService, useValue: i18nService },
      ],
    }).compile();

    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);
  });

  const createMockArgumentsHost = (): { host: ArgumentsHost; responseMock: any } => {
    const responseMock = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const host = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(responseMock),
      }),
    } as unknown as ArgumentsHost;
    return { host, responseMock };
  };

  it('should translate and format DomainException', () => {
    const { host, responseMock } = createMockArgumentsHost();
    const exception = new DomainException('NOT_FOUND', 'User not found', 404, { resource: 'User' });

    filter.catch(exception, host);

    expect(i18nService.translate).toHaveBeenCalledWith('errors.NOT_FOUND', { resource: 'User' });
    expect(responseMock.status).toHaveBeenCalledWith(404);
    expect(responseMock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Không tìm thấy User',
      }),
    );
  });

  it('should translate and format HttpException with a string message', () => {
    const { host, responseMock } = createMockArgumentsHost();
    const exception = new HttpException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);

    filter.catch(exception, host);

    expect(i18nService.translate).toHaveBeenCalledWith('errors.UNAUTHORIZED');
    expect(responseMock.status).toHaveBeenCalledWith(401);
    expect(responseMock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'HTTP_ERROR',
        message: 'Không có quyền truy cập',
      }),
    );
  });

  it('should translate and format HttpException with an array of messages (e.g. Validation Errors)', () => {
    const { host, responseMock } = createMockArgumentsHost();
    const exception = new HttpException(
      { message: ['isEmail', 'some_unknown_validation_key'] },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    expect(i18nService.translate).toHaveBeenCalledWith('errors.isEmail');
    expect(i18nService.translate).toHaveBeenCalledWith('validation.isEmail');
    expect(responseMock.status).toHaveBeenCalledWith(400);
    expect(responseMock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'HTTP_ERROR',
        message: ['Email không đúng định dạng', 'some_unknown_validation_key'],
      }),
    );
  });

  it('should handle and format fallback internal server error for unhandled exception types', () => {
    const { host, responseMock } = createMockArgumentsHost();
    const exception = new Error('Some unexpected internal DB crash');

    filter.catch(exception, host);

    expect(responseMock.status).toHaveBeenCalledWith(500);
    expect(responseMock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      }),
    );
  });
});
