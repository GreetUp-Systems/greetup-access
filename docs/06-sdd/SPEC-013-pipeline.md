# SPEC-013 — Pipeline CI/CD (GitHub Actions + Railway + Cloudflare + KMS)

> ⚠️ **SPEC a reduzir** — sem OpenTelemetry, Grafana nem deploy de contrato multi-sig (D-18). Em qualquer conflito, vale o [MVP-REVISADO.md](./MVP-REVISADO.md). Não implemente a partir desta versão.

**Objetivo:** Configurar toda a infraestrutura de CI/CD, deploy blue-green no Railway, CDN e WAF via Cloudflare, key management com AWS KMS e observabilidade com OpenTelemetry.

**Pré-requisitos:** Nenhum em termos de código. Pode ser implementado em paralelo.

**Tempo estimado:** 1-2 dias

---

## 1. Arquivos de configuração

```
.github/
├── workflows/
│   ├── ci.yml                  ← já existe no repo
│   ├── cd.yml                  ← já existe no repo
│   └── contracts-deploy.yml    ← já existe no repo
├── CODEOWNERS                  ← define aprovadores obrigatórios

railway/
├── railway.json                ← configuração de serviços Railway

infra/
├── cloudflare/
│   └── waf-rules.json          ← regras de WAF customizadas
└── aws/
    ├── kms-policy.json         ← policy IAM para o KMS
    └── oidc-role.json          ← role para GitHub Actions OIDC
```

---

## 2. CODEOWNERS

```
# Arquivos que sempre requerem review do Tech Lead
* @GreetUp-Corp/tech-lead

# Contratos Soroban: exigem 2 reviews
/packages/contracts/ @GreetUp-Corp/tech-lead @GreetUp-Corp/security

# Workflows CI/CD: exigem aprovação do Tech Lead
/.github/workflows/ @GreetUp-Corp/tech-lead
```

---

## 3. Variáveis e Secrets do GitHub Actions

```yaml
# GitHub Actions Secrets (nunca em código):
secrets:
  # AWS OIDC (sem credenciais estáticas)
  AWS_ACCOUNT_ID: "123456789"
  AWS_ROLE_ARN: "arn:aws:iam::123456789:role/GitHubActionsRole"

  # Railway tokens por ambiente
  RAILWAY_TOKEN_DEV: ""
  RAILWAY_TOKEN_STG: ""
  RAILWAY_TOKEN_PROD: ""

  # Contratos Soroban
  DEPLOY_KEYPAIR_TESTNET: ""    # keypair em texto plano apenas para testnet
  DEPLOY_KEYPAIR_MAINNET: ""    # keypair em KMS — nunca em texto plano

  # Snyk
  SNYK_TOKEN: ""

  # Doppler
  DOPPLER_TOKEN_DEV: ""
  DOPPLER_TOKEN_PROD: ""
```

---

## 4. Dockerfiles — multi-stage

### apps/api/Dockerfile
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/
RUN corepack enable pnpm && pnpm install --frozen-lockfile
COPY apps/api/ ./apps/api/
RUN pnpm --filter api run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/packages/database/prisma ./prisma
RUN corepack enable pnpm && pnpm install --prod --frozen-lockfile
RUN pnpm prisma generate
USER nestjs
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

### apps/workers/Dockerfile (mesmo padrão, sem EXPOSE)
```dockerfile
# ... mesmo padrão do api
CMD ["node", "dist/main.js"]
# Workers não servem HTTP
```

---

## 5. OpenTelemetry — configuração

```typescript
// apps/api/src/telemetry/telemetry.ts
// DEVE ser importado ANTES de qualquer outro módulo (main.ts)

import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { NestInstrumentation } from "@opentelemetry/instrumentation-nestjs-core";

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME ?? "access-api",
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  instrumentations: [
    new HttpInstrumentation(),
    new NestInstrumentation(),
    new PrismaInstrumentation(),
  ],
});

sdk.start();
process.on("SIGTERM", () => sdk.shutdown());
```

