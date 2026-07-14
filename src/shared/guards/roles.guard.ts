import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { IUserRepository } from '../../modules/auth/domain/user.repository.js';
import type { JwtPayload } from '../decorators/current-user.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userRepository: IUserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const userPayload = request.user;

    if (!userPayload) {
      return true;
    }

    const user = await this.userRepository.findById(userPayload.sub);
    if (!user) {
      return false;
    }

    if (user.isBanned()) {
      throw new ForbiddenException(`Tài khoản đã bị khóa đến ngày: ${user.bannedUntil?.toLocaleString()}`);
    }

    if (!requiredRoles) {
      return true;
    }

    return requiredRoles.includes(user.role);
  }
}
