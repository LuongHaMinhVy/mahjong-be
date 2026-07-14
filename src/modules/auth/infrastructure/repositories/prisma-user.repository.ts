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
        role: raw.role,
        bannedUntil: raw.bannedUntil,
        settings: {
          upsert: {
            create: {
              locale: raw.settings.locale,
              soundEnabled: raw.settings.soundEnabled,
            },
            update: {
              locale: raw.settings.locale,
              soundEnabled: raw.settings.soundEnabled,
            },
          },
        },
      },
      create: {
        id: raw.id,
        email: raw.email,
        passwordHash: raw.passwordHash,
        displayName: raw.displayName,
        avatar: raw.avatar,
        elo: raw.elo,
        isEmailVerified: raw.isEmailVerified,
        role: raw.role,
        bannedUntil: raw.bannedUntil,
        settings: {
          create: {
            locale: raw.settings.locale,
            soundEnabled: raw.settings.soundEnabled,
          },
        },
      },
      include: {
        settings: true,
      },
    });

    return UserMapper.toDomain(updated);
  }

  async findById(id: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({
      where: { id },
      include: { settings: true },
    });
    if (!raw) return null;
    return UserMapper.toDomain(raw);
  }

  async findByEmail(email: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { settings: true },
    });
    if (!raw) return null;
    return UserMapper.toDomain(raw);
  }

  async findMany(options: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<{ users: User[]; total: number }> {
    const { page, limit, search } = options;
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { displayName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [rawUsers, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { settings: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: rawUsers.map((u) => UserMapper.toDomain(u)),
      total,
    };
  }
}