---

## 6. KMS Policy (AWS IAM)

```json
// infra/aws/kms-policy.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSign",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT:role/access-api-role"
      },
      "Action": ["kms:Sign", "kms:GetPublicKey"],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:SigningAlgorithm": "ECDSA_SHA_256"
        }
      }
    }
  ]
}
```

---

## 7. SensitiveFieldsInterceptor — filtro de logs

```typescript
// apps/api/src/common/interceptors/sensitive-fields.interceptor.ts

@Injectable()
export class SensitiveFieldsInterceptor implements NestInterceptor {
  private readonly SENSITIVE_FIELDS = new Set([
    "secret", "privatekey", "mnemonic", "seed", "password",
    "taxid", "cpf", "pixkey", "bankaccount", "signature",
    "kmskeyid", "authorization", "cookie", "blindpay_webhook_secret",
  ]);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    this.redact(request.body);
    return next.handle();
  }

  private redact(obj: unknown): void {
    if (!obj || typeof obj !== "object") return;
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      if (this.SENSITIVE_FIELDS.has(key.toLowerCase())) {
        (obj as Record<string, unknown>)[key] = "[REDACTED]";
      } else {
        this.redact((obj as Record<string, unknown>)[key]);
      }
    }
  }
}
```

---

## 8. Configuração Railway (railway.json)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE"
  },
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3,
    "startCommand": "node dist/main.js"
  }
}
```

---

## 9. Variáveis de ambiente de produção (Doppler)

```bash
# Injetadas via Railway Variables linked ao Doppler
# Nunca em texto plano no repositório ou no Railway dashboard

# Listagem de variáveis (valores gerenciados no Doppler):
NODE_ENV=production
DATABASE_URL=           # Railway Postgres (connection string)
DATABASE_URL_DIRECT=    # Railway Postgres (direct URL)
REDIS_URL=              # Railway Redis
PRIVY_APP_ID=
PRIVY_APP_SECRET=
BLINDPAY_API_KEY=
BLINDPAY_INSTANCE_ID=
BLINDPAY_BASE_URL=https://api.blindpay.com
BLINDPAY_WEBHOOK_SECRET=
STELLAR_NETWORK=mainnet
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
STELLAR_USDC_ASSET_CODE=USDC
STELLAR_USDC_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
TREASURY_STELLAR_ADDRESS=G...
KMS_KEY_ID=arn:aws:kms:...
SOROBAN_TICKET_CONTRACT_ADDRESS=C...
SOROBAN_ESCROW_CONTRACT_ADDRESS=C...
MULTISIG_SIGNER_A_ADDRESS=G...
MULTISIG_SIGNER_B_ADDRESS=G...
MULTISIG_THRESHOLD=2
JWT_SECRET=
OTEL_EXPORTER_OTLP_ENDPOINT=
SENTRY_DSN=
```

---

## 10. Testes de pipeline

```bash
# Validar que o Dockerfile builda corretamente
docker build -f apps/api/Dockerfile -t access-api:test .
docker run --rm access-api:test node -e "console.log('build ok')"

# Validar que o health check funciona no container
docker run --env-file .env.test -p 3001:3001 access-api:test &
curl --retry 5 --retry-delay 2 http://localhost:3001/health
```

---

## 11. Definição de Pronto

- [ ] `docker build` executa sem erro para api e workers
- [ ] GitHub Actions CI passa em todas as branches
- [ ] Deploy no Railway funciona via `git push` para develop
- [ ] Health check responde corretamente no container de produção
- [ ] Nenhuma variável de ambiente em texto plano no repositório
- [ ] OpenTelemetry instrumentado e enviando traces
- [ ] SensitiveFieldsInterceptor filtrando campos sensíveis dos logs
- [ ] CODEOWNERS configurado corretamente
