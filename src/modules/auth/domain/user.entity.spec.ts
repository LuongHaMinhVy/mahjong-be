import { User } from './user.entity.js';
import { Email } from './value-objects/email.vo.js';
import { Password } from './value-objects/password.vo.js';

describe('User Entity Locale', () => {
  it('should support locale preference and fallback to vi', () => {
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
    expect(user.locale).toBe('vi');
    
    const userWithEn = new User({
      id: '2',
      email: new Email('en@example.com'),
      password: Password.fromHash('hash'),
      displayName: 'En User',
      elo: 1000,
      isEmailVerified: true,
      role: 'USER',
      bannedUntil: null,
      locale: 'en',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(userWithEn.locale).toBe('en');
  });
});
