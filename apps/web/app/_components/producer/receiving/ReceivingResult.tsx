"use client";

/**
 * PART 3 BOUNDARY (SPEC-015 15C). The results of the verification at `/producer/receiving`: Em
 * análise, Pendência (with the request for information at `/producer/receiving/rfi`), Recusado
 * (with "Corrigir e enviar de novo", which goes to the terms through `useReceiving().go`),
 * Aprovada · Conta a caminho, Liberando and its failure, and Pronto (§5.2, §6 "Resultados"). The
 * root hands over here whenever the configuration is not on screen (`useReceiving().stage`), under
 * the page's header. It renders nothing until part 3 builds those screens.
 */
export function ReceivingResult() {
  return null;
}

/**
 * PART 3 BOUNDARY. The notice of the receiving account above the root's content: Conta com erro
 * when the account `failed` (302:5193, 520:8833; R3) and the toast "Conta de recebimento" once the
 * background resume stopped (§6, R6), both with "Tentar de novo". `useProducer().account` gives
 * `stopped`, `error` and `retry`. It renders nothing until part 3 builds it.
 */
export function ReceivingAccountNotice() {
  return null;
}
