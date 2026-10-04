# SPEC-003 — Onboarding do produtor

> **Status:** gates 3A/3B e implementação automatizada de 3C (v1.4) validados localmente; smokes
> reais BlindPay e Stellar/Privy/BlindPay pendentes
>
> **Versão:** 1.5
>
> **Atualizada em:** 04/10/2026
>
> **Aprovada em:** 30/09/2026
>
> **Depende de:** [`SPEC-002`](./SPEC-002-auth.md) e
> [`ADR-009`](../03-adrs/ADR-009-identity-producer-tenancy.md) e
> [`ADR-010`](../03-adrs/ADR-010-stellar-development-signer.md)

## 1. Objetivo

Transformar um `User` autenticado em produtor, isolar seus dados por RLS e conduzir seu onboarding
regulatório na BlindPay. No gate 3C, a mesma SPEC faz a configuração inicial da conta Stellar do
produtor — ativação e trustlines — logo após a criação do perfil, sem depender do KYC, e registra a
wallet externa na BlindPay quando o KYC estiver aprovado (D-23).

Ao final das etapas liberadas, a API deve conseguir:

1. criar exatamente um `ProducerProfile` para o `User` autenticado;
2. impedir, também no banco, que um produtor leia ou altere dados de outro;
3. gerar a jornada de aceite dos termos e enviar KYC/KYB à BlindPay sem persistir o dossiê;
4. refletir `customer.update`, RFIs e o estado operacional do customer de forma idempotente;
5. emitir `producer.kyc_approved` uma única vez na primeira aprovação operacional;
6. ativar na Testnet a conta Stellar do produtor ao criar o perfil e, após o KYC, cadastrar sua
   wallet externa `bw_...`.

Esta SPEC é dividida em três gates. Em 3C, o signer do ADR-010 opera somente em development/testnet;
production segue o mesmo modelo (D-24), mas só é liberada na etapa explícita de habilitação de
Pubnet/USDC.

## 2. Correções arquiteturais confirmadas

- **Baseline desta SPEC:** desenvolvimento, testes de integração, smoke tests e validação de negócio
  usam exclusivamente Stellar Testnet, com trustlines de USDB (ativo da BlindPay) e de USDC de
  teste. Pubnet não faz parte da entrega nem da validação desta etapa.
- A wallet Privy criada na SPEC-002 ainda pode ser somente um endereço; ela não necessariamente
  existe no ledger Stellar.
- `fee bump` paga a taxa da transação, mas não substitui as assinaturas exigidas pela transação
  interna.
- A reserva da conta e das trustlines é patrocinada por uma conta Stellar do Access. Em development,
  essa conta também paga a taxa clássica e assina localmente conforme o ADR-010.
- O fluxo de ativação exige autorização da conta patrocinadora e da wallet do produtor, porque as
  operações possuem fontes diferentes.
- A assinatura da wallet user-owned pode ser solicitada no backend com o JWT válido do próprio
  usuário e `raw_sign` do Privy; isso não transforma o Access em owner da wallet.
- Na BlindPay, o produtor é um _customer_. Uma rejeição de KYC não é corrigida no mesmo customer:
  uma nova tentativa deve criar outro `re_...`.
- USDC na rede pública permanece como configuração futura de produção e não deve ser exercitada
  implicitamente por nenhum ambiente desta SPEC. Na Testnet, o USDC usado é o de teste.

Referências técnicas vigentes:

