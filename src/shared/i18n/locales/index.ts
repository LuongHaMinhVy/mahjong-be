import viErrors from './vi/errors.js';
import viValidation from './vi/validation.js';
import viNotifications from './vi/notifications.js';
import viGame from './vi/game.js';
import viEmail from './vi/email.js';

import enErrors from './en/errors.js';
import enValidation from './en/validation.js';
import enNotifications from './en/notifications.js';
import enGame from './en/game.js';
import enEmail from './en/email.js';

import jaErrors from './ja/errors.js';
import jaValidation from './ja/validation.js';
import jaNotifications from './ja/notifications.js';
import jaGame from './ja/game.js';
import jaEmail from './ja/email.js';

import zhErrors from './zh/errors.js';
import zhValidation from './zh/validation.js';
import zhNotifications from './zh/notifications.js';
import zhGame from './zh/game.js';
import zhEmail from './zh/email.js';

export const vi = {
  errors: viErrors,
  validation: viValidation,
  notifications: viNotifications,
  game: viGame,
  email: viEmail,
};

export const en = {
  errors: enErrors,
  validation: enValidation,
  notifications: enNotifications,
  game: enGame,
  email: enEmail,
};

export const ja = {
  errors: jaErrors,
  validation: jaValidation,
  notifications: jaNotifications,
  game: jaGame,
  email: jaEmail,
};

export const zh = {
  errors: zhErrors,
  validation: zhValidation,
  notifications: zhNotifications,
  game: zhGame,
  email: zhEmail,
};

export const locales = {
  vi,
  en,
  ja,
  zh,
};

export type LocaleType = keyof typeof locales;
export type TranslationKeys = typeof vi;

export const defaultLocale: LocaleType = 'vi';
