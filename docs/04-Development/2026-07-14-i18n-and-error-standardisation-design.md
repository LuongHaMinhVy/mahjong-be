# Design Document: i18n and Error Response Standardisation

**Date:** 2026-07-14  
**Author:** Antigravity (AI)  
**Status:** Approved

---

## 1. Mục tiêu & Phạm vi (Goal & Scope)
Thiết lập hệ thống đa ngôn ngữ (i18n) nhẹ và chuẩn hóa cấu trúc lỗi trả về (Error Response) cho hệ thống backend NestJS của Game Mahjong:
*   **Hỗ trợ 4 ngôn ngữ:** Tiếng Anh (`en`), Tiếng Việt (`vi`), Tiếng Nhật (`ja`), Tiếng Trung (`zh`).
*   **Quyết định Ngôn ngữ (Language Resolution):** Ưu tiên cấu hình User Profile > Header `Accept-Language` > Fallback mặc định (`vi`).
*   **Kiến trúc Đa Ngôn Ngữ:** Sử dụng Node.js `AsyncLocalStorage` để lưu trữ ngôn ngữ của request hiện tại mà không làm ảnh hưởng đến các lớp Clean Architecture (Domain/Application).
*   **Chuẩn hóa Lỗi (Standardised Errors):** Định dạng phản hồi lỗi thống nhất dạng JSON với đầy đủ thông tin mã lỗi (`code`), đường dẫn (`path`), thời gian (`timestamp`), thông báo được dịch (`message`) và phân rã lỗi validation theo dạng Key-Value (tên trường nhập liệu -> danh sách lỗi chi tiết).

---

## 2. Thiết kế Cơ sở Dữ liệu & Domain
1.  **Bảng UserSetting (Prisma & Domain):**
    *   Tạo bảng `UserSetting` riêng biệt liên kết 1-1 với bảng `User`.
    *   Bảng `UserSetting` bao gồm các trường: `id`, `userId` (unique), `locale` (mặc định là `'vi'`), và `soundEnabled` (mặc định là `true`).
    *   Thực thể Domain `User` sẽ có thuộc tính `settings` kiểu `UserSettings` chứa cấu hình này, tách biệt phần Identity của User với phần cấu hình UI/Game settings.

---

## 3. Quản lý Context Ngôn ngữ (Language Context)
Chúng ta sẽ tạo ra một giải pháp không sử dụng thư viện cồng kềnh, hoạt động qua `AsyncLocalStorage` để lưu trữ Locale động theo từng Request luồng bất đồng bộ.

### 3.1 I18nContext
*   **Đường dẫn:** `src/shared/i18n/i18n.context.ts`
*   Lớp bọc static chứa một thực thể `AsyncLocalStorage<{ locale: string }>` để lấy/đặt ngôn ngữ hiện tại.

### 3.2 I18nMiddleware
*   **Đường dẫn:** `src/shared/i18n/i18n.middleware.ts`
*   Được đăng ký toàn cục trong `AppModule`.
*   Phân tích locale từ:
    1.  **JWT/User Profile:** Parse Header `Authorization` (nếu có) lấy `userId` và truy vấn cơ sở dữ liệu/đọc JWT payload. Nếu JWT payload chứa thông tin locale trực tiếp, hoặc lấy từ cache. (Để tối ưu, ta có thể lưu locale của User vào JWT Payload lúc sinh token, hoặc fallback sang Header nếu chưa đăng nhập).
    2.  **Accept-Language:** Đọc `req.headers['accept-language']` (ưu tiên parser đơn giản để lấy ngôn ngữ hợp lệ đầu tiên).
    3.  **Fallback:** Nếu không có, gán locale mặc định là `vi`.
*   Khởi chạy request trong scope của `AsyncLocalStorage.run()`.

---

## 4. Từ điển Dịch thuật & I18nService
Sử dụng các file TypeScript tĩnh làm từ điển để tăng hiệu năng biên dịch và gỡ lỗi dễ dàng.

### 4.1 Cấu trúc Từ điển
*   **Đường dẫn:** `src/shared/i18n/translations/`
    *   `vi.ts`, `en.ts`, `ja.ts`, `zh.ts` chứa các cụm dịch lồng nhau cho:
        *   `errors.NOT_FOUND`, `errors.VALIDATION_ERROR`, v.v.
        *   `validation.isEmail`, `validation.isNotEmpty`, `validation.min`, v.v.

### 4.2 I18nService
*   **Đường dẫn:** `src/shared/i18n/i18n.service.ts`
*   Thực hiện dịch thuật dựa trên `key` (ví dụ: `'errors.NOT_FOUND'`) và `args` (ví dụ: `{ entity: 'User', id: '1' }`).
*   Tự động thay thế `{param}` động trong chuỗi bản dịch.
*   Cơ chế Fallback: Nếu không tìm thấy Key trong từ điển ngôn ngữ hiện tại, tìm tiếp ở từ điển tiếng Việt (`vi`), nếu vẫn không thấy thì trả về chính `key`.

---

## 5. Chuẩn hóa Lỗi trả về (Standardised Error Response)

### 5.1 Cấu trúc Payload trả về của lỗi (Standardised Payload)
Mọi lỗi trả về cho Client phải tuân thủ schema sau:
```typescript
interface StandardErrorResponse {
  success: false;
  statusCode: number;
  code: string;
  message: string;
  errors?: Record<string, string[]>; // Phân rã lỗi validation theo tên trường nhập liệu
  timestamp: string;
  path: string;
}
```

### 5.2 Xử lý Lỗi Nhập liệu (Validation Errors)
Cập nhật `ValidationPipe` trong `main.ts`:
*   Thay thế `exceptionFactory` mặc định để gom nhóm các constraint lỗi theo từng trường:
    ```json
    {
      "success": false,
      "statusCode": 400,
      "code": "VALIDATION_ERROR",
      "message": "Dữ liệu đầu vào không hợp lệ",
      "errors": {
        "email": ["validation.isEmail"],
        "password": ["validation.isNotEmpty", "validation.minLength"]
      },
      "timestamp": "2026-07-14T13:48:36Z",
      "path": "/api/auth/register"
    }
    ```

### 5.3 Cập nhật GlobalExceptionFilter
*   **Đường dẫn:** `src/shared/exceptions/http-exception.filter.ts`
*   Đọc `I18nService` để dịch `message` chính (ví dụ: `errors.VALIDATION_ERROR`).
*   Dịch đệ quy các mã lỗi trong danh sách `errors` Key-Value của lỗi Validation (ví dụ: `validation.isEmail` -> *"Email không đúng định dạng"*).
*   Đảm bảo dịch các mã lỗi của `DomainException` mang theo `args` động.

---

## 6. Kế hoạch Kiểm thử (Testing Plan)
*   **Unit Tests:**
    *   Viết test cho `I18nService` để kiểm tra khả năng dịch đúng locale, hỗ trợ tham số động và cơ chế fallback.
    *   Viết test cho `I18nMiddleware` kiểm tra thứ tự ưu tiên: Profile > Header > Fallback.
    *   Viết test cho `GlobalExceptionFilter` đảm bảo cấu trúc trả về chuẩn hóa dạng Key-Value và dịch đúng lỗi.
