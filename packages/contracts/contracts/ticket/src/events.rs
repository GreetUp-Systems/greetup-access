use soroban_sdk::{contractevent, BytesN};

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventCapacitySet {
    #[topic]
    pub event_id: BytesN<16>,
    pub capacity: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CheckedIn {
    #[topic]
    pub token_id: u32,
    #[topic]
    pub event_id: BytesN<16>,
}
