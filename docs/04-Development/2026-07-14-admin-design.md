# Design Document: Admin Module

**Date:** 2026-07-14  
**Author:** Antigravity (AI)  
**Status:** Approved

---

## 1. Mục tiêu & Phạm vi (Goal & Scope)
Thiết lập các tính năng quản trị hệ thống tập trung (`AdminModule`) dành cho nhà phát triển/quản trị viên, bao gồm:
* Quản lý tài khoản người chơi (Xem danh sách, chỉnh sửa ELO, khóa tài khoản tạm thời hoặc vĩnh viễn).
* Giám sát danh sách phòng đấu đang chờ/đang chơi thời gian thực và cưỡng ép giải phóng/đóng phòng khi xảy ra sự cố.
* Giám sát hàng đợi Matchmaking và vé ghép trận (Match Tickets) hiện tại.

---

## 2. Thay đổi Cơ sở dữ liệu (Postgres Schema)
Cập nhật bảng `User` trong Prisma schema để hỗ trợ lưu trữ mốc thời gian khóa tài khoản:

```prisma
// prisma/schema.prisma
model User {
  id              String         @id @default(uuid())
  email           String         @unique
  passwordHash    String         @map("password_hash")
  displayName     String         @map("display_name")
  avatar          String?
  elo             Int            @default(1000)
  role            String         @default("USER") // USER | ADMIN
  isEmailVerified Boolean        @default(false) @map("is_email_verified")
  bannedUntil     DateTime?      @map("banned_until") // Null hoặc quá khứ = bình thường; Tương lai = Banned
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")
  refreshTokens   RefreshToken[]
  gameResults     GameResult[]   @relation("WinnerRelation")

  @@map("users")
}
```

---

## 3. Phân quyền và Bảo mật (Authentication & Authorization)
Để hạn chế việc truy cập trái phép, tất cả các API quản trị đều cần xác thực và phân quyền.

### 3.1 Roles Decorator
Tạo decorator để gán quyền yêu cầu cho từng route:
```typescript
// src/shared/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

### 3.2 RolesGuard & Check Banned Status
Tạo `RolesGuard` để kết hợp đọc thông tin vai trò từ JWT và kiểm tra trạng thái khóa của người dùng:
1. Đọc metadata `roles` bằng `Reflector`.
2. Kiểm tra xem người dùng hiện tại có vai trò tương ứng hay không.
3. Đồng thời, đối với **mọi request của tất cả người dùng (qua REST hoặc WebSocket)**, nếu tài khoản đang bị khóa (`user.bannedUntil > new Date()`), hệ thống sẽ lập tức chặn lại và ném lỗi `ForbiddenException` hoặc `WsException` tương ứng.

---

## 4. Kiến trúc AdminModule
Thiết kế theo **Feature-Based Clean Architecture**:

```text
src/modules/admin/
├── application/
│   └── use-cases/
│       ├── admin-get-users.use-case.ts       # Xem danh sách người chơi
│       ├── admin-ban-user.use-case.ts         # Khóa/Mở khóa người chơi
│       ├── admin-update-elo.use-case.ts       # Chỉnh sửa ELO thủ công
│       ├── admin-get-rooms.use-case.ts        # Xem danh sách phòng online
│       ├── admin-force-close-room.use-case.ts # Giải phóng phòng đấu bị kẹt
│       ├── admin-get-matchmaking.use-case.ts  # Giám sát queue ghép trận
│       └── admin-cancel-ticket.use-case.ts    # Hủy vé ghép trận bị kẹt
├── presentation/
│   ├── controllers/
│   │   └── admin.controller.ts                # REST API endpoints cho admin
│   └── dto/
│       ├── ban-user.dto.ts
│       ├── update-elo.dto.ts
│       └── query-users.dto.ts
└── admin.module.ts
```

---

## 5. Danh sách API Endpoints

Tất cả các API đều bắt đầu với tiền tố `/admin` và được bảo vệ bởi `@UseGuards(JwtAuthGuard, RolesGuard)` và `@Roles('ADMIN')`:

1. **GET `/admin/users`**
   * **Query:** `page?: number`, `limit?: number`, `search?: string`
   * **Trả về:** Phân trang danh sách users cùng trạng thái `bannedUntil`.

2. **POST `/admin/users/:id/ban`**
   * **Body:** `{ durationHours: number | null }` (nếu truyền `null` hoặc `<= 0` sẽ thực hiện unban).
   * **Mô tả:** Đặt giá trị `bannedUntil` của user bằng `new Date() + durationHours`.

3. **PATCH `/admin/users/:id/elo`**
   * **Body:** `{ elo: number }`
   * **Mô tả:** Đặt điểm ELO mới cho user trong database.

4. **GET `/admin/rooms`**
   * **Trả về:** Danh sách tất cả các phòng chơi hiện tại (lấy trực tiếp từ cơ sở dữ liệu/Redis thông qua RoomRepository).

5. **DELETE `/admin/rooms/:id`**
   * **Mô tả:** Cưỡng ép giải tán phòng chơi và cập nhật danh sách phòng của sảnh đấu (Lobby).

6. **GET `/admin/matchmaking`**
   * **Trả về:** Tình trạng hàng đợi Redis (số lượng player của từng loại luật mạt chược) và các Match Tickets hiện có.

7. **DELETE `/admin/matchmaking/tickets/:id`**
   * **Mô tả:** Xóa Match Ticket khỏi Redis để giải thoát những người chơi bị kẹt trạng thái "đang tìm trận".
