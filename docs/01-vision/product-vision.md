# Visão do Produto — Access

**Versão:** 0.5

**Data:** 29/09/2026

**Responsável:** Matheus Aguiar

**Empresa:** Access

**Status:** Em revisão

> Arquitetura vigente: [`docs/06-sdd/MVP-REVISADO.md`](../06-sdd/MVP-REVISADO.md)

---

## 1. Resumo Executivo

O **Access** é uma solução para vender ingressos, controlar a entrada e receber pelas vendas, para eventos de qualquer tipo e tamanho.

A proposta é ser tão simples que não precise de explicação. Comprar um ingresso, criar um evento ou validar uma entrada tem que ser tão natural quanto usar qualquer bom app do celular. A qualidade está no cuidado com cada detalhe, não em parecer sofisticado.

**Para o comprador:** paga com Pix e recebe o ingresso. O ingresso fica registrado na Stellar e é dele de verdade, mas ele nunca precisa saber disso: nada de carteira para configurar, termos técnicos ou cripto.  
**Para o produtor:** cria eventos, acompanha saldo e solicita retirada de valores.  
**Para o credenciamento:** no MVP, o próprio produtor usa a área autenticada para escanear QR Code e validar ingressos. Contas separadas de staff ficam para uma evolução posterior.

Toda a camada web3 fica abstraída. Para quem usa, o Access funciona como qualquer app comum.

---

## 2. O Problema

Vender ingresso e controlar a entrada de um evento ainda é mais difícil do que deveria:

- Taxas altas e pouca clareza sobre quanto fica com quem
- Ferramentas complexas, pensadas para grandes vendedores, não para quem organiza o próprio evento
- Pouca flexibilidade para regras de ingresso, reembolso e transferência
- Fila e falha na entrada, especialmente com internet instável
- Pouca rastreabilidade sobre emissão, uso e transferência de ingressos
- Falta de regras claras para cancelamento, reembolso e retirada de valores

Para quem organiza, o ingresso é receita e compromisso com o público. Para quem compra, é a garantia de que vai entrar. As duas coisas precisam funcionar sem esforço.

---

## 3. A Solução

**Frase de produto:** Vender ingresso, liberar a entrada e receber. Simples assim.  
**Frase técnica:** pagamento por Pix, ingresso na Stellar, check-in verificável, saque por Pix.

**O Access combina:**
- Venda de ingressos com pagamento via Pix
- Emissão de ingressos tokenizados na Stellar
- Credenciamento via QR Code, com funcionamento offline a partir da fase 2
- Repasse ao produtor no momento do pagamento, com off-ramp via Pix
- Dashboard financeiro completo em BRL

---

## 4. Perfis de Usuário

### 4.1 Comprador de Ingresso
Pessoa física que compra ou recebe um ingresso para um evento.

**Jornada:** acessa página do evento → escolhe ingresso → paga com Pix → recebe QR Code → apresenta no evento → check-in realizado.

**Requisito crítico:** nunca ver termos de blockchain, stablecoin, wallet ou crypto em nenhum ponto do fluxo.

### 4.2 Produtor de Evento
Empresa ou pessoa responsável pelo evento e pelo faturamento das vendas.

**Jornada:** cria conta → passa por KYB → cria evento → configura ingressos e regras → acompanha vendas → visualiza saldo → solicita retirada → recebe Pix na conta bancária.

**Requisito crítico:** todos os valores exibidos em BRL. Sem interação com stablecoin ou endereço de wallet.

### 4.3 Credenciamento no MVP
O próprio produtor autenticado opera o credenciamento. Não há conta separada de staff, convite de equipe ou compartilhamento de tenant nesta fase.

**Jornada:** acessa o PWA com sua conta → seleciona evento → escaneia QR Codes → valida ingressos.

**Requisito crítico:** resposta visual em menos de 2 segundos. Funcionamento offline e contas separadas de operação ficam para fases posteriores.

---

## 5. Escopo do MVP

