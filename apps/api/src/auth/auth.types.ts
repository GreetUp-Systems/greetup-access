import { type Request } from "express";

export interface AuthenticatedPrincipal {
  privyUserId: string;
  sessionId: string;
  accessToken: string;
}

export interface AuthenticatedRequest extends Request {
  authenticatedPrincipal?: AuthenticatedPrincipal;
}
