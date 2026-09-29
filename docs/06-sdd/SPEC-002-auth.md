# SPEC-002 — Auth (Privy JWT + Guard + RLS + /auth/wallet)

**Objetivo:** Implementar autenticação via Privy JWT, guard global, TenantInterceptor com RLS, decorator @CurrentUser e endpoint /auth/wallet para registro de wallets Stellar.

**Pré-requisitos:** SPEC-001 concluída.

**Tempo estimado:** 1 dia

---

## 1. Estrutura de arquivos

```
apps/api/src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts          ← POST /auth/wallet
│   ├── auth.service.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts       ← guard global (verifica Privy JWT)
│   │   └── roles.guard.ts
│   ├── decorators/
│   │   ├── public.decorator.ts     ← @Public() — bypass do guard
│   │   ├── current-user.decorator.ts
│   │   └── roles.decorator.ts
│   ├── interceptors/
│   │   └── tenant.interceptor.ts   ← seta RLS context antes de toda query
│   ├── dto/
│   │   └── register-wallet.dto.ts
│   └── __tests__/
│       ├── auth.service.spec.ts
│       └── auth.integration.spec.ts
└── common/
    └── privy/
        ├── privy.module.ts
        └── privy.service.ts        ← verifyToken, getStellarWallets
```

---

## 2. Assinaturas de função

### PrivyService (apps/api/src/common/privy/privy.service.ts)

```typescript
import { PrivyClient } from "@privy-io/node";

export interface PrivyUserClaims {
  userId: string;
  sessionId: string;
  expiration: number;
}

export interface StellarWallet {
  address: string;
  chainType: "stellar";
  walletClientType: string;
}

@Injectable()
export class PrivyService {
  private client: PrivyClient;

  constructor(private config: ConfigService) {
    this.client = new PrivyClient(
      config.getOrThrow("PRIVY_APP_ID"),
      config.getOrThrow("PRIVY_APP_SECRET"),
    );
  }

  async verifyAccessToken(token: string): Promise<PrivyUserClaims>;
  async getStellarWalletAddresses(privyUserId: string): Promise<StellarWallet[]>;
  async getOrCreateStellarWallet(privyUserId: string): Promise<StellarWallet>;
}
```

### JwtAuthGuard (apps/api/src/auth/guards/jwt-auth.guard.ts)

```typescript
@Injectable()
export class JwtAuthGuard implements CanActivate {
  // 1. Verifica se rota tem @Public() → bypassa
  // 2. Extrai Bearer token do header Authorization
  // 3. Chama privyService.verifyAccessToken(token)
  // 4. Busca Organization pelo privyUserId (se existir)
  // 5. Seta request.user = { privyUserId, organizationId?, role }
  // 6. Lança UnauthorizedException se token inválido

  async canActivate(context: ExecutionContext): Promise<boolean>;
}
```

### TenantInterceptor (apps/api/src/auth/interceptors/tenant.interceptor.ts)

```typescript
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  // Executado antes de toda request autenticada
  // Lê organizationId do request.user
  // Se existir: SET LOCAL app.current_organization_id = $organizationId
  // Usa prisma.$executeRaw para setar a variável de sessão do Postgres

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>>;
}
```

### AuthService (apps/api/src/auth/auth.service.ts)

```typescript
@Injectable()
export class AuthService {
  // Registra ou atualiza wallet Stellar de um usuário (comprador ou produtor)
  // - Verifica se stellarAddress pertence ao privyUserId (segurança)
  // - Cria BuyerUser ou atualiza WalletAccount
  // - Retorna { userId, stellarAddress }

  async registerWallet(dto: RegisterWalletDto, privyUserId: string): Promise<RegisterWalletResponse>;

  // Busca ou cria Organization pelo privyUserId
  async getOrCreateOrganization(privyUserId: string): Promise<Organization | null>;
}
```

### RegisterWalletDto (apps/api/src/auth/dto/register-wallet.dto.ts)

```typescript
export class RegisterWalletDto {
  @IsString()
  @IsNotEmpty()
  stellarAddress: string; // deve começar com G e ter 56 chars

  @IsEnum(["buyer", "organization"])
  walletType: "buyer" | "organization";
}

export interface RegisterWalletResponse {
  userId: string;
  stellarAddress: string;
  walletType: string;
}
```

---

## 3. Endpoints

### POST /auth/wallet

```
Headers: Authorization: Bearer <privy_token>
Body: { stellarAddress: string, walletType: "buyer" | "organization" }

Response 201:
{
  userId: string,
  stellarAddress: string,
  walletType: string
}

Errors:
  401 — token inválido ou expirado
  400 — stellarAddress não pertence ao usuário do token
  409 — stellarAddress já registrado para outro usuário
```

---

## 4. app.module.ts — configuração global

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envValidationSchema }),
    PrismaModule,
    RedisModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },        // guard global
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor }, // RLS global
  ],
})
export class AppModule {}
```

---

## 5. Validação de variáveis de ambiente (startup)

```typescript
// apps/api/src/config/env.validation.ts
import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  PRIVY_APP_ID: Joi.string().required(),
  PRIVY_APP_SECRET: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
});
// Qualquer variável ausente → app não sobe
```

---

## 6. Testes esperados

### Unitários (auth.service.spec.ts)
- `registerWallet` cria BuyerUser quando não existe
- `registerWallet` atualiza WalletAccount quando já existe
- `registerWallet` lança ConflictException se stellarAddress pertence a outro usuário
- `JwtAuthGuard.canActivate` retorna true com token válido
- `JwtAuthGuard.canActivate` lança UnauthorizedException com token expirado
- `JwtAuthGuard.canActivate` bypassa com @Public()
- `TenantInterceptor` seta `app.current_organization_id` quando organizationId existe
- `TenantInterceptor` não executa $executeRaw quando organizationId é null (comprador sem org)

### Integração (auth.integration.spec.ts)
- `POST /auth/wallet` com token Privy válido retorna 201
- `POST /auth/wallet` sem token retorna 401
- `POST /auth/wallet` com token inválido retorna 401
- `POST /auth/wallet` com stellarAddress duplicado retorna 409
- `GET /health` (rota @Public) retorna 200 sem token

---

## 7. Variáveis de ambiente necessárias

```bash
PRIVY_APP_ID=
PRIVY_APP_SECRET=
JWT_SECRET=at-least-32-characters-long-secret
```

---

## 8. Definição de Pronto

- [ ] `POST /auth/wallet` com token Privy válido retorna 201
- [ ] Toda rota sem `@Public()` retorna 401 sem token
- [ ] `TenantInterceptor` seta RLS antes de toda query de tenant
- [ ] Variáveis ausentes fazem a app não subir com mensagem de erro clara
- [ ] Todos os testes unitários e de integração passam
