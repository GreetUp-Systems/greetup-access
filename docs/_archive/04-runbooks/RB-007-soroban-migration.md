# RB-007 — Migração de Contrato Soroban

**Objetivo:** deploy de nova versão de contrato Soroban sem perda de dados e com rollback seguro.

**ATENÇÃO:** contratos Soroban são imutáveis após deploy. Esta é a operação mais delicada do sistema.

---

## Quando migrar

- Correção de bug crítico no contrato
- Adição de nova funcionalidade que não é possível com upgrade parcial
- Mudança nas regras de negócio que o contrato atual não suporta

---

## Processo de aprovação (obrigatório antes de qualquer passo)

1. [ ] Código do novo contrato revisado por pelo menos 2 engenheiros
2. [ ] Testes unitários e de integração passando (cargo test)
3. [ ] Auditoria de segurança do diff (se mudança crítica)
4. [ ] Aprovação do Tech Lead (Matheus Aguiar)
5. [ ] Janela de manutenção comunicada com 24h de antecedência

---

## 1. Deploy em Testnet (sempre primeiro)

```bash
# Build do contrato
stellar contract build --manifest-path packages/contracts/Cargo.toml --release

# Verificar tamanho do WASM (limite: 64KB)
wc -c target/wasm32-unknown-unknown/release/ticket_contract.wasm

# Computar hash SHA-256 para auditoria
sha256sum target/wasm32-unknown-unknown/release/ticket_contract.wasm

# Deploy em testnet
stellar contract deploy   --wasm target/wasm32-unknown-unknown/release/ticket_contract.wasm   --source ${DEPLOY_KEYPAIR_TESTNET}   --network testnet

# Anotar o novo contract address
export NEW_CONTRACT_ADDRESS_TESTNET="C..."
```

---

## 2. Testes de validação em Testnet

```bash
# Executar suite completa de testes de integração contra o novo contrato
SOROBAN_TICKET_CONTRACT_ADDRESS=${NEW_CONTRACT_ADDRESS_TESTNET}   pnpm turbo test:integration --filter=api

# Testar manualmente os fluxos críticos:
# - mint de ticket
# - check_in
# - cancel
# - release de escrow
```

---

## 3. Deploy em Mainnet

```bash
# Deploy requer aprovação manual no GitHub Actions + multi-sig

# Via CI (GitHub Actions workflow contracts-deploy-mainnet):
# 1. Push para branch contracts/v{version}
# 2. Aprovação de 2 revisores no GitHub Environment mainnet-contracts
# 3. Workflow executa o deploy com DEPLOY_KEYPAIR armazenado no KMS

# Anotar o novo contract address
export NEW_CONTRACT_ADDRESS_MAINNET="C..."

# Salvar no Secrets Manager
aws secretsmanager put-secret-value   --secret-id greetup/mainnet/ticket-contract-address   --secret-string "${NEW_CONTRACT_ADDRESS_MAINNET}"
```

---

## 4. Transição gradual

O sistema suporta dois contratos simultaneamente durante a transição:

```typescript
// Config no backend
const TICKET_CONTRACT_V1 = 'C...' // contrato antigo — tickets já emitidos
const TICKET_CONTRACT_V2 = 'C...' // contrato novo — novos tickets

// Lógica de roteamento:
// - Novos mints: sempre V2
// - Check-in de tickets antigos: V1
// - Leitura de tickets: verifica em qual contrato o ticket_id existe
```

---

## 5. Rollback

Rollback = deploy da versão anterior do WASM.

```bash
# O WASM da versão anterior está no GHCR com a tag do commit
docker pull ghcr.io/greetup/contracts:${PREVIOUS_COMMIT_SHA}

# Extrair e fazer novo deploy
stellar contract deploy   --wasm previous_ticket_contract.wasm   --source ${DEPLOY_KEYPAIR}   --network mainnet

# Atualizar o Secrets Manager com o address anterior
```

**Importante:** dados on-chain no contrato antigo são preservados — o rollback cria um novo contrato com o código anterior, não apaga o atual.

---

## 6. Pós-migração

- [ ] Verificar métricas por 24h após o deploy
- [ ] Confirmar que novos mints estão usando o contrato V2
- [ ] Confirmar que check-ins de tickets V1 continuam funcionando
- [ ] Documentar no CHANGELOG o novo contract address e o motivo da migração
- [ ] Atualizar `SOROBAN_TICKET_CONTRACT_ADDRESS` nas variáveis de ambiente de todos os serviços
