# i18n and Error Response Standardisation Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Xây dựng hệ thống đa ngôn ngữ (i18n) cho 4 ngôn ngữ (vi, en, ja, zh) sử dụng AsyncLocalStorage, quản lý cấu hình ngôn ngữ qua bảng `UserSetting` riêng biệt, chia nhỏ từ điển dịch theo chủ đề (errors, validation, notifications, game, email) và chuẩn hóa cấu trúc lỗi trả về của API NestJS.

**Architecture:** 
1. Database & Domain: Tách biệt cấu hình người dùng ra bảng `UserSetting` liên kết 1-1 với `User`. Thực thể `User` chứa thực thể con `UserSettings`.
2. Locales Modularization: Chia nhỏ tệp ngôn ngữ tĩnh thành các tệp chuyên biệt dưới thư mục `src/shared/i18n/locales/[lang]/`.
3. Context & Middleware: Sử dụng Node.js `AsyncLocalStorage` trong `I18nContext`. `I18nMiddleware` xác định ngôn ngữ từ Query -> User Settings (nếu đăng nhập) -> Header `Accept-Language` -> Fallback (`vi`).
4. Exception & Validation: Tích hợp dịch lỗi validation Key-Value và dịch các Exception tự động trong `GlobalExceptionFilter`.

**Tech Stack:** NestJS, TypeScript, Node.js AsyncLocalStorage, Jest, Prisma.

---

### Task 1: Refactor Database Schema and User Domain Entity to support UserSetting

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/modules/auth/domain/user.entity.ts`
- Modify: `src/modules/auth/infrastructure/repositories/user.mapper.ts`
- Modify: `src/modules/auth/infrastructure/repositories/prisma-user.repository.ts`
- Modify: `src/modules/users/application/use-cases/update-user-profile.use-case.ts`
- Modify: `src/modules/users/application/use-cases/get-user-profile.use-case.ts`
- Modify: `src/modules/users/presentation/dto/update-profile.dto.ts`
- Test: `src/modules/auth/domain/user.entity.spec.ts`

**Step 1: Write the failing test**
Cập nhật `src/modules/auth/domain/user.entity.spec.ts` để kiểm thử cấu trúc thực thể `User` chứa thuộc tính `settings` (thay vì trực tiếp `locale`), hỗ trợ cập nhật và kiểm tra tính hợp lệ của locale.
```typescript
import { User } from './user.entity.js';
import { Email } from './value-objects/email.vo.js';
import { Password } from './value-objects/password.vo.js';

