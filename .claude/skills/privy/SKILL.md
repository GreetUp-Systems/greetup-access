---
name: privy
description: Use when building wallet infrastructure, authentication systems, or financial applications. Reach for Privy when you need to create embedded wallets, manage user identity, execute blockchain transactions, enforce access controls, or build financial products (deposits, payouts, swaps, yield) without building infrastructure from scratch.
metadata:
    mintlify-proj: privy
    version: "1.0"
---

# Privy Skill Reference

## Product summary

Privy is a programmable wallet infrastructure platform for building financial applications. It provides secure embedded wallets, user authentication, transaction execution across 50+ blockchains, and financial services (deposits, payouts, swaps, yield). Agents use Privy to authenticate users, create and manage wallets, execute transactions, enforce policies, and build complete financial products.

**Key files and commands:**
- Dashboard: https://dashboard.privy.io (create apps, configure settings, manage policies)
- REST API base: `https://api.privy.io/v1`
- Authentication: Basic Auth with app ID and app secret (found in Dashboard > App settings > Basics)
- Client SDKs: React, React Native, Swift, Android, Flutter, Unity, NodeJS, Java, Go, Rust, Ruby, Python
- Primary docs: https://docs.privy.io

## When to use

Use Privy when:
- Building consumer or business wallets that need to work across multiple blockchains
- Implementing user authentication with email, social, passkeys, or wallet-based login
- Creating wallets owned by users, organizations, servers, or AI agents
- Executing transactions (send, sign, swap, transfer) on Ethereum, Solana, Tempo, Tron, Bitcoin, or other chains
- Enforcing spending limits, approval workflows, or transaction policies
- Building financial products (deposits, payouts, card spend, yield, staking)
- Migrating users from other wallet providers
- Setting up multi-sig or quorum-based approval workflows
- Managing treasury operations or agent wallets with strict controls

Do not use Privy for: pure authentication without wallets, non-blockchain applications, or when you need full custody of user keys (Privy uses key splitting so it never has complete access).

## Quick reference

### Core concepts

| Concept | Purpose | Example |
|---------|---------|---------|
| **User** | Individual with linked accounts (email, social, wallets) | User logs in via email, gets Privy DID |
| **Embedded wallet** | Wallet created and managed by Privy, owned by user or app | User's Ethereum wallet auto-created on login |
| **External wallet** | Third-party wallet (MetaMask, Phantom) user brings to app | User connects existing MetaMask to your app |
| **Owner** | Entity with full control over wallet (user, auth key, or key quorum) | User owns their wallet, can export keys |
| **Signer** | Additional party with scoped permissions on wallet | Server has permission to execute limit orders |
| **Policy** | Rules that constrain what actions a wallet can perform | Max $1000 per transaction, only to allowlisted addresses |
| **Authorization key** | Server-side credential to control wallets programmatically | Backend signs transactions on behalf of app |
| **Key quorum** | Multi-party approval requirement (users + keys) | 2-of-3 approval: user + 2 server keys |

### SDK imports by platform

```tsx
// React
import {usePrivy, useCreateWallet, useSendTransaction} from '@privy-io/react-auth';

// React Native
import {usePrivy, useEmbeddedEthereumWallet} from '@privy-io/expo';

// NodeJS
import {PrivyClient} from '@privy-io/server-auth';
const privy = new PrivyClient({appId: 'xxx', appSecret: 'xxx'});

// REST API
// POST https://api.privy.io/v1/wallets
// Headers: Authorization: Basic <base64(appId:appSecret)>, privy-app-id: <appId>
```

### Common API endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/users` | POST | Create user |
| `/v1/users/{id}` | GET | Get user by ID |
| `/v1/wallets` | POST | Create wallet |
| `/v1/wallets/{id}` | GET | Get wallet by ID |
| `/v1/wallets/{id}/rpc` | POST | Execute RPC method (send transaction, sign, etc.) |
| `/v1/policies` | POST | Create policy |
| `/v1/intents` | POST | Create intent (propose transaction for approval) |

### Authentication methods (login)

