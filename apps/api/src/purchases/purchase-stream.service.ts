import { Inject, Injectable, Logger, type MessageEvent, NotFoundException } from "@nestjs/common";
import { Observable } from "rxjs";

import { type AuthenticatedPrincipal } from "../auth/auth.types";
import { UsersRepository } from "../users/users.repository";
import { type PurchaseRecord, PurchasesRepository } from "./purchases.repository";
import {
  PURCHASE_STREAM_TIMING,
  type PurchaseStage,
  type PurchaseStatusView,
  type PurchaseStreamTiming,
} from "./purchases.types";

const stages: Record<PurchaseStatusView, PurchaseStage> = {
  initiated: "order_placed",
  awaiting_payment: "awaiting_payment",
  payment_confirmed: "payment_confirmed",
  ticket_issued: "ticket_issued",
  payment_failed: "not_completed",
  payment_refunded: "not_completed",
};
const finalStages = new Set<PurchaseStage>(["ticket_issued", "not_completed"]);

export function purchaseStage(status: PurchaseStatusView): PurchaseStage {
  return stages[status];
}

/**
 * The waiting screen's stream (D-17, SPEC-008 §7): each connection polls the purchase in the
 * buyer's context and emits only stage changes, then closes on a final stage or on timeout.
 */
@Injectable()
export class PurchaseStreamService {
  private readonly logger = new Logger(PurchaseStreamService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly purchases: PurchasesRepository,
    @Inject(PURCHASE_STREAM_TIMING) private readonly timing: PurchaseStreamTiming,
  ) {}

  async open(
    principal: AuthenticatedPrincipal,
    purchaseId: string,
  ): Promise<Observable<MessageEvent>> {
    const user = await this.users.findByPrivyUserId(principal.privyUserId);
    const purchase = user === null ? null : await this.purchases.find(user.id, purchaseId);
    // Answered before the stream opens, so it is a plain HTTP 404.
    if (user === null || purchase === null) {
      throw new NotFoundException({
        code: "purchase_not_found",
        message: "The purchase does not exist.",
      });
    }

    return new Observable<MessageEvent>((subscriber) => {
      let lastStage: PurchaseStage | undefined;
      let polling = false;

      const emit = (current: PurchaseRecord): void => {
        const status = current.status.toLowerCase() as PurchaseStatusView;
        const stage = purchaseStage(status);
        if (stage === lastStage) {
          return;
        }
        lastStage = stage;
        subscriber.next({ type: "status", data: { purchaseId, stage, status } });
        if (finalStages.has(stage)) {
          subscriber.complete();
        }
      };

      const poll = async (): Promise<void> => {
        if (polling || subscriber.closed) {
          return;
        }
        polling = true;
        try {
          const current = await this.purchases.find(user.id, purchaseId);
          if (current !== null && !subscriber.closed) {
            emit(current);
          }
        } catch (error) {
          // A failed read is retried on the next tick; the timeout bounds the stream.
          this.logger.warn(
            `Purchase stream read failed for ${purchaseId}: ${error instanceof Error ? error.name : "unknown"}.`,
          );
        } finally {
          polling = false;
        }
      };

      const pollTimer = setInterval(() => void poll(), this.timing.pollMs);
      const heartbeatTimer = setInterval(
        () => subscriber.next({ type: "heartbeat", data: {} }),
        this.timing.heartbeatMs,
      );
      const timeoutTimer = setTimeout(() => {
        subscriber.next({ type: "timeout", data: { purchaseId } });
        subscriber.complete();
      }, this.timing.timeoutMs);

      emit(purchase);

      return () => {
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        clearTimeout(timeoutTimer);
      };
    });
  }
}