- [Stellar — sponsored reserves](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/accounts/reserves-sponsored-reserves)
- [OpenZeppelin Relayer — Stellar](https://docs.openzeppelin.com/relayer/stellar)
- [OpenZeppelin Channels](https://docs.openzeppelin.com/relayer/plugins/channels)
- [Privy — Stellar signing](https://docs.privy.io/recipes/tier-2-wallet-integration#stellar)
- [BlindPay — customers](https://blindpay.com/docs/learn/customers)
- [BlindPay — RFI](https://blindpay.com/docs/learn/rfi)

## 3. Decisões consumidas

- `ProducerProfile` é um perfil opcional 1:1 de `User`.
- Uma conta possui no máximo um produtor no MVP; não existem `Organization`, `Membership`, convite
  ou papéis.
- Se a mesma pessoa compra e produz, usa o mesmo `User` e a mesma wallet. Pessoas diferentes nunca
  compartilham wallet.
- Cada produtor é um customer próprio na instância BlindPay do Access.
- A wallet cadastrada na BlindPay é externa e aponta para o endereço Stellar da wallet Privy.
- O Access não recebe dinheiro em nome do produtor; payins futuros apontam diretamente para o
  `blockchain_wallet_id` desse customer.
- Tabelas de tenant usam RLS por `producer_id`; o contexto e as queries usam a mesma transação.
- Alteração de estado que gera evento de domínio também grava o Outbox na mesma transação.
- Dados de KYC/KYB pertencem à BlindPay e não viram um segundo dossiê no banco do Access.

## 4. Entrega por gates

### 3A — Perfil e isolamento

Inclui:

- `ProducerProfile` 1:1 e endpoints de criação/consulta;
- roles PostgreSQL de migration, runtime e integração BlindPay;
- helpers transacionais de contexto de usuário e produtor;
- RLS real, com `FORCE ROW LEVEL SECURITY`, nas tabelas do produtor;
- testes com a role restrita de runtime, nunca somente com o owner/superuser.

### 3B — BlindPay e compliance

Inclui:

- aceite client-side dos termos da BlindPay;
- upload intermediado de documentos;
- criação de customer individual ou business com KYC/KYB standard;
- acompanhamento de status, webhook `customer.update` e RFI;
- múltiplas tentativas de customer quando houver rejeição;
- Outbox `producer.kyc_approved` na primeira transição para estado operacional.

### 3C — Ativação Stellar e wallet BlindPay

Inclui em development/testnet, conforme o ADR-010:

- conta Stellar com reserva patrocinada pelo Access;
- trustlines de USDB e de USDC de teste na Stellar Testnet;
- assinatura do produtor via Privy;
- assinatura local da conta patrocinadora e submissão direta à Testnet;
- reconciliação on-chain para retries e resultados ambíguos;
- registro da wallet externa `bw_...` na BlindPay.

**Gate:** 3C pode ser implementado somente em development/testnet. Produção permanece bloqueada
até a etapa explícita de habilitação de Pubnet/USDC, que usa o mesmo modelo de signer (D-24).

### Fora do escopo

- telas Next.js do onboarding;
- conta bancária, Pix, payin, payout, partner fee ou saldo;
- criação de eventos;
- ativação on-chain da wallet de comprador que não seja produtor;
- contratos Soroban, NFT, mint e check-in;
- equipes, staff, organizações, convites e RBAC;
- KYC do comprador;
- armazenamento de documentos ou dados regulatórios completos pelo Access.

## 5. Invariantes e estados

### Invariantes

1. Cada `User` possui no máximo um `ProducerProfile`.
2. O endpoint nunca aceita `userId`, `producerId`, customer ID ou wallet address para escolher o
   tenant; esses valores são derivados da identidade autenticada e dos vínculos persistidos.
3. Uma rejeição cria uma nova tentativa BlindPay; o histórico anterior não é sobrescrito.
4. Somente o customer atual pode determinar a prontidão regulatória do produtor.
5. `approved` e `approved_rfi` são operacionais. `verifying`, `compliance_request` e `rejected` não
   liberam novos fluxos dependentes de KYC.
6. Status desconhecido enviado pela BlindPay falha fechado para prontidão e gera alerta sem
   persistir o payload bruto.
7. `producer.kyc_approved` ocorre apenas na primeira transição não operacional → operacional de
   cada produtor.
8. O endereço Stellar vem de `WalletAccount`, nunca do body do cliente.
9. A configuração Stellar do produtor não depende do KYC. A wallet `bw_...` só é cadastrada depois
   de a conta e as trustlines estarem confirmadas on-chain **e** de o customer atual estar
   operacional.
10. Toda mutação externa usa chave de idempotência estável para a mesma intenção e payload.

### Estado derivado de onboarding

Não criar um enum redundante `ProducerStatus`. A API deriva a situação:

| Estado                        | Condição                                                          |
| ----------------------------- | ----------------------------------------------------------------- |
| `stellar_pending`             | perfil existe, conta/trustlines ainda não ativas                  |
| `compliance_pending`          | Stellar ativa, customer atual ausente ou não operacional          |
| `wallet_registration_pending` | Stellar ativa + customer operacional, sem `bw_...`                |
| `ready`                       | customer operacional + Stellar ativa + wallet BlindPay registrada |

A configuração Stellar e o KYC correm em trilhas independentes; o estado derivado reporta a primeira
pendência na ordem da tabela.

## 6. Modelo de dados

Os nomes finais da migration podem acompanhar a convenção do repositório, preservando estas
restrições:

```prisma
enum BlindPayCustomerType {
  INDIVIDUAL @map("individual")
  BUSINESS   @map("business")
}

enum BlindPayKycStatus {
  VERIFYING          @map("verifying")
  APPROVED           @map("approved")
  REJECTED           @map("rejected")
  COMPLIANCE_REQUEST @map("compliance_request")
  APPROVED_RFI       @map("approved_rfi")
}

enum BlindPayCustomerCreationStatus {
  PENDING @map("pending")
  CREATED @map("created")
  FAILED  @map("failed")
}

enum StellarProvisioningStatus {
  PENDING   @map("pending")
  SIGNING   @map("signing")
  SUBMITTED @map("submitted")
  ACTIVE    @map("active")
  FAILED    @map("failed")
}

model ProducerProfile {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @unique @map("user_id") @db.Uuid
  displayName String   @map("display_name") @db.VarChar(120)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  user                User                        @relation(fields: [userId], references: [id], onDelete: Restrict)
  blindPayCustomers   BlindPayCustomer[]
  stellarProvisioning StellarAccountProvisioning?

  @@map("producer_profiles")
}

model BlindPayCustomer {
  id                         String                         @id @default(uuid()) @db.Uuid
  producerId                 String                         @map("producer_id") @db.Uuid
  externalCustomerId         String?                        @unique @map("external_customer_id")
  providerIdempotencyKey     String                         @unique @map("provider_idempotency_key") @db.VarChar(64)
  customerType               BlindPayCustomerType           @map("customer_type")
  creationStatus             BlindPayCustomerCreationStatus @default(PENDING) @map("creation_status")
  kycStatus                  BlindPayKycStatus?             @map("kyc_status")
  isCurrent                  Boolean                        @default(true) @map("is_current")
  externalBlockchainWalletId String?                        @unique @map("external_blockchain_wallet_id")
  failureCode                String?                        @map("failure_code") @db.VarChar(100)
  createdAt                  DateTime                       @default(now()) @map("created_at")
  updatedAt                  DateTime                       @updatedAt @map("updated_at")

  producer ProducerProfile @relation(fields: [producerId], references: [id], onDelete: Restrict)

  @@index([producerId, createdAt])
  @@map("blindpay_customers")
}

model BlindPayWebhookDelivery {
  id                String    @id @default(uuid()) @db.Uuid
  providerMessageId String    @unique @map("provider_message_id")
  eventType         String    @map("event_type")
  resourceId        String?   @map("resource_id")
  payloadHash       String    @map("payload_hash")
  processedAt       DateTime? @map("processed_at")
  createdAt         DateTime  @default(now()) @map("created_at")

  @@map("blindpay_webhook_deliveries")
}

model StellarAccountProvisioning {
  id              String                    @id @default(uuid()) @db.Uuid
  producerId      String                    @unique @map("producer_id") @db.Uuid
  walletAccountId String                    @unique @map("wallet_account_id") @db.Uuid
  network         String                    @db.VarChar(32)
  status          StellarProvisioningStatus @default(PENDING)
  transactionHash String?                   @unique @map("transaction_hash") @db.VarChar(64)
  failureCode     String?                   @map("failure_code") @db.VarChar(80)
  activatedAt     DateTime?                 @map("activated_at")
  createdAt       DateTime                  @default(now()) @map("created_at")
  updatedAt       DateTime                  @updatedAt @map("updated_at")

  producer ProducerProfile @relation(fields: [producerId], references: [id], onDelete: Restrict)
  wallet   WalletAccount   @relation(fields: [walletAccountId], references: [id], onDelete: Restrict)

  @@map("stellar_account_provisionings")
}
```

A migration adiciona um índice único parcial em `blindpay_customers(producer_id) WHERE is_current`,
que o Prisma Schema não expressa. Trocar a tentativa atual desmarca a anterior e cria a nova na
mesma transação.

`externalCustomerId` e `kycStatus` permanecem nulos enquanto a tentativa `pending` ainda não foi
confirmada pelo provider. Isso permite persistir a intenção antes da chamada externa, repetir com a
mesma chave e distinguir falha definitiva de indisponibilidade temporária sem guardar o dossiê.

`StellarAccountProvisioning` e suas relações pertencem à migration própria do gate 3C. Essa
migration mantém o mesmo isolamento por `producer_id` das tabelas entregues em 3A/3B. O registro não
guarda os ativos: as trustlines esperadas vêm da configuração e são conferidas on-chain a cada
reconciliação.

`BlindPayWebhookDelivery` guarda somente metadados para deduplicação e auditoria. O body original,
headers de assinatura e dados pessoais não são persistidos.

## 7. RLS e conexões de banco

### Contexto autenticado

`ProducerProfile` resolve o primeiro vínculo pelo usuário:

```sql
user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
```

O helper `withUserContext(userId, callback)` define `app.current_user_id` com `set_config(...,
true)` e executa o callback na mesma transação. Ele permite criar e consultar o próprio perfil.

Depois que o perfil existe, `withProducerContext(userId, callback)`:

1. abre uma transação;
2. define `app.current_user_id`;
3. resolve o `ProducerProfile.id` protegido pela policy;
4. define `app.current_producer_id`;
5. executa todas as queries do callback no mesmo cliente transacional.

Tabelas filhas usam `producer_id = app.current_producer_id` em `USING` e `WITH CHECK`. Ausência de
contexto retorna zero linhas.

### Roles

- owner/migration: aplica migrations; nunca é usado para requests;
- runtime: `NOBYPASSRLS`, não é owner e atende rotas autenticadas;
- BlindPay webhook: role técnica separada, `NOBYPASSRLS`, com grants e policy somente nas tabelas
  BlindPay, Outbox e deduplicação necessárias ao webhook já autenticado.

O handler não usa a role técnica antes de validar assinatura e tolerância temporal. Nenhuma role da
aplicação recebe `BYPASSRLS`.

Os testes usam URLs distintas para migration e runtime. O superuser criado pelo container não vale
como prova de isolamento.

## 8. Contratos HTTP

Todas as rotas abaixo são privadas, exceto o webhook.

### `POST /api/producers`

```json
{ "displayName": "Festival Access" }
```

Cria idempotentemente o perfil do usuário atual. Retorna `200` se já existir com o mesmo valor e
`409 producer_already_exists` se uma repetição tentar alterar a identidade do perfil.

### `GET /api/producers/me`

Retorna perfil e estado derivado, sem dados pessoais do dossiê:

```json
{
  "id": "uuid",
  "displayName": "Festival Access",
  "onboardingStatus": "compliance_pending",
  "compliance": { "status": "verifying", "hasOpenRfi": false },
  "stellar": { "status": "not_started" }
}
```

### `POST /api/producers/onboarding/tos`

Recebe uma `redirectUrl` permitida pela configuração e retorna a URL temporária da BlindPay. O
aceite ocorre no domínio da BlindPay e o retorno contém `tos_id`. Session token e URL completa não
são persistidos nem logados.

### `POST /api/producers/onboarding/files`

Recebe um único PDF, JPEG ou PNG de até 10 MB, mantém o buffer apenas durante a request e o encaminha
à BlindPay. Retorna somente a referência opaca necessária à submissão; o arquivo não é gravado em
disco ou banco pelo Access.

### `POST /api/producers/onboarding/customer`

Aceita DTO discriminado por `type: "individual" | "business"`, sempre com `kycType: "standard"`,
`tosId` e referências de arquivo válidas. Email e wallet não são aceitos como campos livres: o email
vem do `User`, e a wallet será vinculada somente no gate 3C.

Cria um novo `BlindPayCustomer`, torna-o a tentativa atual e retorna apenas identificadores/estado
necessários. Se a tentativa atual não estiver rejeitada, uma nova criação retorna
`409 customer_attempt_already_active`.

### `GET /api/producers/onboarding/rfi`

Busca na BlindPay o RFI aberto do customer atual e devolve os campos necessários ao cliente. O
conteúdo não é persistido nem logado.

### `POST /api/producers/onboarding/rfi`

Encaminha uma resposta única e validada para o RFI atual. Chaves aceitas vêm da definição retornada
pela BlindPay; campos adicionais são rejeitados.

### `POST /api/webhooks/blindpay`

Rota pública quanto ao Privy, mas autenticada pelos headers `svix-id`, `svix-timestamp` e
`svix-signature` sobre o body bruto. Regras:

1. capturar o body sem transformação;
2. validar assinatura em tempo constante e tolerância de cinco minutos;
3. deduplicar por `svix-id` e conferir o hash para detectar reuso divergente;
4. aceitar `customer.new` e `customer.update` nesta SPEC; a criação também persiste o
   `kyc_status` inicial, pois em Development o customer pode nascer `approved` sem uma transição
   posterior. Desde 10/2026 a resposta da criação traz só `id` e `customer_id`: o status é lido por
   `GET /customers/{id}` logo depois; se essa leitura falhar, o customer fica `verifying` e o
   webhook traz o status real;
5. localizar o customer somente depois da validação;
6. atualizar status e, na primeira entrada operacional, gravar Outbox na mesma transação;
7. responder `2xx` também para entrega válida já processada.

Eventos válidos ainda não consumidos são reconhecidos sem persistir payload sensível. Status novo
ou payload incompatível não libera o produtor e gera alerta sanitizado.

### `POST /api/producers/onboarding/stellar/activate` — gate 3C

Operação explícita, autenticada e repetível. Não aceita endereço, rede ou ativo no body. Executa o
que estiver pendente: a configuração Stellar, chamada logo após a criação do perfil, e o registro
`bw_...`, quando o customer atual estiver operacional — o cliente chama de novo após a aprovação do
KYC. Retorna o estado atual (`signing`, `submitted` ou `active`) e reconcilia a rede antes de repetir
uma submissão cujo resultado seja incerto.

## 9. Boundary da BlindPay

Controllers não conhecem URLs, headers ou DTOs crus do provider. O adapter expõe operações do
domínio:

```typescript
interface BlindPayGateway {
  createTermsOfServiceUrl(input: CreateTermsInput): Promise<TermsSession>;
  uploadDocument(input: DocumentUpload): Promise<UploadedDocument>;
  createCustomer(input: CreateCustomerInput, idempotencyKey: string): Promise<{ id: string }>;
  getCustomerKycStatus(customerId: string): Promise<BlindPayKycStatus>;
  getOpenRfi(customerId: string): Promise<BlindPayRfi | null>;
  submitRfi(customerId: string, answers: RfiAnswers, idempotencyKey: string): Promise<void>;
  registerExternalStellarWallet(
    input: ExternalWalletInput,
    idempotencyKey: string,
  ): Promise<BlindPayWallet>;
}
```

Regras:

- base URL e `instance_id` vêm da configuração;
- toda chamada possui timeout e validação estrita da resposta;
- mutações enviam `Idempotency-Key` estável para a mesma intenção e corpo;
- `429`, timeout e `5xx` viram erro retryable; `4xx` de regra viram erro de domínio sanitizado;
- resposta `2xx` fora do contrato é resultado incerto, não rejeição: vira erro retryable, a
  tentativa não é marcada como falha e a repetição reusa a mesma `Idempotency-Key`, recuperando o
  recurso que o provider possa ter criado. Só um `4xx` de regra encerra a tentativa;
- `externalCustomerId` começa com `re_` e wallet externa com `bw_`;
- network é obrigatoriamente `stellar_testnet` nesta SPEC;
- wallet externa usa `is_account_abstraction: true` conforme o fluxo da BlindPay para Stellar;
- API key, dados pessoais, documentos, URLs privadas e respostas de RFI nunca aparecem em logs.

## 10. Fluxo Stellar e Privy — gate 3C development

Pré-condições: `ProducerProfile` existente, wallet da SPEC-002 íntegra e signer local do ADR-010
configurado. O KYC não é pré-condição da configuração Stellar (D-23).

1. consultar a Testnet via Horizon e seguir para o passo 8 se a conta e todas as trustlines
   configuradas já estiverem corretas;
2. construir transação clássica com:
   - `beginSponsoringFutureReserves`, fonte Access;
   - `createAccount` com `startingBalance = 0`, fonte Access — omitida se a conta já foi ativada
     no login espontâneo (D-23);
   - um `changeTrust` para cada ativo configurado ainda sem trustline (USDB e USDC), fonte
     produtor;
   - `endSponsoringFutureReserves`, fonte produtor;
3. calcular o hash da transação interna;
4. solicitar a assinatura Ed25519 da wallet user-owned via Privy `raw_sign`, autorizada pelo JWT do
   usuário atual mantido apenas no contexto efêmero da request;
5. assinar localmente com a conta patrocinadora dedicada à Testnet;
6. submeter diretamente, com taxa paga pelo sponsor, e persistir somente hash/estado/código
   sanitizado;
7. confirmar conta e trustlines via Horizon;
8. se o customer atual estiver operacional, registrar o endereço como wallet externa na BlindPay;
   caso contrário, encerrar com o produtor em `compliance_pending`;
9. derivar o produtor como `ready` quando as duas trilhas estiverem concluídas.

Não persistir XDR assinado, assinatura, JWT ou chave privada. Timeout após submissão exige consulta
por hash/estado antes de montar outra transação.

## 11. Outbox e idempotência

Ao mudar o customer atual de estado não operacional para operacional, a mesma transação grava:

```json
{
  "eventType": "producer.kyc_approved",
  "aggregateType": "producer",
  "aggregateId": "producer-uuid",
  "payload": {
    "producerId": "producer-uuid",
    "blindPayCustomerRecordId": "customer-record-uuid"
  }
}
```

A `deduplicationKey` é estável por produtor, por exemplo `producer:{id}:kyc_approved:v1`. O payload
não contém nome, email, tax ID, customer externo ou qualquer dado do KYC.

Criação de perfil, customer, processamento de webhook, ativação Stellar e registro `bw_...` devem
ser seguros sob repetição e concorrência.

## 12. Configuração

3A/3B adicionam:

```dotenv
DATABASE_URL_BLINDPAY_WEBHOOK=
BLINDPAY_API_KEY=
BLINDPAY_INSTANCE_ID=
BLINDPAY_BASE_URL=https://api.blindpay.com/v1
BLINDPAY_WEBHOOK_SECRET=
BLINDPAY_API_TIMEOUT_MS=5000
BLINDPAY_ALLOWED_REDIRECT_ORIGINS=http://localhost:3000
```

Em `development`, `DATABASE_URL_BLINDPAY_WEBHOOK` e `BLINDPAY_WEBHOOK_SECRET` podem permanecer
ambos vazios enquanto não existir uma URL HTTPS pública. Nesse modo, o endpoint de webhook e sua
conexão técnica não são registrados; as chamadas de saída para ToS, upload, customer e RFI continuam
disponíveis, mas mudanças assíncronas de KYC não são refletidas até o webhook ser ativado. Configurar
somente um dos dois valores é inválido. Em `test` e `production`, ambos são obrigatórios.

3C development adiciona:

```dotenv
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_ASSET_CODE=USDB
STELLAR_ASSET_ISSUER=
STELLAR_USDC_ASSET_ISSUER=
STELLAR_SPONSOR_PUBLIC_KEY=
STELLAR_SPONSOR_SECRET_KEY=
```

`STELLAR_ASSET_*` é o ativo de liquidação da BlindPay (USDB na Testnet); `STELLAR_USDC_ASSET_ISSUER`
é o emissor do USDC de teste. Na Pubnet os dois coincidem em USDC e resultam numa única trustline.

As operações clássicas de conta, trustline e submissão usam Horizon. O endpoint RPC permanece
fixado na Testnet para as próximas integrações Soroban, sem ser usado para inferir Pubnet.

A chave secreta do sponsor é aceita somente no `.env` local de development/test e nunca é
versionada. Nesta SPEC ela é rejeitada em production. Network, passphrase implícita, ativo, issuer e
correspondência entre public e secret são validados no startup. Nesta SPEC, qualquer configuração
diferente de Stellar Testnet + USDB + USDC de teste falha fechada; Pubnet + USDC exige uma etapa explícita, que passa
a ler a secret das variáveis de ambiente da plataforma de hospedagem (D-24).

## 13. Segurança e minimização de dados

O banco do Access não armazena:

- CPF/CNPJ, tax ID, data de nascimento ou endereço residencial;
- selfie, passaporte, documento societário ou conteúdo de arquivos;
- respostas de RFI;
- IP informado no aceite, `tos_id` consumido ou session token;
- body bruto de webhook;
- access token/JWT Privy, assinatura, XDR assinado ou chave privada.

O backend pode processar esses dados em memória somente para encaminhá-los à BlindPay. Erros e
telemetria usam códigos, IDs internos e correlation ID. DTOs sensíveis nunca são serializados em
logs.

`displayName` é dado do produto, não nome legal verificado. Qualquer nome público futuro deve deixar
essa diferença clara.

## 14. Testes

### Unitários

- criação idempotente do perfil e rejeição de troca indevida;
- derivação de todos os estados do onboarding;
- mapeamento exato dos cinco status conhecidos e falha fechada para status novo;
- criação individual/business e nova tentativa após rejeição;
- idempotency keys estáveis e distintas entre intenções;
- assinatura Svix válida, inválida, expirada e body alterado;
- transição operacional grava um único evento, inclusive sob replay;
- RFI e upload não vazam conteúdo em erros/logs;
- adapter sanitiza falhas externas.

### Integração 3A/3B

Com PostgreSQL real e fakes apenas para BlindPay:

- migrations criam roles, grants e policies;
- runtime não é owner e não possui `BYPASSRLS`;
- produtor A não lê, altera ou referencia registros de B, mesmo omitindo filtro na query;
- ausência de contexto retorna zero linhas;
- contexto não vaza entre transações reutilizadas pelo pool;
- role do webhook acessa somente as tabelas concedidas;
- dois `POST /api/producers` concorrentes criam um perfil;
- dois creates/replays de customer não duplicam tentativa;
- webhook repetido por `svix-id` atualiza uma vez e produz um Outbox;
- `approved_rfi` permanece operacional; `compliance_request` não;
- customer rejeitado permite nova tentativa sem apagar histórico;
- body, documento e respostas de RFI não ficam no banco.

### Integração 3C

- composição e fontes das operações Stellar estão corretas, com e sem `createAccount`;
- as duas trustlines são criadas, e uma trustline já existente não é recriada;
- assinatura Privy usa a autorização do usuário atual e rejeita owner divergente;
- assinatura local do sponsor paga a taxa clássica somente em development/test;
- retry antes/depois da submissão não cria operação econômica duplicada;
- conta/trustline existentes são reconciliadas;
- BlindPay só recebe registro da wallet após confirmação on-chain;
- configuração aceita Testnet com USDB e USDC de teste e rejeita combinações de rede, passphrase,
  código ou issuer incompatíveis, inclusive Pubnet;
- configuração Stellar ocorre sem customer operacional, e `bw_...` só após o KYC;

### Smoke tests manuais

3B usa a instância development da BlindPay para completar ToS, customer e webhook/RFI sem registrar
credenciais. 3C usa Stellar Testnet, wallet user-owned real e saldo de sponsor controlado, conforme
o ADR-010.

## 15. Sequência de implementação

1. aprovar esta SPEC e o recorte 3A/3B;
2. criar roles de banco, helpers transacionais, schema e migration de 3A;
3. provar RLS com a role real de runtime;
4. implementar perfil e estado derivado;
5. implementar boundary BlindPay, ToS, upload e customer;
6. implementar webhook, RFI e Outbox;
7. executar validações automáticas e smoke test BlindPay development;
8. registrar no ADR-010 a decisão do signer de development/testnet;
9. adicionar schema/configuração e implementar 3C;
10. executar smoke test Stellar/Privy/BlindPay e validar o onboarding `ready`.

## 16. Validação obrigatória

```bash
pnpm db:generate
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
```

Também são obrigatórios os testes negativos de RLS com credenciais de runtime e o smoke test real
da integração entregue. Secrets e payloads sensíveis não entram em fixtures, snapshots ou saída do
CI.

## 17. Definição de pronto

### Gates 3A/3B

- [x] Um usuário autenticado cria no máximo um produtor.
- [x] Não existem `Organization`, `Membership`, role ou wallet adicional de produtor.
- [x] RLS isola produtores usando a role real de runtime.
- [x] Contratos de ToS, upload, customer individual/business, webhook e RFI passam com provider fake
      e PostgreSQL real.
- [x] O Access persiste somente o mínimo necessário do provider.
- [x] Rejeição preserva histórico e permite nova tentativa.
- [x] Aprovação operacional gera exatamente um `producer.kyc_approved` sanitizado.
- [ ] Smoke test com a instância BlindPay development confirma ToS, customer, webhook e RFI reais.
- [x] Build, lint, typecheck e suítes unitária/de integração passam na revisão final.

Validação parcial em 2026-10-02: ToS, upload e customer individual foram executados contra a
instância Development. O customer nasceu `approved` na resposta síncrona. A assinatura, os handlers
de `customer.new`/`customer.update` e a deduplicação da Outbox foram validados pelo endpoint público
com payload assinado, mas o checklist permanece aberto até observar uma entrega originada pela
BlindPay e um RFI real.

Smoke em 04/10/2026, pela instância Development e túnel HTTPS: ToS aceito, documentos enviados,
customer criado e lido `approved`, entrega real de webhook verificada pela assinatura e um único
`producer.kyc_approved` na Outbox. A primeira execução revelou a mudança no contrato da criação
(resposta só com ids), corrigida na v1.5. Falta só o RFI real: a instância Development aprova o
customer direto e não abre RFI sozinha.

### Gate 3C

- [x] Signer de development/testnet está decidido e documentado no ADR-010.
- [ ] Conta e trustlines USDB/USDC são patrocinadas sem exigir XLM do produtor.
- [ ] Produtor e sponsor autorizam somente o que lhes cabe.
- [x] Signer local paga a taxa e submete somente em development/test; production falha fechada.
- [x] Retry/reconciliação não duplica o provisionamento nos testes automatizados.
- [ ] Wallet externa `bw_...` aponta para o endereço verificado da SPEC-002.
- [ ] Estado derivado chega a `ready` somente com todas as pré-condições reais.

Revalidação automatizada da v1.4 em 02/10/2026: configuração Stellar sem KYC, trustlines USDB e
USDC de teste, conta já ativada no login, reprovisionamento de registro `ACTIVE` com trustline
ausente e registro `bw_...` somente após o KYC.

Validação automatizada em 02/10/2026: composição e fontes das operações, assinaturas produtor/sponsor,
fail-closed de configuração, reconciliação, idempotência, RLS, registro BlindPay após confirmação e
estado derivado `ready` passaram com gateways externos controlados. Os itens dependentes dos três
providers reais permanecem abertos até o smoke manual.

Tentativa de smoke em 04/10/2026, adiada por decisão: o login e o bootstrap com token real da Privy
funcionaram, mas a assinatura da wallet do usuário no servidor (`authorization_context.user_jwts`)
foi recusada pela Privy em `/v1/wallets/authenticate` com `400 Invalid JWT token provided`, tanto
para test account quanto para usuário real, com os dois tokens emitidos pela API REST de login. O
app está em `user-controlled-server-wallets-only`, sem JWT customizado. Falta testar com token
emitido pelo SDK no navegador: os itens do gate 3C serão validados pelo front, fluxo a fluxo. Se o
token do navegador também for recusado, a alternativa é signer delegado, com ADR.

## 18. Decisões adiadas

- habilitação de Pubnet/USDC em production, com o signer da D-24;
- ativação da conta Stellar de compradores que não são produtores, decidida na D-23 e especificada
  junto com a SPEC de compra.
- conta bancária e payout do produtor;
- renovação de uma nova versão dos termos da BlindPay;
- KYC enhanced, países além do piloto e políticas de retenção exigidas juridicamente;
- frontend do onboarding e recuperação de jornada interrompida.
