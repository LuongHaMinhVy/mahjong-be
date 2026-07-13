# Google OAuth2 Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Implement Google OAuth2 authentication (sign in and registration) adhering to Clean Architecture principles.

**Architecture:** We verify Google ID tokens in the Infrastructure layer, mapping them to the domain model. If the user doesn't exist, we register them with a random secure password hash.

**Tech Stack:** NestJS, google-auth-library, Prisma, ESM.

---

### Task 1: Install google-auth-library and configure Environment Variables

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `.env`

**Step 1: Install dependency**
Run: `pnpm add google-auth-library`

**Step 2: Update env files**
Add `GOOGLE_CLIENT_ID` to both `.env` and `.env.example`.

**Step 3: Verify build**
Run: `pnpm build`

**Step 4: Commit**
```bash
git add package.json pnpm-lock.yaml .env.example
git commit -m "feat(auth): install google-auth-library and configure env variables"
```

---

### Task 2: Create IGoogleAuthService (Domain Port)

**Files:**
- Create: `src/modules/auth/domain/google-auth.service.ts`

**Step 1: Write IGoogleAuthService definition**
Write code:
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

**Step 2: Verify build**
Run: `pnpm build`

**Step 3: Commit**
```bash
git add src/modules/auth/domain/google-auth.service.ts
git commit -m "feat(auth): add IGoogleAuthService domain port"
```

---

### Task 3: Implement GoogleAuthService (Infrastructure Adapter)

**Files:**
- Create: `src/modules/auth/infrastructure/identity/google-auth.service.ts`

**Step 1: Write GoogleAuthService implementation**
Write code:
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { IGoogleAuthService, type GoogleUserPayload } from '../../domain/google-auth.service.js';

@Injectable()
export class GoogleAuthService implements IGoogleAuthService {
  private readonly client: OAuth2Client;

  constructor(private readonly configService: ConfigService) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    this.client = new OAuth2Client(clientId);
  }

  async verifyToken(idToken: string): Promise<GoogleUserPayload> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.name) {
        throw new UnauthorizedException('GOOGLE_TOKEN_INVALID');
      }

      return {
        email: payload.email,
        displayName: payload.name,
        avatar: payload.picture ?? null,
      };
    } catch {
      throw new UnauthorizedException('GOOGLE_TOKEN_INVALID');
    }
  }
}
```

**Step 2: Verify build**
Run: `pnpm build`

**Step 3: Commit**
```bash
git add src/modules/auth/infrastructure/identity/google-auth.service.ts
git commit -m "feat(auth): implement GoogleAuthService adapter"
```

---

### Task 4: Create GoogleLoginUseCase (Application Layer)

**Files:**
- Create: `src/modules/auth/application/use-cases/google-login.use-case.ts`

**Step 1: Write GoogleLoginUseCase code**
Write code:
```typescript
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { IGoogleAuthService } from '../../domain/google-auth.service.js';
import { IUserRepository } from '../../domain/user.repository.js';
import { User } from '../../domain/user.entity.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { Password } from '../../domain/value-objects/password.vo.js';
import { SessionService, type SessionResult } from '../../infrastructure/session/session.service.js';

@Injectable()
export class GoogleLoginUseCase {
  constructor(
    private readonly googleAuthService: IGoogleAuthService,
    private readonly userRepository: IUserRepository,
    private readonly sessionService: SessionService,
  ) {}

  async execute(idToken: string): Promise<SessionResult> {
    const googleUser = await this.googleAuthService.verifyToken(idToken);
    
    let user = await this.userRepository.findByEmail(googleUser.email);
    
    if (user) {
      if (!user.isEmailVerified) {
        user.verifyEmail();
        await this.userRepository.save(user);
      }
    } else {
      // Auto-generate strong secure random password
      const randomPassword = randomBytes(32).toString('hex');
      const password = Password.create(randomPassword);
      const email = new Email(googleUser.email);
      
      user = new User({
        email,
        password,
        displayName: googleUser.displayName,
        avatar: googleUser.avatar,
        isEmailVerified: true,
      });
      
      await this.userRepository.save(user);
    }
    
    return this.sessionService.createSession(user);
  }
}
```

**Step 2: Verify build**
Run: `pnpm build`

**Step 3: Commit**
```bash
git add src/modules/auth/application/use-cases/google-login.use-case.ts
git commit -m "feat(auth): implement GoogleLoginUseCase"
```

---

### Task 5: Register DTO, Route, and Update AuthModule

**Files:**
- Create: `src/modules/auth/presentation/dto/google-login.dto.ts`
- Modify: `src/modules/auth/presentation/controllers/auth.controller.ts`
- Modify: `src/modules/auth/auth.module.ts`

**Step 1: Write GoogleLoginDto**
Write code:
```typescript
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsNotEmpty()
  @IsString()
  idToken: string;
}
```

**Step 2: Add Google Login Route to AuthController**
Add imports:
```typescript
import { GoogleLoginDto } from '../dto/google-login.dto.js';
import { GoogleLoginUseCase } from '../../application/use-cases/google-login.use-case.js';
```
Inject `GoogleLoginUseCase` in constructor.
Add route:
```typescript
  @Post('google')
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.googleLoginUseCase.execute(dto.idToken);

    response.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return new ApiResponseDto(true, 'Đăng nhập Google thành công', {
      accessToken: result.accessToken,
      user: result.user,
    });
  }
```

**Step 3: Register in AuthModule**
Import and register:
* `IGoogleAuthService` custom provider using `GoogleAuthService` class.
* `GoogleLoginUseCase` in `providers`.

**Step 4: Verify build & formatting**
Run: `pnpm build ; pnpm format ; pnpm lint`

**Step 5: Commit**
```bash
git add src/modules/auth/presentation/dto/google-login.dto.ts src/modules/auth/presentation/controllers/auth.controller.ts src/modules/auth/auth.module.ts
git commit -m "feat(auth): expose google oauth2 login endpoint and register providers"
```
