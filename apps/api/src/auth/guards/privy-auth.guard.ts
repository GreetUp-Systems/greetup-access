import {
  CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { PRIVY_GATEWAY, type PrivyGateway } from "../../common/privy/privy.types";
import { type AuthenticatedRequest } from "../auth.types";
import { IS_PUBLIC_ROUTE } from "../decorators/public.decorator";

@Injectable()
export class PrivyAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PRIVY_GATEWAY) private readonly privy: PrivyGateway,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (token === null) {
      throw this.invalidToken();
    }

    try {
      const verified = await this.privy.verifyAccessToken(token);
      request.authenticatedPrincipal = { ...verified, accessToken: token };
      return true;
    } catch {
      throw this.invalidToken();
    }
  }

  private extractBearerToken(header: string | undefined): string | null {
    if (header === undefined) {
      return null;
    }

    const parts = header.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer" || !parts[1]) {
      return null;
    }

    return parts[1];
  }

  private invalidToken(): UnauthorizedException {
    return new UnauthorizedException({
      code: "invalid_auth_token",
      message: "A valid access token is required.",
    });
  }
}
