import { type AccountView, bootstrapAccount, getAccount } from "./api/account";
import { ApiError } from "./api/client";

/**
 * The account behind an existing Privy session (a reload, another tab). A bootstrap that never
 * finished is finished now. If the account cannot be loaded, the session is closed and the result
 * is null, so "Entrar" works again: a Privy session the API does not accept would leave the header
 * with no way in, and Privy refuses a new login on top of it.
 */
export async function restoreSession(
  getToken: () => Promise<string>,
  signOut: () => Promise<void>,
): Promise<AccountView | null> {
  try {
    return await restoreAccount(await getToken());
  } catch {
    await signOut().catch(() => undefined);
    return null;
  }
}

async function restoreAccount(token: string): Promise<AccountView> {
  try {
    return await getAccount(token);
  } catch (error) {
    if (error instanceof ApiError && error.code === "account_not_bootstrapped") {
      // "checkout" grants nothing (D-23): a restore must not count as a spontaneous login.
      return bootstrapAccount(token, "checkout");
    }
    throw error;
  }
}
