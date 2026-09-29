# Visão do Produto — GreetUp Access

**Versão:** 0.3  
**Data:** 20/08/2026  
**Responsável:** Matheus Aguiar  
**Empresa:** GreetUp  
**Status:** Em revisão

> Arquitetura vigente: [`docs/06-sdd/MVP-REVISADO.md`](../06-sdd/MVP-REVISADO.md)

---

## 1. Resumo Executivo

O **GreetUp Access** é uma plataforma de infraestrutura premium para venda de ingressos, gestão de acessos, credenciamento e repasse financeiro para eventos corporativos B2B.

A solução resolve a ausência de uma infraestrutura programável e confiável para eventos corporativos, permitindo que organizadores vendam ingressos, controlem acessos, acompanhem faturamento e repassem valores com regras programáveis — de forma segura, transparente e elegante.

**Para o comprador:** paga com Pix e recebe um ingresso digital. Nenhuma interação com blockchain, stablecoin ou wallet.  
**Para o produtor:** cria eventos, acompanha saldo e solicita retirada de valores.  
**Para o staff:** escaneia QR Code e valida ingressos no dia do evento, com modo offline a partir da fase 2.

A complexidade de blockchain e stablecoins acontece nos bastidores. A experiência final é Web2.

---

## 2. O Problema

Organizadores de eventos corporativos enfrentam problemas recorrentes com as plataformas atuais:

- Taxas altas sem transparência sobre o split financeiro
- Sistemas genéricos não pensados para hospitalidade corporativa
- Pouca flexibilidade para regras de ingresso, reembolso, transferência e acesso
- Falhas no credenciamento no dia do evento, especialmente com internet instável
- Baixa rastreabilidade sobre emissão, uso, cancelamento e transferência de ingressos
- Falta de regras claras para cancelamento, reembolso e retirada de valores
- Dependência de plataformas não projetadas para o relacionamento B2B

Em eventos corporativos, o ingresso não é apenas uma entrada. Ele representa relacionamento, convite, compromisso financeiro, direito do consumidor e receita para o organizador.

---

## 3. A Solução

**Frase de produto:** Venda, controle e credencie acessos com confiança programável.  
**Frase técnica:** Pix in, ticket on-chain, check-in verifiable, payout controlled.

**O GreetUp Access combina:**
- Venda de ingressos com pagamento via Pix
- Emissão de ingressos tokenizados na Stellar
- Credenciamento via QR Code, com funcionamento offline a partir da fase 2
- Repasse ao produtor no momento do pagamento, com off-ramp via Pix
- Dashboard financeiro completo em BRL

---

## 4. Perfis de Usuário

### 4.1 Comprador de Ingresso
Pessoa física que compra ou recebe um ingresso para um evento corporativo.

**Jornada:** acessa página do evento → escolhe ingresso → paga com Pix → recebe QR Code → apresenta no evento → check-in realizado.

**Requisito crítico:** nunca ver termos de blockchain, stablecoin, wallet ou crypto em nenhum ponto do fluxo.

### 4.2 Produtor de Evento
Empresa ou pessoa responsável pelo evento e pelo faturamento das vendas.

**Jornada:** cria conta → passa por KYB → cria evento → configura ingressos e regras → acompanha vendas → visualiza saldo → solicita retirada → recebe Pix na conta bancária.

**Requisito crítico:** todos os valores exibidos em BRL. Sem interação com stablecoin ou endereço de wallet.

### 4.3 Staff de Credenciamento
Membro da equipe operacional do evento responsável pela entrada dos participantes.

**Jornada:** faz login no PWA → seleciona evento → sincroniza lista → escaneia QR Codes → valida ingressos → sincroniza check-ins quando online.

**Requisito crítico:** resposta visual em menos de 2 segundos. Funcionamento offline a partir da fase 2.

---

## 5. Escopo do MVP