- **Email/SMS/WhatsApp**: OTP-based
- **Social**: Google, Apple, Discord, Twitter, Farcaster, Telegram
- **Crypto**: MetaMask, Phantom, Farcaster, Telegram
- **Passkeys**: WebAuthn biometric
- **Custom OAuth**: Any OIDC provider
- **Guest**: Temporary access without login

### Supported chains

Ethereum, Solana, Tempo, Tron, Bitcoin, Sui, Cosmos, Stellar, Aptos, Movement, Near, TON, Starknet, Spark (Bitcoin L2)

## Decision guidance

### When to use embedded vs external wallets

| Scenario | Use embedded | Use external |
|----------|-------------|------------|
| New user onboarding | ✓ | |
| User has existing wallet | | ✓ |
| Need seamless UX | ✓ | |
| User wants to bring own keys | | ✓ |
| Building for crypto natives | | ✓ |
| Building for mainstream users | ✓ | |
| Need to control wallet | ✓ | |

### When to use different wallet ownership models

| Model | Owner | Use case |
|-------|-------|----------|
| User-owned | User only | Self-custodial consumer wallets |
| User + server | User + auth key | Automated trading, limit orders, delegated access |
| Application-owned | Auth key or key quorum | Treasury, trading bots, agent wallets |
| Custodial | Licensed custodian | Institutional accounts, regulated entities |

### When to use policies vs intents

| Need | Use | Why |
|------|-----|-----|
| Enforce standing rules | Policies | Automatic evaluation on every transaction |
| Require approval for one action | Intents | Manual approval workflow for sensitive ops |
| Prevent unauthorized actions | Policies | Guardrails at key level |
| Multi-party sign-off | Intents + key quorum | Explicit approval from multiple parties |

### When to use client-side vs server-side SDKs

| Scenario | Client SDK | Server SDK |
|----------|-----------|-----------|
| User authentication | ✓ | |
| User wallet creation | ✓ | ✓ |
| User-initiated transaction | ✓ | |
| Server automation (limit orders) | | ✓ |
| Batch operations | | ✓ |
| Sensitive operations | | ✓ |
| Querying user data | ✓ | ✓ |

## Workflow

### 1. Authenticate a user and create a wallet

**Client-side (React):**
```tsx
import {usePrivy, useCreateWallet} from '@privy-io/react-auth';

function App() {
  const {user, login} = usePrivy();
  const {createWallet} = useCreateWallet();

  // User logs in via email
  const handleLogin = () => login({loginMethods: ['email']});

  // Create wallet after login
  const handleCreateWallet = async () => {
    const wallet = await createWallet();
    console.log('Wallet created:', wallet.address);
  };

  return (
    <>
      {!user ? (
        <button onClick={handleLogin}>Login</button>
      ) : (
        <button onClick={handleCreateWallet}>Create Wallet</button>
      )}
    </>
  );
}
```

**Server-side (NodeJS):**
```ts
const privy = new PrivyClient({appId: 'xxx', appSecret: 'xxx'});

// Create user
const user = await privy.users().create({email: 'user@example.com'});

// Create wallet for user
const wallet = await privy.wallets().create({
  chain_type: 'ethereum',
  owner: {user_id: user.id}
});
```

### 2. Send a transaction

**Client-side (React):**
```tsx
import {useSendTransaction} from '@privy-io/react-auth';

function SendButton() {
  const {sendTransaction} = useSendTransaction();

  const handleSend = async () => {
    const hash = await sendTransaction({
      to: '0xE3070d3e4309afA3bC9a6b057685743CF42da77C',
      value: 100000 // wei
    });
    console.log('Sent:', hash);
  };

  return <button onClick={handleSend}>Send 0.0001 ETH</button>;
}
```

**Server-side (NodeJS):**
```ts
const {hash} = await privy.wallets().ethereum().sendTransaction(walletId, {
  caip2: 'eip155:1',
  params: {
    transaction: {
      to: '0xE3070d3e4309afA3bC9a6b057685743CF42da77C',
      value: '0x2386F26FC10000'
    }
  }
});
```

### 3. Create and enforce a policy

