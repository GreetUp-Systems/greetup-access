# SPEC-003 — Organizations (Cadastro Produtor + KYB BlindPay)

**Objetivo:** Implementar onboarding completo do produtor: cadastro, KYB via BlindPay, registro de chave Pix e wallet Stellar no BlindPay.

**Pré-requisitos:** SPEC-001, SPEC-002

**Tempo estimado:** 1-2 dias

---

## 1. Estrutura de arquivos

```
apps/api/src/
├── organizations/
│   ├── organizations.module.ts
│   ├── organizations.controller.ts
│   ├── organizations.service.ts
│   ├── dto/
│   │   ├── create-organization.dto.ts
│   │   ├── update-kyb.dto.ts
│   │   └── register-pix-key.dto.ts
│   └── __tests__/
│       ├── organizations.service.spec.ts
│       └── organizations.integration.spec.ts
└── common/
    └── blindpay/
        ├── blindpay.module.ts
        ├── blindpay.service.ts
        ├── blindpay.types.ts
        └── __tests__/
            └── blindpay.service.spec.ts
```

---

## 2. BlindPayService — assinaturas

```typescript
// common/blindpay/blindpay.types.ts
export interface CreateReceiverDto {
  name: string;
  taxId: string;        // CPF ou CNPJ formatado
  email: string;
  phone: string;
  country: "BR";
  type: "individual" | "business";
}

export interface BlindPayReceiver {
  id: string;
  kybStatus: "pending" | "approved" | "rejected" | "under_review";
  kybUrl?: string;
}

export interface RegisterWalletPayload {
  network: "stellar" | "stellar_testnet";
  address: string;
  isAccountAbstraction: boolean;
}

export interface RegisterPixKeyPayload {
  type: "pix";
  pixKey: string;
  pixKeyType: "email" | "cpf" | "cnpj" | "phone" | "random";
}

export interface PayinQuote {
  id: string;
  pixCode: string;
  pixExpiresAt: string;
  sourceAmountBrl: number;
  destinationAmountUsdc: number;
  feeBrl: number;
  exchangeRate: number;
}

export interface CreatePayinDto {
  sourceCurrency: "BRL";
  sourceAmountCents: number;   // em centavos
  destinationCurrency: "USDC";
  destinationNetwork: "stellar" | "stellar_testnet";
  destinationAddress: string;  // wallet do EscrowContract
  idempotencyKey: string;      // purchaseId
}

// common/blindpay/blindpay.service.ts
@Injectable()
export class BlindPayService {
  async createReceiver(dto: CreateReceiverDto): Promise<BlindPayReceiver>;
  async getReceiver(receiverId: string): Promise<BlindPayReceiver>;
  async registerBlockchainWallet(receiverId: string, payload: RegisterWalletPayload): Promise<{ id: string }>;
  async registerPixKey(receiverId: string, payload: RegisterPixKeyPayload): Promise<{ id: string }>;
  async createPayinQuote(dto: CreatePayinDto): Promise<PayinQuote>;
  async confirmPayin(quoteId: string, idempotencyKey: string): Promise<{ id: string; status: string }>;
  async createPayoutQuote(receiverId: string, amountUsdc: number): Promise<{ id: string }>;
  async executePayout(quoteId: string, bankAccountId: string): Promise<{ id: string; status: string }>;

  // Valida HMAC-SHA256 do webhook
  validateWebhookSignature(rawBody: Buffer, signature: string): boolean;
}
```

---

## 3. OrganizationsService — assinaturas

```typescript
@Injectable()
export class OrganizationsService {
  // Cria organização e receiver no BlindPay
  async create(dto: CreateOrganizationDto, privyUserId: string): Promise<Organization>;

  // Busca organização pelo privyUserId (via WalletAccount)
  async findByPrivyUserId(privyUserId: string): Promise<Organization | null>;

  // Atualiza status KYB (chamado pelo webhook ou polling)
  async updateKybStatus(organizationId: string, status: KYBStatus): Promise<void>;

  // Registra chave Pix do produtor no BlindPay
  async registerPixKey(organizationId: string, dto: RegisterPixKeyDto): Promise<void>;

  // Retorna organização completa com receiver e wallet
  async findById(organizationId: string): Promise<Organization & {
    blindPayReceiver: BlindPayReceiver | null;
    walletAccount: WalletAccount | null;
  }>;
}
```

---

## 4. Endpoints

### POST /organizations
```
Headers: Authorization: Bearer <privy_token>
Body: {
  name: string,
  email: string,
  cnpj?: string,
  taxId: string,       // CPF ou CNPJ para KYB
  phone: string,
}

Response 201: Organization

Flow:
1. Cria Organization (status: PENDING_KYB)
2. Chama BlindPayService.createReceiver()
3. Salva blindPayReceiver com kybStatus: PENDING
4. Retorna org com kybUrl para o frontend redirecionar
```

### GET /organizations/me
```
Headers: Authorization: Bearer <privy_token>
Response 200: Organization com blindPayReceiver e walletAccount
```

### POST /organizations/me/pix-key
```
Headers: Authorization: Bearer <privy_token>
Body: { pixKey: string, pixKeyType: "email" | "cpf" | "cnpj" | "phone" | "random" }
Response 200: { success: true }
Pré-condição: kybStatus === APPROVED
```

### POST /organizations/me/wallet
```
Headers: Authorization: Bearer <privy_token>
Body: { stellarAddress: string }
Response 200: { id: string }
Pré-condição: kybStatus === APPROVED
Flow:
1. Chama Privy para confirmar que stellarAddress pertence ao usuário
2. Registra wallet no BlindPay
3. Cria WalletAccount no banco
```

---

## 5. Webhook KYB BlindPay (integração futura, preparar handler)

```typescript
// Em webhooks.controller.ts (será implementado em SPEC-005)
// Preparar o handler:
async handleKybUpdate(payload: { receiver_id: string; kyb_status: string }): Promise<void> {
  // Busca BlindPayReceiver pelo receiver_id
  // Atualiza kybStatus
  // Se APPROVED: ativa Organization (status: ACTIVE)
  // Publica domain event: organization.kyb_approved
}
```

---

## 6. Testes esperados

### Unitários
- `OrganizationsService.create` chama `BlindPayService.createReceiver` e salva receiver
- `OrganizationsService.updateKybStatus` atualiza org para ACTIVE quando APPROVED
- `OrganizationsService.registerPixKey` lança ForbiddenException se kybStatus !== APPROVED
- `BlindPayService.validateWebhookSignature` retorna true com HMAC correto
- `BlindPayService.validateWebhookSignature` retorna false com payload adulterado

### Integração
- `POST /organizations` cria org e chama BlindPay (mock do BlindPay em teste)
- `GET /organizations/me` retorna 404 para usuário sem org
- `POST /organizations/me/pix-key` retorna 403 se KYB pendente

---

## 7. Variáveis de ambiente necessárias

```bash
BLINDPAY_API_KEY=
BLINDPAY_INSTANCE_ID=
BLINDPAY_BASE_URL=https://sandbox.api.blindpay.com
BLINDPAY_WEBHOOK_SECRET=
```

---

## 8. Definição de Pronto

- [ ] `POST /organizations` cria organização e envia para KYB BlindPay
- [ ] `GET /organizations/me` retorna organização com status KYB atualizado
- [ ] `POST /organizations/me/pix-key` funciona apenas com KYB aprovado
- [ ] Validação de assinatura de webhook BlindPay funciona
- [ ] Todos os testes passam