describe('User Entity Settings', () => {
  it('should initialize with default settings', () => {
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
    expect(user.settings.locale).toBe('vi');
    expect(user.settings.soundEnabled).toBe(true);
  });

  it('should allow updating settings and validate locale', () => {
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

    user.settings.updateLocale('en');
    expect(user.settings.locale).toBe('en');

    user.settings.updateSoundEnabled(false);
    expect(user.settings.soundEnabled).toBe(false);

    expect(() => user.settings.updateLocale('invalid')).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- src/modules/auth/domain/user.entity.spec.ts`
Expected: FAIL (lỗi biên dịch hoặc thiếu thuộc tính settings)

**Step 3: Write minimal implementation**
1. Cập nhật `prisma/schema.prisma`:
   * Xóa cột `locale` khỏi `User`.
   * Thêm bảng `UserSetting`:
     ```prisma
     model UserSetting {
       id           String  @id @default(uuid())
       userId       String  @unique @map("user_id")
       locale       String  @default("vi")
       soundEnabled Boolean @default(true) @map("sound_enabled")
       user         User    @relation(fields: [userId], references: [id], onDelete: Cascade)

       @@map("user_settings")
     }
     ```
   * Chạy migration bằng lệnh: `pnpm prisma migrate dev --name add_user_settings`
2. Tạo file `src/modules/auth/domain/user-settings.ts` chứa lớp cấu hình:
   ```typescript
   import { DomainException } from '../../../shared/exceptions/domain.exception.js';

   export interface UserSettingsProps {
     locale: string;
     soundEnabled: boolean;
   }

   export class UserSettings {
     private _locale: string;
     private _soundEnabled: boolean;

     constructor(props: UserSettingsProps) {
       this._locale = props.locale;
       this._soundEnabled = props.soundEnabled;
     }

     get locale(): string { return this._locale; }
     get soundEnabled(): boolean { return this._soundEnabled; }

     updateLocale(locale: string): void {
       if (!['vi', 'en', 'ja', 'zh'].includes(locale)) {
         throw new DomainException('VALIDATION_ERROR', 'Invalid locale');
       }
       this._locale = locale;
     }

     updateSoundEnabled(enabled: boolean): void {
       this._soundEnabled = enabled;
     }
   }
   ```
3. Cập nhật `src/modules/auth/domain/user.entity.ts`:
   * Import `UserSettings` và tích hợp `settings` vào `UserProps`.
   * Khởi tạo `this._settings = new UserSettings(props.settings || { locale: 'vi', soundEnabled: true });`
4. Cập nhật `UserMapper` và `PrismaUserRepository` để xử lý lưu/nạp liên kết `settings` (dùng Prisma transactions hoặc `upsert` khi lưu User).
5. Cập nhật `UpdateUserProfileUseCase`, `GetUserProfileUseCase` và các DTO tương ứng của Module `users`.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- src/modules/auth/domain/user.entity.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat: refactor database and domain user entity to use UserSetting table"
```

---

### Task 2: Create Modular Translation Dictionaries

**Files:**
- Create: `src/shared/i18n/locales/vi/errors.ts`
- Create: `src/shared/i18n/locales/vi/validation.ts`
- Create: `src/shared/i18n/locales/vi/notifications.ts`
- Create: `src/shared/i18n/locales/vi/game.ts`
- Create: `src/shared/i18n/locales/vi/email.ts`
- (Và tương tự cho các thư mục ngôn ngữ `en`, `ja`, `zh`)
- Create: `src/shared/i18n/locales/vi.ts` (gộp toàn bộ vi/*.ts)
- Create: `src/shared/i18n/locales/en.ts` (gộp toàn bộ en/*.ts)
- Create: `src/shared/i18n/locales/ja.ts` (gộp toàn bộ ja/*.ts)
- Create: `src/shared/i18n/locales/zh.ts` (gộp toàn bộ zh/*.ts)
- Create: `src/shared/i18n/locales/index.ts`
- Test: `src/shared/i18n/locales/locales.spec.ts`

**Step 1: Write the failing test**
Tạo file kiểm thử `src/shared/i18n/locales/locales.spec.ts` để kiểm tra độ đồng nhất cấu trúc keys của 4 bộ từ điển tĩnh.
```typescript
import { locales } from './index.js';

describe('Locales Dictionary Consistency', () => {
  it('should have identical key structures across all languages', () => {
    const keysVi = getDeepKeys(locales.vi);
    const keysEn = getDeepKeys(locales.en);
    const keysJa = getDeepKeys(locales.ja);
    const keysZh = getDeepKeys(locales.zh);

    expect(keysEn).toEqual(keysVi);
    expect(keysJa).toEqual(keysVi);
    expect(keysZh).toEqual(keysVi);
  });
});

function getDeepKeys(obj: any, prefix = ''): string[] {
  return Object.keys(obj).reduce((res: string[], el) => {
    if (Array.isArray(obj[el])) {
      return [...res, prefix + el];
    } else if (typeof obj[el] === 'object' && obj[el] !== null) {
      return [...res, ...getDeepKeys(obj[el], prefix + el + '.')];
    }
    return [...res, prefix + el];
  }, []).sort();
}
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- src/shared/i18n/locales/locales.spec.ts`
Expected: FAIL (chưa có thư mục và tệp tin index.ts)

**Step 3: Write minimal implementation**
1. Tạo thư mục `src/shared/i18n/locales/` và viết các tệp tĩnh con cho từng ngôn ngữ (`errors.ts`, `validation.ts`, `notifications.ts`, `game.ts`, `email.ts`).
2. Viết các tệp chính `vi.ts`, `en.ts`, `ja.ts`, `zh.ts` để import và gộp các tệp con lại thành một object duy nhất cho từng ngôn ngữ.
3. Tạo `index.ts` để tập hợp và export `locales` map của cả 4 ngôn ngữ, kèm kiểu dữ liệu `LocaleType` và `TranslationKeys`.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- src/shared/i18n/locales/locales.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat: create modular i18n translation dictionaries for vi, en, ja, zh"
```

---

### Task 3: Implement I18nContext and I18nService

**Files:**
- Create/Modify: `src/shared/i18n/i18n.context.ts`
- Create/Modify: `src/shared/i18n/i18n.service.ts`
- Test: `src/shared/i18n/i18n.service.spec.ts`

**Step 1: Write the failing test**
`src/shared/i18n/i18n.service.spec.ts`:
```typescript
import { I18nService } from './i18n.service.js';
import { I18nContext } from './i18n.context.js';

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    service = new I18nService();
  });

  it('should translate key with fallback to vi', () => {
    I18nContext.run('en', () => {
      expect(service.translate('errors.INTERNAL_ERROR')).toBe('Internal server error');
    });

    I18nContext.run('vi', () => {
      expect(service.translate('errors.INTERNAL_ERROR')).toBe('Lỗi hệ thống nội bộ');
    });
  });

  it('should interpolate dynamic arguments', () => {
    I18nContext.run('vi', () => {
      const result = service.translate('errors.NOT_FOUND', { entity: 'Người dùng', id: '123' });
      expect(result).toBe('Không tìm thấy Người dùng với ID 123');
    });
  });

  it('should translate game and notifications keys', () => {
    I18nContext.run('vi', () => {
      expect(service.translate('game.ruleset.RIICHI')).toBe('Riichi Mahjong');
      const notify = service.translate('notifications.playerJoined', { username: 'Vy' });
      expect(notify).toBe('Người chơi Vy đã tham gia phòng');
    });
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- src/shared/i18n/i18n.service.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
1. Implement `I18nContext` sử dụng `AsyncLocalStorage` để lưu trữ locale của request.
2. Implement `I18nService` hỗ trợ tra cứu key dạng dot-notation (ví dụ: `game.tiles.wind.east`), thay thế tham số động `{param}`, và tự động fallback sang tiếng Việt (`vi`) nếu không tìm thấy cấu hình ở ngôn ngữ hiện tại.

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

**Step 1: Implement Middleware and its mock logic**
Viết `I18nMiddleware` thực hiện giải quyết ngôn ngữ ưu tiên:
1. Đọc query params: `?lang=` hoặc `?locale=`.
2. Đọc JWT của user (nếu có header `Authorization`) -> lấy `userId` -> query bảng `UserSetting` để lấy locale cài đặt của User.
3. Đọc Header `Accept-Language`.
4. Mặc định fallback về `'vi'`.
Sau đó chạy request trong context: `I18nContext.run(locale, () => next())`.

**Step 2: Register globally**
Đăng ký middleware trong `AppModule` áp dụng cho tất cả routes (`*`).

**Step 3: Run project build check**
Run: `pnpm run build`
Expected: SUCCESS

**Step 4: Commit**
```bash
git add .
git commit -m "feat: implement I18nMiddleware and register it globally in AppModule"
```

---

### Task 5: Standardise Validation Errors in ValidationPipe

**Files:**
- Modify: `src/main.ts`

**Step 1: Modify ValidationPipe exceptionFactory**
Cập nhật cấu hình của `ValidationPipe` trong `main.ts` để gom các constraint lỗi theo dạng Key-Value (ví dụ: `errors: { email: ["validation.isEmail"] }`) thay vì trả ra thông báo lỗi thô mặc định.

**Step 2: Verify Build and Tests**
Run: `pnpm run build`
Expected: SUCCESS

**Step 3: Commit**
```bash
git add .
git commit -m "feat: standardise ValidationPipe exceptionFactory output to translate-friendly Key-Value format"
```

---

### Task 6: Update GlobalExceptionFilter to Translate Messages

**Files:**
- Modify: `src/shared/exceptions/http-exception.filter.ts`
- Modify: `src/shared/exceptions/http-exception.filter.spec.ts`

**Step 1: Write the failing test**
Cập nhật `http-exception.filter.spec.ts` kiểm thử khả năng tích hợp dịch tự động của `GlobalExceptionFilter` khi ném ra `DomainException` chứa mã lỗi động, hoặc khi nhận lỗi validation Key-Value từ ValidationPipe.

**Step 2: Run test to verify it fails**
Run: `pnpm test -- src/shared/exceptions/http-exception.filter.spec.ts`
Expected: FAIL

**Step 3: Update GlobalExceptionFilter**
Tích hợp `I18nService` vào `GlobalExceptionFilter`. Khi bắt được lỗi:
* Lỗi Domain: Gọi `i18nService.translate('errors.' + code, args)`.
* Lỗi Validation: Lặp qua các mã lỗi validation Key-Value và dịch tương ứng qua `i18nService.translate()`.
* Đăng ký filter qua `APP_FILTER` trong `AppModule` để NestJS tự inject dependency.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- src/shared/exceptions/http-exception.filter.spec.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "feat: integrate I18nService with GlobalExceptionFilter for automatic translation of responses"
```
