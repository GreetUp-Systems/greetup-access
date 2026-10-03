use soroban_sdk::{contracttype, BytesN, Env, IntoVal, TryFromVal, Val};

pub const DAY_IN_LEDGERS: u32 = 17_280;
pub const TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
pub const TTL_EXTEND_TO: u32 = 120 * DAY_IN_LEDGERS;

/// Ticket state kept on-chain. Only identifiers and flags: no personal data (RN-010).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TicketData {
    pub event_id: BytesN<16>,
    pub ticket_id: BytesN<16>,
    pub checked_in: bool,
    pub transferred: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventData {
    pub capacity: u32,
    pub minted: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Ticket(u32),
    TokenOf(BytesN<16>),
    Event(BytesN<16>),
}

fn read<V: TryFromVal<Env, Val>>(e: &Env, key: &DataKey) -> Option<V> {
    let value = e.storage().persistent().get::<_, V>(key);
    if value.is_some() {
        e.storage()
            .persistent()
            .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
    value
}

fn write<V: IntoVal<Env, Val>>(e: &Env, key: &DataKey, value: &V) {
    e.storage().persistent().set(key, value);
    e.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

// OpenZeppelin manages the TTL of its own entries, but instance storage is the contract's job.
pub fn extend_instance(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

pub fn ticket(e: &Env, token_id: u32) -> Option<TicketData> {
    read(e, &DataKey::Ticket(token_id))
}

pub fn set_ticket(e: &Env, token_id: u32, data: &TicketData) {
    write(e, &DataKey::Ticket(token_id), data);
}

pub fn token_of(e: &Env, ticket_id: &BytesN<16>) -> Option<u32> {
    read(e, &DataKey::TokenOf(ticket_id.clone()))
}

pub fn set_token_of(e: &Env, ticket_id: &BytesN<16>, token_id: u32) {
    write(e, &DataKey::TokenOf(ticket_id.clone()), &token_id);
}

pub fn event(e: &Env, event_id: &BytesN<16>) -> Option<EventData> {
    read(e, &DataKey::Event(event_id.clone()))
}

pub fn set_event(e: &Env, event_id: &BytesN<16>, data: &EventData) {
    write(e, &DataKey::Event(event_id.clone()), data);
}
