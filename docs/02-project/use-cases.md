# Casos de Uso — Access

> ⚠️ **Documento anterior à revisão de arquitetura de 20/08/2026.** Parte do conteúdo está
> superada (escrow, Treasury própria, KMS, CQRS, WebSocket). Em qualquer conflito, vale o
> [`MVP-REVISADO.md`](../06-sdd/MVP-REVISADO.md). Será revisado junto com as SPECs de cada bloco.

---

## UC-001 — Compra de Ingresso via Pix

**Ator principal:** Comprador  
**Atores secundários:** BlindPay, Privy, Soroban TicketContract  
**Pré-condições:** evento publicado com ingressos disponíveis e capacidade não esgotada  
**Resultado esperado:** ingresso tokenizado emitido na wallet do comprador, QR Code disponível

**Fluxo principal:**
1. Comprador acessa a página pública do evento
2. Seleciona tipo e quantidade de ingresso
3. Informa email
4. Backend cria `Purchase` com status `initiated` e lock Redis por idempotência
5. Backend cria payin quote no BlindPay com wallet do smart contract como destino
6. BlindPay retorna QR Code Pix com expiração de 5 minutos
7. Sistema exibe QR Code com contador de tempo
8. Comprador paga Pix no app do banco
9. BlindPay confirma e envia USDC para wallet do EscrowContract
10. BlindPay dispara webhook `payin.completed`
11. Backend valida HMAC-SHA256 e verifica idempotência por `blindpayPayinId`
12. `Purchase` → `payment_confirmed`; evento publicado no Outbox
13. `MintTicketJob` enfileirado no BullMQ
14. Worker cria/associa wallet Privy do comprador (invisível)
15. Worker chama `TicketContract.mint()` com fee-bump via Treasury
16. Soroban emite ticket com `status: issued`
17. `Purchase` → `ticket_issued`
18. Saldo do produtor registrado como `pending_settlement`
19. Comprador recebe email de confirmação com link para o ingresso
20. Comprador visualiza ingresso e QR Code de entrada

**Fluxos alternativos:**
- Pix expira antes do pagamento → `Purchase` → `payment_expired`, comprador pode gerar novo QR
- Pagamento recusado → `Purchase` → `payment_failed`, notificação ao comprador
- Mint falha por indisponibilidade Stellar → BullMQ retenta com backoff exponencial (até 5x); se exceder, vai para DLQ com alerta

**Invariantes:**
- Webhook duplicado → idempotência bloqueia reprocessamento
- Capacidade do evento não excede limite do contrato
- Dados pessoais do comprador nunca armazenados on-chain

---

## UC-002 — Credenciamento no Evento

**Ator principal:** Staff de Credenciamento  
**Atores secundários:** Soroban TicketContract, Backend  
**Pré-condições:** evento ativo, lista de tickets sincronizada no PWA  
**Resultado esperado:** check-in registrado, ticket com `status: checked_in`

**Fluxo principal:**
1. Antes do evento: PWA baixa snapshot assinado de todos os tickets válidos do evento
2. Snapshot salvo no IndexedDB via Service Worker
3. Staff escaneia QR Code do participante
4. PWA valida assinatura HMAC do payload do QR Code localmente
5. PWA verifica status do ticket no IndexedDB
6. Se válido: exibe tela verde "VÁLIDO" por 2 segundos
7. Check-in salvo na fila local de sincronização (IndexedDB)
8. Quando online: Background Sync API dispara sincronização
9. `CheckinSyncWorker` processa fila: persiste no Postgres + registra on-chain via `TicketContract.check_in()`
10. Dashboard do organizador atualiza contagem de presença em tempo real via WebSocket

**Fluxos alternativos:**
- Ticket já utilizado → tela âmbar "JÁ UTILIZADO" com timestamp do check-in anterior
- Ticket cancelado/reembolsado/invalidado → tela vermelha com motivo específico
- QR Code adulterado (assinatura inválida) → tela vermelha "INVÁLIDO"
- Evento incorreto → tela vermelha "EVENTO INCORRETO"
- Dois staffs escaneiam o mesmo ticket offline → ambos veem "VÁLIDO" localmente; na sincronização, o segundo é rejeitado pelo contrato e marcado como `CONFLICT_REJECTED`; painel do organizador exibe o incidente

**Invariantes:**
- Validação local não depende de internet
- Contrato rejeita check-in duplicado (idempotência on-chain)
- Snapshot tem validade configurável (expiração após o evento)

---

## UC-003 — Cadastro e KYB do Produtor

**Ator principal:** Produtor  
**Atores secundários:** BlindPay, Privy  
**Pré-condições:** nenhuma  
**Resultado esperado:** conta do produtor criada, KYB aprovado, wallet Privy associada

**Fluxo principal:**
1. Produtor acessa página de cadastro
2. Preenche dados básicos (nome, email, telefone)
3. Sistema cria conta com status `pending_kyb`
4. Sistema cria receiver no BlindPay: `POST /receivers`
5. BlindPay retorna URL de KYB (upload de documentos + selfie)
6. Produtor completa KYB no flow do BlindPay
7. BlindPay retorna status `approved`
8. Sistema cria wallet Privy embedded para o produtor
9. Sistema registra wallet como blockchain wallet no BlindPay: `POST /receivers/{id}/wallets`
10. Produtor cadastra chave Pix para recebimento: `POST /receivers/{id}/bank-accounts`
11. Conta do produtor → `active`
12. Produtor acessa o dashboard

**Fluxos alternativos:**
- KYB reprovado → produtor notificado, pode tentar novamente com documentação correta
- KYB em análise manual → produtor notificado, aguarda revisão (até 1 dia útil)

