/** The buyer's account, activated at sign-in, and the producer's receiving account. */
export type ActivationKind = "account" | "producer";

export interface ActivationQueue<T> {
  /**
   * Runs the activation after the ones before it have ended. The same kind asked again while it
   * waits or runs gets that same run: its task is not called again.
   */
  run(kind: ActivationKind, task: () => Promise<T>): Promise<T>;
}

/**
 * The account activations of this browser, one at a time (SPEC-015 R7). Both use the same wallet:
 * the next starts only when the previous ended, confirmed on the network or failed, so the wallet
 * is never asked for two signatures together and the producer's transaction is never built while
 * the buyer's account is still on its way to the ledger.
 */
export function createActivationQueue<T>(): ActivationQueue<T> {
  let previous: Promise<unknown> = Promise.resolve();
  const runs = new Map<ActivationKind, Promise<T>>();
  return {
    run(kind, task) {
      const current = runs.get(kind);
      if (current !== undefined) {
        return current;
      }
      const started = previous.then(() => task());
      // A failure ends the run like a success: the next one still starts.
      previous = started.catch(() => undefined);
      runs.set(kind, started);
      const forget = (): void => {
        runs.delete(kind);
      };
      started.then(forget, forget);
      return started;
    },
  };
}
