import { vi } from './vi.js';
import { en } from './en.js';
import { ja } from './ja.js';
import { zh } from './zh.js';

export const locales = {
  vi,
  en,
  ja,
  zh,
};

export type LocaleType = keyof typeof locales;
export type TranslationKeys = typeof vi;

export const defaultLocale: LocaleType = 'vi';
