# PagFinance — Documentação Consolidada (fonte externa)

> **Origem:** conteúdo obtido diretamente de `docs.pag.finance` (via `llms.txt` + páginas `.md` individuais) em 2026-08-18.
> **Natureza:** isto é uma cópia de referência da documentação pública da PagFinance, não uma decisão de arquitetura do Access. Nenhuma escolha de usar PagFinance foi tomada — este documento existe para permitir comparação informada com o ramp atual (BlindPay, ver `integrations.md` e `ADR-004-blindpay-ramp.md`).
> **Cobertura:** SDK (`@pagfinance/sdk`), API REST de parceiro (partner API), FAQ público. 62 páginas da documentação oficial, consolidadas aqui.

## Sumário

1. [Visão geral / FAQ](#1-visão-geral--faq)
2. [SDK — @pagfinance/sdk](#2-sdk--pagfinancesdk)
3. [API de Parceiro — Narrativa](#3-api-de-parceiro--narrativa)
4. [API de Parceiro — Endpoints](#4-api-de-parceiro--endpoints)
   - 4.1 Auth
   - 4.2 Users
   - 4.3 API Keys
   - 4.4 Webhook Config
   - 4.5 KYC
   - 4.6 Prices / Assets
   - 4.7 Validate
   - 4.8 Cashout (offramp — cripto → PIX/boleto)
   - 4.9 Cashin (onramp — PIX → cripto)
   - 4.10 Receipts
   - 4.11 Links


---

## 1. Visão geral / FAQ

### Welcome to PagFinance

> The Web3 payment infrastructure that connects stablecoins and cryptocurrencies to local currency payments such as PIX, boletos, and bank transfers.

<Tip>
  **GPag**

  Enjoy without moderation.
</Tip>

**PagFinance** is the Web3 payment infrastructure that connects stablecoins and cryptocurrencies to local currency payments, such as PIX, boletos (Brazilian bank slips), and bank transfers.

#### What is PagFinance?

**PagFinance** lets people and companies make real-world payments using their decentralized wallets, with support for stablecoins such as USDC and XRP.

With our platform, you can:

* Pay boletos and PIX directly with crypto.
* Integrate systems via API or SDK.
* Automate settlements using smart contracts.

#### Get started

Explore the guides below to start integrating or using **PagFinance**:

* [Frequently Asked Questions](/en/faq/introduction)

#### Support

Need help? Talk to our team on [Discord](https://discord.gg/vhvXnKuARg) or send an email to [**suporte@pag.finance**](mailto:suporte@pag.finance).

**PagFinance**: combining the power of cryptocurrencies with the convenience of traditional payments.

### What do we do?

> We accept cryptocurrency deposits and convert them to Brazilian reais (BRL) directly in the recipient's account.

We accept cryptocurrency deposits and convert them to Brazilian reais (BRL) directly in the recipient's account.

### Introduction

> Common questions about PagFinance: how it works, who can use it, which currencies are accepted, and how to integrate.

Get answers about **PagFinance**: how it works, who can use it, which currencies are accepted, and how to integrate.

<AccordionGroup>
  <Accordion title="What is PagFinance?">
    **PagFinance** is a platform that connects payments with stablecoins and cryptocurrencies to traditional banking systems, such as boletos (Brazilian bank slips), PIX, and bank transfers.
  </Accordion>

  <Accordion title="Which countries are supported?">
    We currently support payments in Brazil and are expanding to Argentina, Mexico, and Canada. You can pay from anywhere in the world with your Web3 wallet.
  </Accordion>

  <Accordion title="Which cryptocurrencies are accepted?">
    * USDC
    * USDT (some networks)
    * XRP
    * ETH (via wrapped tokens)
    * Other compatible tokens (see the [complete list](https://github.com/pagcrypto/token-list))
  </Accordion>

  <Accordion title="Can I pay boletos or PIX with crypto?">
    Yes! Just create a payment order in the app or via the API, send the amount in stablecoin, and the payment will be settled in local currency.
  </Accordion>

  <Accordion title="What happens if the crypto transaction fails?">
    If the payment is not detected or validated within the expected time, the order is automatically canceled and the funds returned, if they were received. You can track it in real time through our API or dashboard.
  </Accordion>

  <Accordion title="Does PagFinance offer solutions for companies?">
    Yes. We offer:

    * Invoice issuing with settlement in crypto
    * API for payment management
    * Financial dashboard and reports
  </Accordion>

  <Accordion title="Where can I get support?">
    Our support is available via:

    * Discord: [join the server](https://discord.gg/vhvXnKuARg)
    * Email: [**suporte@pag.finance**](mailto:suporte@pag.finance)
  </Accordion>
</AccordionGroup>

If you still have questions, talk to us!

### How does PagFinance work?

> Select a digital wallet, enter the invoice or PIX amount, and complete the payment with cryptocurrencies. Conversion to Brazilian reais is automatic.

**PagFinance** lets users select a digital wallet (such as Phantom, Solflare, or MetaMask), enter the invoice or PIX amount, and complete the payment with cryptocurrencies.

The platform automatically converts the amount to Brazilian reais and sends it to the intended recipient, making the process intuitive and easy to use. It also supports several digital wallets and operates primarily on the Solana network for fast, low-cost transactions.

### Which cryptocurrencies are accepted?

> Assets currently accepted on the Solana network: SOL, USDC, USDT, PYUSD, and WETH. New assets coming soon.

We currently accept the following assets on the Solana network:

<Warning>
  * **SOL (Solana)**
  * **USDC (USD Coin)**
  * **USDT (Tether)**
  * **PYUSD (PayPal USD)**
  * **WETH (Wrapped Ether)**
</Warning>

We are constantly expanding our ecosystem, and new cryptocurrencies will be supported soon.

If you have suggestions, feel free to contact us.

### I don't have SOL. Can I still use PagFinance?

> Yes. Use our bridge tool to bring your assets to the Solana network, even without holding any tokens on it.

Yes, you can!

You can currently use our [bridge](https://app.pag.finance/onboard/debridge) tool to bridge assets to Solana, even if you do not hold SOL or any other tokens on that network.

We are expanding to support other blockchains in the future, but for now our bridge tool offers an efficient solution for anyone who wants to interact with the Solana network.

### What is the maximum amount I can transact?

> The maximum amount per transaction on PagFinance is R$ 10,000.00. Higher amounts may go through additional review.

Currently, the maximum amount that can be transacted on **PagFinance** is R\$ 10,000.00.

For regulatory reasons, amounts above this limit may go through a stricter review process, and you may need to provide additional information to complete the transaction.

If you need to transact higher amounts, contact our team. We will be happy to assist you.

### I made a payment but have not received it yet!

> Settlement times: PIX within 5 minutes and boleto within 24 hours. If the deadline has passed, contact support.

**PIX payments:** usually settled automatically within 5 minutes.

**Boleto payments:** may take up to 24 hours to be processed.

<Note>
  If the deadline has passed and your payment has not been confirmed yet, contact our support. We will be glad to help!
</Note>

### Payment Receipt

> How to access and download your payment receipt on the platform using the same Web3 wallet used for the payment.

#### How do I access my payment receipt?

The receipt must be accessed directly by you, the customer, through our platform.

1. Access the platform and connect the **same Web3 wallet** used at the time of payment.
2. Go to the **"Payments"** section and check the history of completed transactions.
3. Click the desired payment to view and download the receipt.

If you cannot find the receipt or it is not working correctly, contact our support. To help you, we will need you to **prove that the wallet used belongs to you**. After this verification, our team will be authorized to issue and send the receipt to you.

We are here to help with whatever you need.

### Refunds

> PagFinance's chargeback and refund policy: conditions, required documents, and review and return timeframes.

#### PagFinance Chargeback and Refund Policy

**PagFinance** acts as a crypto/fiat payment facilitator and therefore cares for the security, transparency, and traceability of every operation. For refunds or chargebacks, we follow the criteria below:

##### 1. Conditions for requesting a chargeback or refund

Users can request a refund when:

* The purchase was canceled by the store or partner platform (for example, a marketplace);
* The product was returned according to the supplier's policies;
* The payment was duplicated;
* The transaction was made by proven mistake.

##### 2. Required documents

For the request to be reviewed, the user must provide:

1. **Proof of purchase:**
   * Screenshot of the purchase or digital receipt issued by the store or platform.
2. **Proof of chargeback or return on the original platform:**
   * Email or screenshot of the return status approved by the marketplace or store.
3. **Official invoice or receipt of the purchase (NF-e, the Brazilian electronic invoice):**
   * Issued by the store, with the same data shown in the proof of purchase.
4. **Source wallet of the crypto payment:**
   * Full address of the wallet that made the original transaction.
5. **Proof of wallet ownership:**
   * Message signature or screenshot of the connected wallet panel.
6. **Valid identity document (when requested in suspicious cases):**
   * For additional identity validation.

##### 3. Timeframes

* The average review time is up to **5 business days**;
* Once approved, the crypto refund is made within **2 business days**.

### Can I pay government taxes?

> We currently do not process payments of government tax forms such as DARF, GRU, and GPS. The platform is intended for private transactions.

**Can I pay government payment forms (such as DARF, GRU, GPS, among others)?**

We currently do not process payments of tax forms and taxes destined to government bodies, such as DARF (the Brazilian federal tax collection form), GRU (the Brazilian federal government payment form), GPS (the Brazilian social security payment form), among others.

We reinforce that our platform is intended exclusively for transactions of a private nature, such as payments between companies, service providers, and suppliers.

<Warning>
  **Important:** payments of this type must be made directly through the official channels authorized by the issuing body. Sending government payment forms through our platform may result in the automatic rejection of the payment, with no possibility of later settlement.
</Warning>

<Info>
  **Disclaimer:** we are not responsible for charges resulting from an improper payment attempt, such as interest, fines, or other penalties that may arise from non-payment or late payment of these obligations.
</Info>

---

## 2. SDK — @pagfinance/sdk

### Introduction and Installation

> Overview and installation of the official @pagfinance/sdk, the framework-agnostic client for integrating your application with the PagFinance API.

**`@pagfinance/sdk`** is the framework-agnostic client SDK for integrating external applications with the PagFinance API (crypto payments converted to PIX, boleto, or gift card, KYC verification, and price quotes).

<Info>
  Official package reference: [**@pagfinance/sdk on npm**](https://www.npmjs.com/package/@pagfinance/sdk). This documentation is based on the README and the public contract of that package.
</Info>

#### Why use the SDK

The SDK was designed to be pluggable into any application and to never contain secrets, keys, or cryptography logic. Everything sensitive stays in the host application, protecting PagFinance's intellectual property and security.

<CardGroup cols={2}>
  <Card title="Broad compatibility" icon="laptop-code">
    Works on Node 18+, browsers, and modern bundlers.
  </Card>

  <Card title="No embedded secrets" icon="shield-check">
    No private key or signing logic lives in the client.
  </Card>

  <Card title="Web3 authentication" icon="wallet">
    Challenge-response login (SIWS style), orchestrated by the SDK.
  </Card>

  <Card title="Framework-agnostic" icon="puzzle-piece">
    Independent of any specific UI framework or backend.
  </Card>
</CardGroup>

#### Requirements

<ParamField path="Node.js" type="18+">
  Node 18 or later, a modern browser, or a bundler.
</ParamField>

<ParamField path="JWT token" type="optional">
  For authenticated endpoints, provide a JWT token obtained through the login flow. Public endpoints do not require a token.
</ParamField>

#### Installation

<CodeGroup>
  ```bash npm theme={null}
  npm install @pagfinance/sdk
  ```

  ```bash pnpm theme={null}
  pnpm add @pagfinance/sdk
  ```
</CodeGroup>

#### Getting started

Instantiate the client pointing to the API host and start calling public endpoints, which require no authentication:

```ts theme={null}
import { PagFinanceClient } from '@pagfinance/sdk';

const client = new PagFinanceClient({
  baseUrl: 'https://app.pag.finance', // API host (Next.js proxy)
  clientId: 'my-app',
  appMeta: { name: 'my-app', version: '1.0.0', domain: 'myapp.com' },
  defaultBlockchain: 'solana',
});

// Public endpoint (no auth)
const config = await client.assets.acceptedCryptos();
```

<Tip>
  Continue with [Authentication and Configuration](/en/sdks/authentication) to set up the client and the login, then see [Usage and Examples](/en/sdks/usage-examples) for end-to-end flows.
</Tip>

#### Next steps

<CardGroup cols={2}>
  <Card title="Authentication and Configuration" icon="key" href="/en/sdks/authentication">
    Client options, tokens, and challenge-response login.
  </Card>

  <Card title="Usage and Examples" icon="code" href="/en/sdks/usage-examples">
    Complete quote, creation, and receipt flows.
  </Card>

  <Card title="Method Reference" icon="list" href="/en/sdks/method-reference">
    All available resources and methods.
  </Card>

  <Card title="API Reference" icon="server" href="/en/api-reference/overview">
    REST endpoints underlying the SDK.
  </Card>
</CardGroup>

### Authentication and Configuration

> PagFinanceClient configuration, JWT token management, and the Web3 challenge-response login flow.

This page covers client configuration, the authentication model, and token management.

#### Client configuration

The `PagFinanceClient` receives a configuration object at construction time:

```ts theme={null}
import { PagFinanceClient } from '@pagfinance/sdk';

const client = new PagFinanceClient({
  baseUrl: 'https://app.pag.finance',
  clientId: 'my-app',
  appMeta: { name: 'my-app', version: '1.0.0', domain: 'myapp.com' },
  defaultBlockchain: 'solana',
});
```

##### Configuration options

<ParamField path="baseUrl" type="string" required>
  API host (Next.js proxy). Point it to your app today or to a dedicated BFF in the future. The contract stays the same.
</ParamField>

<ParamField path="clientId" type="string" required>
  Identifier of the application consuming the API.
</ParamField>

<ParamField path="appMeta" type="object">
  Host application metadata.
</ParamField>

<ParamField path="defaultBlockchain" type="string">
  Default blockchain used when not specified per call (for example, `solana`).
</ParamField>

#### Authentication model (challenge-response, no crypto)

The Web3 login is a challenge-response in the SIWS (Sign In With Solana) style. The SDK orchestrates the whole flow, and the host application only provides a `signer` that signs the challenge with the user's wallet:

```ts theme={null}
import nacl from 'tweetnacl';

const { tokenJWT } = await client.auth.signIn(
  { address, blockchain: 'solana' },
  (challenge) => wallet.signMessage(new TextEncoder().encode(challenge)),
);
// tokenJWT is stored in the client (tokenStore)
```

<Note>
  Internally the flow is: `POST /api/auth/challenge`, then `signer(challenge)`, then `POST /api/auth/verify`. There is no cryptography or key in the client. The only proof is the signature, and all the logic (nonce, verification, token issuance) lives on the server.
</Note>

#### Providing a token obtained elsewhere

If you already have a JWT token (obtained through another channel or reused from a previous session), just hand it to the client:

```ts theme={null}
client.setToken(tokenJWT);

const me = await client.user.me();
```

#### Transparent re-login on 401

The SDK can sign in again automatically when the API responds `401`, transparently to the application:

```ts theme={null}
client.auth.enableAutoRelogin(async () => {
  await client.auth.signIn({ address, blockchain }, signer);
  return true;
});
```

<Warning>
  Authenticated endpoints require the JWT token to be present in the client, either via `signIn` or via `setToken`. Public endpoints (such as `assets.acceptedCryptos`) do not need a token.
</Warning>

#### Authentication methods

| Method                        | Description                                                     |
| ----------------------------- | --------------------------------------------------------------- |
| `auth.signIn(params, signer)` | Runs the complete challenge-response flow and stores the token. |
| `auth.challenge(params)`      | Requests the challenge (nonce) from the server.                 |
| `auth.verify(params)`         | Verifies the signature and receives the JWT token.              |
| `auth.setToken(token)`        | Sets the JWT token on the client.                               |
| `auth.getToken()`             | Returns the currently stored token.                             |
| `auth.clearToken()`           | Removes the token from the client.                              |
| `auth.otpSend(params)`        | Sends an OTP code.                                              |
| `auth.enableAutoRelogin(fn)`  | Enables automatic re-login on 401 responses.                    |

<Tip>
  See the [Method Reference](/en/sdks/method-reference) for the complete list of resources and the [Authentication API Reference](/en/api-reference/authentication) for the underlying REST endpoints.
</Tip>

### Usage and Examples

> Practical SDK usage examples: public endpoints, authenticated calls, error handling, and the end-to-end transaction flow.

This page gathers practical usage examples for `@pagfinance/sdk`.

#### Public endpoints (no authentication)

```ts theme={null}
import { PagFinanceClient } from '@pagfinance/sdk';

const client = new PagFinanceClient({
  baseUrl: 'https://app.pag.finance',
  clientId: 'my-app',
  appMeta: { name: 'my-app', version: '1.0.0', domain: 'myapp.com' },
  defaultBlockchain: 'solana',
});

// Accepted crypto configuration
const config = await client.assets.acceptedCryptos();

// Price of an asset in a fiat currency
const price = await client.assets.getAssetPrice({ assetId: 1, fiatCurrency: 'BRL' });

// Validation of a payment code (PIX, boleto, or gift card)
const transfer = await client.payments.validateCode({ code: '00020101...' });
```

#### Authenticated calls

Provide the JWT token obtained outside the SDK and call protected endpoints:

```ts theme={null}
client.setToken(tokenJWT);

const me = await client.user.me();
```

#### End-to-end transaction flow

The typical payment flow has three steps: quote, creation, and receipt.

<Steps>
  <Step title="Quote">
    Request a quote for the desired payment.

    ```ts theme={null}
    const quote = await client.payments.quote({
      code: '00020101...',
      assetId: 1,
      blockchain: 'solana',
    });
    ```
  </Step>

  <Step title="Create">
    Create the payment from the quote.

    ```ts theme={null}
    const payment = await client.payments.create({
      quoteId: quote.id,
    });
    ```
  </Step>

  <Step title="Submit and track">
    Submit the transaction and fetch the receipt.

    ```ts theme={null}
    await client.payments.submit({ paymentId: payment.id, txHash: '...' });

    const receipt = await client.receipts.get({
      type: 'pix',
      tx: payment.id,
      chain: 'solana',
    });
    ```
  </Step>
</Steps>

<Note>
  The exact fields of each request and response depend on the API contract. See the [API Reference](/en/api-reference/overview) and the [Method Reference](/en/sdks/method-reference) for parameter details.
</Note>

#### Error handling

Every failure throws `PagFinanceError`, with messages and field errors already normalized:

```ts theme={null}
import { PagFinanceError } from '@pagfinance/sdk';

try {
  await client.payments.quote(req);
} catch (e) {
  if (e instanceof PagFinanceError) {
    console.error(e.messages, e.fieldErrors, e.httpStatus);
  }
}
```

<Info>
  `PagFinanceError` normalizes the two API response envelopes (`{ success, data }` and `{ ok, error }`) into a single structure with `messages`, `fieldErrors`, `httpStatus`, and `code`.
</Info>

#### Runnable example

The package includes a real end-to-end example in `examples/transaction-flow` (quote, creation, and receipt) using a `TOKEN_JWT` environment variable:

```bash theme={null}
pnpm --filter @pagfinance/sdk build

PAGFINANCE_BASE_URL=https://app.pag.finance \
PAGFINANCE_CLIENT_ID=example \
TOKEN_JWT=... \
PAYMENT_CODE='00020101...' \
SENDER_WALLET=7NaNvh... \
npx tsx examples/transaction-flow/index.ts
```

<Tip>
  See the official package on [npm](https://www.npmjs.com/package/@pagfinance/sdk) for the most recent example code.
</Tip>

### Method Reference

> Complete reference of the @pagfinance/sdk resources and methods: assets, payments, receipts, kyc, user, and auth.

The client exposes the resources below. Each resource groups methods related to one API domain.

<Note>
  Reference based on the public contract of the [@pagfinance/sdk](https://www.npmjs.com/package/@pagfinance/sdk) package. The corresponding REST endpoints are documented in the [API Reference](/en/api-reference/overview).
</Note>

#### Resource overview

| Resource   | Methods                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| `assets`   | `acceptedCryptos`, `gatewayConfig`, `assets`, `getAssetPrice`                                         |
| `payments` | `validateCode`, `quote`, `create`, `submit`, `list`, `get`                                            |
| `receipts` | `get({ type, tx, chain })`                                                                            |
| `kyc`      | `naturalProposal`, `legalProposal`, `documentUrl`, `check`, `cpfValidate`, `userData`                 |
| `user`     | `me`                                                                                                  |
| `auth`     | `signIn`, `challenge`, `verify`, `setToken`, `getToken`, `clearToken`, `otpSend`, `enableAutoRelogin` |

#### assets

Price quotes and asset configuration. Public methods, no authentication.

<AccordionGroup>
  <Accordion title="acceptedCryptos()">
    Returns the configuration of the cryptocurrencies accepted by the platform.

    ```ts theme={null}
    const config = await client.assets.acceptedCryptos();
    ```
  </Accordion>

  <Accordion title="gatewayConfig()">
    Returns the payment gateway configuration.

    ```ts theme={null}
    const gateway = await client.assets.gatewayConfig();
    ```
  </Accordion>

  <Accordion title="assets()">
    Lists the available assets.

    ```ts theme={null}
    const assets = await client.assets.assets();
    ```
  </Accordion>

  <Accordion title="getAssetPrice({ assetId, fiatCurrency })">
    Returns the price of an asset in a fiat currency.

    ```ts theme={null}
    const price = await client.assets.getAssetPrice({ assetId: 1, fiatCurrency: 'BRL' });
    ```
  </Accordion>
</AccordionGroup>

#### payments

Payment validation, quoting, creation, and lookup.

<AccordionGroup>
  <Accordion title="validateCode({ code })">
    Validates a payment code (PIX, boleto, or gift card).

    ```ts theme={null}
    const transfer = await client.payments.validateCode({ code: '00020101...' });
    ```
  </Accordion>

  <Accordion title="quote(req)">
    Requests a quote for a payment.

    ```ts theme={null}
    const quote = await client.payments.quote(req);
    ```
  </Accordion>

  <Accordion title="create(req)">
    Creates a payment from a quote.

    ```ts theme={null}
    const payment = await client.payments.create(req);
    ```
  </Accordion>

  <Accordion title="submit(req)">
    Submits the transaction of a created payment.

    ```ts theme={null}
    await client.payments.submit(req);
    ```
  </Accordion>

  <Accordion title="list()">
    Lists the authenticated user's payments.

    ```ts theme={null}
    const payments = await client.payments.list();
    ```
  </Accordion>

  <Accordion title="get(id)">
    Returns a specific payment by its identifier.

    ```ts theme={null}
    const payment = await client.payments.get(id);
    ```
  </Accordion>
</AccordionGroup>

#### receipts

Transaction receipts, agnostic to the payment type.

<Accordion title="get({ type, tx, chain })">
  Returns the receipt of a transaction. Agnostic: it works for PIX, boleto, and gift card.

  ```ts theme={null}
  const receipt = await client.receipts.get({ type: 'pix', tx: '...', chain: 'solana' });
  ```
</Accordion>

#### kyc

Identity verification (natural persons and legal entities).

| Method            | Description                                    |
| ----------------- | ---------------------------------------------- |
| `naturalProposal` | Creates a KYC proposal for a natural person.   |
| `legalProposal`   | Creates a KYC proposal for a legal entity.     |
| `documentUrl`     | Gets the URL for document upload.              |
| `check`           | Looks up the verification status.              |
| `cpfValidate`     | Validates a CPF (Brazilian taxpayer ID).       |
| `userData`        | Returns the user data associated with the KYC. |

#### user

Authenticated user data.

<Accordion title="me()">
  Returns the authenticated user's data.

  ```ts theme={null}
  client.setToken(tokenJWT);
  const me = await client.user.me();
  ```
</Accordion>

#### auth

Authentication and token management. Full details in [Authentication and Configuration](/en/sdks/authentication).

| Method                   | Description                                        |
| ------------------------ | -------------------------------------------------- |
| `signIn(params, signer)` | Runs the complete login flow and stores the token. |
| `challenge(params)`      | Requests the challenge (nonce).                    |
| `verify(params)`         | Verifies the signature and receives the JWT token. |
| `setToken(token)`        | Sets the JWT token on the client.                  |
| `getToken()`             | Returns the current token.                         |
| `clearToken()`           | Removes the token from the client.                 |
| `otpSend(params)`        | Sends an OTP code.                                 |
| `enableAutoRelogin(fn)`  | Enables automatic re-login on 401.                 |

#### Errors

Every method may throw `PagFinanceError`.

---

## 3. API de Parceiro — Narrativa

### Overview

> Overview of the PagFinance partner API: base URL, versioning, authentication schemes, response envelopes, rate limits, and common errors.

The PagFinance API is a multi-tenant B2B payments API: crypto cash-out to PIX and boleto (offramp), PIX cash-in to crypto (onramp), payment links, price quotes, and KYC/KYB onboarding. It is a machine-to-machine HTTP API consumed by your backend.

<Info>
  Every partner and every user is isolated. All reads and writes are scoped to the authenticated principal (the partner behind the API key or HMAC signature, and the end user behind a JWT). You never pass a partner id or user id in the body to switch tenants.
</Info>

#### Base URL

Every versioned endpoint lives under `/api/v1`.

<CodeGroup>
  ```bash Production theme={null}
  https://app.pag.finance/api/v1
  ```
</CodeGroup>

<Note>
  Calls to `/api/*` without a version are redirected to `/api/v1/*` (301 on `GET`, 308 on `POST`, `PATCH`, and `DELETE`). Inbound provider webhooks live outside `/api` (for example `/webhooks/bank`) and are not part of the partner surface.
</Note>

#### Environments

There is no separate sandbox host. Test mode is activated by configuration on your credentials: outbound PIX payout runs in dry-run (the intent is recorded but no real PIX is sent), and the KYC provider accepts test documents. Sandbox credentials (partner id, API key or HMAC secret, the expected `x-app-*` values, and test CPF/CNPJ numbers for the approved and rejected scenarios) are provisioned by our team.

<Card title="Request sandbox access" icon="flask" href="https://pag.finance/businesses">
  Contact the integration team to receive your partner credentials and test data.
</Card>

#### Authentication

The API has three layers of authentication. See [Authentication](/en/api-reference/authentication) for the full detail.

<CardGroup cols={2}>
  <Card title="Partner: API key (recommended)" icon="key">
    `Authorization: Bearer sk_live_<hex>`. Sent directly, no signing. Used on the partner routes (`/auth/token`, `/users/*`, `/partners/*`).
  </Card>

  <Card title="Partner: HMAC-SHA256 (legacy)" icon="signature">
    `Authorization: HMAC-SHA256 partnerId=...,timestamp=...,nonce=...,signature=...`. Per-request signature. Accepted on the same routes as the API key.
  </Card>

  <Card title="End user: JWT" icon="user-shield">
    `Authorization: Bearer <token>`. Issued by `POST /api/v1/auth/token` for a user; required on cash-out, cash-in, and receipts.
  </Card>

  <Card title="Public routes" icon="globe">
    No auth: `GET /getAssetPrice`, `GET /accepted-cryptos`, `POST /validate-code`, health checks, and public payment-link resolution.
  </Card>
</CardGroup>

#### Response envelopes

Successful responses use a `success` envelope with the payload under `data`. Errors return `success: false` with an `error` message and, in some cases, a `code`.

<CodeGroup>
  ```json Success theme={null}
  {
    "success": true,
    "error": null,
    "data": { }
  }
  ```

  ```json Error theme={null}
  {
    "success": false,
    "error": "Human-readable message",
    "code": "USER_NOT_FOUND"
  }
  ```

  ```json Rate limit theme={null}
  {
    "success": false,
    "error": "Too Many Requests",
    "retryAfter": 42
  }
  ```
</CodeGroup>

#### Rate limits

| Scope                     | Limit                    |
| ------------------------- | ------------------------ |
| Global (all routes)       | 120 requests/min per IP  |
| `POST /cashout/*`         | 10 requests/min per user |
| `POST /cashin/*`          | 10 requests/min per user |
| `POST /cashout/withdraw*` | 5 requests/min per user  |

On overflow the API returns `429` with `{ success: false, error, retryAfter }`. Respect `retryAfter` with exponential backoff and size your client with a 10 to 15 second timeout.

#### Common errors

<ResponseField name="400 Bad Request" type="validation error">
  Malformed request or a missing required field. The `error` message describes the problem.
</ResponseField>

<ResponseField name="401 Unauthorized" type="unauthenticated">
  Missing, expired, or invalid credentials (API key, HMAC signature, or JWT). The response is generic and does not reveal whether the principal exists.
</ResponseField>

<ResponseField name="403 Forbidden" type="forbidden">
  The principal is not allowed: a suspended or revoked partner, an IP outside the allowlist, a blocked user, or an operation that requires approved KYC (`kycStatus === APPROVED`).
</ResponseField>

<ResponseField name="404 Not Found" type="not found">
  The resource does not exist (for example a user, intent, or receipt).
</ResponseField>

<ResponseField name="409 Conflict" type="concurrency">
  A concurrent operation is already in progress for the same resource (for example a second `cashout/intent` for the same `quoteId`, or an `Idempotency-Key` still being processed).
</ResponseField>

<ResponseField name="429 Too Many Requests" type="rate limit">
  Rate limit exceeded. Wait `retryAfter` seconds before retrying.
</ResponseField>

<ResponseField name="500 Internal Server Error" type="internal error">
  Unexpected server error. The response carries a `requestId` for support.
</ResponseField>

<ResponseField name="503 Service Unavailable" type="provider not configured">
  A dependent provider is not configured on this instance (for example the KYC provider). Returned at call time.
</ResponseField>

#### Reference structure

The endpoints are grouped by resource:

<CardGroup cols={2}>
  <Card title="Authentication" icon="key" href="/en/api-reference/authentication">
    Partner API key, HMAC-SHA256, and end-user JWT issuance.
  </Card>

  <Card title="Crypto settlement" icon="coins" href="/en/api-reference/crypto-settlement">
    Supported chains, the live asset catalog, memo reconciliation, and the cash-out state machine.
  </Card>

  <Card title="Endpoints" icon="code">
    Browse the live API groups in the sidebar (Users, Partners, KYC, Prices, Cash-out, Cash-in, Receipts, Links). Each endpoint has an interactive playground generated from the OpenAPI spec.
  </Card>

  <Card title="BRLP" icon="brazilian-real-sign" href="/en/api-reference/brlp">
    BRLP withdraw (Mode B) and the BRL pricing layer.
  </Card>

  <Card title="KYC" icon="id-card" href="/en/api-reference/kyc">
    Document lookup and full onboarding sessions.
  </Card>

  <Card title="Webhooks" icon="webhook" href="/en/api-reference/webhooks">
    Outbound event notifications, registration, and signature.
  </Card>
</CardGroup>

### Authentication

> Partner authentication with a Bearer API key or HMAC-SHA256, and end-user JWT issuance via POST /auth/token.

The partner caller (machine-to-machine) authenticates with one of two equivalent schemes: a Bearer API key (recommended) or an HMAC-SHA256 signature. The same routes accept either one. Separately, your backend exchanges a user identifier for a short-lived end-user JWT that unlocks the payment operations.

<Info>
  Partner credentials (partner id, API key or HMAC secret, webhook secret) are provisioned by our team at onboarding. Request them at [pag.finance/businesses](https://pag.finance/businesses).
</Info>

#### API key (Bearer) - recommended

Send the key directly in the `Authorization` header on every request. No canonical string, no signature, no nonce, no timestamp.

```http theme={null}
Authorization: Bearer sk_live_<hex>
```

<Steps>
  <Step title="Generate a key">
    Create a key in the dashboard (API and Integrations panel) or via `POST /api/v1/partners/me/api-keys`. The full `sk_live_...` value is shown once only; store it, because it is not recoverable (only the hash is kept).
  </Step>

  <Step title="Send it on every request">
    Attach the key exactly as received in the `Authorization` header.
  </Step>

  <Step title="Rotate or revoke">
    List keys with `GET /api/v1/partners/me/api-keys` and revoke one with `POST /api/v1/partners/me/api-keys/:keyId/revoke` (takes effect immediately). Each partner can hold several keys, for example one per environment or service.
  </Step>
</Steps>

<Warning>
  Always transit the key over HTTPS. The key is a bearer secret: if it leaks, revoke it. Partner status (`SUSPENDED` or `REVOKED`) and the optional IP allowlist still apply. An invalid or revoked key returns a generic `401`.
</Warning>

#### HMAC-SHA256 - legacy and advanced

Use HMAC if you already have an HMAC integration or need nonce-based anti-replay. The header carries the partner id, a timestamp, a nonce, and the signature.

```http theme={null}
Authorization: HMAC-SHA256 partnerId=<id>,timestamp=<unix>,nonce=<uuid>,signature=<hex>
```

The signature is computed over a canonical string with a literal newline separator between fields:

```text theme={null}
canonical =
  METHOD            (uppercase, for example "POST")
  \n
  PATH              (no query string, for example "/api/v1/auth/token")
  \n
  TIMESTAMP         (unix seconds, as a string)
  \n
  NONCE             (16 to 64 chars, for example a UUID v4)
  \n
  SHA256_HEX(BODY)  (hex hash of the body)
```

<Steps>
  <Step title="Derive the signing key">
    `signingKey = SHA256(rawSecret + ":" + partnerId)`. The raw secret never travels and is never stored: only `SHA256(secret:partnerId)` is kept. The secret is plain text, not base64.
  </Step>

  <Step title="Hash the body">
    `bodyHash = SHA256_hex( JSON.stringify(JSON.parse(rawBody)) )`. The body is normalized before hashing. For a `GET` or an empty body, hash the normalized empty body.
  </Step>

  <Step title="Sign the canonical string">
    `signature = HMAC_SHA256_hex(signingKey, canonical)` (64 hex chars).
  </Step>

  <Step title="Build the header">
    `HMAC-SHA256 partnerId=...,timestamp=...,nonce=...,signature=...`
  </Step>
</Steps>

<Note>
  Timestamp window: 300 seconds (5 minutes); outside it, `401`. Anti-replay nonce: deduplicated in Redis for 600 seconds (10 minutes); reuse within that window returns `401`. Use a unique nonce per request.
</Note>

#### End-user JWT

Payment operations (cash-out, cash-in, receipts) run as an end user, not as the partner. Your backend exchanges the user's `pubkey` or `uid` for a JWT.

##### Issue a token

`POST /api/v1/auth/token`, authenticated by the partner (API key or HMAC).

<ParamField header="Authorization" type="string" required>
  Partner credentials: `Bearer sk_live_...` or the HMAC header.
</ParamField>

<ParamField body="pubkey" type="string">
  The user's blockchain address. Provide `pubkey` or `uid` (at least one, minimum 3 characters).
</ParamField>

<ParamField body="uid" type="string">
  The user's internal id, as an alternative to `pubkey`.
</ParamField>

<ParamField body="expiresIn" type="string" default="config default">
  Optional TTL override, for example `1h` or `7d`. Capped at `30d`.
</ParamField>

<ResponseField name="token" type="string">
  The signed JWT (HS256). Send it as `Authorization: Bearer <token>` on protected routes.
</ResponseField>

<ResponseField name="expiresIn" type="string">
  The effective TTL applied to the token.
</ResponseField>

<ResponseField name="tokenType" type="string">
  Always `Bearer`.
</ResponseField>

<ResponseField name="user" type="object">
  `{ pubkey, kycStatus, partnerId }` for the resolved user.
</ResponseField>

<RequestExample>
  ```bash cURL theme={null}
  curl -X POST https://app.pag.finance/api/v1/auth/token \
    -H "Authorization: Bearer sk_live_<hex>" \
    -H "Content-Type: application/json" \
    -d '{ "pubkey": "7NaNvh...", "expiresIn": "7d" }'
  ```
</RequestExample>

<ResponseExample>
  ```json 200 theme={null}
  {
    "success": true,
    "error": null,
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
      "expiresIn": "7d",
      "tokenType": "Bearer",
      "user": {
        "pubkey": "7NaNvh...",
        "kycStatus": "APPROVED",
        "partnerId": "partner_123"
      }
    }
  }
  ```
</ResponseExample>

<Note>
  The token carries identity only (`pubkey`, `uid`, `partnerId`, `iss`). Issuance refuses a `BLOCKED` user with `403`. The per-operation KYC gate (`kycStatus === APPROVED`) is enforced on the protected routes, not at issuance. A token minted by another instance is rejected with `401` (the issuer is validated on every call).
</Note>

#### Token usage

Include the end-user JWT in the `Authorization` header of every authenticated user call:

```http theme={null}
Authorization: Bearer <token>
```

<Warning>
  On a `401`, request a new token from `POST /api/v1/auth/token`. Tokens are short-lived; do not cache them past `expiresIn`.
</Warning>

### Crypto settlement

> Supported chains (Solana, EVM, Stellar, Tron, XRPL), the live asset catalog in gateway-config-latest.json, the memo reconciliation model, and the cash-out settlement state machine.

Both money flows settle on-chain: cash-out (offramp) receives crypto from the user and pays out PIX or boleto, and cash-in (onramp) receives PIX and delivers crypto. This page describes the chains we support, how to discover the exact assets enabled on this instance, and how an on-chain transfer is reconciled to your intent.

#### Supported chains

The `assetId` in a quote selects both the asset and the network it settles on.

<CardGroup cols={2}>
  <Card title="Solana" icon="circle-nodes">
    Native SOL and SPL tokens.
  </Card>

  <Card title="EVM" icon="ethereum">
    Ethereum, Polygon, BSC, and other compatible networks.
  </Card>

  <Card title="Stellar" icon="star">
    Native and issued assets. See the memo note below.
  </Card>

  <Card title="Tron" icon="gem">
    Native and token transfers.
  </Card>

  <Card title="XRPL / Ripple" icon="droplet">
    XRP Ledger transfers.
  </Card>
</CardGroup>

<Note>
  The set of chains and assets actually enabled is per instance and can change over time. Always resolve the live catalog (below) rather than hardcoding a chain or asset list.
</Note>

#### Accepted assets: the live catalog

The canonical, real-time list of assets, networks, and valid `assetId` values is published as a JSON file:

<CodeGroup>
  ```bash Live asset catalog theme={null}
  https://config.pag.finance/gateway-config-latest.json
  ```
</CodeGroup>

Read `gateway-config-latest.json` to know which crypto assets are enabled, their contract addresses, and the networks supported on the current instance. It is the source of truth for the `assetId` you pass to `cashout/quote`, `cashin/quote`, and `getAssetPrice`. The `GET /api/v1/accepted-cryptos` endpoint returns the same catalog through the API.

<Info>
  Treat the catalog as dynamic. New assets and networks are added there without a documentation change, so resolve it at runtime instead of shipping a static copy.
</Info>

#### No custody, no pre-funded balance

The platform never custodies funds and never holds a pre-funded balance for you. On cash-out, the user sends the on-chain transaction directly to the receiving wallet, and the transfer is matched to your intent by a memo.

* `POST /api/v1/cashout/intent` returns the exact `memo` to attach to the on-chain transaction, along with the `receiver` wallet and the `amount`.
* Always copy the `memo` verbatim from the intent response. It carries an instance prefix followed by the intent id (the IPFS CID), and it is what lets us reconcile the incoming transfer to your order. Do not construct it yourself.

<Warning>
  A transfer sent without the exact `memo`, or to a wallet other than the `receiver` returned by the intent, cannot be reconciled automatically.
</Warning>

##### Stellar memo

Stellar caps a `MEMO_TEXT` at 28 bytes, and the instance prefix plus the intent id exceeds that limit. On Stellar the memo therefore travels on-chain as a `MEMO_HASH` (the SHA-256 of the memo string) rather than as text. This is handled by the platform: you still attach the `memo` value returned by the intent, and reconciliation resolves the hash back to your order internally. No extra step is required on your side, and other chains are unaffected.

#### Cash-out settlement state machine

Once the intent is created, the on-chain transfer drives its status:

```
PENDING --(crypto received on-chain -> webhook)--> PROCESSING --(BAAS)--> COMPLETED
   |                                                    |
   |                                                    +----------------> FAILED (after BAAS retries)
   +--(5 min with no on-chain payment)--> EXPIRED
```

* `PENDING`: intent created, waiting for the on-chain transfer.
* `PROCESSING`: crypto received on-chain, the PIX or boleto payout is being settled.
* `COMPLETED`: PIX or boleto paid to the payee.
* `FAILED`: the payout failed after exhausting retries.
* `EXPIRED`: no on-chain payment arrived within the quote window (5 minutes).

There is no intent-cancellation endpoint: an intent ends in `COMPLETED`, `FAILED`, or `EXPIRED`. Each status transition fires the matching outbound webhook (`INTENT_CONFIRMED`, `INTENT_COMPLETED`, `INTENT_FAILED`); see [Webhooks](/en/api-reference/webhooks) for the payloads.

#### On-chain confirmations

The exact number of on-chain confirmations required before the payout is released is not a fixed, published parameter: it depends on the banking partner's detection. Confirm the current behavior with our integration team when you size retry and timeout budgets.

### BRLP

> BRLP, the BRL-pegged layer: BRL pricing and the BRLP withdraw (Mode B) that converts BRLP to BRL via PIX. This group targets the sandbox.brlp.io domain.

**BRLP** is PagFinance's pricing and conversion layer pegged to the Brazilian real (BRL). This group brings together the BRL pricing and the BRLP withdraw so you can treat the BRLP base URL as an isolated concern in your integration.

<Note>
  In the future, the `sandbox.brlp.io` domain will exclusively host the BRLP-focused endpoints. Plan your integration so the BRLP base URL is configurable.
</Note>

#### BRL pricing

BRLP amounts derive from the same price endpoint, quoted in BRL. See the `GET /api/v1/getAssetPrice` endpoint in the Prices group for the full field list.

<RequestExample>
  ```bash cURL theme={null}
  curl "https://app.pag.finance/api/v1/getAssetPrice?assetId=1&fiatCurrency=BRL"
  ```
</RequestExample>

<ResponseExample>
  ```json 200 theme={null}
  {
    "success": true,
    "error": null,
    "data": {
      "price": 5.42,
      "pair": "USDC/BRL",
      "baseCurrency": "USDC",
      "quoteCurrency": "BRL"
    }
  }
  ```
</ResponseExample>

#### BRLP withdraw (Mode B)

`POST /api/v1/cashout/withdraw`

Converts a BRLP balance to BRL and pays it out via PIX. This is a synchronous flow: no quote, no on-chain instruction. It settles the PIX and reports back with the `WITHDRAW_COMPLETED` or `WITHDRAW_FAILED` webhook.

<Warning>
  BRLP withdraw is a preview capability, enabled per partner (feature-flagged) and not generally available. Request access from the integration team before building against it.
</Warning>

<ParamField header="Authorization" type="string" required>
  `Bearer <token>` (end-user JWT with approved KYC).
</ParamField>

<ParamField body="amount" type="number" required>
  The BRL amount to withdraw (equal to the BRLP quantity, 1:1).
</ParamField>

<ParamField body="pixKey" type="string" required>
  The beneficiary PIX key.
</ParamField>

<ParamField body="walletAddress" type="string" required>
  The requester's BRLP address. Must match the authenticated user's wallet.
</ParamField>

<ParamField body="description" type="string">
  Optional note.
</ParamField>

<ResponseField name="withdrawId" type="string">
  The withdraw id, used to check status and to correlate the webhook.
</ResponseField>

<ResponseField name="status" type="string">
  The withdraw status.
</ResponseField>

<ResponseField name="amount" type="number">
  The gross BRL amount.
</ResponseField>

<ResponseField name="fee" type="number">
  The fee applied.
</ResponseField>

<ResponseField name="netAmount" type="number">
  The net BRL amount paid out.
</ResponseField>

<RequestExample>
  ```bash cURL theme={null}
  curl -X POST https://app.pag.finance/api/v1/cashout/withdraw \
    -H "Authorization: Bearer <token>" \
    -H "Idempotency-Key: 9a8b7c6d-..." \
    -H "Content-Type: application/json" \
    -d '{
      "amount": 250.00,
      "pixKey": "user@example.com",
      "walletAddress": "7NaNvh..."
    }'
  ```
</RequestExample>

<ResponseExample>
  ```json 201 theme={null}
  {
    "success": true,
    "error": null,
    "data": {
      "withdrawId": "wd_ab12...",
      "status": "COMPLETED",
      "amount": 250.00,
      "fee": 1.25,
      "netAmount": 248.75,
      "pixKey": "user@example.com",
      "estimatedAt": "2026-08-03T12:00:10.000Z"
    }
  }
  ```
</ResponseExample>

<Info>
  Check status with `GET /api/v1/cashout/withdraw/:withdrawId`, or list with `GET /api/v1/cashout/withdrawals?limit=20&cursor=<id>`. An insufficient BRLP balance returns `422` with code `INSUFFICIENT_BRLP_BALANCE`.
</Info>

### Webhooks

> Outbound event notifications (API to your backend): register a destination, the event catalog, payload shapes, HMAC signature verification, and retry policy.

Outbound webhooks are the notifications PagFinance sends to your backend when a cash-out, cash-in, withdraw, or KYC event happens. You register one destination and receive all your events there.

<Info>
  This is the outbound direction (API to you). The inbound webhooks the platform exposes to receive callbacks from the banking and KYC providers (for example `/webhooks/bank`) are not part of your integration; you do not consume them.
</Info>

#### Register a destination

`POST /api/v1/partners/me/webhook-config` (partner API key or HMAC)

Register once the destination URL, the events you want, and any custom headers. Read it with `GET` and remove it with `DELETE` on the same path.

<ParamField body="url" type="string" required>
  The single HTTPS destination that receives all of your notifications.
</ParamField>

<ParamField body="events" type="string[]">
  Subscription filter. Absent or empty receives all events. See the catalog below for valid values.
</ParamField>

<ParamField body="headers" type="object">
  Extra HTTP headers sent on every delivery (for example an authorization token for your endpoint). The platform's signature and event headers take precedence and are never overwritten.
</ParamField>

<RequestExample>
  ```bash cURL theme={null}
  curl -X POST https://app.pag.finance/api/v1/partners/me/webhook-config \
    -H "Authorization: Bearer sk_live_<hex>" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://your-backend.com/webhooks/pagfinance",
      "events": ["INTENT_COMPLETED", "CASHIN_COMPLETED", "KYC_APPROVED"],
      "headers": { "Authorization": "Bearer your-token" }
    }'
  ```
</RequestExample>

<Note>
  Without a registered destination, events are only persisted, not sent.
</Note>

#### Payload envelope

Every delivery shares a common envelope. The correlation id varies by event family: `intentId` (cash-out and cash-in), `withdrawId` (BRLP withdraw), or `sessionId` (KYC).

```json theme={null}
{
  "event": "INTENT_COMPLETED",
  "intentId": "<cid>",
  "status": "COMPLETED",
  "timestamp": "2026-08-03T12:00:00.000Z",
  "data": { }
}
```

#### Event catalog

##### Cash-out (offramp), correlation key `intentId`

| Event              | `status`     | When                                   | `data`                                                                       |
| ------------------ | ------------ | -------------------------------------- | ---------------------------------------------------------------------------- |
| `INTENT_CONFIRMED` | `PROCESSING` | Crypto received on-chain               | `sender, amount, currency, confirmedAt, bankTxId?`                           |
| `INTENT_COMPLETED` | `COMPLETED`  | PIX or boleto paid to the payee        | `baasTransactionId, invoiceValue, invoiceCurrency, completedAt, receiptUrl?` |
| `INTENT_FAILED`    | `FAILED`     | Payout failed after exhausting retries | `reason, attempts, failedAt`                                                 |

##### Cash-in (onramp), correlation key `intentId`

| Event              | `status`    | When                                                         | `data`                                                                                     |
| ------------------ | ----------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `CASHIN_COMPLETED` | `COMPLETED` | Onramp PIX received and confirmed                            | See the two variants below                                                                 |
| `CASHIN_FAILED`    | `FAILED`    | PIX paid, but the on-chain crypto delivery failed terminally | `correlationID, reason, failedAt, deliveryId?, asset?, chain?, tokenAmount?, destination?` |

`CASHIN_COMPLETED` has two variants, discriminated by `data.deliveryId`:

* Without `deliveryId` (legacy): crediting the crypto to the user's wallet is your backend's responsibility. `data`: `correlationID, walletAddress, valueCents, transactionID, splitApplied, splitValueCents, completedAt`.
* With `deliveryId`: the platform already delivered the crypto on-chain to `data.destination`, nothing to credit. `data`: `correlationID, deliveryId, onChainTxId, asset, chain, tokenAmount, destination, completedAt`.

<Warning>
  `CASHIN_FAILED` means the fiat was captured but no crypto was delivered. Treat it as an incident and route it to support. The expiry of a cash-in charge does not currently produce a webhook; check status with `GET` if needed.
</Warning>

##### BRLP withdraw (Mode B), correlation key `withdrawId`

| Event                | `status`    | When                    | `data`                                                   |
| -------------------- | ----------- | ----------------------- | -------------------------------------------------------- |
| `WITHDRAW_COMPLETED` | `COMPLETED` | BRLP withdraw completed | `baasTransactionId, amount, fee, netAmount, completedAt` |
| `WITHDRAW_FAILED`    | `FAILED`    | BRLP withdraw failed    | `reason, failedAt`                                       |

##### KYC, correlation key `sessionId`

| Event             | When                                            |
| ----------------- | ----------------------------------------------- |
| `KYC_PENDING`     | Session created, awaiting documentoscopy        |
| `KYC_IN_PROGRESS` | Documentoscopy under review                     |
| `KYC_APPROVED`    | KYC approved                                    |
| `KYC_REJECTED`    | KYC rejected (reason in `data.rejectionReason`) |
| `KYC_EXPIRED`     | Session expired                                 |

The KYC `data` carries `externalUserId, type ('PF' | 'PJ'), provider, status, previousStatus, documentMasked, rejectionReason?, completedAt?`.

#### Signature verification

Every delivery is signed. Verify the signature before trusting the payload.

```http theme={null}
X-App-Signature: sha256=<hex>
X-App-Event: INTENT_COMPLETED
```

The signature is HMAC-SHA256 over the raw JSON body, signed with your partner `webhookSecret` (delivered at onboarding and rotatable via `POST /api/v1/partners/me/rotate-webhook-secret`). Compute the expected value and compare with a timing-safe equal.

```ts theme={null}
import { createHmac } from 'node:crypto';

const expected = 'sha256=' + createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
const valid = timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
```

<Note>
  The signature header prefix defaults to `App` (`X-App-Signature`, `X-App-Event`); your instance's exact prefix is confirmed at onboarding. Legacy partners without their own secret fall back to a global signing secret.
</Note>

#### Delivery guarantees

<CardGroup cols={2}>
  <Card title="Retry" icon="arrows-rotate">
    3 attempts, backoff 2s / 4s / 8s, 10s timeout per attempt. Failure after retries is only logged; it does not block the business flow.
  </Card>

  <Card title="Acknowledge" icon="check">
    Respond `2xx`. Any non-2xx or timeout counts as a failure and triggers a retry.
  </Card>

  <Card title="Idempotency" icon="fingerprint">
    Order is not guaranteed. Deduplicate by `intentId`, `correlationID`, `withdrawId`, or `sessionId`.
  </Card>

  <Card title="HTTPS only" icon="lock">
    Register an HTTPS destination only.
  </Card>
</CardGroup>

### KYC

> Identity verification: document lookup and verify, and full onboarding sessions for individuals (PF) and companies (PJ). Partner-authenticated.

KYC endpoints are called by your backend with partner credentials (Bearer API key or HMAC), never with an end-user JWT. There are two modes: document lookup (100% via API, using only the document number, no images) and full onboarding sessions (the API returns a `webViewUrl` your app opens in a webview for the provider to capture document, selfie, and liveness).

<Info>
  KYC runs on a configured provider (BigDataCorp is active; ZKPassport is the future target). If no provider is configured on the instance, calls return `503` at call time.
</Info>

<Note>
  Access gate: the KYC gate is binary. Only `kycStatus === APPROVED` unlocks the payment operations (cash-out, cash-in). There are no KYC levels or per-level limits. The gate is enforced on the payment routes, not on the KYC routes themselves.
</Note>

All KYC endpoints are mounted under `/api/v1/users/kyc`.

#### Document lookup and verify

`POST /api/v1/users/kyc/lookup` returns the registry data for a document; `POST /api/v1/users/kyc/verify` returns a validity check. Both take the same body.

<ParamField header="Authorization" type="string" required>
  Partner credentials: `Bearer sk_live_...` or the HMAC header.
</ParamField>

<ParamField body="documentType" type="string" required>
  One of `CPF`, `CNPJ`, `RG`, `PASSPORT`, `SSN`, `DNI`, `CURP`, `RUT`, `CC`, `NIT`, `OTHER`.
</ParamField>

<ParamField body="documentNumber" type="string" required>
  The document number (minimum 3 characters).
</ParamField>

<ParamField body="country" type="string" required>
  ISO 3166-1 alpha-2 country code, for example `BR` or `US`.
</ParamField>

<RequestExample>
  ```bash cURL theme={null}
  curl -X POST https://app.pag.finance/api/v1/users/kyc/lookup \
    -H "Authorization: Bearer sk_live_<hex>" \
    -H "Content-Type: application/json" \
    -d '{ "documentType": "CPF", "documentNumber": "00000000000", "country": "BR" }'
  ```
</RequestExample>

<ResponseExample>
  ```json 200 theme={null}
  {
    "success": true,
    "error": null,
    "data": { },
    "meta": { }
  }
  ```
</ResponseExample>

<Note>
  A document not found returns `404`. A provider failure returns `502`.
</Note>

#### Onboarding sessions

##### Start an individual (PF) session

`POST /api/v1/users/kyc/sessions/natural-person`

<ParamField body="externalUserId" type="string" required>
  The user's id in your system (1 to 128 chars).
</ParamField>

<ParamField body="documentNumber" type="string" required>
  CPF (11 to 14 chars).
</ParamField>

<ParamField body="fullName" type="string" required>
  Full legal name.
</ParamField>

<ParamField body="birthDate" type="string" required>
  Date of birth.
</ParamField>

<ParamField body="motherName" type="string" required>
  Mother's name.
</ParamField>

<ParamField body="email" type="string" required>
  Contact email.
</ParamField>

<ParamField body="isPoliticallyExposedPerson" type="boolean" required>
  Whether the person is a politically exposed person (PEP).
</ParamField>

<ParamField body="country" type="string" default="BR">
  ISO 3166-1 alpha-2 country code.
</ParamField>

<ParamField body="address" type="object">
  Optional address (`postalCode`, `street`, `number`, `neighborhood`, `city`, `state`).
</ParamField>

<ParamField body="phoneNumber" type="string">
  Optional phone number.
</ParamField>

<RequestExample>
  ```bash cURL theme={null}
  curl -X POST https://app.pag.finance/api/v1/users/kyc/sessions/natural-person \
    -H "Authorization: Bearer sk_live_<hex>" \
    -H "Content-Type: application/json" \
    -d '{
      "externalUserId": "user-123",
      "documentNumber": "00000000000",
      "fullName": "Ana Souza",
      "birthDate": "1990-01-01",
      "motherName": "Maria Souza",
      "email": "ana@example.com",
      "isPoliticallyExposedPerson": false
    }'
  ```
</RequestExample>

<ResponseExample>
  ```json 201 theme={null}
  {
    "success": true,
    "error": null,
    "data": {
      "sessionId": "kyc_ab12...",
      "externalUserId": "user-123",
      "type": "PF",
      "provider": "bigdatacorp",
      "status": "PENDING",
      "webViewUrl": "https://provider.example/session/...",
      "createdAt": "2026-08-03T12:00:00.000Z"
    }
  }
  ```
</ResponseExample>

##### Start a company (PJ) session

`POST /api/v1/users/kyc/sessions/legal-person`

<ParamField body="externalUserId" type="string" required>
  The company's id in your system.
</ParamField>

<ParamField body="documentNumber" type="string" required>
  CNPJ (14 to 18 chars).
</ParamField>

<ParamField body="businessName" type="string" required>
  Legal business name.
</ParamField>

<ParamField body="tradingName" type="string" required>
  Trading name.
</ParamField>

<ParamField body="companyType" type="string" required>
  One of `MEI`, `EI`, `EIRELI`, `LTDA`, `SA`, `SLU`.
</ParamField>

<ParamField body="contactNumber" type="string" required>
  Contact phone.
</ParamField>

<ParamField body="businessEmail" type="string" required>
  Business email.
</ParamField>

<ParamField body="businessAddress" type="object" required>
  The company address (`postalCode`, `street`, `number`, `neighborhood`, `city`, `state`).
</ParamField>

<ParamField body="owners" type="array" required>
  One or more owners, each with `ownerType` (`PARTNER`, `LEGAL_REPRESENTATIVE`, or `BOTH`), `documentNumber`, `fullName`, `birthDate`, `motherName`, `phoneNumber`, `email`, and `address`.
</ParamField>

##### Manage sessions

<ParamField path="GET /api/v1/users/kyc/sessions" type="list">
  List the partner's sessions. Query: `limit` (1 to 200), `status`, `externalUserId`.
</ParamField>

<ParamField path="GET /api/v1/users/kyc/sessions/:sessionId" type="lookup">
  Get a session by id.
</ParamField>

<ParamField path="POST /api/v1/users/kyc/sessions/:sessionId/sync" type="refresh">
  Force a status refresh from the provider.
</ParamField>

<ParamField path="POST /api/v1/users/kyc/sessions/:sessionId/document-url" type="reopen">
  Get a fresh documentoscopy `webViewUrl`, reopening the session if it expired.
</ParamField>

<ParamField path="GET /api/v1/users/kyc/users/:externalUserId/check" type="status">
  The latest session for one of your users. Returns `hasSession: false` when none exists.
</ParamField>

<ParamField path="GET /api/v1/users/kyc/health" type="health">
  Provider availability. Returns `503` when no provider is available.
</ParamField>

#### Session status

A session moves through these statuses (also delivered as `KYC_*` webhooks):

| `status`      | Meaning                                     |
| ------------- | ------------------------------------------- |
| `PENDING`     | Session created, awaiting documentoscopy.   |
| `IN_PROGRESS` | Documentoscopy under review.                |
| `APPROVED`    | KYC approved.                               |
| `REJECTED`    | KYC rejected (reason in `rejectionReason`). |
| `EXPIRED`     | Session expired.                            |
| `ERROR`       | Provider error.                             |

<Warning>
  Get notified of status changes via the `KYC_*` [webhooks](/en/api-reference/webhooks), or poll `GET /api/v1/users/kyc/sessions/:sessionId`. The session payload never exposes the raw document hash or the provider's raw response.
</Warning>

---

## 4. API de Parceiro — Endpoints

### 4.1 Auth
**[faltou: endpoints__auth-token.md]**

### 4.2 Users
**[faltou: endpoints__users-create.md]**
**[faltou: endpoints__users-list.md]**
**[faltou: endpoints__users-get.md]**
**[faltou: endpoints__users-block.md]**

### 4.3 API Keys
**[faltou: endpoints__apikeys-create.md]**
**[faltou: endpoints__apikeys-list.md]**
**[faltou: endpoints__apikeys-revoke.md]**
**[faltou: endpoints__rotate-secret.md]**
**[faltou: endpoints__rotate-webhook-secret.md]**

### 4.4 Webhook Config
**[faltou: endpoints__webhook-config-set.md]**
**[faltou: endpoints__webhook-config-get.md]**
**[faltou: endpoints__webhook-config-delete.md]**

### 4.5 KYC
**[faltou: endpoints__kyc-lookup.md]**
**[faltou: endpoints__kyc-verify.md]**
**[faltou: endpoints__kyc-health.md]**
**[faltou: endpoints__kyc-session-pf.md]**
**[faltou: endpoints__kyc-session-pj.md]**
**[faltou: endpoints__kyc-sessions-list.md]**
**[faltou: endpoints__kyc-session-get.md]**
**[faltou: endpoints__kyc-session-sync.md]**
**[faltou: endpoints__kyc-session-docurl.md]**
**[faltou: endpoints__kyc-user-check.md]**

### 4.6 Prices / Assets
**[faltou: endpoints__price-get.md]**
**[faltou: endpoints__accepted-cryptos.md]**

### 4.7 Validate
**[faltou: endpoints__validate-code.md]**

### 4.8 Cashout (offramp — cripto → PIX/boleto)
**[faltou: endpoints__cashout-quote.md]**
**[faltou: endpoints__cashout-intent.md]**
**[faltou: endpoints__cashout-intent-get.md]**
**[faltou: endpoints__cashout-intents-list.md]**

### 4.9 Cashin (onramp — PIX → cripto)
**[faltou: endpoints__cashin-quote.md]**
**[faltou: endpoints__cashin-intent.md]**
**[faltou: endpoints__cashin-intent-get.md]**
**[faltou: endpoints__cashin-intents-list.md]**
**[faltou: endpoints__cashin-payment-get.md]**

### 4.10 Receipts
**[faltou: endpoints__receipt-pix.md]**
**[faltou: endpoints__receipt-payments.md]**

### 4.11 Links
**[faltou: endpoints__links-create.md]**
**[faltou: endpoints__links-list.md]**
**[faltou: endpoints__links-resolve.md]**
**[faltou: endpoints__links-cancel.md]**

---

_Fim do documento consolidado. Fonte: https://docs.pag.finance (llms.txt + páginas .md individuais)._
