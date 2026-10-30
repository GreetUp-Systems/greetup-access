import { digitsOnly } from "./masks";

/** The 27 federative units, for the Estado list and to check what ViaCEP answers. */
export const brazilianUfs = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export type BrazilianUf = (typeof brazilianUfs)[number];

export function isBrazilianUf(value: unknown): value is BrazilianUf {
  return typeof value === "string" && (brazilianUfs as readonly string[]).includes(value);
}

/** What the CEP fills; a CEP of a whole city has no street nor neighborhood. */
export interface CepAddress {
  street: string | null;
  neighborhood: string | null;
  city: string;
  uf: BrazilianUf;
}

export type CepLookup =
  { status: "found"; address: CepAddress } | { status: "not_found" } | { status: "failed" };

/** Past this, the lookup counts as failed and the address is filled by hand. */
export const CEP_LOOKUP_TIMEOUT_MS = 5_000;

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

function readAnswer(body: unknown): CepLookup {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { status: "failed" };
  }
  const answer = body as Record<string, unknown>;
  // ViaCEP answers an unknown CEP with 200 and { "erro": true } (lately the string "true").
  if (answer.erro === true || answer.erro === "true") {
    return { status: "not_found" };
  }
  const city = text(answer.localidade);
  if (city === null || !isBrazilianUf(answer.uf)) {
    return { status: "failed" };
  }
  return {
    status: "found",
    address: {
      street: text(answer.logradouro),
      neighborhood: text(answer.bairro),
      city,
      uf: answer.uf,
    },
  };
}

/**
 * The address of a CEP from ViaCEP, asked by the browser (SPEC-015 R10): only the CEP leaves it,
 * with no cookie and no referrer. A CEP without its 8 digits is not found without asking; a
 * network failure, a timeout, an error status or an answer out of shape is a failure, and the
 * producer fills the address by hand. Cancelling through `signal` rejects with the abort.
 */
export async function lookupCep(
  cep: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<CepLookup> {
  const digits = digitsOnly(cep);
  if (digits.length !== 8) {
    return { status: "not_found" };
  }
  const { signal, timeoutMs = CEP_LOOKUP_TIMEOUT_MS } = options;
  signal?.throwIfAborted();

  const controller = new AbortController();
  const cancel = (): void => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, timeoutMs);
  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      headers: { Accept: "application/json" },
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (!response.ok) {
      return { status: "failed" };
    }
    return readAnswer(await response.json());
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    return { status: "failed" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
