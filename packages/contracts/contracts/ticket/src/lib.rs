#![no_std]

//! Access ticket: OpenZeppelin NFT extended with event capacity, idempotent minting, check-in and
//! the MVP transfer rules (SPEC-006). The contract owner is the Access platform account (D-24).

mod errors;
mod events;
mod storage;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, panic_with_error, Address, BytesN, Env, String};
use stellar_access::ownable::{self, Ownable};
use stellar_macros::only_owner;
use stellar_tokens::non_fungible::{Base, NonFungibleToken};

pub use errors::TicketError;
pub use storage::{EventData, TicketData};

use events::{CheckedIn, EventCapacitySet};

const NAME: &str = "Access Tickets";
const SYMBOL: &str = "ACCESS";

#[contract]
pub struct TicketContract;

#[contractimpl]
impl TicketContract {
    pub fn __constructor(e: &Env, owner: Address, base_uri: String) {
        ownable::set_owner(e, &owner);
        Base::set_metadata(
            e,
            base_uri,
            String::from_str(e, NAME),
            String::from_str(e, SYMBOL),
        );
        storage::extend_instance(e);
    }

    /// Creates or updates the capacity of an event; it never drops below what was minted.
    #[only_owner]
    pub fn set_event_capacity(
        e: &Env,
        event_id: BytesN<16>,
        capacity: u32,
    ) -> Result<(), TicketError> {
        let minted = storage::event(e, &event_id).map_or(0, |event| event.minted);
        if capacity == 0 || capacity < minted {
            return Err(TicketError::InvalidCapacity);
        }

        storage::set_event(e, &event_id, &EventData { capacity, minted });
        storage::extend_instance(e);
        EventCapacitySet { event_id, capacity }.publish(e);
        Ok(())
    }

    pub fn event(e: &Env, event_id: BytesN<16>) -> Option<EventData> {
        storage::event(e, &event_id)
    }

    /// Mints the ticket identified by `ticket_id`. Repeating the same mint returns the same token,
    /// so retried workers never issue a second NFT. The recipient account does not need to exist
    /// on the ledger yet (D-23).
    #[only_owner]
    pub fn mint(
        e: &Env,
        ticket_id: BytesN<16>,
        event_id: BytesN<16>,
        to: Address,
    ) -> Result<u32, TicketError> {
        if let Some(token_id) = storage::token_of(e, &ticket_id) {
            let ticket = storage::ticket(e, token_id).ok_or(TicketError::TicketNotFound)?;
            if ticket.event_id == event_id && Base::owner_of(e, token_id) == to {
                return Ok(token_id);
            }
            return Err(TicketError::TicketConflict);
        }

        let mut event = storage::event(e, &event_id).ok_or(TicketError::EventNotRegistered)?;
        if event.minted >= event.capacity {
            return Err(TicketError::CapacityExceeded);
        }

        let token_id = Base::sequential_mint(e, &to);
        storage::set_ticket(
            e,
            token_id,
            &TicketData {
                event_id: event_id.clone(),
                ticket_id: ticket_id.clone(),
                checked_in: false,
                transferred: false,
            },
        );
        storage::set_token_of(e, &ticket_id, token_id);
        event.minted += 1;
        storage::set_event(e, &event_id, &event);
        storage::extend_instance(e);
        Ok(token_id)
    }

    pub fn token_of(e: &Env, ticket_id: BytesN<16>) -> Option<u32> {
        storage::token_of(e, &ticket_id)
    }

    pub fn ticket(e: &Env, token_id: u32) -> Result<TicketData, TicketError> {
        storage::ticket(e, token_id).ok_or(TicketError::TicketNotFound)
    }

    #[only_owner]
    pub fn check_in(e: &Env, token_id: u32) -> Result<(), TicketError> {
        let mut ticket = storage::ticket(e, token_id).ok_or(TicketError::TicketNotFound)?;
        if ticket.checked_in {
            return Err(TicketError::AlreadyCheckedIn);
        }

        ticket.checked_in = true;
        storage::set_ticket(e, token_id, &ticket);
        storage::extend_instance(e);
        CheckedIn {
            token_id,
            event_id: ticket.event_id,
        }
        .publish(e);
        Ok(())
    }

    /// The final domain is not defined yet, so the owner can repoint token URIs.
    #[only_owner]
    pub fn set_base_uri(e: &Env, base_uri: String) {
        Base::set_metadata(e, base_uri, Base::name(e), Base::symbol(e));
        storage::extend_instance(e);
    }

    /// In-place upgrade with the `upgrade(new_wasm_hash)` shape expected by `ctg upgrade` (D-25).
    #[only_owner]
    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        e.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

#[contractimpl(contracttrait)]
impl NonFungibleToken for TicketContract {
    type ContractType = Base;

    /// Needs both the holder's and the platform's authorization (D-05). A ticket moves at most
    /// once (D-04) and never after check-in (RN-002); recipient validity is checked off-chain
    /// before the platform co-signs.
    fn transfer(e: &Env, from: Address, to: Address, token_id: u32) {
        ownable::enforce_owner_auth(e);
        if from == to {
            panic_with_error!(e, TicketError::SelfTransfer);
        }

        let mut ticket = storage::ticket(e, token_id)
            .unwrap_or_else(|| panic_with_error!(e, TicketError::TicketNotFound));
        if ticket.checked_in {
            panic_with_error!(e, TicketError::CheckedInNotTransferable);
        }
        if ticket.transferred {
            panic_with_error!(e, TicketError::AlreadyTransferred);
        }

        Base::transfer(e, &from, &to, token_id);
        ticket.transferred = true;
        storage::set_ticket(e, token_id, &ticket);
        storage::extend_instance(e);
    }

    // Approvals would let a ticket move without the platform co-signature.
    fn transfer_from(e: &Env, _spender: Address, _from: Address, _to: Address, _token_id: u32) {
        panic_with_error!(e, TicketError::OperationNotSupported);
    }

    fn approve(
        e: &Env,
        _approver: Address,
        _approved: Address,
        _token_id: u32,
        _live_until_ledger: u32,
    ) {
        panic_with_error!(e, TicketError::OperationNotSupported);
    }

    fn approve_for_all(e: &Env, _owner: Address, _operator: Address, _live_until_ledger: u32) {
        panic_with_error!(e, TicketError::OperationNotSupported);
    }
}

#[contractimpl(contracttrait)]
impl Ownable for TicketContract {
    // Without an owner nothing could be minted or checked in again.
    fn renounce_ownership(e: &Env) {
        panic_with_error!(e, TicketError::OperationNotSupported);
    }
}
