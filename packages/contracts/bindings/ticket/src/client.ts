import {TicketError, EventData, TicketData} from './types.js';
import {Result, Spec, AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions} from '@stellar/stellar-sdk/contract';
import {Address} from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging -- intentional: Client is both the typed interface and the ContractClient subclass that dispatches its methods via Proxy.
export interface Client {
  /**
   * Mints the ticket identified by `ticket_id`. Repeating the same mint returns the same token,
   * so retried workers never issue a second NFT. The recipient account does not need to exist
   * on the ledger yet (D-23).
   */
  mint({ ticket_id, event_id, to }: { ticket_id: Buffer; event_id: Buffer; to: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<number, TicketError>>>;
  /**
   * Returns the token collection name.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   */
  name(options?: MethodOptions): Promise<AssembledTransaction<string>>;
  event({ event_id }: { event_id: Buffer }, options?: MethodOptions): Promise<AssembledTransaction<EventData | null>>;
  /**
   * Returns the token collection symbol.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   */
  symbol(options?: MethodOptions): Promise<AssembledTransaction<string>>;
  ticket({ token_id }: { token_id: number }, options?: MethodOptions): Promise<AssembledTransaction<Result<TicketData, TicketError>>>;
  approve({ approver, approved, token_id, live_until_ledger }: { approver: string | Address; approved: string | Address; token_id: number; live_until_ledger: number }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  /**
   * Returns the number of tokens owned by `account`.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   * * `account` - The address for which the balance is being queried.
   */
  balance({ account }: { account: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<number>>;
  /**
   * In-place upgrade with the `upgrade(new_wasm_hash)` shape expected by `ctg upgrade` (D-25).
   */
  upgrade({ new_wasm_hash }: { new_wasm_hash: Buffer }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  check_in({ token_id }: { token_id: number }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, TicketError>>>;
  /**
   * Returns the owner of the token with `token_id`.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   * * `token_id` - Token ID as a number.
   *
   * # Errors
   *
   * * [`NonFungibleTokenError::NonExistentToken`] - If the token does not
   * exist.
   */
  owner_of({ token_id }: { token_id: number }, options?: MethodOptions): Promise<AssembledTransaction<string>>;
  token_of({ ticket_id }: { ticket_id: Buffer }, options?: MethodOptions): Promise<AssembledTransaction<number | null>>;
  /**
   * Needs both the holder's and the platform's authorization (D-05). A ticket moves at most
   * once (D-04) and never after check-in (RN-002); recipient validity is checked off-chain
   * before the platform co-signs.
   */
  transfer({ from, to, token_id }: { from: string | Address; to: string | Address; token_id: number }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  /**
   * Returns `Some(Address)` if ownership is set, or `None` if ownership has
   * been renounced.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   */
  get_owner(options?: MethodOptions): Promise<AssembledTransaction<string | null>>;
  /**
   * Returns the Uniform Resource Identifier (URI) for the token with
   * `token_id`.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   * * `token_id` - Token ID as a number.
   *
   * # Notes
   *
   * If the token does not exist, this function is expected to panic.
   */
  token_uri({ token_id }: { token_id: number }, options?: MethodOptions): Promise<AssembledTransaction<string>>;
  /**
   * Returns the account approved for the token with `token_id`.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   * * `token_id` - Token ID as a number.
   *
   * # Errors
   *
   * * [`NonFungibleTokenError::NonExistentToken`] - If the token does not
   * exist.
   */
  get_approved({ token_id }: { token_id: number }, options?: MethodOptions): Promise<AssembledTransaction<string | null>>;
  /**
   * The final domain is not defined yet, so the owner can repoint token URIs.
   */
  set_base_uri({ base_uri }: { base_uri: string }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  transfer_from({ spender, from, to, token_id }: { spender: string | Address; from: string | Address; to: string | Address; token_id: number }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  approve_for_all({ owner, operator, live_until_ledger }: { owner: string | Address; operator: string | Address; live_until_ledger: number }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  /**
   * Accepts a pending ownership transfer.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   *
   * # Errors
   *
   * * [`crate::role_transfer::RoleTransferError::NoPendingTransfer`] - If
   * there is no pending transfer to accept.
   *
   * # Events
   *
   * * topics - `["ownership_transfer_completed"]`
   * * data - `[new_owner: Address]`
   */
  accept_ownership(options?: MethodOptions): Promise<AssembledTransaction<void>>;
  renounce_ownership(options?: MethodOptions): Promise<AssembledTransaction<void>>;
  /**
   * Creates or updates the capacity of an event; it never drops below what was minted.
   */
  set_event_capacity({ event_id, capacity }: { event_id: Buffer; capacity: number }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, TicketError>>>;
  /**
   * Initiates a 2-step ownership transfer to a new address.
   *
   * Requires authorization from the current owner. The new owner must later
   * call `accept_ownership()` to complete the transfer.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   * * `new_owner` - The proposed new owner.
   * * `live_until_ledger` - Ledger number until which the new owner can
   * accept. A value of `0` cancels any pending transfer.
   *
   * # Errors
   *
   * * [`OwnableError::OwnerNotSet`] - If the owner is not set.
   * * [`crate::role_transfer::RoleTransferError::NoPendingTransfer`] - If
   * trying to cancel a transfer that doesn't exist.
   * * [`crate::role_transfer::RoleTransferError::InvalidLiveUntilLedger`] -
   * If the specified ledger is in the past.
   * * [`crate::role_transfer::RoleTransferError::InvalidPendingAccount`] -
   * If the specified pending account is not the same as the provided `new`
   * address.
   *
   * # Notes
   *
   * * Authorization for the current owner is required.
   */
  transfer_ownership({ new_owner, live_until_ledger }: { new_owner: string | Address; live_until_ledger: number }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  /**
   * Returns whether the `operator` is allowed to manage all the assets of
   * `owner`.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   * * `owner` - Account of the token's owner.
   * * `operator` - Account to be checked.
   */
  is_approved_for_all({ owner, operator }: { owner: string | Address; operator: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<boolean>>;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging -- intentional: Client is both the typed interface and the ContractClient subclass that dispatches its methods via Proxy.
export class Client extends ContractClient {
  constructor(public readonly options: ContractClientOptions) {
    super(
      new Spec(["AAAAAAAAAM9NaW50cyB0aGUgdGlja2V0IGlkZW50aWZpZWQgYnkgYHRpY2tldF9pZGAuIFJlcGVhdGluZyB0aGUgc2FtZSBtaW50IHJldHVybnMgdGhlIHNhbWUgdG9rZW4sCnNvIHJldHJpZWQgd29ya2VycyBuZXZlciBpc3N1ZSBhIHNlY29uZCBORlQuIFRoZSByZWNpcGllbnQgYWNjb3VudCBkb2VzIG5vdCBuZWVkIHRvIGV4aXN0Cm9uIHRoZSBsZWRnZXIgeWV0IChELTIzKS4AAAAABG1pbnQAAAADAAAAAAAAAAl0aWNrZXRfaWQAAAAAAAPuAAAAEAAAAAAAAAAIZXZlbnRfaWQAAAPuAAAAEAAAAAAAAAACdG8AAAAAABMAAAABAAAD6QAAAAQAAAfQAAAAC1RpY2tldEVycm9yAA==", "AAAAAAAAAFtSZXR1cm5zIHRoZSB0b2tlbiBjb2xsZWN0aW9uIG5hbWUuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAAAARuYW1lAAAAAAAAAAEAAAAQ", "AAAAAAAAAAAAAAAFZXZlbnQAAAAAAAABAAAAAAAAAAhldmVudF9pZAAAA+4AAAAQAAAAAQAAA+gAAAfQAAAACUV2ZW50RGF0YQAAAA==", "AAAAAAAAAF1SZXR1cm5zIHRoZSB0b2tlbiBjb2xsZWN0aW9uIHN5bWJvbC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4AAAAAAAAGc3ltYm9sAAAAAAAAAAAAAQAAABA=", "AAAAAAAAAAAAAAAGdGlja2V0AAAAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAABAAAD6QAAB9AAAAAKVGlja2V0RGF0YQAAAAAH0AAAAAtUaWNrZXRFcnJvcgA=", "AAAAAAAAAAAAAAAHYXBwcm92ZQAAAAAEAAAAAAAAAAhhcHByb3ZlcgAAABMAAAAAAAAACGFwcHJvdmVkAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAAA", "AAAAAAAAAKtSZXR1cm5zIHRoZSBudW1iZXIgb2YgdG9rZW5zIG93bmVkIGJ5IGBhY2NvdW50YC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWRkcmVzcyBmb3Igd2hpY2ggdGhlIGJhbGFuY2UgaXMgYmVpbmcgcXVlcmllZC4AAAAAB2JhbGFuY2UAAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAQ=", "AAAAAAAAAFpJbi1wbGFjZSB1cGdyYWRlIHdpdGggdGhlIGB1cGdyYWRlKG5ld193YXNtX2hhc2gpYCBzaGFwZSBleHBlY3RlZCBieSBgY3RnIHVwZ3JhZGVgIChELTI1KS4AAAAAAAd1cGdyYWRlAAAAAAEAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=", "AAAAAAAAAAAAAAAIY2hlY2tfaW4AAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAABAAAD6QAAAAIAAAfQAAAAC1RpY2tldEVycm9yAA==", "AAAAAAAAAOVSZXR1cm5zIHRoZSBvd25lciBvZiB0aGUgdG9rZW4gd2l0aCBgdG9rZW5faWRgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGB0b2tlbl9pZGAgLSBUb2tlbiBJRCBhcyBhIG51bWJlci4KCiMgRXJyb3JzCgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpOb25FeGlzdGVudFRva2VuYF0gLSBJZiB0aGUgdG9rZW4gZG9lcyBub3QKZXhpc3QuAAAAAAAACG93bmVyX29mAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAABM=", "AAAAAAAAAAAAAAAIdG9rZW5fb2YAAAABAAAAAAAAAAl0aWNrZXRfaWQAAAAAAAPuAAAAEAAAAAEAAAPoAAAABA==", "AAAAAAAAAMxOZWVkcyBib3RoIHRoZSBob2xkZXIncyBhbmQgdGhlIHBsYXRmb3JtJ3MgYXV0aG9yaXphdGlvbiAoRC0wNSkuIEEgdGlja2V0IG1vdmVzIGF0IG1vc3QKb25jZSAoRC0wNCkgYW5kIG5ldmVyIGFmdGVyIGNoZWNrLWluIChSTi0wMDIpOyByZWNpcGllbnQgdmFsaWRpdHkgaXMgY2hlY2tlZCBvZmYtY2hhaW4KYmVmb3JlIHRoZSBwbGF0Zm9ybSBjby1zaWducy4AAAAIdHJhbnNmZXIAAAADAAAAAAAAAARmcm9tAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAACHRva2VuX2lkAAAABAAAAAA=", "AAAAAAAAAJBSZXR1cm5zIGBTb21lKEFkZHJlc3MpYCBpZiBvd25lcnNoaXAgaXMgc2V0LCBvciBgTm9uZWAgaWYgb3duZXJzaGlwIGhhcwpiZWVuIHJlbm91bmNlZC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4AAAAJZ2V0X293bmVyAAAAAAAAAAAAAAEAAAPoAAAAEw==", "AAAAAAAAAPVSZXR1cm5zIHRoZSBVbmlmb3JtIFJlc291cmNlIElkZW50aWZpZXIgKFVSSSkgZm9yIHRoZSB0b2tlbiB3aXRoCmB0b2tlbl9pZGAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHRva2VuX2lkYCAtIFRva2VuIElEIGFzIGEgbnVtYmVyLgoKIyBOb3RlcwoKSWYgdGhlIHRva2VuIGRvZXMgbm90IGV4aXN0LCB0aGlzIGZ1bmN0aW9uIGlzIGV4cGVjdGVkIHRvIHBhbmljLgAAAAAAAAl0b2tlbl91cmkAAAAAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAABAAAAEA==", "AAAAAAAAAPFSZXR1cm5zIHRoZSBhY2NvdW50IGFwcHJvdmVkIGZvciB0aGUgdG9rZW4gd2l0aCBgdG9rZW5faWRgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGB0b2tlbl9pZGAgLSBUb2tlbiBJRCBhcyBhIG51bWJlci4KCiMgRXJyb3JzCgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpOb25FeGlzdGVudFRva2VuYF0gLSBJZiB0aGUgdG9rZW4gZG9lcyBub3QKZXhpc3QuAAAAAAAADGdldF9hcHByb3ZlZAAAAAEAAAAAAAAACHRva2VuX2lkAAAABAAAAAEAAAPoAAAAEw==", "AAAAAAAAAElUaGUgZmluYWwgZG9tYWluIGlzIG5vdCBkZWZpbmVkIHlldCwgc28gdGhlIG93bmVyIGNhbiByZXBvaW50IHRva2VuIFVSSXMuAAAAAAAADHNldF9iYXNlX3VyaQAAAAEAAAAAAAAACGJhc2VfdXJpAAAAEAAAAAA=", "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAIYmFzZV91cmkAAAAQAAAAAA==", "AAAAAAAAAAAAAAANdHJhbnNmZXJfZnJvbQAAAAAAAAQAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAAEZnJvbQAAABMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAAA", "AAAAAAAAAAAAAAAPYXBwcm92ZV9mb3JfYWxsAAAAAAMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAAA", "AAAAAAAAATBBY2NlcHRzIGEgcGVuZGluZyBvd25lcnNoaXAgdHJhbnNmZXIuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCgojIEVycm9ycwoKKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRoZXJlIGlzIG5vIHBlbmRpbmcgdHJhbnNmZXIgdG8gYWNjZXB0LgoKIyBFdmVudHMKCiogdG9waWNzIC0gYFsib3duZXJzaGlwX3RyYW5zZmVyX2NvbXBsZXRlZCJdYAoqIGRhdGEgLSBgW25ld19vd25lcjogQWRkcmVzc11gAAAAEGFjY2VwdF9vd25lcnNoaXAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAScmVub3VuY2Vfb3duZXJzaGlwAAAAAAAAAAAAAA==", "AAAAAAAAAFJDcmVhdGVzIG9yIHVwZGF0ZXMgdGhlIGNhcGFjaXR5IG9mIGFuIGV2ZW50OyBpdCBuZXZlciBkcm9wcyBiZWxvdyB3aGF0IHdhcyBtaW50ZWQuAAAAAAASc2V0X2V2ZW50X2NhcGFjaXR5AAAAAAACAAAAAAAAAAhldmVudF9pZAAAA+4AAAAQAAAAAAAAAAhjYXBhY2l0eQAAAAQAAAABAAAD6QAAAAIAAAfQAAAAC1RpY2tldEVycm9yAA==", "AAAAAAAAA45Jbml0aWF0ZXMgYSAyLXN0ZXAgb3duZXJzaGlwIHRyYW5zZmVyIHRvIGEgbmV3IGFkZHJlc3MuCgpSZXF1aXJlcyBhdXRob3JpemF0aW9uIGZyb20gdGhlIGN1cnJlbnQgb3duZXIuIFRoZSBuZXcgb3duZXIgbXVzdCBsYXRlcgpjYWxsIGBhY2NlcHRfb3duZXJzaGlwKClgIHRvIGNvbXBsZXRlIHRoZSB0cmFuc2Zlci4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgbmV3X293bmVyYCAtIFRoZSBwcm9wb3NlZCBuZXcgb3duZXIuCiogYGxpdmVfdW50aWxfbGVkZ2VyYCAtIExlZGdlciBudW1iZXIgdW50aWwgd2hpY2ggdGhlIG5ldyBvd25lciBjYW4KYWNjZXB0LiBBIHZhbHVlIG9mIGAwYCBjYW5jZWxzIGFueSBwZW5kaW5nIHRyYW5zZmVyLgoKIyBFcnJvcnMKCiogW2BPd25hYmxlRXJyb3I6Ok93bmVyTm90U2V0YF0gLSBJZiB0aGUgb3duZXIgaXMgbm90IHNldC4KKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRyeWluZyB0byBjYW5jZWwgYSB0cmFuc2ZlciB0aGF0IGRvZXNuJ3QgZXhpc3QuCiogW2BjcmF0ZTo6cm9sZV90cmFuc2Zlcjo6Um9sZVRyYW5zZmVyRXJyb3I6OkludmFsaWRMaXZlVW50aWxMZWRnZXJgXSAtCklmIHRoZSBzcGVjaWZpZWQgbGVkZ2VyIGlzIGluIHRoZSBwYXN0LgoqIFtgY3JhdGU6OnJvbGVfdHJhbnNmZXI6OlJvbGVUcmFuc2ZlckVycm9yOjpJbnZhbGlkUGVuZGluZ0FjY291bnRgXSAtCklmIHRoZSBzcGVjaWZpZWQgcGVuZGluZyBhY2NvdW50IGlzIG5vdCB0aGUgc2FtZSBhcyB0aGUgcHJvdmlkZWQgYG5ld2AKYWRkcmVzcy4KCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgb3duZXIgaXMgcmVxdWlyZWQuAAAAAAASdHJhbnNmZXJfb3duZXJzaGlwAAAAAAACAAAAAAAAAAluZXdfb3duZXIAAAAAAAATAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAAA", "AAAAAAAAANdSZXR1cm5zIHdoZXRoZXIgdGhlIGBvcGVyYXRvcmAgaXMgYWxsb3dlZCB0byBtYW5hZ2UgYWxsIHRoZSBhc3NldHMgb2YKYG93bmVyYC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgb3duZXJgIC0gQWNjb3VudCBvZiB0aGUgdG9rZW4ncyBvd25lci4KKiBgb3BlcmF0b3JgIC0gQWNjb3VudCB0byBiZSBjaGVja2VkLgAAAAATaXNfYXBwcm92ZWRfZm9yX2FsbAAAAAACAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAEAAAAB", "AAAABAAAAAAAAAAAAAAAC1RpY2tldEVycm9yAAAAAAoAAAAAAAAAEkV2ZW50Tm90UmVnaXN0ZXJlZAAAAAAD6AAAAAAAAAAPSW52YWxpZENhcGFjaXR5AAAAA+kAAAAAAAAAEENhcGFjaXR5RXhjZWVkZWQAAAPqAAAAAAAAAA5UaWNrZXRDb25mbGljdAAAAAAD6wAAAAAAAAAOVGlja2V0Tm90Rm91bmQAAAAAA+wAAAAAAAAAEEFscmVhZHlDaGVja2VkSW4AAAPtAAAAAAAAABJBbHJlYWR5VHJhbnNmZXJyZWQAAAAAA+4AAAAAAAAAGENoZWNrZWRJbk5vdFRyYW5zZmVyYWJsZQAAA+8AAAAAAAAADFNlbGZUcmFuc2ZlcgAAA/AAAAAAAAAAFU9wZXJhdGlvbk5vdFN1cHBvcnRlZAAAAAAAA/E=", "AAAABQAAAAAAAAAAAAAACUNoZWNrZWRJbgAAAAAAAAEAAAAKY2hlY2tlZF9pbgAAAAAAAgAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAAAAAAAAIZXZlbnRfaWQAAAPuAAAAEAAAAAEAAAAC", "AAAABQAAAAAAAAAAAAAAEEV2ZW50Q2FwYWNpdHlTZXQAAAABAAAAEmV2ZW50X2NhcGFjaXR5X3NldAAAAAAAAgAAAAAAAAAIZXZlbnRfaWQAAAPuAAAAEAAAAAEAAAAAAAAACGNhcGFjaXR5AAAABAAAAAAAAAAC", "AAAAAQAAAAAAAAAAAAAACUV2ZW50RGF0YQAAAAAAAAIAAAAAAAAACGNhcGFjaXR5AAAABAAAAAAAAAAGbWludGVkAAAAAAAE", "AAAAAQAAAFJUaWNrZXQgc3RhdGUga2VwdCBvbi1jaGFpbi4gT25seSBpZGVudGlmaWVycyBhbmQgZmxhZ3M6IG5vIHBlcnNvbmFsIGRhdGEgKFJOLTAxMCkuAAAAAAAAAAAAClRpY2tldERhdGEAAAAAAAQAAAAAAAAACmNoZWNrZWRfaW4AAAAAAAEAAAAAAAAACGV2ZW50X2lkAAAD7gAAABAAAAAAAAAACXRpY2tldF9pZAAAAAAAA+4AAAAQAAAAAAAAAAt0cmFuc2ZlcnJlZAAAAAAB", "AAAABAAAAAAAAAAAAAAAEVJvbGVUcmFuc2ZlckVycm9yAAAAAAAABAAAAAAAAAARTm9QZW5kaW5nVHJhbnNmZXIAAAAAAAiYAAAAAAAAABZJbnZhbGlkTGl2ZVVudGlsTGVkZ2VyAAAAAAiZAAAAAAAAABVJbnZhbGlkUGVuZGluZ0FjY291bnQAAAAAAAiaAAAAAAAAAA9UcmFuc2ZlckV4cGlyZWQAAAAImw==", "AAAABAAAAAAAAAAAAAAADE93bmFibGVFcnJvcgAAAAMAAAAAAAAAC093bmVyTm90U2V0AAAACDQAAAAAAAAAElRyYW5zZmVySW5Qcm9ncmVzcwAAAAAINQAAAAAAAAAPT3duZXJBbHJlYWR5U2V0AAAACDY=", "AAAABQAAADZFdmVudCBlbWl0dGVkIHdoZW4gYW4gb3duZXJzaGlwIHRyYW5zZmVyIGlzIGluaXRpYXRlZC4AAAAAAAAAAAART3duZXJzaGlwVHJhbnNmZXIAAAAAAAABAAAAEm93bmVyc2hpcF90cmFuc2ZlcgAAAAAAAwAAAAAAAAAJb2xkX293bmVyAAAAAAAAEwAAAAAAAAAAAAAACW5ld19vd25lcgAAAAAAABMAAAAAAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAAAAAAAAg==", "AAAABQAAADZFdmVudCBlbWl0dGVkIHdoZW4gYW4gb3duZXJzaGlwIHRyYW5zZmVyIGlzIGNvbXBsZXRlZC4AAAAAAAAAAAAaT3duZXJzaGlwVHJhbnNmZXJDb21wbGV0ZWQAAAAAAAEAAAAcb3duZXJzaGlwX3RyYW5zZmVyX2NvbXBsZXRlZAAAAAEAAAAAAAAACW5ld19vd25lcgAAAAAAABMAAAAAAAAAAg==", "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gYSB0b2tlbiBpcyBtaW50ZWQuAAAAAAAAAAAAAARNaW50AAAAAQAAAARtaW50AAAAAgAAAAAAAAACdG8AAAAAABMAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAAAAAAAAg==", "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gYSB0b2tlbiBpcyB0cmFuc2ZlcnJlZC4AAAAAAAAAAAAIVHJhbnNmZXIAAAABAAAACHRyYW5zZmVyAAAAAwAAAAAAAAAEZnJvbQAAABMAAAABAAAAAAAAAAJ0bwAAAAAAEwAAAAEAAAAAAAAACHRva2VuX2lkAAAABAAAAAAAAAAC", "AAAABAAAAAAAAAAAAAAAFU5vbkZ1bmdpYmxlVG9rZW5FcnJvcgAAAAAAAA8AAAAkSW5kaWNhdGVzIGEgbm9uLWV4aXN0ZW50IGB0b2tlbl9pZGAuAAAAEE5vbkV4aXN0ZW50VG9rZW4AAADIAAAAV0luZGljYXRlcyBhbiBlcnJvciByZWxhdGVkIHRvIHRoZSBvd25lcnNoaXAgb3ZlciBhIHBhcnRpY3VsYXIgdG9rZW4uClVzZWQgaW4gdHJhbnNmZXJzLgAAAAAOSW5jb3JyZWN0T3duZXIAAAAAAMkAAABFSW5kaWNhdGVzIGEgZmFpbHVyZSB3aXRoIHRoZSBgb3BlcmF0b3JgcyBhcHByb3ZhbC4gVXNlZCBpbiB0cmFuc2ZlcnMuAAAAAAAAFEluc3VmZmljaWVudEFwcHJvdmFsAAAAygAAAFVJbmRpY2F0ZXMgYSBmYWlsdXJlIHdpdGggdGhlIGBhcHByb3ZlcmAgb2YgYSB0b2tlbiB0byBiZSBhcHByb3ZlZC4gVXNlZAppbiBhcHByb3ZhbHMuAAAAAAAAD0ludmFsaWRBcHByb3ZlcgAAAADLAAAASkluZGljYXRlcyBhbiBpbnZhbGlkIHZhbHVlIGZvciBgbGl2ZV91bnRpbF9sZWRnZXJgIHdoZW4gc2V0dGluZwphcHByb3ZhbHMuAAAAAAAWSW52YWxpZExpdmVVbnRpbExlZGdlcgAAAAAAzAAAAClJbmRpY2F0ZXMgb3ZlcmZsb3cgd2hlbiBhZGRpbmcgdHdvIHZhbHVlcwAAAAAAAAxNYXRoT3ZlcmZsb3cAAADNAAAANkluZGljYXRlcyBhbGwgcG9zc2libGUgYHRva2VuX2lkYHMgYXJlIGFscmVhZHkgaW4gdXNlLgAAAAAAE1Rva2VuSURzQXJlRGVwbGV0ZWQAAAAAzgAAAEVJbmRpY2F0ZXMgYW4gaW52YWxpZCBhbW91bnQgdG8gYmF0Y2ggbWludCBpbiBgY29uc2VjdXRpdmVgIGV4dGVuc2lvbi4AAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAM8AAAAzSW5kaWNhdGVzIHRoZSB0b2tlbiBkb2VzIG5vdCBleGlzdCBpbiBvd25lcidzIGxpc3QuAAAAABhUb2tlbk5vdEZvdW5kSW5Pd25lckxpc3QAAADQAAAAMkluZGljYXRlcyB0aGUgdG9rZW4gZG9lcyBub3QgZXhpc3QgaW4gZ2xvYmFsIGxpc3QuAAAAAAAZVG9rZW5Ob3RGb3VuZEluR2xvYmFsTGlzdAAAAAAAANEAAAAjSW5kaWNhdGVzIGFjY2VzcyB0byB1bnNldCBtZXRhZGF0YS4AAAAADVVuc2V0TWV0YWRhdGEAAAAAAADSAAAAQUluZGljYXRlcyB0aGUgbGVuZ3RoIG9mIHRoZSBiYXNlIFVSSSBleGNlZWRzIHRoZSBtYXhpbXVtIGFsbG93ZWQuAAAAAAAAFUJhc2VVcmlNYXhMZW5FeGNlZWRlZAAAAAAAANMAAABHSW5kaWNhdGVzIHRoZSByb3lhbHR5IGFtb3VudCBpcyBoaWdoZXIgdGhhbiAxMF8wMDAgKDEwMCUpIGJhc2lzIHBvaW50cy4AAAAAFEludmFsaWRSb3lhbHR5QW1vdW50AAAA1AAAAD1JbmRpY2F0ZXMgdGhlIGxlbmd0aCBvZiB0aGUgbmFtZSBleGNlZWRzIHRoZSBtYXhpbXVtIGFsbG93ZWQuAAAAAAAAEk5hbWVNYXhMZW5FeGNlZWRlZAAAAAAA1QAAAD9JbmRpY2F0ZXMgdGhlIGxlbmd0aCBvZiB0aGUgc3ltYm9sIGV4Y2VlZHMgdGhlIG1heGltdW0gYWxsb3dlZC4AAAAAFFN5bWJvbE1heExlbkV4Y2VlZGVkAAAA1g=="]),
      options
    );
  }

   static deploy<T = Client>({ owner, base_uri }: { owner: string | Address; base_uri: string }, options: MethodOptions & Omit<ContractClientOptions, 'contractId'> & { wasmHash: Buffer | string; salt?: Buffer | Uint8Array; format?: "hex" | "base64"; address?: string; }): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({ owner, base_uri }, options);
  }
  public readonly fromJSON = {
    mint : this.txFromJSON<Result<number, TicketError>>,  name : this.txFromJSON<string>,  event : this.txFromJSON<EventData | null>,  symbol : this.txFromJSON<string>,  ticket : this.txFromJSON<Result<TicketData, TicketError>>,  approve : this.txFromJSON<void>,  balance : this.txFromJSON<number>,  upgrade : this.txFromJSON<void>,  check_in : this.txFromJSON<Result<null, TicketError>>,  owner_of : this.txFromJSON<string>,  token_of : this.txFromJSON<number | null>,  transfer : this.txFromJSON<void>,  get_owner : this.txFromJSON<string | null>,  token_uri : this.txFromJSON<string>,  get_approved : this.txFromJSON<string | null>,  set_base_uri : this.txFromJSON<void>,  transfer_from : this.txFromJSON<void>,  approve_for_all : this.txFromJSON<void>,  accept_ownership : this.txFromJSON<void>,  renounce_ownership : this.txFromJSON<void>,  set_event_capacity : this.txFromJSON<Result<null, TicketError>>,  transfer_ownership : this.txFromJSON<void>,  is_approved_for_all : this.txFromJSON<boolean>
  };
}