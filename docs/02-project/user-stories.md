# Histórias de Usuário — GreetUp Access

> ⚠️ **Documento anterior à revisão de arquitetura de 20/08/2026.** Parte do conteúdo está
> superada (escrow, Treasury própria, KMS, CQRS, WebSocket). Em qualquer conflito, vale o
> [`MVP-REVISADO.md`](../06-sdd/MVP-REVISADO.md). Será revisado junto com as SPECs de cada bloco.

Formato: `Como [ator], quero [ação], de modo que [benefício].`

Prioridade: **Crítico** (bloqueante para MVP) · **Importante** (agrega valor) · **Desejável** (evolução futura)

---

## Comprador

### US-001 — Comprar ingresso com Pix
**Como** comprador, **quero** pagar meu ingresso com Pix, **de modo que** eu possa comprar de forma rápida sem precisar cadastrar cartão ou criar conta em outra plataforma.

**Prioridade:** Crítico

**Critérios de aceite:**
- [ ] Comprador acessa página do evento sem necessidade de login
- [ ] QR Code Pix gerado em menos de 3 segundos após seleção do ingresso
- [ ] QR Code exibe contador de expiração (5 minutos)
- [ ] Após pagamento confirmado, comprador recebe email com link do ingresso em menos de 60 segundos
- [ ] Nenhuma tela exibe termos como blockchain, wallet, stablecoin ou crypto

---

### US-002 — Visualizar ingresso digital
**Como** comprador, **quero** acessar meu ingresso digital pelo browser, **de modo que** eu possa apresentá-lo no evento sem precisar instalar nenhum app.

**Prioridade:** Crítico

**Critérios de aceite:**
- [ ] Ingresso acessível via link no email, sem necessidade de criar senha
- [ ] QR Code exibido em destaque, legível, com tamanho adequado para escaneamento
- [ ] Status do ingresso exibido claramente ("Válido", "Utilizado", "Cancelado")
- [ ] Funciona no Safari (iOS) e Chrome (Android) sem instalação

---

### US-003 — Renovar QR Code Pix expirado
**Como** comprador, **quero** gerar um novo QR Code caso o anterior expire, **de modo que** eu não perca a compra por ter demorado para pagar.

**Prioridade:** Crítico

**Critérios de aceite:**
- [ ] Botão "Gerar novo QR Code" disponível após expiração
- [ ] Novo payin criado no BlindPay com mesmo ingresso reservado
- [ ] Reserva do ingresso mantida por até 3 tentativas consecutivas

---

### US-004 — Solicitar reembolso
**Como** comprador, **quero** solicitar reembolso do meu ingresso dentro do prazo permitido, **de modo que** eu possa cancelar minha participação e recuperar o valor pago.

**Prioridade:** Crítico

**Critérios de aceite:**
- [ ] Opção de reembolso visível na área do ingresso quando dentro do prazo
- [ ] Sistema exibe claramente o valor a ser reembolsado conforme a política do evento
- [ ] Após confirmação, Pix de reembolso enviado em até 3 dias úteis
- [ ] Email de confirmação enviado ao comprador
- [ ] Ingresso marcado como `refunded` e não aceito para check-in

---

## Produtor

### US-005 — Criar conta e passar por KYB
**Como** produtor, **quero** criar minha conta e verificar meus dados, **de modo que** eu possa receber os valores das vendas de forma segura e regulamentada.

**Prioridade:** Crítico

**Critérios de aceite:**
- [ ] Cadastro completo em menos de 10 minutos
- [ ] KYB Standard aprovado automaticamente em menos de 2 minutos
- [ ] Produtor pode cadastrar chave Pix após aprovação do KYB
- [ ] Email de boas-vindas com próximos passos enviado após aprovação
- [ ] Conta bloqueada para criação de eventos até KYB aprovado

---

### US-006 — Criar evento com ingressos
**Como** produtor, **quero** criar um evento com tipos de ingresso configuráveis, **de modo que** eu possa vender acessos de forma organizada e com as regras corretas.

**Prioridade:** Crítico

**Critérios de aceite:**
- [ ] Formulário com nome, descrição, data, local, capacidade e imagem de capa
- [ ] Suporte a múltiplos tipos de ingresso (nome, preço, quantidade, transferibilidade)
- [ ] Capacidade total do evento refletida no contrato Soroban no momento da publicação
- [ ] Evento pode ser salvo como rascunho antes de publicar
- [ ] URL pública do evento gerada após publicação

---

### US-007 — Configurar política de reembolso
**Como** produtor, **quero** definir a política de reembolso do meu evento, **de modo que** compradores saibam exatamente as condições antes de comprar.

**Prioridade:** Crítico

**Critérios de aceite:**
- [ ] Opções: reembolso total até X dias antes, parcial até Y horas antes, sem reembolso
- [ ] Política exibida claramente na página pública do evento antes da compra
- [ ] Sistema bloqueia reembolso fora do prazo automaticamente
- [ ] Política não pode ser alterada após a primeira venda

