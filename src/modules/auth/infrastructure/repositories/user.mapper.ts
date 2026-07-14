import { type User as PrismaUser } from '@prisma/client';
import { User } from '../../domain/user.entity.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { Password } from '../../domain/value-objects/password.vo.js';

export class UserMapper {
  public static toDomain(raw: PrismaUser): User {
    return new User({
      id: raw.id,
      email: new Email(raw.email),
      password: Password.fromHash(raw.passwordHash),
      displayName: raw.displayName,
      avatar: raw.avatar,
      elo: raw.elo,
      isEmailVerified: raw.isEmailVerified,
      role: raw.role,
      locale: raw.locale,
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
      locale: domain.locale,
      bannedUntil: domain.bannedUntil,
    };
  }
}
