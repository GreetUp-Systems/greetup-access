# SPEC-002 — Identidade, autenticação e wallet

> **Status:** aprovada para implementação
>
> **Versão:** 2.0
>
> **Atualizada em:** 29/09/2026
>
> **Aprovada em:** 29/09/2026
>
> **Decisão arquitetural:** [`ADR-009`](../03-adrs/ADR-009-identity-producer-tenancy.md)

## 1. Objetivo

Entregar a identidade autenticada básica do Access e provisionar exatamente uma wallet Stellar
user-owned por conta Privy.

Ao final desta SPEC, a API deve conseguir:

1. verificar access tokens emitidos pelo Privy;
2. materializar idempotentemente o `User` interno;
3. localizar ou criar uma wallet Privy Stellar pertencente a esse usuário;
4. persistir o vínculo verificado entre usuário e wallet;
5. proteger rotas por padrão e expor a identidade atual em `/api/me`.

Esta SPEC não implementa o fluxo visual de OTP, onboarding do produtor, pagamentos ou ativação da
conta na rede Stellar.

## 2. Decisões consumidas

- `User` é a identidade canônica interna e `privyUserId` é seu identificador externo.
- Cada pessoa autenticada por email possui seu próprio `User` e sua própria wallet.
- Se o mesmo `User` comprar ingressos e também habilitar um `ProducerProfile`, ele reutiliza a wallet
  existente; o papel de produtor não cria outra conta ou wallet.
- Usuários diferentes nunca compartilham conta ou wallet.
- Cada `User` possui no máximo uma wallet Stellar no MVP.
- Produtor será um perfil opcional 1:1 do `User`, criado somente na SPEC-003.
- Não existem `Organization`, `Membership`, convite de equipe ou papéis no MVP.
- O comprador confirma email por OTP antes do Pix; guest accounts ficam fora do MVP.
- A wallet Privy é provisionada antes do pagamento, mas criar a conta na rede Stellar é outra etapa.
- RLS por `producer_id` será implementado na SPEC-003, quando existir a primeira tabela de produtor.

## 3. Escopo

### Incluído

- integração server-side com `@privy-io/node`;
- configuração e validação das credenciais Privy;
- guard global que verifica access token;
- decorator `@Public()` para rotas sem autenticação;
- decorator `@CurrentUser()` com principal autenticado;
- persistência de `User` e `WalletAccount`;
- bootstrap idempotente de conta e wallet;
- consulta da identidade atual;
- tratamento de concorrência, timeout, rate limit e respostas inválidas do Privy;
- testes unitários e de integração com PostgreSQL real;
- teste manual opcional contra o ambiente development do Privy.

### Não incluído

- aplicação Next.js ou telas de email/OTP;
- guest accounts, login social, SMS, passkey ou wallet externa;
- `ProducerProfile`, KYC/KYB ou customer BlindPay;
- criação da conta Stellar on-chain, reserva patrocinada ou trustline;
- policies, signers adicionais, autorização de transações ou exportação de chave;
- `Organization`, `Membership`, convites, equipes ou RBAC;
- tabelas de evento, ingresso, compra ou pagamento;
- policy RLS — não há tabela de produtor nesta etapa;
- webhooks Privy.

## 4. Invariantes

1. `privyUserId` identifica exatamente um `User`.
2. O email persistido foi verificado pelo Privy; o cliente não envia email para o bootstrap.
3. Um `User` possui no máximo um `WalletAccount`.
4. A wallet persistida usa `chain_type = stellar` e pertence ao mesmo usuário autenticado.
5. O endereço e o ID da wallet vêm do Privy, nunca de campos livres enviados pelo cliente.
6. Repetir ou concorrer o bootstrap não cria usuários nem wallets duplicados.
7. A wallet é user-owned; o backend do Access não é seu owner.
8. A wallet provisionada pode ainda não existir como conta ativa no ledger Stellar.
9. Rotas são privadas por padrão; somente rotas explicitamente `@Public()` ignoram o guard.
10. Tokens, app secret e chave de verificação nunca aparecem em banco, logs ou respostas.

## 5. Modelo de dados

Adicionar somente os modelos abaixo ao schema Prisma:

```prisma
model User {
  id          String   @id @default(uuid()) @db.Uuid
  privyUserId String   @unique @map("privy_user_id")
  email       String   @unique @db.VarChar(320)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  wallet WalletAccount?

  @@map("users")
}

model WalletAccount {
  id               String   @id @default(uuid()) @db.Uuid
  userId           String   @unique @map("user_id") @db.Uuid
  privyWalletId    String   @unique @map("privy_wallet_id")
  stellarAddress   String   @unique @map("stellar_address") @db.VarChar(56)
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@map("wallet_accounts")
}
```

