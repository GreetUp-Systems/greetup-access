# MVP Revisado — Access

> **Escopo:** camada blockchain, trilho financeiro e camada de aplicação.
>
> **Data:** 20/08/2026 · **Status:** arquitetura fechada

---

## 1. O que é o MVP

**Produtor:** cadastra, faz KYC/KYB, cria eventos, vende ingressos, vê o saldo e saca para a conta
bancária.

**Comprador:** vê os ingressos, compra com Pix, recebe o ingresso na conta dele, entra no evento.

**Staff:** escaneia o QR Code e valida o ingresso online. A capacidade offline entra na fase 2 (D-19).

---

## 2. Arquitetura em uma frase

**Privy cria as carteiras, BlindPay move o dinheiro, e a Stellar guarda o ingresso.**

```
Comprador                                   Produtor
    │ paga o Pix (sem cadastro, sem KYC)        │ saca
    ▼                                           ▼
┌──────────────────────────────────────────────────────┐
│  BlindPay  ·  dinheiro                               │
│  cada produtor é um customer com KYC próprio         │
│  payin entrega USDC direto na wallet dele            │
└──────────────────────────────────────────────────────┘
    │ webhook payin.complete
    ▼
┌──────────────────────────────────────────────────────┐
│  Stellar  ·  ingresso                                │
│  wallet Privy · NFT (OpenZeppelin) · check-in        │
└──────────────────────────────────────────────────────┘
```

**O que destrava o MVP:** o ingresso não espera o dinheiro chegar. Basta a confirmação do Pix.

---

## 3. Decisões fechadas

### Camada Stellar

| # | Decisão | Por quê |
|---|---|---|
| **D-01** | Wallet via **Privy** | Gratuito até 500 MAU — suficiente para validar. Tem MCP, o que acelera o desenvolvimento. Recuperação, login social e sincronização entre dispositivos vêm prontos. |
| **D-02** | Gas patrocinado via **OpenZeppelin Relayer** | Fee bump nativo, sem Treasury própria nem gestão de sequence number. Substituiu o Launchtube (descontinuado). **Cobre também a criação da conta Stellar e a trustline de USDC**: a transação leva `beginSponsoringFutureReserves` → `createAccount` → `changeTrust` → `endSponsoringFutureReserves`, e o Relayer paga a taxa. A reserva mínima (~1 XLM por conta, ~0,5 por trustline) fica travada na conta patrocinadora do Access e volta se a conta for encerrada. Nem produtor nem comprador precisam de XLM. |
| **D-03** | Ingresso é **extensão do módulo NFT auditado da OpenZeppelin** | `max_supply`, `owner_of`, `get_owner_tokens`, `transfer`, `burn` já prontos. Só check-in, vínculo com evento e idempotência são código nosso. |
| **D-04** | Comprador **é dono do ingresso**. Transferência **única**, só para conta válida na plataforma, e ingresso transferido **não é reembolsável** | Cobre mercado secundário, lista de credenciamento e o golpe do "transfiro e peço estorno". Transferência errada não tem reversão no MVP. |
| **D-05** | Transferência exige **assinatura do comprador e da plataforma** (auth-entry signing) | Propriedade real com regra aplicável. Funciona com conta clássica `G…`, que é o formato do Privy. |
| **D-06** | Wallet do comprador criada **no checkout, antes do pagamento** | O endereço já existe quando o pagamento confirma. Sem janela de falha entre "pagou" e "tem ingresso". |
| **D-07** | **Recuperação de acesso é responsabilidade do Privy** — login social e email | Consequência de D-01. |

### Trilho financeiro

| # | Decisão | Por quê |
|---|---|---|
| **D-08** | **BlindPay** como provedor de pagamento | O comprador **não é identificado** — paga o Pix e pronto. Stellar suportado em payin e payout com USDC. Testnet gratuita. Tem MCP. Os US$ 399 são mínimo contra taxa gerada, não custo fixo. |
| **D-09** | **Cada produtor é um customer próprio dentro da instância do Access**, com KYC e blockchain wallet próprios | Não é escolha: é a regra anti-*nesting* da BlindPay. O Access não pode receber em nome de terceiros. |
| **D-10** | **Wallet externa (`bw_...`), não managed wallet** | Managed wallets da BlindPay não suportam Stellar — só EVM e Solana. A wallet Privy do produtor entra como blockchain wallet externa. |
| **D-11** | **CCTP e cross-chain ficam fora do MVP** | Entram depois da validação. |
| **D-12** | **Não há escrow nem retenção no MVP** | Consequência aceita de D-09: o payin entrega direto na wallet do produtor. Cancelamento de evento e reembolso ficam cobertos por relacionamento e contrato — viável porque os produtores do piloto são conhecidos pessoalmente. |
| **D-13** | **Taxa do Access via partner fee nativa da BlindPay** | `POST /partner-fees` cria a configuração (`pf_...`); a quote referencia `partner_fee_id`. Percentual em basis points (teto 10%) e/ou fixo, separados para payin e payout. Sem cálculo nem movimentação nossa. |

