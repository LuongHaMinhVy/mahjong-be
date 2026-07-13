import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { IUserRepository } from '../../domain/user.repository.js';
import { User } from '../../domain/user.entity.js';
import { UserMapper } from './user.mapper.js';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User): Promise<User> {
    const raw = UserMapper.toPersistence(user);
    const updated = await this.prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: raw.email,
        passwordHash: raw.passwordHash,
        displayName: raw.displayName,
        avatar: raw.avatar,
        elo: raw.elo,
        isEmailVerified: raw.isEmailVerified,
      },
      create: {
        id: raw.id,
        email: raw.email,
        passwordHash: raw.passwordHash,
        displayName: raw.displayName,
        avatar: raw.avatar,
        elo: raw.elo,
        isEmailVerified: raw.isEmailVerified,
      },
    });

    return UserMapper.toDomain(updated);
  }

  async findById(id: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!raw) return null;
    return UserMapper.toDomain(raw);
  }

  async findByEmail(email: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!raw) return null;
    return UserMapper.toDomain(raw);
  }
}
