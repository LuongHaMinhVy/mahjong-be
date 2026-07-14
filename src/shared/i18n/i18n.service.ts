import { Injectable } from '@nestjs/common';
import { locales, type LocaleType, defaultLocale } from './locales/index.js';
import { I18nContext } from './i18n.context.js';

@Injectable()
export class I18nService {
  public translate(key: string, args?: Record<string, any>): string {
    const locale = I18nContext.getLocale();
    const dictionary = locales[locale] || locales[defaultLocale];

    const template = this.resolvePath(dictionary, key);
    if (!template) {
      return key;
    }

    if (!args) {
      return template;
    }

    return Object.entries(args).reduce((acc, [paramKey, val]) => {
      return acc.replace(new RegExp(`{${paramKey}}`, 'g'), String(val));
    }, template);
  }

  private resolvePath(obj: any, path: string): string | null {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return null;
      }
    }
    return typeof current === 'string' ? current : null;
  }
}