### Dentro do MVP
- Cadastro e KYB do produtor via BlindPay
- Criação de wallet Privy para compradores e produtores (invisível)
- Criação de eventos, tipos de ingresso, preços e regras
- Venda via Pix com on-ramp USDC via BlindPay (payin)
- Emissão de ingresso tokenizado na Stellar para a wallet do comprador
- Transferência de ingresso, uma única vez, entre contas da plataforma
- Dashboard do organizador: vendas, participantes, faturamento
- Área do comprador: ingresso digital, QR Code, status
- Credenciamento online (a capacidade offline entra na fase 2)
- Solicitação de retirada com off-ramp via BlindPay (payout)
- Políticas de reembolso e cancelamento configuráveis

### Fora do MVP
- Marketplace público de eventos
- App mobile nativo (iOS/Android)
- Gamificação e programa de fidelidade
- CRM avançado de convidados
- Split multi-beneficiário complexo
- Escrow totalmente gerenciado on-chain pelo comprador
- Conciliação contábil e emissão de notas fiscais
- White-label para produtoras
- Migração para Polygon/EVM (item de roadmap futuro)

---

## 6. Stack Técnica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Blockchain | Stellar (Soroban) | Custo ~$0.00001/tx, USDC nativo, relacionamento com SDF para grants |
| Smart contracts | Rust + OpenZeppelin Stellar Contracts | Base NFT auditada; código próprio só para check-in e vínculo com evento |
| Gas | OpenZeppelin Relayer | Fee bump nativo, sem Treasury própria nem gestão de sequence number |
| Wallet abstraction | Privy (web SDK) | Embedded wallets Stellar, login por email/passkey, policy signer |
| On-ramp Pix→USDC | BlindPay (payin) | Suporte nativo a Pix + Stellar, YC-backed, LatAm-first |
| Off-ramp USDC→Pix | BlindPay (payout) | KYB do produtor integrado, receiver com chave Pix |
| Frontend | Next.js 15 (App Router) | Web responsivo, PWA para credenciamento, único codebase |
| Backend | NestJS + TypeScript | Modular, testável, guards/interceptors nativos |
| ORM | Prisma | Schema centralizado no monorepo |
| Banco de dados | PostgreSQL 16 com RLS | Row-Level Security para isolamento de tenants |
| Filas | BullMQ + Redis | Mensageria, retry, DLQ, cron jobs |
| Monorepo | Turborepo | Cache incremental, pipelines paralelas |
| Deploy | Railway (Pro) | Blue-green, health checks, graceful shutdown |
| Edge/CDN | Cloudflare (Pro) | WAF, DDoS, rate limiting, sem cobrança por bandwidth |
| Secrets | Doppler | Rotação, auditoria, sem credenciais em variáveis |
| Erros | Sentry | Observabilidade completa entra quando houver o que correlacionar |
| CI/CD | GitHub Actions + OIDC | Sem credenciais estáticas, 5 stages de qualidade |

---

## 7. Arquitetura de Alto Nível

```
Comprador (browser/mobile)
  └── Next.js PWA
        └── NestJS API (+ SSE na tela de espera)
              ├── PostgreSQL (RLS por tenant)
              ├── Redis (BullMQ)
              ├── Privy SDK (wallets)
              ├── BlindPay API (payin/payout)
              ├── OpenZeppelin Relayer (gas)
              └── TicketContract na Stellar

Produtor (browser desktop)
  └── Next.js Dashboard
        └── (mesma API)

Staff (browser mobile)
  └── Next.js PWA (Service Worker + IndexedDB)
        └── (mesma API, modo offline)
```

---

## 8. Padrões Arquiteturais Adotados

### 8.1 Event-Driven com Outbox Pattern
Eventos de domínio escritos na **mesma transação** do banco de dados. Um relay separado publica no BullMQ. Nenhum evento perdido em caso de falha de rede ou reinício do processo.

### 8.2 Leitura direta do Postgres
Sem cache e sem CQRS. Redis serve exclusivamente ao BullMQ. Cache entra depois, em queries específicas, se e quando o volume justificar.

### 8.3 Multi-tenancy com Row-Level Security
Cada request carrega `organizationId` no JWT. Interceptor seta `app.current_organization_id` na sessão do Postgres antes de cada query. RLS filtra automaticamente — nenhum leak de dados entre tenants possível.

