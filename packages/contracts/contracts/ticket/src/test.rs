#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::{storage::Persistent as _, Address as _, Events as _},
    xdr::{ContractEventBody, ScVal},
    Address, BytesN, Env, InvokeError, String,
};

use crate::{
    storage::{DataKey, TTL_EXTEND_TO},
    EventData, TicketContract, TicketContractClient, TicketData, TicketError,
};

const BASE_URI: &str = "https://access.invalid/tickets/";
// A valid account strkey that has never been created in the test ledger.
const UNFUNDED_ACCOUNT: &str = "GCQSSIMOW5OCGULZATDXKU5MOJBOMFX6G65X6CXZDQ7AIB3SKFUZ67NX";

struct Setup<'a> {
    env: Env,
    owner: Address,
    client: TicketContractClient<'a>,
}

fn setup() -> Setup<'static> {
    let env = Env::default();
    env.mock_all_auths();
    let owner = Address::generate(&env);
    let contract_id = env.register(
        TicketContract,
        (owner.clone(), String::from_str(&env, BASE_URI)),
    );
    let client = TicketContractClient::new(&env, &contract_id);
    Setup { env, owner, client }
}

fn id(env: &Env, seed: u8) -> BytesN<16> {
    BytesN::from_array(env, &[seed; 16])
}

// Typed error returned by functions declared with `Result<_, TicketError>`.
fn contract_error(error: TicketError) -> Result<TicketError, InvokeError> {
    Ok(error)
}

// Error raised with `panic_with_error!` inside the overridden NFT/Ownable trait functions.
fn trait_error(error: TicketError) -> Result<soroban_sdk::Error, InvokeError> {
    Ok(soroban_sdk::Error::from_contract_error(error as u32))
}

// Names (first topic) of the events published by the last invocation.
fn published_event_names(env: &Env) -> std::vec::Vec<std::string::String> {
    env.events()
        .all()
        .events()
        .iter()
        .filter_map(|event| match &event.body {
            ContractEventBody::V0(body) => match body.topics.first() {
                Some(ScVal::Symbol(name)) => Some(name.0.to_utf8_string_lossy()),
                _ => None,
            },
        })
        .collect()
}

#[test]
fn constructor_sets_owner_and_metadata() {
    let Setup { env, owner, client } = setup();
    let event = id(&env, 1);
    client.set_event_capacity(&event, &1);
    let token = client.mint(&id(&env, 10), &event, &Address::generate(&env));

    assert_eq!(client.get_owner(), Some(owner));
    assert_eq!(client.name(), String::from_str(&env, "Access Tickets"));
    assert_eq!(client.symbol(), String::from_str(&env, "ACCESS"));
    assert_eq!(
        client.token_uri(&token),
        String::from_str(&env, "https://access.invalid/tickets/0")
    );
}

#[test]
fn event_capacity_is_set_updated_and_never_below_minted() {
    let Setup { env, client, .. } = setup();
    let event = id(&env, 1);

    assert_eq!(
        client.try_set_event_capacity(&event, &0),
        Err(contract_error(TicketError::InvalidCapacity))
    );
    client.set_event_capacity(&event, &3);
    client.mint(&id(&env, 10), &event, &Address::generate(&env));
    client.mint(&id(&env, 11), &event, &Address::generate(&env));

    assert_eq!(
        client.try_set_event_capacity(&event, &1),
        Err(contract_error(TicketError::InvalidCapacity))
    );
    client.set_event_capacity(&event, &2);
    assert_eq!(
        client.event(&event),
        Some(EventData {
            capacity: 2,
            minted: 2
        })
    );
    client.set_event_capacity(&event, &10);
    assert!(published_event_names(&env).contains(&"event_capacity_set".into()));
    assert_eq!(
        client.event(&event),
        Some(EventData {
            capacity: 10,
            minted: 2
        })
    );
}

#[test]
fn owner_only_functions_require_the_platform_authorization() {
    let Setup { env, client, .. } = setup();
    let event = id(&env, 1);
    client.set_event_capacity(&event, &5);
    let token = client.mint(&id(&env, 10), &event, &Address::generate(&env));

    env.set_auths(&[]);
    assert!(client.try_set_event_capacity(&event, &6).is_err());
    assert!(client
        .try_mint(&id(&env, 11), &event, &Address::generate(&env))
        .is_err());
    assert!(client.try_check_in(&token).is_err());
    assert!(client
        .try_set_base_uri(&String::from_str(&env, "https://x/"))
        .is_err());
    assert!(client
        .try_upgrade(&BytesN::from_array(&env, &[0; 32]))
        .is_err());
}

