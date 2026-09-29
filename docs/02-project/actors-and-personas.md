# Atores e Personas — GreetUp Access

> ⚠️ **Documento anterior à revisão de arquitetura de 20/08/2026.** Parte do conteúdo está
> superada (escrow, Treasury própria, KMS, CQRS, WebSocket). Em qualquer conflito, vale o
> [`MVP-REVISADO.md`](../06-sdd/MVP-REVISADO.md). Será revisado junto com as SPECs de cada bloco.

---

## Atores Humanos

### Comprador de Ingresso

**Quem é:** pessoa física que compra ou recebe um ingresso para um evento corporativo.

**Motivação:** acessar um evento relevante de forma simples, sem fricção.

**Características:**
- Não tem conhecimento de blockchain ou crypto
- Usa Pix diariamente como método de pagamento
- Acessa o sistema pelo browser do smartphone na maioria dos casos
- Não tolera complexidade técnica ou etapas desnecessárias

**Interações com o sistema:**
- Acessar página pública do evento
- Selecionar tipo e quantidade de ingresso
- Informar email para receber o ingresso
- Pagar via Pix
- Visualizar ingresso digital e QR Code
- Apresentar QR Code no evento
- Solicitar reembolso (quando permitido)

**O que o sistema nunca deve exibir para ele:**
- Endereço de wallet
- Hash de transação
- Termos como stablecoin, USDC, Soroban, Stellar, on-chain

---

### Produtor de Evento

**Quem é:** empresa, produtora, comunidade ou pessoa responsável pelo evento e pelo faturamento.

**Motivação:** vender ingressos, controlar acesso e receber os valores de forma transparente e confiável.

**Características:**
- Familiaridade com ferramentas de gestão e dashboards
- Acessa principalmente pelo browser desktop
- Precisa de visibilidade financeira clara e em BRL
- Realiza KYB durante o onboarding (documentação, CNPJ/CPF, dados bancários)

**Interações com o sistema:**
- Criar conta e passar por KYB via BlindPay
- Criar eventos, tipos de ingresso, preços e regras
- Acompanhar vendas, participantes e presença em tempo real
- Visualizar dashboard financeiro (faturamento, taxas, saldo)
- Cancelar ou adiar eventos
- Cancelar ingressos individualmente
- Solicitar retirada de saldo disponível
- Exportar lista de participantes

**O que o sistema nunca deve exibir para ele como complexidade:**
- Endereço de contrato Soroban
- Hash de transação no Stellar
- Operações de stablecoin

---

### Staff de Credenciamento

**Quem é:** membro da equipe operacional do evento responsável pela entrada dos participantes.

**Motivação:** validar ingressos de forma rápida e confiável, sem depender de internet estável.

**Características:**
- Opera sob pressão, com muitas pessoas na fila
- Usa smartphone (browser mobile ou PWA instalado)
- Ambiente com internet potencialmente instável
- Precisa de resposta visual imediata e sem ambiguidade

**Interações com o sistema:**
- Fazer login no PWA de credenciamento
- Selecionar evento
- Sincronizar lista de tickets válidos antes do evento
- Escanear QR Codes dos participantes
- Ver resposta visual de validação (verde/vermelho/amarelo)
- Sincronizar check-ins quando online

---

## Atores de Sistema

### BlindPay
API de on/off-ramp. Processa pagamentos Pix, converte BRL→USDC, executa payouts USDC→Pix, realiza KYB do produtor. Comunica com o sistema via webhooks e API REST.

**Eventos que emite para o GreetUp Access:**
- `payin.completed` — Pix confirmado, USDC enviado para wallet destino
- `payin.failed` — Pagamento falhou ou expirou
- `payout.completed` — Off-ramp concluído, Pix enviado ao produtor
- `payout.failed` — Falha no off-ramp

### Privy
Provedor de wallet abstraction. Cria e gerencia wallets Stellar embedded para compradores e produtores. Fornece SDK web para login e signing. O sistema usa o policy signer do Privy para assinar transações sem interação do usuário.

### Stellar Horizon
Interface REST para interagir com a rede Stellar. O sistema acessa via pool de conexões com fallback entre múltiplos nós. Usado para submissão de transações e consulta de estado on-chain.

### Soroban (TicketContract + EscrowContract)
Contratos inteligentes em Rust deployados na Stellar Mainnet. Controlam emissão de tickets, estados de ingresso, check-in e custódia/liberação de saldo. O backend interage via `stellar-sdk` e `soroban-client`.

---

## Persona 1 — Comprador

| Campo | Descrição |
|---|---|
| Nome | Lucas Ferreira |
| Perfil | Gerente de Contas, 32 anos, São Paulo |
| Contexto | Recebeu convite da empresa para um jantar corporativo de relacionamento |
| Dores | Formulários longos, precisar instalar apps, processos de cadastro desnecessários |
| Objetivos | Confirmar presença, ter o ingresso no celular, entrar no evento sem complicação |
| Familiaridade digital | Alta — usa apps de banco, delivery e e-commerce diariamente |
| Dispositivo principal | iPhone, browser Safari |

---

## Persona 2 — Produtor

| Campo | Descrição |
|---|---|
| Nome | Renata Campos |
| Perfil | Sócia de produtora de eventos corporativos, 41 anos, Belo Horizonte |
| Contexto | Organiza 3 a 5 eventos corporativos por mês para clientes B2B |
| Dores | Plataformas genéricas sem controle financeiro, credenciamento que falha no dia, falta de transparência nos repasses |
| Objetivos | Criar eventos rápido, vender com Pix, saber exatamente o que vai receber e quando, credenciar sem stress |
| Familiaridade digital | Média-alta — usa plataformas de gestão, mas não tem perfil técnico |
| Dispositivo principal | MacBook, Chrome |

---

## Persona 3 — Staff

| Campo | Descrição |
|---|---|
| Nome | Pedro Alves |
| Perfil | Assistente operacional, 24 anos, terceirizado para eventos |
| Contexto | Trabalha na entrada de eventos corporativos, responsável por credenciar participantes |
| Dores | Apps que travam, internet instável no local, interface complicada sob pressão |
| Objetivos | Validar ingressos rápido, ter resposta visual clara, não precisar perguntar para ninguém o que fazer |
| Familiaridade digital | Média — usa smartphone bem mas não tem experiência com sistemas complexos |
| Dispositivo principal | Android, Chrome |
