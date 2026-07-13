import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  sub: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request: Request & { user: JwtPayload } = ctx
      .switchToHttp()
      .getRequest();
    const user: JwtPayload = request.user;
    return data ? user[data] : user;
  },
);