**Via REST API:**
```bash
curl -X POST https://api.privy.io/v1/policies \
  -u "appId:appSecret" \
  -H "privy-app-id: appId" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Max $1000 per transfer",
    "chain_type": "ethereum",
    "rules": [{
      "method": "eth_sendTransaction",
      "action": "ALLOW",
      "conditions": [{
        "field_source": "ethereum_transaction",
        "field": "value",
        "operator": "lte",
        "value": "1000000000000000000"
      }]
    }]
  }'
```

Then attach to wallet:
```bash
curl -X POST https://api.privy.io/v1/wallets \
  -u "appId:appSecret" \
  -H "privy-app-id: appId" \
  -d '{
    "chain_type": "ethereum",
    "owner": {"user_id": "user-id"},
    "policy_ids": ["policy-id"]
  }'
```

### 4. Create an intent (approval workflow)

**Server-side:**
```ts
// Propose a transaction
const intent = await privy.intents().create({
  type: 'transfer',
  wallet_id: walletId,
  params: {
    to: '0xRecipient',
    amount: '1000000000000000000',
    chain_type: 'ethereum'
  }
});

// User approves via dashboard or API
await privy.intents().authorize(intent.id, {
  authorization_signature: userSignature
});

// Execute
await privy.intents().execute(intent.id);
```

### 5. Query user and wallet data

**Client-side:**
```tsx
const {user} = usePrivy();
console.log(user.id); // Privy DID
console.log(user.linkedAccounts); // All auth methods
console.log(user.linkedAccounts.find(a => a.type === 'wallet')); // Wallets
```

**Server-side:**
```ts
const user = await privy.users().get(userId);
const wallet = await privy.wallets().get(walletId);
const balance = await privy.wallets().getBalance(walletId, {chain_type: 'ethereum'});
```

## Common gotchas

- **Missing authorization signature**: Server-side operations on user wallets require an authorization signature from the user. Use `privy-authorization-signature` header.
- **Policy defaults to DENY**: If a wallet has a policy but no rule matches the RPC method, the request is denied. Always include an "allow all" rule for methods you want to permit.
- **Idempotency keys**: Use `idempotency_key` on wallet creation to prevent duplicates if requests retry.
- **Chain type mismatch**: Policies are chain-specific. A policy for Ethereum won't apply to Solana wallets.
- **Key export requires user approval**: Exporting private keys is a sensitive operation; users must approve via MFA or passkey.
- **Webhooks are not guaranteed delivery**: Implement polling or retry logic for critical operations.
- **Rate limits**: REST API is rate-limited. Implement exponential backoff for retries.
- **External wallet limitations**: External wallets don't support policies or server-side signing; they're read-only from the server.
- **Automatic wallet creation**: If enabled, wallets are created on login. Disable if you want manual control.
- **Policy evaluation happens in enclave**: Policies are evaluated in secure execution environments; you cannot inspect policy logic from outside.

## Verification checklist

Before submitting work with Privy:

- [ ] User authentication is working (login method tested)
- [ ] Wallet is created and address is correct
- [ ] Transaction sends successfully and hash is returned
- [ ] Policy is attached to wallet and enforced (test with violation)
- [ ] Authorization signatures are included for server operations on user wallets
- [ ] Idempotency keys are used for wallet creation
- [ ] Webhooks are configured and receiving events
- [ ] Error handling covers rate limits (429), policy violations, and network errors
- [ ] MFA is enabled for sensitive operations (if required)
- [ ] External IDs are set on wallets for tracking
- [ ] User data is queried correctly (linked accounts, wallets)
- [ ] Policies are chain-specific and match wallet chain type

## Resources

- **Comprehensive page listing**: https://docs.privy.io/llms.txt
- **Dashboard**: https://dashboard.privy.io (create apps, configure auth methods, manage policies)
- **API Reference**: https://docs.privy.io/api-reference/introduction
- **Key Concepts**: https://docs.privy.io/basics/key-concepts
- **Controls & Policies**: https://docs.privy.io/controls/overview

---

> For additional documentation and navigation, see: https://docs.privy.io/llms.txt