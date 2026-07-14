import { type User } from './user.entity.js';

export abstract class IUserRepository {
  abstract save(user: User): Promise<User>;
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findMany(options: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<{ users: User[]; total: number }>;
}
