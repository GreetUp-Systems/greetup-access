import { type Request } from "express";

export interface AuthenticatedPrincipal {
  privyUserId: string;
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  authenticatedPrincipal?: AuthenticatedPrincipal;
}
