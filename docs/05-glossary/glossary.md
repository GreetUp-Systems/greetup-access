# Glossário Técnico — Access

> ⚠️ **Documento anterior à revisão de arquitetura de 20/08/2026.** Parte do conteúdo está
> superada (escrow, Treasury própria, KMS, CQRS, WebSocket). Em qualquer conflito, vale o
> [`MVP-REVISADO.md`](../06-sdd/MVP-REVISADO.md). Será revisado junto com as SPECs de cada bloco.

Termos ordenados alfabeticamente com definição precisa no contexto do Access.

---

**ADR (Architecture Decision Record)**  
Documento que registra uma decisão arquitetural relevante — contexto, opções avaliadas, decisão tomada e consequências. Armazenado em `docs/03-adrs/`. Serve como memória técnica do projeto.

**At-least-once delivery**  
Garantia de entrega de mensagem onde um evento pode ser entregue mais de uma vez, mas nunca menos. Usado no BullMQ. Requer que todos os consumers sejam idempotentes para evitar efeitos duplos.

**Background Sync API**  
API nativa do browser (parte dos Service Workers) que permite sincronização automática de dados quando a conexão de internet é restabelecida. Usada no PWA de credenciamento para sincronizar check-ins feitos offline.

**Balance Status**  
Estado do saldo do produtor para um determinado evento. Valores: `pending_settlement`, `blocked`, `available`, `withdrawn`, `refunded`, `disputed`. Controlado tanto no Postgres (auditoria) quanto no EscrowContract Soroban (autorização).

**BlindPay**  
Provedor de on/off-ramp Pix ↔ USDC da plataforma. Parceiro nativo Stellar, YC-backed, LatAm-first. Responsável por: processar pagamentos Pix (payin), executar retiradas via Pix (payout), realizar KYB dos produtores e garantir compliance regulatório. O Access nunca custodia os valores — o BlindPay é o liquidante.

**BullMQ**  
Biblioteca de filas de trabalho sobre Redis Streams para Node.js. Oferece retry exponencial, Dead-Letter Queue (DLQ), prioridade, delay, concorrência configurável e cron jobs. Usado para processar todos os jobs assíncronos do sistema.

**CQRS (Command Query Responsibility Segregation)**  
Padrão arquitetural que separa operações de escrita (commands) e leitura (queries) em modelos distintos. No Access, aplicado nos domínios de Tickets e Finance: escrita via Postgres + Soroban com consistência forte; leitura via Redis com projeção denormalizada e consistência eventual.

**Dead-Letter Queue (DLQ)**  
Fila especial no BullMQ que recebe jobs que falharam após todas as tentativas de retry. Todo job na DLQ gera alerta automático no Prometheus. Operador pode inspecionar, diagnosticar e reprocessar via painel admin.

**Domain Event**  
Representação de algo que aconteceu no sistema com relevância para o domínio de negócio. Exemplos: `payment.confirmed`, `ticket.issued`, `balance.released`. Armazenados na tabela `domain_events` (Outbox) antes de serem publicados no BullMQ.

**EscrowContract**  
Contrato Soroban (Rust) que controla a custódia, liberação e bloqueio do saldo do produtor em USDC. Implementa três camadas de proteção independentes: time-lock (release_at), multi-sig 2-of-3 e rate limit on-chain por seller_address.

**Feature Flag**  
Variável de ambiente ou configuração que habilita/desabilita uma funcionalidade sem necessidade de novo deploy. Usado, por exemplo, para desabilitar novos pagamentos durante indisponibilidade do BlindPay (`DISABLE_NEW_PAYMENTS=true`).

**Fee-bump**  
Mecanismo da Stellar que permite a uma conta pagar a taxa de transação de outra conta. Usado pela conta Treasury para pagar o gas de todas as transações dos compradores — o usuário nunca paga taxas de rede.

**HMAC-SHA256**  
Algoritmo de autenticação de mensagem usando função de hash criptográfica. Usado em dois contextos: (1) validação de webhooks do BlindPay — o header `blindpay-signature` contém HMAC do corpo da requisição; (2) assinatura do payload do QR Code para validação offline.

**Horizon**  
Interface REST e streaming da Stellar para interagir com a rede. Usada pelo backend para submeter transações assinadas, consultar estado de contas e indexar eventos dos contratos Soroban.

**Idempotência**  
Propriedade de uma operação que, quando executada múltiplas vezes com os mesmos parâmetros, produz o mesmo resultado sem efeitos colaterais adicionais. Crítico no Access para: webhooks do BlindPay (por `blindpayPayinId`), mints Soroban (por `purchase_id` no contrato), check-ins (contrato rejeita duplicatas).

**IndexedDB**  
Banco de dados NoSQL embutido no browser, usado pelo PWA de credenciamento para armazenar o snapshot de tickets válidos e a fila de check-ins offline.

**KYB (Know Your Business)**  
Processo de verificação da identidade e documentação de pessoas jurídicas ou físicas que recebem pagamentos. Obrigatório para produtores de eventos no Access. Realizado pelo BlindPay durante o onboarding — inclui upload de documentos e selfie. O comprador de ingresso nunca passa por KYC.

**Ledger (Financial Ledger)**  
Tabela `financial_ledger` append-only no Postgres que registra todos os eventos financeiros do sistema. Nenhuma linha é alterada ou deletada. O saldo atual de qualquer produtor é derivado da sequência de entradas no ledger. Garante rastreabilidade completa e irrefutável para auditoria.

**Lock Distribuído**  
Mecanismo de exclusão mútua via Redis que garante que apenas uma instância execute uma operação crítica por vez. Usado em: (1) solicitação de retirada do produtor — evita retiradas simultâneas do mesmo produtor; (2) processamento de webhook — evita processamento duplo em caso de múltiplas réplicas da API.

