# ADR-004 — BlindPay como provedor exclusivo de on/off-ramp no MVP

**Status:** Aceito | **Data:** 25/06/2026 | **Autor:** Matheus Aguiar

## Contexto

O sistema precisa de: on-ramp Pix→USDC Stellar, off-ramp USDC Stellar→Pix, KYB para produtores, compliance BCB 519/520/521.

## Opções Avaliadas

**BlindPay:** Pix nativo, Stellar nativo, KYB integrado, YC-backed, parceiro SCF ($115K em grants recebidos).

**Trace Finance:** escala institucional, burocrático para early stage.

**Ramp Network:** widget embedado, menos flexibilidade de API, Pix a confirmar.

## Decisão

**BlindPay** como provedor exclusivo no MVP.

## Justificativa

1. Único parceiro com Pix + Stellar nos dois sentidos confirmado em produção
2. KYB integrado — sem terceiro adicional para onboarding do produtor
3. Custo por produtor, não por comprador — alinhado com o modelo de negócio
4. Comprador nunca interage com BlindPay — zero KYC, zero fricção
5. Compliance BCB coberto pelo BlindPay como liquidante

## Consequências

- Dependência de fornecedor único — mitigado com camada de abstração RampService
- Fee por transação não publicado — confirmar antes de definir o split financeiro
