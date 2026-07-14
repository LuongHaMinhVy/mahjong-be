import { DomainException } from '../../../shared/exceptions/domain.exception.js';

export interface UserSettingsProps {
  locale: string;
  soundEnabled: boolean;
}

export class UserSettings {
  private _locale: string;
  private _soundEnabled: boolean;

  constructor(props: UserSettingsProps) {
    this._locale = props.locale;
    this._soundEnabled = props.soundEnabled;
  }

  get locale(): string {
    return this._locale;
  }

  get soundEnabled(): boolean {
    return this._soundEnabled;
  }

  updateLocale(locale: string): void {
    if (!['vi', 'en', 'ja', 'zh'].includes(locale)) {
      throw new DomainException('VALIDATION_ERROR', 'Invalid locale');
    }
    this._locale = locale;
  }

  updateSoundEnabled(enabled: boolean): void {
    this._soundEnabled = enabled;
  }
}