---

## UC-004 — Criação de Evento

**Ator principal:** Produtor  
**Pré-condições:** conta do produtor com KYB aprovado  
**Resultado esperado:** evento publicado com tipos de ingresso e regras configuradas

**Fluxo principal:**
1. Produtor acessa "Criar evento" no dashboard
2. Preenche: nome, descrição, data, local, capacidade máxima, imagem de capa
3. Cria tipos de ingresso: nome, preço em BRL, quantidade disponível, regras de transferência
4. Configura política de reembolso:
   - Até X dias antes: 100%
   - Até Y horas antes: percentual configurável
   - Após: sem reembolso automático
5. Define janela de segurança para liberação do saldo (ex: 7 dias após o evento)
6. Publica o evento
7. Sistema gera página pública do evento
8. Sistema prepara parâmetros para o `TicketContract` (capacidade, regras)

---

## UC-005 — Cancelamento de Evento

**Ator principal:** Produtor ou Access (admin)  
**Pré-condições:** evento ativo com ingressos emitidos  
**Resultado esperado:** evento cancelado, saldo bloqueado, compradores elegíveis a reembolso

**Fluxo principal:**
1. Produtor ou admin aciona cancelamento do evento
2. Sistema chama `TicketContract.cancel_event()` — todos os tickets → `invalidated`
3. Sistema chama `EscrowContract.block()` — saldo do produtor → `blocked`
4. Check-in bloqueado para todos os ingressos do evento
5. Repasses pendentes pausados
6. Sistema notifica todos os compradores via email
7. Compradores ficam elegíveis a reembolso via botão na área do comprador
8. Reembolsos processados via BlindPay (reversão Pix)
9. Saldo do produtor reduzido proporcionalmente aos reembolsos executados

**Invariantes:**
- Saldo bloqueado não pode ser sacado pelo produtor
- Reembolso respeita a política configurada no evento
- Cancelamento requer multi-sig 2-of-3 para `EscrowContract.block()`

---

## UC-006 — Solicitação de Retirada pelo Produtor

**Ator principal:** Produtor  
**Atores secundários:** BlindPay, Soroban EscrowContract  
**Pré-condições:** saldo com status `available`, sem bloqueios ou disputas  
**Resultado esperado:** Pix creditado na conta bancária do produtor

**Fluxo principal:**
1. Produtor acessa área financeira e visualiza saldo disponível em BRL
2. Clica em "Solicitar Retirada"
3. Confirma valor e chave Pix de destino
4. Backend adquire lock Redis (impede retiradas simultâneas do mesmo produtor)
5. `Purchase` de retirada → `withdraw_requested`
6. Backend verifica: saldo disponível ≥ valor solicitado, sem bloqueios, sem disputas
7. `EscrowContract.release()` executado com multi-sig 2-of-3
8. `Purchase` de retirada → `withdraw_escrow_done`
9. Backend chama BlindPay payout: `POST /payouts/stellar`
10. BlindPay processa conversão USDC → BRL e executa Pix
11. Webhook `payout.completed` recebido
12. `Purchase` de retirada → `withdrawn`
13. Lock Redis liberado
14. Produtor recebe comprovante

**Fluxos alternativos:**
- Falha após `withdraw_escrow_done` e antes do Pix: `PayoutRecoveryJob` detecta após 10 min e retenta o payout sem re-executar o release on-chain
- Saldo insuficiente → erro retornado antes de qualquer operação

---

## UC-007 — Reembolso de Ingresso

**Ator principal:** Comprador  
**Pré-condições:** ingresso com status `issued`, dentro do prazo da política de reembolso  
**Resultado esperado:** Pix de reembolso creditado ao comprador, ingresso → `refunded`

**Fluxo principal:**
1. Comprador acessa área de ingressos e solicita reembolso
2. Sistema verifica política de reembolso do evento
3. Sistema verifica status do ingresso (não pode estar `checked_in` ou `invalidated`)
4. Sistema verifica saldo disponível/pendente do produtor
5. Ingresso → `refunded` no Soroban
6. Saldo do produtor reduzido pelo valor do reembolso
7. BlindPay executa reversão Pix para o comprador
8. Comprador recebe notificação de confirmação

---

## UC-008 — Adiamento de Evento

**Ator principal:** Produtor  
**Pré-condições:** evento ativo  
**Resultado esperado:** evento com nova data, compradores notificados, saldo mantido pendente

**Fluxo principal:**
1. Produtor define nova data para o evento
2. Sistema atualiza data no banco e na página do evento
3. Ingressos continuam válidos com status inalterado
4. Saldo do produtor permanece `pending_settlement` até a nova data + janela de segurança
5. Compradores notificados por email com opção de aceitar nova data ou solicitar reembolso
6. Comprador que solicitar reembolso segue UC-007

---

## Matriz de Rastreabilidade

| Caso de Uso | Funcionalidade (Visão) | Histórias | Sequência |
|---|---|---|---|
| UC-001 | Venda via Pix + emissão de ingresso | US-001, US-002, US-003 | SEQ-001 |
| UC-002 | Credenciamento offline | US-010, US-011 | SEQ-002 |
| UC-003 | Cadastro + KYB do produtor | US-005 | SEQ-003 |
| UC-004 | Criação de evento | US-006, US-007 | SEQ-004 |
| UC-005 | Cancelamento de evento | US-014 | SEQ-005 |
| UC-006 | Retirada pelo produtor | US-012, US-013 | SEQ-006 |
| UC-007 | Reembolso de ingresso | US-004 | SEQ-007 |
| UC-008 | Adiamento de evento | US-015 | SEQ-008 |