**MAU (Monthly Active User)**  
Usuário que realizou pelo menos uma ação na plataforma no mês. Métrica de billing do Privy: grátis até 499 MAU/mês, $299/mês até 2.499, $499/mês até 9.999, Enterprise acima disso.

**Multi-sig (Multi-signature)**  
Mecanismo que requer múltiplas assinaturas para autorizar uma operação. No Access: esquema 2-of-3 para operações críticas do EscrowContract (release, block) e TicketContract (cancel_event). Signers: KMS prod (Signer A) + HSM físico do fundador (Signer B) + cold storage de emergência (Signer C).

**Outbox Pattern (Transactional Outbox)**  
Padrão de design que garante entrega atômica de eventos de domínio. O evento é escrito na tabela `domain_events` na mesma transação do banco que atualiza o estado da entidade. Um processo separado (OutboxRelay) publica os eventos no BullMQ. Elimina o risco de estado atualizado sem evento correspondente.

**Payin**  
Operação de on-ramp no BlindPay: recebe pagamento em BRL via Pix e envia USDC para uma wallet blockchain especificada. No fluxo do Access, o destino é a wallet do EscrowContract.

**Payout**  
Operação de off-ramp no BlindPay: recebe USDC de uma wallet blockchain e envia BRL via Pix para a conta bancária cadastrada do produtor. Requer que o produtor seja um receiver com KYB aprovado.

**Policy Signer**  
Signer adicional configurado em uma wallet Privy com permissões restritas a um conjunto específico de operações. No Access, o backend usa um policy signer na wallet do comprador para assinar mints e check-ins sem interação do usuário — escopo mínimo de segurança.

**Privy**  
Provedor de wallet abstraction. Cria e gerencia wallets Stellar embedded invisíveis para o usuário. Login por email, social ou passkey. O usuário nunca vê endereço de wallet, seed phrase ou chave privada. Adquirido pela Stripe em junho de 2025.

**Purchase**  
Entidade que representa uma tentativa de compra de ingresso. Tem máquina de estados: `initiated → awaiting_payment → payment_confirmed → ticket_issued`. Também pode ir para `payment_failed`, `payment_expired` ou `payment_refunded`. A idempotência de webhooks é garantida pelo campo `blindpayPayinId`.

**PWA (Progressive Web App)**  
Aplicação web que pode ser instalada no dispositivo, funcionar offline e receber notificações push. No Access, será usada pelo produtor no credenciamento sem exigir publicação em app store. Capacidade offline e contas separadas de staff ficam para fases posteriores.

**RLS (Row-Level Security)**  
Feature do PostgreSQL que aplica políticas de acesso automaticamente em nível de linha para cada query. No Access, garante isolamento por `producer_id`. O contexto é resolvido a partir do usuário autenticado e usado dentro da mesma transação e conexão das queries protegidas.

**Soroban**  
Plataforma de smart contracts da Stellar. Contratos escritos em Rust, compilados para WebAssembly (WASM) e executados na rede Stellar. Usado para o TicketContract e EscrowContract do Access.

**Stellar**  
Blockchain de pagamentos com foco em velocidade e baixo custo. Transações finalizam em 3–5 segundos, custo ~$0.00001/tx. USDC disponível como ativo nativo (não bridged). Usado como blockchain principal do Access.

**Ticket Status**  
Estado de um ingresso tokenizado. Valores: `reserved → issued → checked_in` (fluxo feliz) ou `cancelled`, `refunded`, `expired`, `invalidated` (fluxos alternativos). Controlado tanto no Postgres quanto no TicketContract Soroban.

**TicketContract**  
Contrato Soroban (Rust) que controla a emissão, estados e check-in de ingressos. Garante: unicidade de ticket_id, capacidade máxima do evento, check-in único por ticket, idempotência por purchase_id, rejeição de check-in em tickets inválidos.

**Time-lock**  
Restrição on-chain no EscrowContract que impede qualquer release de saldo antes de um timestamp específico (`release_at`). Definido no momento do depósito e imutável. Mesmo que todas as chaves do multi-sig sejam comprometidas, o saldo não pode ser liberado antes do tempo.

**Treasury**  
Conta Stellar do Access que paga fee-bumps de todas as transações dos compradores e produtores. A chave privada da Treasury nunca é exposta — signing acontece dentro do AWS KMS. Requer monitoramento de saldo mínimo de XLM.

**Trustline**  
Autorização explícita de uma conta Stellar para receber um ativo não-nativo (como USDC). Toda nova wallet Stellar precisa estabelecer uma trustline antes de poder receber USDC. Custo: 0.5 XLM (base reserve). Gerenciado automaticamente pelo backend, patrocinado pela Treasury.

**USDC (USD Coin)**  
Stablecoin emitida pelo Circle, lastreada 1:1 em dólar americano. Disponível nativamente na Stellar com supply > $83M e volume > $4.2B. Usado como moeda de liquidação intermediária no Access — o comprador paga em BRL, o sistema opera internamente em USDC, o produtor recebe em BRL.

**WebSocket Gateway**  
Componente NestJS baseado em Socket.io que mantém conexões bidirecionais com clientes web e PWA. Emite eventos em tempo real para rooms específicas (por tenant, por evento, por comprador). Alimentado por Redis Pub/Sub — os workers publicam no Redis após concluir operações.

**WASM (WebAssembly)**  
Formato de bytecode portátil e eficiente. Contratos Soroban são compilados de Rust para WASM antes do deploy. Limite de tamanho: 64KB por contrato.

**XLM (Lumen)**  
Token nativo da rede Stellar. Usado para pagar taxas de transação e manter base reserves das contas. A conta Treasury mantém XLM para patrocinar todas as operações dos usuários.
