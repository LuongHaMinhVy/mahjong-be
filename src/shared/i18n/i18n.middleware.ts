import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { locales, type LocaleType, defaultLocale } from './locales/index.js';
import { I18nContext } from './i18n.context.js';
import { PrismaService } from '../database/prisma.service.js';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class I18nMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let locale: LocaleType = defaultLocale;

    // 1. Custom request header x-custom-lang
    const customLang = req.headers['x-custom-lang'];
    if (typeof customLang === 'string' && locales[customLang as LocaleType]) {
      locale = customLang as LocaleType;
    } else {
      // 2. Accept-Language header
      let headerLocale: LocaleType | null = null;
      const acceptLang = req.headers['accept-language'];
      if (typeof acceptLang === 'string') {
        const parsedLangs = acceptLang
          .split(',')
          .map((lang) => {
            const [code, q] = lang.trim().split(';q=');
            return {
              code: code.trim().split('-')[0].toLowerCase(),
              q: q ? parseFloat(q) : 1.0,
            };
          })
          .sort((a, b) => b.q - a.q);

        for (const parsed of parsedLangs) {
          if (locales[parsed.code as LocaleType]) {
            headerLocale = parsed.code as LocaleType;
            break;
          }
        }
      }

      if (headerLocale) {
        locale = headerLocale;
      } else {
        // 3. Authenticated user preference
        let userLocale: LocaleType | null = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.split(' ')[1];
          try {
            const payload = await this.jwtService.verifyAsync<{
              sub: string;
              email: string;
            }>(token);
            if (payload && payload.sub) {
              const userSetting = await this.prisma.userSetting.findUnique({
                where: { userId: payload.sub },
              });
              if (
                userSetting &&
                userSetting.locale &&
                locales[userSetting.locale as LocaleType]
              ) {
                userLocale = userSetting.locale as LocaleType;
              }
            }
          } catch {
            // Token verify error, fallback to default
          }
        }

        if (userLocale) {
          locale = userLocale;
        }
      }
    }

    I18nContext.run(locale, () => {
      next();
    });
  }
}