---

### US-008 — Acompanhar vendas em tempo real
**Como** produtor, **quero** visualizar as vendas do meu evento em tempo real, **de modo que** eu possa monitorar o progresso e tomar decisões.

**Prioridade:** Crítico

**Critérios de aceite:**
- [ ] Dashboard atualizado via WebSocket sem necessidade de refresh
- [ ] Métricas visíveis: total vendido, por tipo de ingresso, % de capacidade
- [ ] Lista de compradores com nome, tipo de ingresso e status de check-in
- [ ] Exportação da lista de participantes em CSV

---

### US-009 — Acompanhar credenciamento ao vivo
**Como** produtor, **quero** ver o progresso do credenciamento em tempo real, **de modo que** eu possa monitorar a entrada dos participantes durante o evento.

**Prioridade:** Importante

**Critérios de aceite:**
- [ ] Contador de check-ins atualizado em tempo real
- [ ] Percentual de presença vs vendas visível
- [ ] Lista de check-ins com timestamps
- [ ] Alerta visual se houver incidente de conflito de check-in

---

### US-010 — Visualizar dashboard financeiro
**Como** produtor, **quero** visualizar meu faturamento, taxas e saldo de forma clara, **de modo que** eu saiba exatamente o que recebi, o que está pendente e o que posso sacar.

**Prioridade:** Crítico

**Critérios de aceite:**
- [ ] Valores exibidos em BRL, sem menção a stablecoin ou USDC
- [ ] Métricas visíveis: faturamento bruto, taxa BlindPay, taxa GreetUp, líquido estimado
- [ ] Saldo segmentado: pendente / disponível / sacado / reembolsado
- [ ] Histórico de transações com data, descrição e valor
- [ ] Data estimada de liberação do saldo pendente exibida

---

### US-011 — Solicitar retirada de saldo
**Como** produtor, **quero** solicitar a retirada do meu saldo disponível, **de modo que** eu receba os valores na minha conta bancária.

**Prioridade:** Crítico

**Critérios de aceite:**
- [ ] Botão de retirada habilitado apenas quando há saldo disponível
- [ ] Confirmação com valor, chave Pix de destino e taxa (se houver)
- [ ] Status da retirada atualizado em tempo real (solicitado → processando → concluído)
- [ ] Email com comprovante enviado após conclusão
- [ ] Impossível iniciar segunda retirada enquanto há uma em processamento

---

### US-012 — Cancelar evento
**Como** produtor, **quero** cancelar um evento, **de modo que** compradores sejam notificados e eu possa gerenciar os reembolsos.

**Prioridade:** Importante

**Critérios de aceite:**
- [ ] Confirmação com alerta sobre impacto (bloqueio de saldo, elegibilidade de reembolso)
- [ ] Todos os compradores notificados por email em menos de 5 minutos
- [ ] Ingressos invalidados no contrato imediatamente
- [ ] Saldo bloqueado imediatamente (não disponível para saque)
- [ ] Compradores com botão de reembolso disponível por 30 dias

---

## Staff de Credenciamento

### US-013 — Sincronizar lista de tickets antes do evento
**Como** staff, **quero** sincronizar a lista de tickets válidos antes do evento, **de modo que** eu possa validar ingressos mesmo sem internet.

**Prioridade:** Crítico

**Critérios de aceite:**
- [ ] Botão de sincronização disponível no PWA
- [ ] Confirmação visual do número de tickets carregados e timestamp da última sync
- [ ] Lista válida por até 24 horas após a sincronização
- [ ] Sincronização em segundo plano não bloqueia o uso do app

---

### US-014 — Escanear e validar QR Code
**Como** staff, **quero** escanear o QR Code do participante e ver a resposta imediatamente, **de modo que** eu possa credenciar rapidamente sem depender de internet.

**Prioridade:** Crítico

**Critérios de aceite:**
- [ ] Resposta visual em menos de 2 segundos após o escaneamento
- [ ] Tela verde + "VÁLIDO" com nome do participante e tipo de ingresso
- [ ] Tela âmbar + "JÁ UTILIZADO" com timestamp do check-in anterior
- [ ] Tela vermelha + motivo específico para tickets inválidos
- [ ] Auto-retorno para câmera após 2 segundos
- [ ] Funciona 100% offline com lista pré-sincronizada

---

### US-015 — Sincronizar check-ins após o evento
**Como** staff, **quero** sincronizar os check-ins realizados offline, **de modo que** o dashboard do organizador reflita a presença real.

**Prioridade:** Crítico

**Critérios de aceite:**
- [ ] Sincronização automática quando internet disponível (Background Sync API)
- [ ] Indicador de check-ins pendentes de sincronização visível no app
- [ ] Botão de "Sincronizar agora" disponível
- [ ] Após sincronização, contagem de presença atualizada no dashboard do organizador
