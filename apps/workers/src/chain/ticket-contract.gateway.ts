import { Keypair } from "@stellar/stellar-sdk";
import { basicNodeSigner, Client } from "@stellar/stellar-sdk/contract";

export interface OnChainEvent {
  capacity: number;
  minted: number;
}

export interface MintResult {
  tokenId: number;
  /** Null when the ticket was already on-chain and no transaction was sent. */
  transactionHash: string | null;
}

/** The three TicketContract calls the MintTicketWorker needs (SPEC-006 §5). */
export interface TicketContractGateway {
  event(eventId: string): Promise<OnChainEvent | null>;
  setEventCapacity(eventId: string, capacity: number): Promise<void>;
  mint(ticketId: string, eventId: string, to: string): Promise<MintResult>;
}

export const TICKET_CONTRACT_GATEWAY = Symbol("TICKET_CONTRACT_GATEWAY");

/** A contract error is final for the job; anything else (RPC, timeout) is retried. */
export class TicketContractError extends Error {
  constructor(
    readonly operation: string,
    readonly contractCode: number | undefined,
  ) {
    super(
      `TicketContract ${operation} failed${contractCode === undefined ? "" : ` (#${contractCode})`}`,
    );
    this.name = "TicketContractError";
  }
}

export interface SorobanTicketContractGatewayOptions {
  contractId: string;
  rpcUrl: string;
  networkPassphrase: string;
  signerSecretKey: string;
}

// The contract stores UUIDs as BytesN<16> (MVP-REVISADO §7).
export function uuidToBytes(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) {
    throw new Error("invalid_uuid");
  }
  return Buffer.from(hex, "hex");
}

interface ContractResult<T> {
  isOk(): boolean;
  unwrap(): T;
  unwrapErr(): { code?: number };
}

interface AssembledCall<T> {
  isReadCall: boolean;
  result: T;
  signAndSend(): Promise<{ result: T; sendTransactionResponse?: { hash: string } }>;
}

type DynamicMethod<T> = (args: Record<string, unknown>) => Promise<AssembledCall<T>>;

/**
 * Talks to the deployed TicketContract through the SDK's spec-driven client, which loads the
 * interface from the network. The versioned Caatinga bindings pin that interface in tests.
 * The platform account signs and pays the fee (D-24, ADR-010).
 */
export class SorobanTicketContractGateway implements TicketContractGateway {
  private client: Promise<Client> | undefined;

  constructor(private readonly options: SorobanTicketContractGatewayOptions) {}

  async event(eventId: string): Promise<OnChainEvent | null> {
    const call = await this.method<unknown>("event")({ event_id: uuidToBytes(eventId) });
    const value = call.result;
    if (value === null || value === undefined) {
      return null;
    }
    const event = value as { capacity?: unknown; minted?: unknown };
    if (typeof event.capacity !== "number" || typeof event.minted !== "number") {
      throw new TicketContractError("event_invalid_response", undefined);
    }
    return { capacity: event.capacity, minted: event.minted };
  }

  async setEventCapacity(eventId: string, capacity: number): Promise<void> {
    const call = await this.method<ContractResult<null>>("set_event_capacity")({
      event_id: uuidToBytes(eventId),
      capacity,
    });
    this.unwrap("set_event_capacity", call.result);
    const sent = await call.signAndSend();
    this.unwrap("set_event_capacity", sent.result);
  }

  // A retried job finds the ticket through the free token_of read instead of paying for a
  // repeated mint: mint is owner-authorized, so even its idempotent path is a transaction.
  async mint(ticketId: string, eventId: string, to: string): Promise<MintResult> {
    const existing = await this.method<number | null | undefined>("token_of")({
      ticket_id: uuidToBytes(ticketId),
    });
    if (typeof existing.result === "number") {
      return { tokenId: existing.result, transactionHash: null };
    }

    const call = await this.method<ContractResult<number>>("mint")({
      ticket_id: uuidToBytes(ticketId),
      event_id: uuidToBytes(eventId),
      to,
    });
    const simulated = this.unwrap("mint", call.result);
    if (call.isReadCall) {
      return { tokenId: simulated, transactionHash: null };
    }

    const sent = await call.signAndSend();
    return {
      tokenId: this.unwrap("mint", sent.result),
      transactionHash: sent.sendTransactionResponse?.hash ?? null,
    };
  }

  private method<T>(name: string): DynamicMethod<T> {
    return async (args) => {
      const client = await this.loadClient();
      const method = (client as unknown as Record<string, DynamicMethod<T> | undefined>)[name];
      if (method === undefined) {
        throw new TicketContractError(`${name}_missing`, undefined);
      }
      return method(args);
    };
  }

  private unwrap<T>(operation: string, result: ContractResult<T>): T {
    if (!result.isOk()) {
      throw new TicketContractError(operation, result.unwrapErr().code);
    }
    return result.unwrap();
  }

  private loadClient(): Promise<Client> {
    if (this.client === undefined) {
      const signer = Keypair.fromSecret(this.options.signerSecretKey);
      this.client = Client.from({
        contractId: this.options.contractId,
        rpcUrl: this.options.rpcUrl,
        networkPassphrase: this.options.networkPassphrase,
        publicKey: signer.publicKey(),
        ...basicNodeSigner(signer, this.options.networkPassphrase),
      }).catch((error: unknown) => {
        this.client = undefined;
        throw error;
      });
    }
    return this.client;
  }
}