### 8.4 Contrato de ingresso sobre base auditada
O contrato estende o módulo Non-Fungible Token da OpenZeppelin Stellar Contracts. Código próprio fica restrito a check-in, vínculo com evento e idempotência por `purchase_id`.

### 8.5 Gas patrocinado
Transações on-chain são patrocinadas via OpenZeppelin Relayer, usando fee bump nativo da Stellar. Reserva mínima de conta e trustline vem de uma conta patrocinadora da GreetUp. Nem produtor nem comprador precisam de XLM.

### 8.6 Realtime pontual
Server-Sent Events em uma única tela — o comprador aguardando a emissão do ingresso após pagar. O restante da interface usa polling.

### 8.7 Rate Limiting em duas camadas
1. **Cloudflare:** por IP, antes de tocar a aplicação
2. **NestJS Guard:** por rota e por usuário, sliding window no Redis

---

## 9. Fluxo Principal — Compra de Ingresso

```
Comprador acessa página do evento
  └── Escolhe ingresso + informa email
        └── Wallet Privy criada no checkout
              └── Backend cria payin quote apontando para a wallet do produtor
                    └── BlindPay retorna código Pix (quote expira em 5 min)
                          └── Comprador paga Pix — sem cadastro, sem KYC
                                └── BlindPay entrega USDC na wallet do produtor
                                      └── Webhook payin.complete → valida HMAC + idempotência
                                            └── Outbox: payment.confirmed
                                                  └── MintTicketWorker: mint na wallet do comprador
                                                        └── Gas patrocinado pelo Relayer
                                                              └── SSE atualiza a tela do comprador
```

---

## 10. Fluxo Financeiro — Repasse e Payout

```
Pagamento confirmado
  └── BlindPay entrega USDC direto na wallet Stellar do produtor
        └── Taxa da GreetUp coletada como partner fee na própria transação
              └── Produtor vê o saldo no painel
                    └── Produtor solicita retirada
                          └── BlindPay payout: USDC → Pix na conta bancária dele
                                └── Webhook confirma a conclusão

Taxas da GreetUp acumulam no mês e são liberadas no dia 1º do mês seguinte,
já líquidas da fatura da BlindPay.
```

---

## 11. Regras de Negócio Críticas

| Código | Regra |
|---|---|
| RN-001 | Cada ingresso tem ID único e pertence a uma única wallet |
| RN-002 | Ingresso só pode ser usado para check-in uma vez; após isso não pode ser transferido |
| RN-003 | Contrato não permite emissão acima da capacidade máxima do evento |
| RN-004 | Ingressos com status `cancelled`, `refunded`, `expired` ou `invalidated` não fazem check-in |
| RN-005 | O pagamento é entregue direto na wallet do produtor quando o Pix é confirmado — não há retenção de saldo |
| RN-006 | Ingresso pode ser transferido uma única vez, e apenas para uma conta válida na plataforma |
| RN-007 | Ingresso transferido não é reembolsável |
| RN-008 | Reembolso segue a política configurada pelo produtor no evento e depende de ele devolver o valor, que já é dele |
| RN-009 | A GreetUp nunca recebe recurso de terceiro. Cada produtor é customer próprio na BlindPay, com KYC e wallet próprios |
| RN-010 | Dados pessoais nunca armazenados on-chain — apenas hashes e identificadores |
| RN-011 | O comprador não é identificado pelo provedor de pagamento. Ele apenas paga o código Pix. KYC existe só para o produtor |
| RN-012 | Gas patrocinado pela GreetUp via OpenZeppelin Relayer; a reserva mínima de conta e trustline vem de uma conta patrocinadora própria |
| RN-013 | Taxa da GreetUp cobrada via partner fee nativa da BlindPay, aplicada automaticamente por transação |
| RN-014 | Cancelamento de evento é tratado por contrato e relacionamento, não por mecanismo financeiro |

---

## 12. Estados das Entidades

