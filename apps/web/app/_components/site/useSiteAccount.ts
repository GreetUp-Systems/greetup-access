"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getProducer } from "../../_lib/api/producer";
import { type ProducerLookup, type SiteAccount, siteAccount } from "../../_lib/site/account";
import { useSession } from "../../_lib/session";

export interface SiteAccountState {
  account: SiteAccount;
  /** Ends the Privy session and goes back to the site's Início (SPEC-016 §6). */
  signOut: () => void;
  /** Set on "Sair", so a page that asks for a session does not open the identification. */
  leaving: boolean;
}

/**
 * Who is on the site (SPEC-016 §6): the session and, for a signed-in person, GET /producers/me,
 * read once per session. A 404 or a failed read shows the person as a buyer (S18).
 */
export function useSiteAccount(): SiteAccountState {
  const { state, getToken, logout } = useSession();
  const router = useRouter();
  const [lookup, setLookup] = useState<ProducerLookup>({ status: "loading" });
  const [leaving, setLeaving] = useState(false);
  // Privy's token function changes identity on every render: read it by ref, so the producer is
  // not read again and an open menu does not close (as in useProducerSystem).
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;

  const userId = state.status === "authenticated" ? state.account.user.id : null;
  useEffect(() => {
    setLookup({ status: "loading" });
    if (userId === null) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const producer = await getProducer(await tokenRef.current());
        if (!cancelled) {
          setLookup({ status: "found", producer });
        }
      } catch {
        if (!cancelled) {
          setLookup({ status: "none" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signOut = useCallback(() => {
    setLeaving(true);
    void logout()
      .catch(() => undefined)
      .finally(() => router.replace("/"));
  }, [logout, router]);

  const account = useMemo(() => siteAccount(state, lookup), [state, lookup]);
  return useMemo(() => ({ account, signOut, leaving }), [account, signOut, leaving]);
}