### Dentro do MVP
- Cadastro e KYB do produtor via BlindPay
- Uma conta e wallet Stellar próprias por pessoa; se o mesmo usuário comprar e produzir, reutiliza ambas
- Criação de wallet Privy para compradores e produtores (invisível)
- Login por email/OTP, sem senha e sem guest account
- Criação de eventos, tipos de ingresso, preços e regras
- Venda via Pix com on-ramp USDC via BlindPay (payin)
- Emissão de ingresso tokenizado na Stellar para a wallet do comprador
- Transferência de ingresso, uma única vez, entre contas da plataforma
- Dashboard do organizador: vendas, participantes, faturamento
- Área do comprador: ingresso digital, QR Code, status
- Credenciamento online pela conta do produtor
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
- Equipes, convites, múltiplos administradores e contas separadas de staff
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
| Banco de dados | PostgreSQL 16 com RLS | Row-Level Security para isolamento por produtor |
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
              ├── PostgreSQL (RLS por produtor)
              ├── Redis (BullMQ)
              ├── Privy SDK (wallets)
              ├── BlindPay API (payin/payout)
              ├── OpenZeppelin Relayer (gas)
              └── TicketContract na Stellar

Produtor (browser desktop)
  └── Next.js Dashboard
        └── (mesma API)

Produtor no credenciamento (browser mobile)
  └── Next.js PWA (Service Worker + IndexedDB)
        └── (mesma API, modo offline)
```

---

## 8. Padrões Arquiteturais Adotados

### 8.1 Event-Driven com Outbox Pattern
Eventos de domínio escritos na **mesma transação** do banco de dados. Um relay separado publica no BullMQ. Nenhum evento perdido em caso de falha de rede ou reinício do processo.

### 8.2 Leitura direta do Postgres
Sem cache e sem CQRS. Redis serve exclusivamente ao BullMQ. Cache entra depois, em queries específicas, se e quando o volume justificar.

### 8.3 Isolamento por produtor com Row-Level Security
O backend resolve `producerId` a partir do `User` autenticado. O contexto é configurado dentro da mesma transação e conexão Prisma das queries protegidas; não vem diretamente do JWT ou de um ID aceito do cliente. As policies filtram leitura e escrita por `producer_id`.

### 8.4 Contrato de ingresso sobre base auditada
O contrato estende o módulo Non-Fungible Token da OpenZeppelin Stellar Contracts. Código próprio fica restrito a check-in, vínculo com evento e idempotência por `purchase_id`.

### 8.5 Gas patrocinado
Transações on-chain são patrocinadas via OpenZeppelin Relayer, usando fee bump nativo da Stellar. Reserva mínima de conta e trustline vem de uma conta patrocinadora do Access. Nem produtor nem comprador precisam de XLM.

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
        └── Confirma email por OTP — sem senha ou KYC
              └── User e wallet Privy Stellar são criados ou reutilizados
                    └── Backend cria payin quote apontando para a wallet do produtor
                          └── BlindPay retorna código Pix (quote expira em 5 min)
                          └── Comprador paga Pix — sem KYC na BlindPay
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
        └── Taxa do Access coletada como partner fee na própria transação
              └── Produtor vê o saldo no painel
                    └── Produtor solicita retirada
                          └── BlindPay payout: USDC → Pix na conta bancária dele
                                └── Webhook confirma a conclusão

Taxas do Access acumulam no mês e são liberadas no dia 1º do mês seguinte,
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
| RN-009 | O Access nunca recebe recurso de terceiro. Cada produtor é customer próprio na BlindPay, com KYC e wallet próprios |
| RN-010 | Dados pessoais nunca armazenados on-chain — apenas hashes e identificadores |
| RN-011 | O comprador não é identificado pelo provedor de pagamento. Ele apenas paga o código Pix. KYC existe só para o produtor |
| RN-012 | Gas patrocinado pelo Access via OpenZeppelin Relayer; a reserva mínima de conta e trustline vem de uma conta patrocinadora própria |
| RN-013 | Taxa do Access cobrada via partner fee nativa da BlindPay, aplicada automaticamente por transação |
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
| Taxa do Access por ingresso (define modelo de negócio) | Matheus | Antes da Fase 2 |
| Quem absorve a taxa — `cover_fees` na quote | Matheus | Antes da Fase 2 |
| Regras e prazos de reembolso, com apoio jurídico | Jurídico / Matheus | Antes da Fase 4 |
| Auditoria externa da extensão do contrato | Matheus | Antes da Fase 5 |
| Licença SPSAV necessária ou BlindPay cobre compliance? | Jurídico / Matheus | Antes do go-live |
| Como cobrir cancelamento e reembolso ao abrir para o mercado | Matheus | Antes da Fase 5 |
| Preços dos ingressos nos eventos piloto | Matheus | Antes da Fase 4 |