### Ingresso (`TicketStatus`)
```
reserved → paid → issued → checked_in
                         ↘ cancelled
                         ↘ refunded
                         ↘ expired
                         ↘ invalidated
```

### Compra (`PurchaseStatus`)
```
initiated → awaiting_payment → payment_confirmed → ticket_issued
                             ↘ payment_failed
                             ↘ payment_expired
                             ↘ payment_refunded
```

### Saldo do Produtor
Não há máquina de estados de saldo. O valor é entregue direto na wallet do produtor no momento em
que o pagamento é confirmado, e a retirada é um payout da BlindPay.

---

## 13. Validação — Eventos Piloto

O MVP será validado com 2 a 3 eventos reais antes do go-to-market amplo.

| Evento | Tamanho | Objetivo |
|---|---|---|
| Piloto 1 | 25–50 pessoas | Validar fluxo completo ponta a ponta |
| Piloto 2 | 100–250 pessoas | Validar credenciamento offline, stress de QR Code |
| Piloto 3 | 500 pessoas | Validar escala, concorrência de mints, payout |
| Go-to-market | 500+ | Abertura para novos produtores |

---

## 14. Custos de Infraestrutura — MVP

| Serviço | Custo/mês | Observação |
|---|---|---|
| BlindPay | US$ 399 como **mínimo**, não fixo | A fatura é abatida das partner fees coletadas. Se as taxas cobrirem, não há desembolso |
| Privy | US$ 0 | Grátis até 500 MAU — suficiente para validar o MVP |
| OpenZeppelin Relayer | US$ 0 | Instância hospedada em testnet; self-host via Docker em produção |
| Railway Pro | US$ 20 + compute | ~US$ 83 total no MVP |
| Cloudflare Pro | US$ 25 | WAF + DDoS + CDN |
| Sentry, Uptime | US$ 0 | Free tiers suficientes no MVP |
| GitHub Actions | US$ 0 | Free tier suficiente |

**Reserva em XLM:** alguns centavos por produtor, travados na conta patrocinadora para conta e
trustline. Recuperáveis se a conta for encerrada.

**Ciclo de recebimento:** as partner fees acumulam pelo mês calendário e são liberadas no dia 1º do
mês seguinte, já líquidas da fatura da BlindPay.

---

## 15. Roadmap

| Fase | Descrição | Prazo |
|---|---|---|
| Fase 1 — Fundação | Docs, setup monorepo, ambientes, sandboxes | Semana 1 |
| Fase 2 — MVP Core | Cadastro produtor, compra Pix, mint do ingresso, credenciamento online | Semanas 2–3 |
| Fase 3 — Financeiro | Saldo, payout, dashboard financeiro | Semana 4 |
| Fase 4 — Piloto | 2–3 eventos reais, ajustes, métricas | Após MVP |
| Fase 5 — Go-to-market | Abertura para novos produtores, suporte operacional | A definir |
| Fase 6 — Evolução | Novas features por feedback | Contínuo |
| Roadmap futuro | Migração Stellar → grant SDF (US$ 5K–150K condicional) | Condicional |

---

## 16. Questões em Aberto

| Questão | Responsável | Prazo |
|---|---|---|
| Fee exato do BlindPay por transação Pix | BlindPay / Matheus | Antes da Fase 2 |
| Taxa GreetUp por ingresso (define modelo de negócio) | Matheus | Antes da Fase 2 |
| Quem absorve a taxa — `cover_fees` na quote | Matheus | Antes da Fase 2 |
| Regras e prazos de reembolso, com apoio jurídico | Jurídico / Matheus | Antes da Fase 4 |
| Auditoria externa da extensão do contrato | Matheus | Antes da Fase 5 |
| Licença SPSAV necessária ou BlindPay cobre compliance? | Jurídico / Matheus | Antes do go-live |
| Como cobrir cancelamento e reembolso ao abrir para o mercado | Matheus | Antes da Fase 5 |
| Preços dos ingressos nos eventos piloto | Matheus | Antes da Fase 4 |