#[test]
fn mint_assigns_sequential_tokens_and_tracks_ticket_data() {
    let Setup { env, client, .. } = setup();
    let event = id(&env, 1);
    let buyer = Address::generate(&env);
    client.set_event_capacity(&event, &5);

    let first = client.mint(&id(&env, 10), &event, &buyer);
    let second = client.mint(&id(&env, 11), &event, &buyer);

    assert_eq!(second, first + 1);
    assert_eq!(client.owner_of(&first), buyer);
    assert_eq!(client.balance(&buyer), 2);
    assert_eq!(client.token_of(&id(&env, 10)), Some(first));
    assert_eq!(
        client.ticket(&first),
        TicketData {
            event_id: event.clone(),
            ticket_id: id(&env, 10),
            checked_in: false,
            transferred: false,
        }
    );
    assert_eq!(
        client.event(&event),
        Some(EventData {
            capacity: 5,
            minted: 2
        })
    );
}

#[test]
fn repeated_mint_is_idempotent_and_conflicting_mint_fails() {
    let Setup { env, client, .. } = setup();
    let event = id(&env, 1);
    let other_event = id(&env, 2);
    let buyer = Address::generate(&env);
    client.set_event_capacity(&event, &5);
    client.set_event_capacity(&other_event, &5);

    let token = client.mint(&id(&env, 10), &event, &buyer);
    assert_eq!(client.mint(&id(&env, 10), &event, &buyer), token);
    assert_eq!(client.balance(&buyer), 1);
    assert_eq!(
        client.event(&event),
        Some(EventData {
            capacity: 5,
            minted: 1
        })
    );

    assert_eq!(
        client.try_mint(&id(&env, 10), &other_event, &buyer),
        Err(contract_error(TicketError::TicketConflict))
    );
    assert_eq!(
        client.try_mint(&id(&env, 10), &event, &Address::generate(&env)),
        Err(contract_error(TicketError::TicketConflict))
    );
}

#[test]
fn mint_requires_a_registered_event_with_free_capacity() {
    let Setup { env, client, .. } = setup();
    let event = id(&env, 1);

    assert_eq!(
        client.try_mint(&id(&env, 10), &event, &Address::generate(&env)),
        Err(contract_error(TicketError::EventNotRegistered))
    );

    client.set_event_capacity(&event, &1);
    client.mint(&id(&env, 10), &event, &Address::generate(&env));
    assert_eq!(
        client.try_mint(&id(&env, 11), &event, &Address::generate(&env)),
        Err(contract_error(TicketError::CapacityExceeded))
    );
}

#[test]
fn mint_reaches_an_account_that_does_not_exist_on_the_ledger() {
    let Setup { env, client, .. } = setup();
    let event = id(&env, 1);
    let unfunded = Address::from_str(&env, UNFUNDED_ACCOUNT);
    client.set_event_capacity(&event, &1);

    let token = client.mint(&id(&env, 10), &event, &unfunded);

    assert_eq!(client.owner_of(&token), unfunded);
}

#[test]
fn transfer_requires_holder_and_platform_and_happens_once() {
    let Setup { env, owner, client } = setup();
    let event = id(&env, 1);
    let buyer = Address::generate(&env);
    let friend = Address::generate(&env);
    let stranger = Address::generate(&env);
    client.set_event_capacity(&event, &1);
    let token = client.mint(&id(&env, 10), &event, &buyer);

    client.transfer(&buyer, &friend, &token);

    let authorizers: std::vec::Vec<Address> = env
        .auths()
        .iter()
        .map(|(address, _)| address.clone())
        .collect();
    assert!(authorizers.contains(&buyer));
    assert!(authorizers.contains(&owner));
    assert_eq!(client.owner_of(&token), friend);
    assert!(client.ticket(&token).transferred);

    assert_eq!(
        client.try_transfer(&friend, &stranger, &token),
        Err(trait_error(TicketError::AlreadyTransferred))
    );
}