### Camada de aplicação

| # | Decisão | Por quê |
|---|---|---|
| **D-14** | **Outbox mantido.** Seis eventos de domínio: `organization.kyc_approved`, `payment.confirmed`, `ticket.issued`, `ticket.transferred`, `checkin.registered`, `event.cancelled` | Evento escrito na mesma transação do estado. É a melhor razão valor/complexidade do projeto: sem ele, dinheiro entra e o ingresso não é emitido. |
| **D-15** | **Três workers:** `OutboxRelay`, `MintTicketWorker`, `NotifyWorker` | Os outros seis do desenho original morreram junto com o que os justificava — sem escrow não há `EscrowMonitor`, sem release on-chain não há `PayoutRecovery`, sem CQRS não há `TicketRead` nem `FinanceDashboard`. DLQ vira alerta do BullMQ, não worker. |
| **D-16** | **Sem cache e sem CQRS.** Redis só para o BullMQ | Postgres com índice resolve 25 a 500 pessoas com folga. CQRS dobra os modelos por domínio num sistema financeiro, e invalidação errada vira saldo errado na tela. Pôr cache num query específico depois é reversível; CQRS não. **Mata o ADR-003.** |
| **D-17** | **Realtime só por SSE, numa tela** — o comprador esperando o ingresso depois de pagar | É o único momento em que alguém encara a tela esperando. SSE é mão única, HTTP puro, reconecta sozinho, sem handshake nem rooms. Dashboard do produtor usa polling. WebSocket só se pagaria com várias telas bidirecionais ao vivo. |
| **D-18** | **Observabilidade fora do escopo por enquanto** | Volta quando houver o que correlacionar. |
| **D-19** | **Fase 1: check-in online. Fase 2: capacidade offline** | Piloto de 25 a 50 pessoas com wifi funciona online. Service worker, IndexedDB, snapshot assinado, sincronização e resolução de conflito ficam para a fase 2. |

---

## 4. Fluxos

### 4.1 Onboarding do produtor

1. Produtor se cadastra no Access e cria a wallet Privy
2. Criar a conta Stellar e a trustline de USDC, patrocinadas pelo Access (D-02)
3. Criar o customer na BlindPay (`POST /v1/instances/{instance_id}/customers`) com `tos_id`, `type`,
   `kyc_type`, `email` e dados pessoais/endereço
4. Registrar a blockchain wallet dele (`bw_...`) apontando para o endereço Stellar
5. KYC aprovado → produtor liberado para criar eventos
6. Cadastrar a conta bancária de saque

### 4.2 Compra do ingresso

1. Comprador escolhe o ingresso e informa email
2. Wallet Privy criada no checkout
3. Criar payin quote apontando para o `blockchain_wallet_id` **do produtor** — a quote trava
   câmbio, taxas e destino por **5 minutos**
4. Criar o payin dentro dessa janela; devolve o `pix_code`
5. Comprador paga pelo app do banco — **sem cadastro, sem KYC, sem wallet**
6. Webhook `payin.complete` → valida assinatura → verifica idempotência
7. Ingresso mintado na wallet do comprador, com gas pelo Relayer

O passo 7 não depende do dinheiro ter chegado.

**Quem paga a taxa** é decidido por `cover_fees` na quote: `false` deduz da stablecoin que o
produtor recebe; `true` soma ao valor em Real que o comprador paga. Decisão de produto pendente.

### 4.3 Saque

O saldo já está na wallet do produtor. O saque é um payout da BlindPay: USDC da wallet dele → Pix
na conta bancária.

### 4.4 Credenciamento

**Fase 1 (MVP):** check-in online. O staff escaneia o QR Code, a API valida e registra o check-in.

**Fase 2 (após validação, D-19):** snapshot assinado baixado antes do evento, validação local por
HMAC no PWA, fila de sincronização local e registro on-chain do check-in em lote quando houver rede.

---

## 5. O que já se sabe da BlindPay

**Quem tem KYC:** o *customer* — quem **recebe** a stablecoin. O *sender* (quem paga o Pix) não é
entidade modelada na API. A prova está no campo `cover_fees`, que trata customer e sender como
partes distintas.

**Chains e tokens:** payin e payout suportam Stellar com **USDC** (USDT não existe na Stellar).
Managed wallets **não** suportam Stellar. Testnet: Stellar Testnet com **USDB**, a stablecoin de
teste deles. Não há endpoint que liste as chains — a tabela da doc é a fonte de verdade.

**Ambiente de desenvolvimento:** todo payin completa automaticamente ~30 segundos após a criação.
Dá para exercitar o fluxo inteiro sem custo.

**Payin quote expira em 5 minutos** e, uma vez criado, o payin **não pode ser cancelado** — se
ninguém pagar, fica `processing` até a BlindPay limpar.

