import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nMiddleware } from './i18n.middleware.js';
import { PrismaService } from '../database/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { I18nContext } from './i18n.context.js';

describe('I18nMiddleware', () => {
  let middleware: I18nMiddleware;
  let prismaService: any;
  let jwtService: any;

  beforeEach(async () => {
    prismaService = {
      userSetting: {
        findUnique: jest.fn(),
      },
    };

    jwtService = {
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        I18nMiddleware,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    middleware = module.get<I18nMiddleware>(I18nMiddleware);
  });

  it('should resolve from x-custom-lang header', async () => {
    const req = {
      headers: {
        'x-custom-lang': 'ja',
      },
    } as any;
    const res = {} as any;
    const next = jest.fn(() => {
      expect(I18nContext.getLocale()).toBe('ja');
    });

    await middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should resolve from Accept-Language header', async () => {
    const req = {
      headers: {
        'accept-language': 'en, vi;q=0.8',
      },
    } as any;
    const res = {} as any;
    const next = jest.fn(() => {
      expect(I18nContext.getLocale()).toBe('en');
    });

    await middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should resolve from authenticated user setting if token is present', async () => {
    const req = {
      headers: {
        authorization: 'Bearer valid-token',
      },
    } as any;
    const res = {} as any;
    
    jwtService.verifyAsync.mockResolvedValue({ sub: 'user-123', email: 'test@example.com' });
    prismaService.userSetting.findUnique.mockResolvedValue({ userId: 'user-123', locale: 'zh' });

    const next = jest.fn(() => {
      expect(I18nContext.getLocale()).toBe('zh');
    });

    await middleware.use(req, res, next);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token');
    expect(prismaService.userSetting.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-123' },
    });
    expect(next).toHaveBeenCalled();
  });

  it('should fallback to default locale (vi) if no headers or tokens are present', async () => {
    const req = {
      headers: {},
    } as any;
    const res = {} as any;
    const next = jest.fn(() => {
      expect(I18nContext.getLocale()).toBe('vi');
    });

    await middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
