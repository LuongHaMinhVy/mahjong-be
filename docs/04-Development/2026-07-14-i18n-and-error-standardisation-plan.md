# i18n and Error Response Standardisation Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Xây dựng hệ thống đa ngôn ngữ (i18n) cho 4 ngôn ngữ (vi, en, ja, zh) sử dụng AsyncLocalStorage, chuẩn hóa cấu trúc lỗi trả về của API NestJS (Key-Value cho validation) và dịch động các thông báo lỗi.

**Architecture:** Sử dụng Node.js AsyncLocalStorage để quản lý context ngôn ngữ theo request, I18nService để dịch các mã lỗi tĩnh/động, cấu hình ValidationPipe trả ra lỗi validation Key-Value và viết ExceptionFilter để dịch và format dữ liệu lỗi trước khi trả về.

**Tech Stack:** NestJS, TypeScript, Node.js AsyncLocalStorage, Jest, Prisma.

---

### Task 1: Update User Domain Entity & Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/modules/auth/domain/user.entity.ts`
- Modify: `src/modules/auth/infrastructure/repositories/prisma-user.repository.ts`

**Step 1: Write the failing test**
Thêm thuộc tính `locale` vào User entity test. Do unit test của User Entity trước đó đã bị xóa khỏi git nhưng ta có thể tạo file test mới: `src/modules/auth/domain/user.entity.spec.ts`.
```typescript
import { User } from './user.entity.js';
import { Email } from './value-objects/email.vo.js';
import { Password } from './value-objects/password.vo.js';

describe('User Entity Locale', () => {
  it('should support locale preference and fallback to vi', () => {
    const user = new User({
      id: '1',
      email: new Email('test@example.com'),
      password: Password.fromHash('hash'),
      displayName: 'Test User',
      elo: 1000,
      isEmailVerified: true,
      role: 'USER',
      bannedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(user.locale).toBe('vi');
    
    const userWithEn = new User({
      id: '2',
      email: new Email('en@example.com'),
      password: Password.fromHash('hash'),
      displayName: 'En User',
      elo: 1000,
      isEmailVerified: true,
      role: 'USER',
      bannedUntil: null,
      locale: 'en',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(userWithEn.locale).toBe('en');
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- src/modules/auth/domain/user.entity.spec.ts`
Expected: FAIL (compilation errors / no locale property)

