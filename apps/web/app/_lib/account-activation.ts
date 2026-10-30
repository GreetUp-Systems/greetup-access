import {
  type AccountActivationView,
  prepareStellarActivation,
  submitStellarActivationSignature,
} from "./api/account";
import { ApiError } from "./api/client";
import { prepareProducerActivation, submitProducerActivationSignature } from "./api/onboarding";

/** Signs a transaction hash with the user's Stellar wallet, as Privy's signRawHash does. */
export type SignStellarHash = (hash: `0x${string}`) => Promise<`0x${string}`>;

/** The buyer's and the producer's activations answer alike: "signing" carries the hash. */
export type StellarActivationView = AccountActivationView;

/** An activation the network confirmed. */
export interface ConfirmedActivation {
  status: "active";
  transactionHash: string | null;
}

/**
 * The routes of an activation: the buyer's account (`/me/stellar/activate`, D-23) or the
 * producer's receiving account (`/producers/onboarding/stellar/activate`, SPEC-003 §10).
 */
export interface ActivationRoutes {
  prepare(token: string): Promise<StellarActivationView>;
  submitSignature(
    token: string,
    body: { hash: string; signature: string },
  ): Promise<StellarActivationView>;
}

export const accountActivationRoutes: ActivationRoutes = {
  prepare: prepareStellarActivation,
  submitSignature: submitStellarActivationSignature,
};

export const producerActivationRoutes: ActivationRoutes = {
  prepare: prepareProducerActivation,
  submitSignature: submitProducerActivationSignature,
};

/**
 * Activates a Stellar account, signed here in the browser (D-28): the API prepares the sponsored
 * transaction, the wallet signs its hash and the API submits it. A prepared transaction that went
 * stale on the way is prepared and signed once more.
 */
export async function activateStellar(
  routes: ActivationRoutes,
  getToken: () => Promise<string>,
  signHash: SignStellarHash,
): Promise<StellarActivationView> {
  try {
    return await prepareAndSign(routes, getToken, signHash);
  } catch (error) {
    if (error instanceof ApiError && error.code === "activation_signature_stale") {
      return prepareAndSign(routes, getToken, signHash);
    }
    throw error;
  }
}

async function prepareAndSign(
  routes: ActivationRoutes,
  getToken: () => Promise<string>,
  signHash: SignStellarHash,
): Promise<StellarActivationView> {
  const prepared = await routes.prepare(await getToken());
  if (prepared.status !== "signing") {
    return prepared;
  }
  const signature = await signHash(`0x${prepared.hashToSign}`);
  return routes.submitSignature(await getToken(), { hash: prepared.hashToSign, signature });
}

/**
 * The network did not confirm the activation: it was still submitted after the last read, or the
 * submitted transaction failed and the API prepared a new one, which waits for a signature.
 */
export class ActivationUnconfirmedError extends Error {
  constructor(readonly last: StellarActivationView) {
    super("The Stellar activation was not confirmed on the network.");
    this.name = "ActivationUnconfirmedError";
  }
}

// A submitted transaction is settled by the API within its 4-minute lease (SPEC-003 §10): read
// about once a ledger, for a little longer than that.
export const CONFIRMATION_INTERVAL_MS = 5_000;
export const CONFIRMATION_READS = 54;

export interface ConfirmationOptions {
  intervalMs?: number;
  reads?: number;
  /** How the wait between reads is done; tests skip it. */
  wait?: (ms: number) => Promise<void>;
}

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Activates and waits for the network (SPEC-015 R7): a submitted activation is read again until
 * it is active. The wallet signs at most what `activateStellar` asks: a new transaction prepared
 * while waiting ends the wait with ActivationUnconfirmedError, unsigned.
 */
export async function activateAndConfirm(
  routes: ActivationRoutes,
  getToken: () => Promise<string>,
  signHash: SignStellarHash,
  options: ConfirmationOptions = {},
): Promise<ConfirmedActivation> {
  const {
    intervalMs = CONFIRMATION_INTERVAL_MS,
    reads = CONFIRMATION_READS,
    wait = pause,
  } = options;
  let view = await activateStellar(routes, getToken, signHash);
  for (let read = 0; view.status === "submitted" && read < reads; read += 1) {
    await wait(intervalMs);
    view = await routes.prepare(await getToken());
  }
  if (view.status !== "active") {
    throw new ActivationUnconfirmedError(view);
  }
  return { status: "active", transactionHash: view.transactionHash };
}
