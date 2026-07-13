# Thiết kế Hệ thống: Google OAuth2 Authentication

## 1. Tổng quan
Tài liệu này mô tả thiết kế và luồng xử lý của tính năng đăng nhập/đăng ký bằng tài khoản Google (OAuth2) cho dự án Mahjong Online.

## 2. Mục tiêu & Yêu cầu
* Hỗ trợ xác thực bằng Google ID Token từ phía client gửi lên.
* Tự động liên kết tài khoản nếu email của Google trùng khớp với email đã đăng ký bằng mật khẩu trước đó.
* Đăng ký tài khoản tự động với mật khẩu ngẫu nhiên an toàn nếu người dùng chưa có tài khoản, sau đó cho phép đăng nhập trực tiếp.
* Tuân thủ kiến trúc Clean Architecture của dự án.
* Sử dụng module hệ thống ESM (ECMAScript Modules).

## 3. Kiến trúc các lớp (Clean Architecture)

### 3.1. Domain Layer
* **`IGoogleAuthService`**: Khai báo interface port dùng để verify Google ID Token.
```typescript
export interface GoogleUserPayload {
  email: string;
  displayName: string;
  avatar: string | null;
}

export abstract class IGoogleAuthService {
  abstract verifyToken(idToken: string): Promise<GoogleUserPayload>;
}
```

### 3.2. Infrastructure Layer
* **`GoogleAuthService`**: Implement `IGoogleAuthService` sử dụng thư viện `google-auth-library` của Google.
* **Cấu hình**: Cần thêm `GOOGLE_CLIENT_ID` vào file `.env`.

### 3.3. Application Layer
* **`GoogleLoginUseCase`**:
  1. Xác thực Google `idToken` thông qua `IGoogleAuthService`.
  2. Tìm kiếm `User` bằng `email`.
  3. Nếu tìm thấy: verify email (nếu chưa verify) và lưu lại.
  4. Nếu chưa có: Tạo user mới với mật khẩu ngẫu nhiên an toàn (được hash qua `Password.create`), lưu mới vào database.
  5. Gọi `SessionService` sinh bộ đôi Access Token & Refresh Token.

### 3.4. Presentation Layer
* **`GoogleLoginDto`**: Validation đầu vào cho ID Token gửi từ client.
* **`AuthController.googleLogin`**: Endpoint POST `/auth/google` xử lý request từ client.

## 4. Quy trình xử lý (Data Flow)
1. Client gửi `idToken` lên POST `/auth/google`.
2. Controller gọi `GoogleLoginUseCase`.
3. UseCase gọi `GoogleAuthService.verifyToken` để verify token với API Google.
4. UseCase kiểm tra database qua `IUserRepository`.
5. Tạo hoặc liên kết tài khoản, lưu vào DB qua `PrismaUserRepository`.
6. Sinh token và đặt Cookie HTTP-Only `refresh_token`.
7. Trả về thông tin user và `accessToken`.