Não adicionar `ProducerProfile`, `Organization`, `Membership`, role ou campos BlindPay nesta
migration.

## 6. Contrato de autenticação

### Entrada

Rotas privadas aceitam:

```http
Authorization: Bearer <privy-access-token>
```

Cookies HttpOnly podem ser avaliados junto com o frontend, mas não fazem parte desta SPEC.

### Verificação

O adapter Privy usa o SDK oficial para verificar assinatura, expiração, emissor e aplicação do
token. O principal interno contém somente os dados necessários:

```typescript
interface AuthenticatedPrincipal {
  privyUserId: string;
  sessionId: string;
}
```

O guard não escolhe produtor, não seta contexto RLS e não cria registros no banco.

### Rotas públicas iniciais

- `GET /api/health/live`
- `GET /api/health/ready`
- `POST /api/auth/bootstrap` continua privada, pois exige o access token Privy.

## 7. Contratos HTTP

### `POST /api/auth/bootstrap`

Materializa a identidade e garante a wallet. A requisição não possui body.

```http
Authorization: Bearer <privy-access-token>
```

Resposta `200` tanto na primeira execução quanto nas repetições:

```json
{
  "user": {
    "id": "uuid",
    "email": "buyer@example.com"
  },
  "wallet": {
    "address": "G...",
    "chainType": "stellar"
  }
}
```

Algoritmo obrigatório:

1. obter `privyUserId` do principal já verificado;
2. consultar no Privy o usuário e seu email verificado;
3. fazer upsert do `User` por `privyUserId`;
4. retornar a wallet persistida, se já existir;
5. procurar uma wallet Stellar user-owned já vinculada ao usuário no Privy;
6. se não existir, criá-la com owner `{ user_id: privyUserId }` e chave de idempotência estável;
7. validar tipo, owner, ID e endereço retornados;
8. persistir `WalletAccount` respeitando os índices únicos;
9. em conflito concorrente, reler o vínculo vencedor e retornar o mesmo resultado.

A chave de idempotência não pode conter email, token ou outro dado sensível.

### `GET /api/me`

Retorna o estado já materializado da conta autenticada.

Resposta `200`:

```json
{
  "user": {
    "id": "uuid",
    "email": "buyer@example.com"
  },
  "wallet": {
    "address": "G...",
    "chainType": "stellar"
  }
}
```

Retorna `404 account_not_bootstrapped` quando o token é válido, mas o bootstrap ainda não ocorreu.
`GET /api/me` não cria nem altera registros.

## 8. Boundary do Privy

O SDK não deve vazar para controllers ou regras de aplicação. Criar um adapter com tipos próprios:

```typescript
interface VerifiedPrivyPrincipal {
  privyUserId: string;
  sessionId: string;
}

interface PrivyIdentity {
  privyUserId: string;
  verifiedEmail: string;
}

interface PrivyStellarWallet {
  id: string;
  address: string;
  chainType: "stellar";
  ownerPrivyUserId: string;
}

interface PrivyGateway {
  verifyAccessToken(token: string): Promise<VerifiedPrivyPrincipal>;
  getIdentity(privyUserId: string): Promise<PrivyIdentity>;
  findStellarWallet(privyUserId: string): Promise<PrivyStellarWallet | null>;
  createStellarWallet(privyUserId: string, idempotencyKey: string): Promise<PrivyStellarWallet>;
}
```

### Falhas externas

- aplicar timeout em todas as chamadas ao Privy;
- mapear `401/403` de token para `401 invalid_auth_token`;
- mapear timeout, `429` e `5xx` durante bootstrap para `503 identity_provider_unavailable`;
- criação pode ser repetida somente com a mesma chave de idempotência;
- logs registram código, operação e correlation ID, nunca token ou segredo;
- resposta inesperada, owner divergente ou chain diferente falha fechada.

## 9. Estrutura esperada

```text
apps/api/src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── auth.types.ts
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── public.decorator.ts
│   ├── guards/
│   │   └── privy-auth.guard.ts
│   └── __tests__/
├── common/
│   └── privy/
│       ├── privy.module.ts
│       ├── privy.gateway.ts
│       └── privy.types.ts
└── users/
    ├── users.module.ts
    ├── users.repository.ts
    └── users.types.ts
```

A estrutura pode ser simplificada durante a implementação, desde que os boundaries de autenticação,
Privy e persistência permaneçam separados.

## 10. Configuração

Adicionar à seção ativa do `.env.example`:

```dotenv
PRIVY_APP_ID=
PRIVY_APP_SECRET=
PRIVY_JWT_VERIFICATION_KEY=
PRIVY_API_TIMEOUT_MS=5000
```

