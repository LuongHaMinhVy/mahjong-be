import { User } from './user.entity.js';
import { Email } from './value-objects/email.vo.js';
import { Password } from './value-objects/password.vo.js';

describe('User Entity Settings', () => {
  it('should initialize with default settings', () => {
    const user = new User({
      id: '1',
      email: new Email('test@example.com'),
      password: Password.fromHash('hash'),
      displayName: 'Test User',
      elo: 1000,
      isEmailVerified: true,
      role: 'USER',
      bannedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(user.settings.locale).toBe('vi');
    expect(user.settings.soundEnabled).toBe(true);
  });

  it('should allow updating settings and validate locale', () => {
    const user = new User({
      id: '1',
      email: new Email('test@example.com'),
      password: Password.fromHash('hash'),
      displayName: 'Test User',
      elo: 1000,
      isEmailVerified: true,
      role: 'USER',
      bannedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    user.settings.updateLocale('en');
    expect(user.settings.locale).toBe('en');

    user.settings.updateSoundEnabled(false);
    expect(user.settings.soundEnabled).toBe(false);

    expect(() => user.settings.updateLocale('invalid')).toThrow();
  });
});
