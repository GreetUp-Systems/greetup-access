import { type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { type PrivyGateway } from "../../common/privy/privy.types";
import { type AuthenticatedRequest } from "../auth.types";
import { IS_PUBLIC_ROUTE } from "../decorators/public.decorator";
import { PrivyAuthGuard } from "./privy-auth.guard";

function contextFor(
  request: Partial<AuthenticatedRequest>,
  handler: () => void = () => undefined,
): ExecutionContext {
  class TestController {}

  return {
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("PrivyAuthGuard", () => {
  const principal = { privyUserId: "did:privy:user-1", sessionId: "session-1" };
  let privy: jest.Mocked<Pick<PrivyGateway, "verifyAccessToken">>;
  let guard: PrivyAuthGuard;

  beforeEach(() => {
    privy = { verifyAccessToken: jest.fn() };
    guard = new PrivyAuthGuard(new Reflector(), privy as unknown as PrivyGateway);
  });

  it("accepts a valid bearer token and attaches the principal", async () => {
    const request = { headers: { authorization: "Bearer valid-token" } };
    privy.verifyAccessToken.mockResolvedValue(principal);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(privy.verifyAccessToken).toHaveBeenCalledWith("valid-token");
    expect(request).toMatchObject({
      authenticatedPrincipal: { ...principal, accessToken: "valid-token" },
    });
  });

  it.each([undefined, "Basic token", "Bearer", "Bearer one two"])(
    "rejects an invalid authorization header: %s",
    async (authorization) => {
      const request = { headers: { authorization } };

      await expect(guard.canActivate(contextFor(request))).rejects.toMatchObject({
        response: { code: "invalid_auth_token" },
      });
      expect(privy.verifyAccessToken).not.toHaveBeenCalled();
    },
  );

  it("maps invalid or expired token failures to a safe 401", async () => {
    const request = { headers: { authorization: "Bearer expired-token" } };
    privy.verifyAccessToken.mockRejectedValue(new Error("token expired: sensitive-token"));

    await expect(guard.canActivate(contextFor(request))).rejects.toMatchObject({
      response: {
        code: "invalid_auth_token",
        message: "A valid access token is required.",
      },
    });
  });

  it("bypasses authentication for routes marked public", async () => {
    const handler = () => undefined;
    Reflect.defineMetadata(IS_PUBLIC_ROUTE, true, handler);

    await expect(guard.canActivate(contextFor({ headers: {} }, handler))).resolves.toBe(true);
    expect(privy.verifyAccessToken).not.toHaveBeenCalled();
  });
});
