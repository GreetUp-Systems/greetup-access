# Ferramentas de desenvolvimento e contexto para agentes

Este documento registra o contexto compartilhável usado por agentes de desenvolvimento no Access.
Ele não contém credenciais e não substitui a documentação arquitetural ou as SPECs.

## Skills versionadas

As skills instaladas com escopo de projeto ficam em `.agents/skills/`. O `skills-lock.json` registra
a origem e o hash do conteúdo instalado, permitindo revisar mudanças e manter o contexto da equipe
reproduzível.

O projeto atualmente inclui:

- BlindPay;
- Privy;
- Stellar: agentic payments, assets, cross-chain, dApp, data, smart contracts, standards e ZK
  proofs.

O diretório `.aider-desk/` é apenas um adaptador local gerado pelo instalador e não é versionado.

## Conexões MCP

Conexões MCP são configuradas no ambiente de cada pessoa. A configuração global e seus tokens não
devem ser copiados para o repositório.

### Stellar Raven

```powershell
codex.cmd mcp add stellar-raven --url https://raven.stellar.org/mcp
codex.cmd mcp login stellar-raven
```

### Privy Docs

```powershell
codex.cmd mcp add privy-docs --url https://docs.privy.io/mcp
```

### BlindPay

Use somente as credenciais da instância de desenvolvimento. Substitua os placeholders localmente e
nunca registre os valores reais em documentação, shell history compartilhado ou commits.

```powershell
codex.cmd mcp add blindpay `
  --env BLINDPAY_API_KEY=<development-api-key> `
  --env BLINDPAY_INSTANCE_ID=<development-instance-id> `
  -- npx.cmd -y @blindpaylabs/blindpay-mcp
```

### Verificação

```powershell
codex.cmd mcp list
```

Depois de instalar ou alterar skills e conexões MCP, recarregue a janela do VS Code para que uma nova
execução do agente descubra as capacidades atualizadas.

## Regras de segurança

- versionar skills e lockfile somente após revisar sua origem e conteúdo;
- nunca versionar `.env`, tokens OAuth, API keys ou IDs sensíveis;
- usar credenciais de desenvolvimento durante implementação e testes;
- consultar as fontes externas apenas quando a SPEC ativa exigir a integração correspondente;
- atualizar uma skill em commit separado para que alterações de instruções permaneçam auditáveis.
