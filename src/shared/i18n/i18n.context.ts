import { AsyncLocalStorage } from 'async_hooks';
import { type LocaleType, defaultLocale } from './locales/index.js';

export class I18nContext {
  private static storage = new AsyncLocalStorage<LocaleType>();

  public static run<T>(locale: LocaleType, fn: () => T): T {
    return this.storage.run(locale, fn);
  }

  public static getLocale(): LocaleType {
    return this.storage.getStore() || defaultLocale;
  }
}
