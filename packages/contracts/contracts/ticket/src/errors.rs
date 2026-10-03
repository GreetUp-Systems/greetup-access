use soroban_sdk::contracterror;

// Codes start at 1000 to stay clear of OpenZeppelin's NFT (200..) and Ownable (2100..) errors.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TicketError {
    EventNotRegistered = 1000,
    InvalidCapacity = 1001,
    CapacityExceeded = 1002,
    TicketConflict = 1003,
    TicketNotFound = 1004,
    AlreadyCheckedIn = 1005,
    AlreadyTransferred = 1006,
    CheckedInNotTransferable = 1007,
    SelfTransfer = 1008,
    OperationNotSupported = 1009,
}
