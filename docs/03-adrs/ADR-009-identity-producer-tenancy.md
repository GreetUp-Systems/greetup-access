# ADR-009 — Identidade, produtor e wallet no MVP

> **Status:** aceito
>
> **Data:** 29/09/2026
>
> **Decisores:** Matheus Aguiar e equipe Access

## Contexto

O Access precisa representar compradores e produtores autenticados pelo Privy sem antecipar um
modelo de equipe que não existe no MVP. O desenho anterior usava `User × Organization × Membership`,
embora o produto tenha somente uma pessoa administrando cada conta produtora.

Também era necessário conciliar duas afirmações aparentemente conflitantes:

- o comprador paga sem cadastro e sem KYC;
- a wallet precisa existir antes do pagamento e continuar recuperável em outro dispositivo.

## Decisão

### 1. `User` é a identidade canônica da aplicação

O `User` interno representa uma pessoa autenticada. `privyUserId` é o identificador externo único;
email e endereço de wallet não substituem essa identidade.

### 2. Cada `User` possui no máximo uma wallet Stellar no MVP

A wallet é user-owned no Privy e vinculada 1:1 ao `User` no Access. Cada pessoa autentica sua
própria conta pelo email e possui sua própria wallet. Se esse mesmo `User` comprar ingressos e também
habilitar um `ProducerProfile`, ele reutiliza a conta e a wallet que já possui; nenhuma segunda
wallet é criada por causa do novo papel.

Usuários diferentes nunca compartilham conta ou wallet. Email é o método de login e recuperação;
`privyUserId` continua sendo a identidade canônica do vínculo.

A wallet Privy representa inicialmente a chave e o endereço `G…`. A existência da conta na rede
Stellar, seu patrocínio de reserva e a trustline são etapas separadas.

### 3. Produtor é um perfil opcional 1:1 do `User`

```text
User 1 ── 0..1 ProducerProfile
User 1 ── 0..1 WalletAccount
ProducerProfile 1 ── N Event
```

No MVP:

- uma conta produtora possui exatamente um usuário administrador;
- não existem `Organization`, `Membership`, convite de equipe nem papéis por organização;
- somente o próprio produtor pode administrar seus eventos;
- o check-in autenticado também usa a conta do produtor; contas separadas de staff ficam fora do
  MVP.

### 4. O comprador confirma o email por OTP antes do Pix

“Sem cadastro” significa sem senha, formulário de perfil ou KYC. Não significa anonimato perante o
Access.

No checkout, o comprador:

1. informa o email;
2. confirma o OTP do Privy;
3. tem o `User` e a wallet Stellar provisionados idempotentemente;
4. só então recebe o Pix para pagamento.

O pagador continua sem ser customer e sem passar por KYC na BlindPay.

### 5. Guest accounts não entram no MVP

Contas guest são locais ao dispositivo, expiram e não podem ser mescladas com uma conta Privy já
existente. Exigir OTP antes do pagamento elimina o risco de o comprador perder a sessão que controla
o ingresso.

### 6. O isolamento de produtor usa `producer_id`

Quando as primeiras tabelas pertencentes ao produtor forem criadas, elas referenciarão
`ProducerProfile.id`. O produtor autenticado será derivado no backend a partir de `User.id`, nunca de
um identificador de produtor aceito sem validação do cliente.

O RLS seguirá o ADR-005 e será aplicado dentro da mesma transação e conexão das queries protegidas.

## Invariantes

- `User.privyUserId` é único.
- Há no máximo um `ProducerProfile` por `User`.
- Há no máximo um `WalletAccount` Stellar por `User` no MVP.
- A wallet registrada precisa ser user-owned pelo mesmo `privyUserId` autenticado.
- Endereço ou ID de wallet enviados pelo cliente nunca são aceitos sem verificação no Privy.
- Um comprador não precisa de `ProducerProfile`.
- Ser produtor não cria uma segunda identidade nem uma segunda wallet.

## Consequências

### Positivas

- remove `Organization` e `Membership` sem uso real no MVP;
- elimina seleção de tenant e papéis prematuros;
- preserva uma única identidade quando a pessoa compra e produz;
- torna a recuperação do ingresso compatível com login por email em outro dispositivo;
- mantém um caminho claro para RLS por produtor.

### Limitações aceitas

- não há convite de funcionários, coorganizadores ou contas separadas de staff;
- adicionar equipes exigirá novo ADR e uma migração para introduzir membership;
- o OTP adiciona uma etapa antes do pagamento, aceita em troca da recuperabilidade;
- ativação da conta na rede Stellar permanece separada do provisionamento da wallet Privy.

## Fontes

- [Login por email e OTP](https://docs.privy.io/authentication/user-authentication/login-methods/email)
- [Guest accounts](https://docs.privy.io/authentication/user-authentication/login-methods/guest)
- [Criação de wallets e suporte a Stellar](https://docs.privy.io/wallets/wallets/create/create-a-wallet)
- [Verificação de access tokens](https://docs.privy.io/authentication/user-authentication/access-tokens)