**Step 3: Write minimal implementation**
1. Cập nhật `prisma/schema.prisma`:
```prisma
model User {
  // ...
  role            String         @default("USER")
  locale          String         @default("vi") // en | vi | ja | zh
  isEmailVerified Boolean        @default(false) @map("is_email_verified")
  // ...
}
```
2. Cập nhật `src/modules/auth/domain/user.entity.ts`:
```typescript
export interface UserProps {
  // ...
  role: string;
  locale?: string;
  bannedUntil?: Date | null;
  // ...
}
// Trong class User:
public readonly locale: string;
constructor(props: UserProps) {
  // ...
  this.locale = props.locale || 'vi';
}
```
3. Cập nhật `src/modules/auth/infrastructure/repositories/prisma-user.repository.ts` để map thuộc tính `locale` khi chuyển từ database model sang domain entity.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- src/modules/auth/domain/user.entity.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat: add locale field to User domain entity and prisma schema"
```

---

### Task 2: Create Translation Dictionaries

**Files:**
- Create: `src/shared/i18n/translations/vi.ts`
- Create: `src/shared/i18n/translations/en.ts`
- Create: `src/shared/i18n/translations/ja.ts`
- Create: `src/shared/i18n/translations/zh.ts`

**Step 1: Write the dictionaries**
Tạo từ điển dịch thuật dạng tĩnh bằng TypeScript.

`src/shared/i18n/translations/vi.ts`:
```typescript
export const vi = {
  errors: {
    NOT_FOUND: 'Không tìm thấy {entity} với ID {id}',
    UNAUTHORIZED: 'Không có quyền truy cập',
    FORBIDDEN: 'Bạn không có quyền thực hiện hành động này hoặc tài khoản đã bị khóa',
    VALIDATION_ERROR: 'Dữ liệu đầu vào không hợp lệ',
    INTERNAL_ERROR: 'Lỗi hệ thống nội bộ',
  },
  validation: {
    isEmail: '{property} phải là địa chỉ email hợp lệ',
    isNotEmpty: '{property} không được để trống',
    minLength: '{property} phải dài ít nhất {constraints.0} ký tự',
    isInt: '{property} phải là số nguyên',
  }
};
```

`src/shared/i18n/translations/en.ts`:
```typescript
export const en = {
  errors: {
    NOT_FOUND: '{entity} with ID {id} not found',
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Forbidden action or account is banned',
    VALIDATION_ERROR: 'Invalid input data',
    INTERNAL_ERROR: 'Internal server error',
  },
  validation: {
    isEmail: '{property} must be a valid email address',
    isNotEmpty: '{property} must not be empty',
    minLength: '{property} must be at least {constraints.0} characters',
    isInt: '{property} must be an integer',
  }
};
```

`src/shared/i18n/translations/ja.ts` (Japanese) và `src/shared/i18n/translations/zh.ts` (Chinese) có cấu trúc tương tự.

**Step 2: Commit**
```bash
git add .
git commit -m "feat: create translations dictionary for vi, en, ja, zh"
```

---

### Task 3: Implement I18nContext and I18nService

**Files:**
- Create: `src/shared/i18n/i18n.context.ts`
- Create: `src/shared/i18n/i18n.service.ts`
- Create: `src/shared/i18n/i18n.service.spec.ts`

**Step 1: Write the failing test**
`src/shared/i18n/i18n.service.spec.ts`:
```typescript
import { jest } from '@jest/globals';
import { I18nService } from './i18n.service.js';
import { I18nContext } from './i18n.context.js';

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    service = new I18nService();
  });

  it('should translate key with fallback to vi', () => {
    I18nContext.setLocale('en');
    expect(service.translate('errors.INTERNAL_ERROR')).toBe('Internal server error');

    I18nContext.setLocale('vi');
    expect(service.translate('errors.INTERNAL_ERROR')).toBe('Lỗi hệ thống nội bộ');
  });

  it('should interpolate dynamic arguments', () => {
    I18nContext.setLocale('vi');
    const result = service.translate('errors.NOT_FOUND', { entity: 'Người dùng', id: '123' });
    expect(result).toBe('Không tìm thấy Người dùng với ID 123');
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- src/shared/i18n/i18n.service.spec.ts`
Expected: FAIL (files do not exist)

**Step 3: Write minimal implementation**
1. `src/shared/i18n/i18n.context.ts`:
```typescript
import { AsyncLocalStorage } from 'async_hooks';

export interface I18nStore {
  locale: string;
}

export class I18nContext {
  private static readonly storage = new AsyncLocalStorage<I18nStore>();

  static getStore(): I18nStore | undefined {
    return this.storage.getStore();
  }

  static getLocale(): string {
    return this.getStore()?.locale || 'vi';
  }

  static setLocale(locale: string): void {
    const store = this.getStore();
    if (store) {
      store.locale = locale;
    }
  }

  static run(locale: string, callback: () => void): void {
    this.storage.run({ locale }, callback);
  }
}
```

2. `src/shared/i18n/i18n.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { I18nContext } from './i18n.context.js';
import { vi } from './translations/vi.js';
import { en } from './translations/en.js';
import { ja } from './translations/ja.js';
import { zh } from './translations/zh.js';

@Injectable()
export class I18nService {
  private readonly dictionaries: Record<string, any> = { vi, en, ja, zh };

  translate(key: string, args?: Record<string, string>): string {
    const locale = I18nContext.getLocale();
    const dictionary = this.dictionaries[locale] || this.dictionaries['vi'];

    let message = this.getNestedValue(dictionary, key);
    if (!message && locale !== 'vi') {
      message = this.getNestedValue(this.dictionaries['vi'], key);
    }

    if (!message) {
      return key;
    }

    if (args) {
      Object.entries(args).forEach(([k, v]) => {
        message = message.replace(new RegExp(`{${k}}`, 'g'), v);
      });
    }

    return message;
  }

  private getNestedValue(obj: any, path: string): string | undefined {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test -- src/shared/i18n/i18n.service.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat: implement I18nContext and I18nService with tests"
```

---

### Task 4: Implement I18nMiddleware & Register Globally

**Files:**
- Create: `src/shared/i18n/i18n.middleware.ts`
- Modify: `src/app.module.ts`

**Step 1: Implement Middleware**
`src/shared/i18n/i18n.middleware.ts`:
```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { I18nContext } from './i18n.context.js';
import { IUserRepository } from '../../modules/auth/domain/user.repository.js';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class I18nMiddleware implements NestMiddleware {
  constructor(private readonly userRepository: IUserRepository) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let locale = 'vi';

    // 1. Check query param
    const queryLang = req.query.lang || req.query.locale;
    if (typeof queryLang === 'string' && ['vi', 'en', 'ja', 'zh'].includes(queryLang)) {
      locale = queryLang;
    } else {
      // 2. Check JWT / User Profile locale
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const decoded = jwt.decode(token) as { sub: string } | null;
          if (decoded && decoded.sub) {
            const user = await this.userRepository.findById(decoded.sub);
            if (user && user.locale) {
              locale = user.locale;
            }
          }
        } catch {
          // Ignore jwt decode error
        }
      }

      // 3. Check Accept-Language header
      if (locale === 'vi') {
        const acceptLanguage = req.headers['accept-language'];
        if (typeof acceptLanguage === 'string') {
          const preferred = acceptLanguage.split(',')[0].split(';')[0].toLowerCase();
          const mapped = preferred.substring(0, 2);
          if (['vi', 'en', 'ja', 'zh'].includes(mapped)) {
            locale = mapped;
          }
        }
      }
    }

    I18nContext.run(locale, () => {
      next();
    });
  }
}
```

**Step 2: Register Middleware in AppModule**
`src/app.module.ts`:
```typescript
import { NestModule, MiddlewareConsumer } from '@nestjs/common';
import { I18nMiddleware } from './shared/i18n/i18n.middleware.js';
// ...
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(I18nMiddleware)
      .forRoutes('*');
  }
}
```

**Step 3: Run project build check**
Run: `pnpm run build`
Expected: SUCCESS

**Step 4: Commit**
```bash
git add .
git commit -m "feat: implement I18nMiddleware and integrate it globally in AppModule"
```

---

### Task 5: Standardise Validation Errors in ValidationPipe

**Files:**
- Modify: `src/main.ts`

**Step 1: Modify ValidationPipe exceptionFactory**
Cấu hình exceptionFactory của ValidationPipe để định dạng lại ValidationError thành Key-Value keys:
`src/main.ts`:
```typescript
import { BadRequestException, ValidationPipe } from '@nestjs/common';
// ...
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (validationErrors) => {
      const errors: Record<string, string[]> = {};
      validationErrors.forEach((err) => {
        errors[err.property] = Object.keys(err.constraints || {}).map(
          (constraintKey) => `validation.${constraintKey}`
        );
      });
      return new BadRequestException({
        code: 'VALIDATION_ERROR',
        errors,
      });
    },
  }),
);
```

**Step 2: Verify Build and Tests**
Run: `pnpm run build`
Run: `pnpm test`
Expected: SUCCESS

**Step 3: Commit**
```bash
git add .
git commit -m "feat: standardise ValidationPipe exceptionFactory output"
```

---

### Task 6: Update GlobalExceptionFilter to Translate Messages

**Files:**
- Modify: `src/shared/exceptions/http-exception.filter.ts`
- Modify: `src/shared/exceptions/http-exception.filter.spec.ts`

**Step 1: Write the failing test**
`src/shared/exceptions/http-exception.filter.spec.ts`:
```typescript
import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { GlobalExceptionFilter } from './http-exception.filter.js';
import { I18nService } from '../i18n/i18n.service.js';
import { I18nContext } from '../i18n/i18n.context.js';
import { DomainException } from './domain.exception.js';
import { ArgumentsHost, HttpStatus } from '@nestjs/common';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let i18nService: I18nService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlobalExceptionFilter,
        {
          provide: I18nService,
          useValue: {
            translate: jest.fn().mockImplementation((key: string, args?: any) => {
              if (key === 'errors.NOT_FOUND') return `Không tìm thấy ${args?.entity}`;
              if (key === 'validation.isEmail') return 'Định dạng email sai';
              return key;
            }),
          },
        },
      ],
    }).compile();

    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);
    i18nService = module.get<I18nService>(I18nService);
  });

  const createMockArgumentsHost = (responseJson: jest.Mock): ArgumentsHost => {
    const getResponse = jest.fn().mockReturnValue({
      status: jest.fn().mockReturnThis(),
      json: responseJson,
    });
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse,
        getRequest: jest.fn().mockReturnValue({ url: '/test-path' }),
      }),
    } as unknown as ArgumentsHost;
  };

  it('should translate and format DomainException', () => {
    const jsonMock = jest.fn();
    const host = createMockArgumentsHost(jsonMock);
    const exception = new DomainException('NOT_FOUND', 'Not Found', 404, { entity: 'User' });

    filter.catch(exception, host);

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Không tìm thấy User',
        path: '/test-path',
      })
    );
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- src/shared/exceptions/http-exception.filter.spec.ts`
Expected: FAIL (files do not exist or translation is not integrated yet)

**Step 3: Update GlobalExceptionFilter**
Đăng ký `I18nService` vào `GlobalExceptionFilter` và thực hiện dịch:
`src/shared/exceptions/http-exception.filter.ts`:
```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger, Inject } from '@nestjs/common';
import { Response, Request } from 'express';
import { DomainException } from './domain.exception.js';
import { I18nService } from '../i18n/i18n.service.js';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly i18nService: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const path = request.url;

    if (exception instanceof DomainException) {
      const translatedMsg = this.i18nService.translate(`errors.${exception.code}`, exception.args);
      response.status(exception.statusCode).json({
        success: false,
        statusCode: exception.statusCode,
        code: exception.code,
        message: translatedMsg,
        timestamp: new Date().toISOString(),
        path,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;

      let code = 'HTTP_ERROR';
      let message = 'HTTP Error';
      let errors: Record<string, string[]> | undefined = undefined;

      if (exceptionResponse && typeof exceptionResponse === 'object') {
        code = exceptionResponse.code || 'HTTP_ERROR';
        if (exceptionResponse.errors) {
          // Lỗi Validation
          errors = {};
          Object.entries(exceptionResponse.errors).forEach(([field, constraintKeys]) => {
            errors![field] = (constraintKeys as string[]).map((key) =>
              this.i18nService.translate(key, { property: field })
            );
          });
          message = this.i18nService.translate('errors.VALIDATION_ERROR');
        } else {
          message = exceptionResponse.message || 'HTTP Error';
        }
      }

      response.status(status).json({
        success: false,
        statusCode: status,
        code,
        message,
        ...(errors ? { errors } : {}),
        timestamp: new Date().toISOString(),
        path,
      });
      return;
    }

    this.logger.error('Unhandled exception', exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: this.i18nService.translate('errors.INTERNAL_ERROR'),
      timestamp: new Date().toISOString(),
      path,
    });
  }
}
```

*Lưu ý:* Ta cần import `I18nService` vào `GlobalExceptionFilter`. Vì Filter này được đăng ký toàn cục trong `main.ts`, ta có thể đăng ký nó ở mức Module hoặc truyền `I18nService` vào `new GlobalExceptionFilter` trong `main.ts`. Để đơn giản, ta có thể đăng ký `GlobalExceptionFilter` là một global provider bằng `APP_FILTER` trong `AppModule` để NestJS tự động inject `I18nService`.

Cập nhật `src/app.module.ts`:
```typescript
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './shared/exceptions/http-exception.filter.js';
// ...
providers: [
  {
    provide: APP_FILTER,
    useClass: GlobalExceptionFilter,
  },
  // ...
]
```

Xóa `app.useGlobalFilters(new GlobalExceptionFilter())` cũ khỏi `src/main.ts`.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- src/shared/exceptions/http-exception.filter.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat: integrate I18nService with GlobalExceptionFilter and test"
```