#[test]
fn transfer_fails_without_the_platform_co_signature() {
    let Setup { env, client, .. } = setup();
    let event = id(&env, 1);
    let buyer = Address::generate(&env);
    client.set_event_capacity(&event, &1);
    let token = client.mint(&id(&env, 10), &event, &buyer);

    env.set_auths(&[]);
    assert!(client
        .try_transfer(&buyer, &Address::generate(&env), &token)
        .is_err());
}

#[test]
fn transfer_is_blocked_after_check_in_and_to_self() {
    let Setup { env, client, .. } = setup();
    let event = id(&env, 1);
    let buyer = Address::generate(&env);
    client.set_event_capacity(&event, &2);
    let checked = client.mint(&id(&env, 10), &event, &buyer);
    let other = client.mint(&id(&env, 11), &event, &buyer);
    client.check_in(&checked);

    assert_eq!(
        client.try_transfer(&buyer, &Address::generate(&env), &checked),
        Err(trait_error(TicketError::CheckedInNotTransferable))
    );
    assert_eq!(
        client.try_transfer(&buyer, &buyer, &other),
        Err(trait_error(TicketError::SelfTransfer))
    );
    assert_eq!(
        client.try_transfer(&buyer, &Address::generate(&env), &999),
        Err(trait_error(TicketError::TicketNotFound))
    );
}

#[test]
fn approvals_transfer_from_and_renounce_are_disabled() {
    let Setup { env, client, .. } = setup();
    let event = id(&env, 1);
    let buyer = Address::generate(&env);
    let operator = Address::generate(&env);
    client.set_event_capacity(&event, &1);
    let token = client.mint(&id(&env, 10), &event, &buyer);
    let unsupported = Err(trait_error(TicketError::OperationNotSupported));

    assert_eq!(
        client.try_approve(&buyer, &operator, &token, &1_000),
        unsupported
    );
    assert_eq!(
        client.try_approve_for_all(&buyer, &operator, &1_000),
        unsupported
    );
    assert_eq!(
        client.try_transfer_from(&operator, &buyer, &operator, &token),
        unsupported
    );
    assert_eq!(client.try_renounce_ownership(), unsupported);
    assert_eq!(client.owner_of(&token), buyer);
}

#[test]
fn check_in_happens_once_and_publishes_an_event() {
    let Setup { env, client, .. } = setup();
    let event = id(&env, 1);
    client.set_event_capacity(&event, &1);
    let token = client.mint(&id(&env, 10), &event, &Address::generate(&env));

    client.check_in(&token);
    assert!(published_event_names(&env).contains(&"checked_in".into()));
    assert!(client.ticket(&token).checked_in);

    assert_eq!(
        client.try_check_in(&token),
        Err(contract_error(TicketError::AlreadyCheckedIn))
    );
    assert_eq!(
        client.try_check_in(&999),
        Err(contract_error(TicketError::TicketNotFound))
    );
}

#[test]
fn base_uri_can_be_repointed_by_the_owner() {
    let Setup { env, client, .. } = setup();
    let event = id(&env, 1);
    client.set_event_capacity(&event, &1);
    let token = client.mint(&id(&env, 10), &event, &Address::generate(&env));

    client.set_base_uri(&String::from_str(&env, "https://tickets.example/"));

    assert_eq!(
        client.token_uri(&token),
        String::from_str(&env, "https://tickets.example/0")
    );
    assert_eq!(client.name(), String::from_str(&env, "Access Tickets"));
}

#[test]
fn own_entries_get_their_ttl_extended() {
    let Setup { env, client, .. } = setup();
    let event = id(&env, 1);
    client.set_event_capacity(&event, &1);
    let token = client.mint(&id(&env, 10), &event, &Address::generate(&env));

    let ttls = env.as_contract(&client.address, || {
        let storage = env.storage().persistent();
        [
            storage.get_ttl(&DataKey::Ticket(token)),
            storage.get_ttl(&DataKey::TokenOf(id(&env, 10))),
            storage.get_ttl(&DataKey::Event(event.clone())),
        ]
    });

    for ttl in ttls {
        assert!(ttl >= TTL_EXTEND_TO, "ttl {ttl} below {TTL_EXTEND_TO}");
    }
}
