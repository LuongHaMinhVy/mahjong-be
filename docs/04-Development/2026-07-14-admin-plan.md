# Admin Module Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Xây dựng module Admin độc lập để giám sát, phân quyền, chỉnh sửa ELO, khóa/mở khóa người chơi, quản lý phòng và matchmaking.

**Architecture:** Áp dụng Feature-Based Clean Architecture. Logic phân quyền và kiểm tra Banned tài khoản sẽ được tích hợp thông qua Custom Decorator và RolesGuard toàn cục.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Redis, Socket.io, Jest.

---

### Task 1: Database Migration & Schema Update

**Files:**
- Modify: `prisma/schema.prisma`
- Create: Prisma Migration

**Step 1: Write the schema changes**
Modify `prisma/schema.prisma` to add `bannedUntil` under the `User` model:
```prisma
model User {
  // ...
  bannedUntil     DateTime?      @map("banned_until")
  // ...
}
```

**Step 2: Run migration command**
Run: `pnpm prisma migrate dev --name add_banned_until`
Expected: Database migration applies successfully.

**Step 3: Commit**
```bash
git add prisma/schema.prisma
git commit -m "db: add banned_until to user schema"
```

---

### Task 2: User Entity & Mapper Update

**Files:**
- Modify: `src/modules/auth/domain/user.entity.ts`
- Modify: `src/modules/auth/infrastructure/repositories/user.mapper.ts`
- Test: `src/modules/auth/domain/user.entity.spec.ts` (hoặc test tương ứng)

**Step 1: Update Domain Entity**
Modify `src/modules/auth/domain/user.entity.ts` to include `role` and `bannedUntil` in props, constructors, getters, and add helper methods:
```typescript
export interface UserProps {
  // ...
  role?: string;
  bannedUntil?: Date | null;
  // ...
}

export class User {
  private _role: string;
  private _bannedUntil: Date | null;

  constructor(props: UserProps) {
    // ...
    this._role = props.role || 'USER';
    this._bannedUntil = props.bannedUntil || null;
  }

  get role(): string {
    return this._role;
  }

  get bannedUntil(): Date | null {
    return this._bannedUntil;
  }

  public isBanned(): boolean {
    return this._bannedUntil ? this._bannedUntil > new Date() : false;
  }

  public ban(until: Date | null): void {
    this._bannedUntil = until;
    this.touch();
  }

  public updateRole(role: string): void {
    this._role = role;
    this.touch();
  }
}
```

**Step 2: Update Mapper**
Modify `src/modules/auth/infrastructure/repositories/user.mapper.ts` to include mapping for `role` and `bannedUntil`:
```typescript
  public static toDomain(raw: PrismaUser): User {
    return new User({
      // ...
      role: raw.role,
      bannedUntil: raw.bannedUntil,
    });
  }

  public static toPersistence(domain: User) {
    return {
      // ...
      role: domain.role,
      bannedUntil: domain.bannedUntil,
    };
  }
```

**Step 3: Run verification tests**
Run: `pnpm test`
Expected: Tests pass.

**Step 4: Commit**
```bash
git add src/modules/auth/domain/user.entity.ts src/modules/auth/infrastructure/repositories/user.mapper.ts
git commit -m "feat: add role and bannedUntil to user domain entity and mapper"
```

---

### Task 3: IUserRepository & PrismaUserRepository Update

**Files:**
- Modify: `src/modules/auth/domain/user.repository.ts`
- Modify: `src/modules/auth/infrastructure/repositories/prisma-user.repository.ts`

**Step 1: Modify Repository Interface**
Modify `src/modules/auth/domain/user.repository.ts` to declare `findMany`:
```typescript
export abstract class IUserRepository {
  // ...
  abstract findMany(options: { page: number; limit: number; search?: string }): Promise<{ users: User[]; total: number }>;
}
```

**Step 2: Implement findMany in PrismaUserRepository**
Modify `src/modules/auth/infrastructure/repositories/prisma-user.repository.ts`:
```typescript
  async findMany(options: { page: number; limit: number; search?: string }): Promise<{ users: User[]; total: number }> {
    const { page, limit, search } = options;
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { displayName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [rawUsers, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: rawUsers.map((u) => UserMapper.toDomain(u)),
      total,
    };
  }
```

**Step 3: Commit**
```bash
git add src/modules/auth/domain/user.repository.ts src/modules/auth/infrastructure/repositories/prisma-user.repository.ts
git commit -m "feat: implement findMany in user repository"
```

---

### Task 4: Custom Decorator and RolesGuard

**Files:**
- Create: `src/shared/decorators/roles.decorator.ts`
- Create: `src/shared/guards/roles.guard.ts`

