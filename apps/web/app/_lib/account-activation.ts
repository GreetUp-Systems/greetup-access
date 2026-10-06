import {
  type AccountActivationView,
  prepareStellarActivation,
  submitStellarActivationSignature,
} from "./api/account";
import { ApiError } from "./api/client";

/** Signs a transaction hash with the user's Stellar wallet, as Privy's signRawHash does. */
export type SignStellarHash = (hash: `0x${string}`) => Promise<`0x${string}`>;

/**
 * Activates the user's Stellar account (D-23), signed here in the browser (D-28): the API
 * prepares the sponsored transaction, the wallet signs its hash and the API submits it. A
 * prepared transaction that went stale on the way is prepared and signed once more.
 */
export async function activateStellarAccount(
  getToken: () => Promise<string>,
  signHash: SignStellarHash,
): Promise<AccountActivationView> {
  try {
    return await prepareAndSign(getToken, signHash);
  } catch (error) {
    if (error instanceof ApiError && error.code === "activation_signature_stale") {
      return prepareAndSign(getToken, signHash);
    }
    throw error;
  }
}

async function prepareAndSign(
  getToken: () => Promise<string>,
  signHash: SignStellarHash,
): Promise<AccountActivationView> {
  const prepared = await prepareStellarActivation(await getToken());
  if (prepared.status !== "signing") {
    return prepared;
  }
  const signature = await signHash(`0x${prepared.hashToSign}`);
  return submitStellarActivationSignature(await getToken(), {
    hash: prepared.hashToSign,
    signature,
  });
}
