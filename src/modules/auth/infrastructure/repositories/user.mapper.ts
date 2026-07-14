import { type User as PrismaUser, type UserSetting as PrismaUserSetting } from '@prisma/client';
import { User } from '../../domain/user.entity.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { Password } from '../../domain/value-objects/password.vo.js';

export class UserMapper {
  public static toDomain(raw: PrismaUser & { settings?: PrismaUserSetting | null }): User {
    return new User({
      id: raw.id,
      email: new Email(raw.email),
      password: Password.fromHash(raw.passwordHash),
      displayName: raw.displayName,
      avatar: raw.avatar,
      elo: raw.elo,
      isEmailVerified: raw.isEmailVerified,
      role: raw.role,
      settings: raw.settings ? {
        locale: raw.settings.locale,
        soundEnabled: raw.settings.soundEnabled,
      } : undefined,
      bannedUntil: raw.bannedUntil,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }

  public static toPersistence(domain: User) {
    return {
      id: domain.id,
      email: domain.email.getValue(),
      passwordHash: domain.password.getHash(),
      displayName: domain.displayName,
      avatar: domain.avatar,
      elo: domain.elo,
      isEmailVerified: domain.isEmailVerified,
      role: domain.role,
      settings: {
        locale: domain.settings.locale,
        soundEnabled: domain.settings.soundEnabled,
      },
      bannedUntil: domain.bannedUntil,
    };
  }
}