Regras:

- todas são obrigatórias para API e testes que instanciam o módulo real;
- `PRIVY_JWT_VERIFICATION_KEY` permite verificar tokens sem buscar a chave a cada processo;
- workers não carregam credenciais Privy nesta SPEC;
- valores nunca recebem default de produção;
- mensagens de validação citam nomes ausentes, não seus conteúdos.

Não adicionar `JWT_SECRET`: o Access não emite um JWT paralelo ao Privy.

## 11. Testes

### Unitários

- guard aceita token válido e popula o principal;
- guard rejeita header ausente, esquema incorreto, token inválido e token expirado;
- `@Public()` ignora autenticação;
- bootstrap cria `User` usando somente identidade retornada pelo Privy;
- bootstrap reutiliza `User` e wallet existentes;
- bootstrap encontra e persiste wallet Privy já existente;
- bootstrap cria wallet Stellar com owner e idempotency key corretos;
- resposta com chain ou owner divergente é rejeitada;
- email, tokens e secrets não aparecem nos erros.

### Integração

Usar PostgreSQL real e um fake explícito do boundary `PrivyGateway`:

- migration aplica em banco vazio;
- rota privada sem token retorna `401`;
- health permanece pública;
- primeiro bootstrap cria um usuário e uma wallet;
- bootstrap repetido retorna os mesmos IDs sem duplicar linhas;
- dois bootstraps concorrentes deixam exatamente um usuário e uma wallet;
- `GET /api/me` retorna `404` antes e `200` depois do bootstrap;
- unicidade de `privyUserId`, `email`, `userId`, `privyWalletId` e `stellarAddress` é garantida pelo
  banco.

O fake substitui somente a API externa. Prisma e PostgreSQL não são mockados.

### Smoke test manual

Com credenciais development e usuário de teste:

1. obter um access token por email/OTP;
2. chamar `POST /api/auth/bootstrap`;
3. confirmar no dashboard Privy uma wallet user-owned com chain Stellar;
4. repetir a chamada e confirmar que nenhuma segunda wallet foi criada;
5. chamar `GET /api/me` e conferir o mesmo endereço.

O smoke test real não roda no CI e não registra tokens ou credenciais.

## 12. Segurança

- app secret e verification key ficam somente no servidor;
- access token não é persistido;
- nenhum endpoint aceita `privyUserId`, email, wallet ID ou endereço para escolher a identidade;
- erros de autenticação não revelam se um usuário existe;
- o cliente não pode solicitar uma wallet para outro usuário;
- dados externos são validados antes da escrita;
- a API falha fechada se não conseguir provar owner e chain da wallet;
- logs e fixtures não contêm tokens reais.

## 13. Sequência de implementação

1. atualizar configuração e `.env.example`;
2. adicionar modelos e migration;
3. implementar o boundary Privy;
4. implementar guard, decorators e proteção global;
5. implementar bootstrap e `/api/me`;
6. adicionar testes unitários;
7. adicionar testes de integração e concorrência;
8. executar smoke test manual development;
9. revisar o diff para confirmar que itens da SPEC-003 não foram antecipados.

## 14. Validação obrigatória

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
```

Também demonstrar localmente:

```bash
curl --fail http://localhost:3001/api/health/live
curl --fail http://localhost:3001/api/health/ready
```

E executar o smoke test Privy descrito no §11 sem registrar credenciais.

## 15. Definição de pronto

- [ ] ADR-009 permanece refletido no schema e nos contratos.
- [ ] Access token Privy é verificado pelo SDK oficial.
- [ ] Rotas privadas falham com `401` sem autenticação.
- [ ] Health permanece pública.
- [ ] Bootstrap cria ou reutiliza `User` e wallet de forma idempotente.
- [ ] A wallet é Stellar, user-owned e pertence ao usuário autenticado.
- [ ] Concorrência não produz duplicatas.
- [ ] `GET /api/me` é somente leitura.
- [ ] Nenhum secret, token ou dado sensível aparece em banco, fixtures ou logs.
- [ ] Migration, build, lint, typecheck e testes passam.
- [ ] Smoke test development confirma a integração real.
- [ ] Nenhum modelo ou fluxo da SPEC-003 foi antecipado.

## 16. Decisões adiadas

- campos, estados e onboarding do `ProducerProfile`;
- customer, KYC/KYB e blockchain wallet da BlindPay;
- criação patrocinada da conta Stellar e trustline do produtor;
- momento de ativação on-chain da conta do comprador — Q-02;
- políticas e signers adicionais da wallet;
- implementação de RLS por `producer_id`;
- frontend de OTP e checkout;
- contas de equipe, staff separado e membership pós-MVP.
