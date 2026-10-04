import { Buffer } from 'buffer';

    /**
 * Error Enum: TicketError
 */
export const TicketError = {
  1000 : { message: "EventNotRegistered" },
  1001 : { message: "InvalidCapacity" },
  1002 : { message: "CapacityExceeded" },
  1003 : { message: "TicketConflict" },
  1004 : { message: "TicketNotFound" },
  1005 : { message: "AlreadyCheckedIn" },
  1006 : { message: "AlreadyTransferred" },
  1007 : { message: "CheckedInNotTransferable" },
  1008 : { message: "SelfTransfer" },
  1009 : { message: "OperationNotSupported" }
}

export interface TicketError {
  message: string;
}

/**
 * Struct: EventData
 */
export interface EventData {
  capacity: number;
  minted: number;
}

/**
 * Ticket state kept on-chain. Only identifiers and flags: no personal data (RN-010).
 */
export interface TicketData {
  checked_in: boolean;
  event_id: Buffer;
  ticket_id: Buffer;
  transferred: boolean;
}

/**
 * Error Enum: RoleTransferError
 */
export const RoleTransferError = {
  2200 : { message: "NoPendingTransfer" },
  2201 : { message: "InvalidLiveUntilLedger" },
  2202 : { message: "InvalidPendingAccount" },
  2203 : { message: "TransferExpired" }
}

export interface RoleTransferError {
  message: string;
}

/**
 * Error Enum: OwnableError
 */
export const OwnableError = {
  2100 : { message: "OwnerNotSet" },
  2101 : { message: "TransferInProgress" },
  2102 : { message: "OwnerAlreadySet" }
}

export interface OwnableError {
  message: string;
}

/**
 * Error Enum: NonFungibleTokenError
 */
export const NonFungibleTokenError = {
  /**
   * Indicates a non-existent `token_id`.
   */
  200 : { message: "NonExistentToken" },
  /**
   * Indicates an error related to the ownership over a particular token.
   * Used in transfers.
   */
  201 : { message: "IncorrectOwner" },
  /**
   * Indicates a failure with the `operator`s approval. Used in transfers.
   */
  202 : { message: "InsufficientApproval" },
  /**
   * Indicates a failure with the `approver` of a token to be approved. Used
   * in approvals.
   */
  203 : { message: "InvalidApprover" },
  /**
   * Indicates an invalid value for `live_until_ledger` when setting
   * approvals.
   */
  204 : { message: "InvalidLiveUntilLedger" },
  /**
   * Indicates overflow when adding two values
   */
  205 : { message: "MathOverflow" },
  /**
   * Indicates all possible `token_id`s are already in use.
   */
  206 : { message: "TokenIDsAreDepleted" },
  /**
   * Indicates an invalid amount to batch mint in `consecutive` extension.
   */
  207 : { message: "InvalidAmount" },
  /**
   * Indicates the token does not exist in owner's list.
   */
  208 : { message: "TokenNotFoundInOwnerList" },
  /**
   * Indicates the token does not exist in global list.
   */
  209 : { message: "TokenNotFoundInGlobalList" },
  /**
   * Indicates access to unset metadata.
   */
  210 : { message: "UnsetMetadata" },
  /**
   * Indicates the length of the base URI exceeds the maximum allowed.
   */
  211 : { message: "BaseUriMaxLenExceeded" },
  /**
   * Indicates the royalty amount is higher than 10_000 (100%) basis points.
   */
  212 : { message: "InvalidRoyaltyAmount" },
  /**
   * Indicates the length of the name exceeds the maximum allowed.
   */
  213 : { message: "NameMaxLenExceeded" },
  /**
   * Indicates the length of the symbol exceeds the maximum allowed.
   */
  214 : { message: "SymbolMaxLenExceeded" }
}

export interface NonFungibleTokenError {
  message: string;
}
    