**Regra anti-nesting:** *"você não pode usar sua conta, wallet ou conta virtual para processar,
facilitar ou movimentar pagamentos em nome de qualquer parte cuja identidade não seja visível para
a BlindPay."* Penalidade: atraso, congelamento, reversão ou encerramento da conta. A descrição de
**Nature of Business** no onboarding precisa ser detalhada e explícita sobre o modelo de
marketplace.

---

## 6. Dívidas conscientes

Duas, e as duas têm a mesma causa: sem retenção de valor, o Access não tem lastro para desfazer
nada. Funcionam no piloto porque os produtores são conhecidos pessoalmente. **Nenhuma das duas
escala**, e as duas precisam de solução antes da abertura ao mercado.

**Reembolso.** Se o comprador exerce o direito de arrependimento, o dinheiro já é do produtor e a
devolução depende dele. As regras concretas de reembolso ainda serão definidas com apoio jurídico,
incluindo a interação com D-04 (ingresso transferido não reembolsa).

**Cancelamento de evento.** Coberto por relacionamento e contrato, não por mecanismo financeiro.

## 7. Notas de implementação

Não são decisões nem pendências — são coisas que mordem se ninguém souber delas de antemão.

- **`Symbol` não comporta UUID.** As SPECs passam `purchase_id`, `ticket_id` e `event_id` como
  `Symbol`, mas são UUID no Prisma. `Symbol` aceita no máximo 32 caracteres e só `a-zA-Z0-9_`;
  UUID tem 36 com hífens. Não compila. Usar `BytesN<16>`.
- **Payin criado não pode ser cancelado.** Se o comprador não paga, fica `processing` até a
  BlindPay limpar. O registro de compra precisa de um estado para isso.
- **Quote expira em 5 minutos.** Definir o comportamento de reexpedição quando o comprador demora.
- **Receita chega no dia 1º do mês seguinte.** Partner fees acumulam pelo mês calendário, já
  líquidas da fatura da BlindPay. É fluxo de caixa, não produto.
- **Arquivamento de dado na Stellar.** Ingresso vendido muito antes do evento pode sair do
  armazenamento ativo. Não quebra — desde o Protocolo 23 a restauração é automática na invocação.
- **Privy enfraquece um pouco a narrativa de SCF.** Wallet Privy é conta Stellar, então o argumento
  se sustenta; mas Privy é provedor multichain, não primitivo da Stellar. Trade-off consciente em
  favor da velocidade.

---

## 8. Documentação superada

| Documento | Situação |
|---|---|
| `ADR-008` — contratos Soroban próprios sobre SEP-50 | **Morto.** A premissa ("não há implementação auditada") era falsa. |
| `SPEC-006` — contratos | Reescrever: `EscrowContract` sai, `TicketContract` vira extensão da OZ. |
| `SPEC-007` — mint worker | Reescrever: sai Treasury própria, sai criação de wallet do caminho crítico. |
| `SPEC-010` / `SPEC-011` — finanças e saque | Reescrever: não há escrow nem liberação; o saldo já é do produtor. |
| `ADR-003` — CQRS em Tickets e Finance | **Morto.** Ver D-16. |
| `SPEC-008` — ticket read (CQRS) | Reescrever sem read side; leitura direta do Postgres. |
| `SPEC-009` — credenciamento | Dividir: check-in online na fase 1, capacidade offline na fase 2. |
| `SPEC-012` — dashboard | Reduzir: polling em vez de WebSocket. |
| `SPEC-013` — pipeline | Reduzir: sem OpenTelemetry, Grafana nem deploy de contrato multi-sig. |
| `RN-005`, `RN-009` | Reescritas no `product-vision.md` v0.3. |

`ADR-001` (Stellar sobre EVM), `ADR-002` (Outbox), `ADR-004` (BlindPay), `ADR-005` (RLS) e
`ADR-006` (BullMQ) seguem válidos.

Os documentos superados foram movidos para [docs/_archive/](../_archive/README.md).

---

## 9. Questões de arquitetura em aberto

Precisam de decisão antes de implementar os blocos afetados. Até lá, nenhuma implementação deve
escolher uma resposta por conta própria.

| # | Questão | Blocos afetados |
|---|---|---|
| **Q-01** | **Chave de assinatura da plataforma.** D-05 exige assinatura da plataforma na transferência, e mint e check-in on-chain também precisam de uma autoridade no contrato. O Relayer paga a taxa, mas não substitui essa autoridade. Onde a chave vive, como é custodiada e rotacionada? | 5, 6, 8 |
| **Q-02** | **Conta Stellar do comprador.** Se o comprador assina a transferência (D-05), a conta `G…` dele precisa existir na rede, com reserva patrocinada de ~1 XLM (D-02). Num evento de 500 pessoas, isso trava ~500 XLM na conta patrocinadora. A conta é criada no mint, ou só quando o comprador for transferir? | 3, 6 |
| **Q-03** | **Onboarding do comprador no Privy.** O comprador paga "sem cadastro", mas a wallet Privy criada no checkout (D-06) depende de login por email/OTP para ele acessar o ingresso depois. Como fica essa etapa na UX? | 2, 6, 7 |