**Step 1: Create Roles Decorator**
Create `src/shared/decorators/roles.decorator.ts`:
```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

**Step 2: Create RolesGuard**
Create `src/shared/guards/roles.guard.ts`:
```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { IUserRepository } from '../../modules/auth/domain/user.repository.js';
import type { JwtPayload } from '../decorators/current-user.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userRepository: IUserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const userPayload = request.user;

    if (!userPayload) {
      return true; // Bypass nếu chưa qua JwtGuard, để route quyết định
    }

    // Luôn kiểm tra trạng thái khóa (Banned) cho mọi người dùng
    const user = await this.userRepository.findById(userPayload.sub);
    if (!user) {
      return false;
    }

    if (user.isBanned()) {
      throw new ForbiddenException(`Tài khoản đã bị khóa đến ngày: ${user.bannedUntil?.toLocaleString()}`);
    }

    if (!requiredRoles) {
      return true; // Không yêu cầu phân quyền cụ thể
    }

    return requiredRoles.includes(user.role);
  }
}
```

**Step 3: Commit**
```bash
git add src/shared/decorators/roles.decorator.ts src/shared/guards/roles.guard.ts
git commit -m "feat: add roles decorator and roles guard with ban check"
```

---

### Task 5: Create Use Cases for Admin Operations

**Files:**
- Create: `src/modules/admin/application/use-cases/admin-get-users.use-case.ts`
- Create: `src/modules/admin/application/use-cases/admin-ban-user.use-case.ts`
- Create: `src/modules/admin/application/use-cases/admin-update-elo.use-case.ts`
- Create: `src/modules/admin/application/use-cases/admin-get-rooms.use-case.ts`
- Create: `src/modules/admin/application/use-cases/admin-force-close-room.use-case.ts`
- Create: `src/modules/admin/application/use-cases/admin-get-matchmaking.use-case.ts`
- Create: `src/modules/admin/application/use-cases/admin-cancel-ticket.use-case.ts`

**Step 1: Write Use Cases**
*  `admin-get-users.use-case.ts`: Gọi `userRepository.findMany`.
*  `admin-ban-user.use-case.ts`: Gọi `userRepository.findById`, set `ban`, lưu qua `userRepository.save`.
*  `admin-update-elo.use-case.ts`: Gọi `userRepository.findById`, set ELO, lưu qua `userRepository.save`.
*  `admin-get-rooms.use-case.ts`: Inject `IRoomRepository` (hoặc service tương ứng) để trả về toàn bộ room.
*  `admin-force-close-room.use-case.ts`: Xóa room qua repository và bắn notification sảnh qua `LobbyGateway` (nếu cần).
*  `admin-get-matchmaking.use-case.ts`: Inject `IMatchmakingRepository` từ Matchmaking module để xem ticket/queue.
*  `admin-cancel-ticket.use-case.ts`: Xóa ticket khỏi `IMatchmakingRepository`.

*(Chi tiết mã nguồn sẽ được hoàn thiện đầy đủ trong quá trình triển khai)*

**Step 2: Commit**
```bash
git add src/modules/admin/application/use-cases/
git commit -m "feat: implement admin application use cases"
```

---

### Task 6: DTOs & Admin Controller

**Files:**
- Create: `src/modules/admin/presentation/dto/ban-user.dto.ts`
- Create: `src/modules/admin/presentation/dto/update-elo.dto.ts`
- Create: `src/modules/admin/presentation/dto/query-users.dto.ts`
- Create: `src/modules/admin/presentation/controllers/admin.controller.ts`

**Step 1: Create presentation components**
*  `AdminController` sử dụng `@UseGuards(JwtGuard, RolesGuard)` và `@Roles('ADMIN')`.
*  Bổ sung các endpoints REST như đã thiết kế.

**Step 2: Commit**
```bash
git add src/modules/admin/presentation/
git commit -m "feat: add admin controller and DTOs"
```

---

### Task 7: Admin Module and App Integration

**Files:**
- Create: `src/modules/admin/admin.module.ts`
- Modify: `src/app.module.ts`

**Step 1: Create Admin Module**
Đăng ký các Use Cases, Providers, Controller. Import `AuthModule` (để dùng `IUserRepository` và `JwtTokenService`), `RoomModule`, `LobbyModule` và `MatchmakingModule`.
**Step 2: Register in AppModule**
Thêm `AdminModule` vào `imports` của `src/app.module.ts`.
**Step 3: Verification & Run Build**
Run: `pnpm build`
Run: `pnpm test`
Expected: Builds and tests pass successfully.

**Step 4: Commit**
```bash
git add src/modules/admin/admin.module.ts src/app.module.ts
git commit -m "feat: register AdminModule in AppModule and finalize integration"
```
