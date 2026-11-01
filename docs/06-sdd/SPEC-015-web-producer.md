# SPEC-015 — App web · Sistema do produtor

> **Status:** aprovada em 07/10/2026
>
> **Versão:** 1.9 (Evento em passos curtos, sem rolar: o rascunho em 3 passos, os detalhes em 4 e a
> página do evento com o resumo por seção e a publicação, E4–E7; a capa no cartaz do celular); 1.8
> (formulários do Recebimento em passos curtos, sem rolar, e o CEP preenchendo o
> endereço, R10); 1.7 (fecho da 15C: confirmação pelo webhook, textos do Figma, as mesmas rotas no
> desktop, fila de ativação por confirmação, arquivos até 3 MB, os 82 quadros e o mapa de erros);
> 1.6 (decisões da 15C, R1–R9); 1.5 (15C: Criar perfil leva ao Painel quem já tem perfil; 15D: a
> capa no cartaz da página do evento, vinda da SPEC-016 S21; 1.4: estados do sistema, Eventos e
> Perfil aprovados no Figma)
>
> **Atualizada em:** 01/11/2026
>
> **Depende de:** SPEC-003 (onboarding do produtor), SPEC-004 (eventos), SPEC-005 (compras),
> SPEC-014 (base do web, identificação, assinatura no navegador), SPEC-016 16A (moldura do site, antes
> do 9D) e a [arquitetura de informação](../design/information-architecture.md).

## 1. Objetivo

Dar ao web o sistema do produtor, a camada que só aparece depois do login e do perfil de produtor
(D-29):

1. o esqueleto: barra lateral no desktop (Sidebar do shadcn, com a conta no rodapé e o menu com
   "Sair"), Barra de abas no celular e o Perfil do produtor;
2. o Painel: avisos, pendências, números, gráfico de vendas por dia, próximo evento, vendas
   recentes e eventos;
3. a entrada focada (Criar perfil) e o Recebimento: conta de recebimento (Stellar, assinada no
   navegador, D-28) e a verificação da BlindPay (termos, dados, documentos, pedido de informações e
   recusa);
4. o Evento: lista, criar, editar (com capa, categoria e cidade), tipos de ingresso, publicar e o link
   do evento publicado.

Ao final, um produtor real fica pronto pelo produto, sem script, e a compra de ponta a ponta pode
ser validada (§11). O site público (vitrine, busca, Para produtores, Conta) é a SPEC-016.

## 2. Fontes

- **Estrutura:** [`docs/design/information-architecture.md`](../design/information-architecture.md).
- **Telas:** páginas "App" e "Produtor" do
  [Design System](https://www.figma.com/design/WYqT9b0lxW4QhWmjuoPblV) (§5). Releia cada nó antes de
  implementar a tela.
- **Referências de qualidade:** blocos `sidebar-07` e `dashboard-01` do shadcn/ui e as referências
  visuais trazidas pelo Matheus em 06/10/2026.
- **Fluxo, regras e perguntas:** grupo "Fluxo · Onboarding do produtor" do
  [FigJam](https://www.figma.com/board/2lbuNUP0m7qulZGR9cVALm).
- **Componentes:** [`docs/design/component-map.md`](../design/component-map.md).
- **BlindPay:** KYC Standard de pessoa física, termos, RFI e recusa (skill `blindpay`, `kb/kyc.md`).

## 3. Decisões desta SPEC (06/10/2026)

| #   | Decisão                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | Duas camadas (D-29): esta SPEC é o sistema do produtor; o site público é a SPEC-016. Só aparece o que existe; Check-in entra com a SPEC-009.                                                                                                                                                                                                                                                                |
| N2  | Desktop: barra lateral flutuante (Sidebar do shadcn, `variant="floating"`, `collapsible="icon"`, ⌘B), com Painel, Eventos e Recebimento e a conta no rodapé. Celular: Barra de abas Painel · Eventos · Recebimento e o avatar no topo, que abre a conta numa folha.                                                                                                                                         |
| N3  | O menu da conta tem Perfil do produtor, Meus ingressos, Ir para o site e Sair, no desktop e no celular. Meus ingressos e Ir para o site levam ao site público.                                                                                                                                                                                                                                              |
| N4  | Sem busca ⌘K nem paleta de comandos: a navegação tem três itens e a lista de Eventos tem a própria busca (08/10/2026).                                                                                                                                                                                                                                                                                      |
| N5  | O sistema exige sessão e perfil de produtor. Sem sessão, a identificação da SPEC-014; sem perfil, Criar perfil, numa tela focada, sem a navegação: no desktop, logo e "Voltar ao site"; no celular, a Barra superior com voltar e "Vender ingressos" (v1.7, como as outras páginas internas). "Começar a vender", no site, leva até aqui.                                                                   |
| N6  | O Painel tem ingressos vendidos e vendas com tendência contra o período anterior, o gráfico de vendas por dia e as vendas recentes, sem dados de quem comprou (15A). Gráficos e comparações além disso ficam para a SPEC-012.                                                                                                                                                                               |
| N7  | Recebimento é item da navegação. No celular, a raiz da aba mostra o estado da verificação (em análise, pendência, recusado, liberando, pronto, erro); termos, dados e documentos abrem como páginas internas, com voltar e sem abas.                                                                                                                                                                        |
| N8  | O logo acompanha o tema: a palavra "Access" usa `text/primary` (no Figma, ajustado; no código, entra na 15B). Hoje ela é branca fixa e some no modo claro.                                                                                                                                                                                                                                                  |
| P1  | Só pessoa física (KYC Standard) no piloto. Empresa (KYB) vem antes da abertura ao mercado (07/10/2026).                                                                                                                                                                                                                                                                                                     |
| P2  | O comprovante de endereço fica fora do formulário (opcional no KYC Standard); se a BlindPay pedir, chega como pedido de informações (RFI).                                                                                                                                                                                                                                                                  |
| P3  | O motivo da recusa é lido na hora da BlindPay, como o RFI, e não é gravado nem logado: só os `kyc_warnings` não resolvidos, com código e mensagem. Os `fraud_warnings` são sinais do modelo de risco, não motivos, e não saem da API (08/10/2026).                                                                                                                                                          |
| P4  | "Corrigir e enviar de novo" reabre Seus dados com os dados da tentativa recusada, lidos na hora da BlindPay; os documentos são enviados de novo.                                                                                                                                                                                                                                                            |
| P5  | O detalhe de taxas ao definir o preço (D-27) fica para a SPEC financeira. O preço mostra o mínimo e "A taxa de serviço é paga por quem compra, por cima do preço."                                                                                                                                                                                                                                          |
| P6  | Cancelar e apagar evento, e apagar tipo de ingresso, ficam fora: o cancelamento ainda não invalida ingressos nem avisa compradores.                                                                                                                                                                                                                                                                         |
| P7  | Avisos de vendas pausadas e de pedido de informações no Painel, calculados do estado que a API já devolve; sem e-mail.                                                                                                                                                                                                                                                                                      |
| P8  | Componentes novos no Design System (§5.3); tokens novos `size/sidebar` (256), `size/sidebar-collapsed` (72), `size/avatar-s` (32), `size/avatar-m` (40) e, na 15B, as medidas fixas das telas: `size/column-s`, `size/column-m`, `size/column-l`, `size/column-xl`, `size/search-field`, `size/section-aside`, `size/menu`, `size/empty-text`, `size/chart`, `size/chart-compact` e `size/dashboard-aside`. |
| E1  | Capa do evento em 16:9, enviada do navegador direto ao Cloudflare R2 por URL assinada (D-30): JPG, PNG ou WebP até 5 MB; fora de 16:9, a imagem é cortada no centro na exibição. Obrigatória para publicar (07/10/2026).                                                                                                                                                                                    |
| E2  | Categoria do evento, de uma lista fixa: Shows, Festas, Teatro, Stand-up, Esportes, Festivais, Infantil, Cursos e Gastronomia. Obrigatória para publicar.                                                                                                                                                                                                                                                    |
| E3  | Cidade do evento escolhida da base do IBGE (código, nome e UF), separada do endereço, que fica com rua e número. Obrigatória para publicar.                                                                                                                                                                                                                                                                 |

### Decisões da 15C (14/10/2026)

| #   | Decisão                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Envio da verificação que ficou sem resposta não trava o produtor (v1.7): a BlindPay não busca cadastro pelo `external_id`, então a API liga a tentativa pendente ao cadastro criado quando o webhook do customer chega com o id do produtor. Sem isso em 10 minutos desde o último envio, um envio novo encerra a pendente e segue; antes, o envio responde `409` e a tela mostra "Envio em processamento". O IP sai do cadastro (SPEC-003 v1.8).                                                                     |
| R2  | "Corrigir e enviar de novo" repassa pelos Termos (cada aceite vale para um cadastro só), reabre Seus dados com os dados da tentativa recusada, lidos antes, e pede os documentos de novo. Uma tentativa que falha na criação não esconde a recusa anterior: ela volta a ser a atual (SPEC-003 v1.7). Emenda a P4.                                                                                                                                                                                                     |
| R3  | "Conta com erro" aparece quando a preparação da conta de recebimento falhou de vez (`stellar.status` `failed`); "Tentar de novo" prepara de novo e pede a assinatura.                                                                                                                                                                                                                                                                                                                                                 |
| R4  | A recusa (v1.7, texto do Figma) tem o título "A verificação foi recusada" e a frase "Confira seus dados e documentos e envie de novo. A nova verificação começa pelos termos e traz preenchidos os dados que você já informou."; abaixo, o motivo de cada aviso como a BlindPay o informou, em "Detalhe informado pela BlindPay": a BlindPay não publica a lista de códigos. Sem aviso, o quadro não aparece. Emenda o §8.                                                                                            |
| R5  | Tamanho dos arquivos (v1.7): em 30/10/2026 a BlindPay Development recusou 5,2 MB com `FILES_TOO_LARGE` (o limite dela é de 5 MiB). O navegador reduz as fotos acima de 3 MB antes do envio, e o PDF vai até 3 MB; a API recusa acima disso (SPEC-003 v1.8).                                                                                                                                                                                                                                                           |
| R6  | O sistema do produtor inteiro retoma a conta de recebimento em segundo plano (prepara sem assinar, confere o envio e registra a carteira na BlindPay) enquanto ela estiver a caminho, com limite de tentativas; quando falta a assinatura, quem pede é o Recebimento. A retomada não mexe em conta `failed`: só o "Tentar de novo" da Conta com erro (v1.7, R3).                                                                                                                                                      |
| R7  | No navegador, as preparações de conta (a do comprador, ao entrar, e a do produtor) correm numa fila, para não pedirem duas assinaturas juntas. A seguinte só começa quando a anterior foi confirmada na rede (`active`) ou terminou em erro (v1.7): as duas usam a mesma carteira, e a do produtor montada antes de a do comprador entrar no ledger tentaria criar a conta de novo.                                                                                                                                   |
| R8  | Campos: Estado e as listas do pedido de informações em lista nativa com o visual do Campo de texto; o tipo de documento é uma lista de opções na própria tela (v1.8, R10); nascimento digitado com máscara DD/MM/AAAA; CPF com os dígitos verificadores conferidos no navegador; telefone enviado em formato internacional (+55); só documentos brasileiros (RG, CNH ou passaporte brasileiro); selfie só JPG ou PNG; o botão de arquivo diz "Escolher" também no celular. Documentos avisa isso na descrição (v1.7). |
| R9  | O Recebimento no celular tem a raiz da aba (as etapas e o resultado) e páginas internas para Termos, Seus dados e Documentos (`/producer/receiving/terms`, `/data`, `/documents`), com voltar e sem abas; a trilha "Perfil e conta" do desktop sai, porque Recebimento é item da navegação. As mesmas rotas valem no desktop, que mostra a lista e a etapa em cada uma (v1.7).                                                                                                                                        |
| R10 | Formulário cabe na tela sem rolar, em passos curtos (padrão de usabilidade do guia de design, 30/10/2026): Seus dados em 3 passos (quem é você, telefone, endereço), Documentos uma tela por item (escolher, frente, verso, selfie, conferir e enviar) e o pedido de informações uma pergunta por tela, que no celular abre como página interna (`/producer/receiving/rfi`). O CEP preenche rua, cidade e estado pelo ViaCEP, consultado do navegador: só o CEP sai.                                                  |

### Decisões da 15D (01/11/2026)

| #   | Decisão                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E4  | Evento em passos curtos, sem rolar (o padrão da R10): o rascunho nasce em 3 passos (nome e categoria, data e horário, capacidade) e os detalhes seguem em 4 (local, capa, tipos de ingresso, descrição e reembolso), cada um gravado no "Continuar" e podendo ficar para depois. Substitui o editor de página única.                                   |
| E5  | A página do evento é o resumo por seção, com "Editar" em cada uma, e a publicação: no desktop, o cartão "Publicação" ao lado; no celular, "Publicar evento" na barra de baixo abre a confirmação numa folha. O publicado segue no mesmo resumo, editável dentro da SPEC-004 §5, com "À venda" e "Vendas".                                              |
| E6  | O requisito da verificação diz o estado do produtor e, quando há o que fazer, leva ao Recebimento (§6).                                                                                                                                                                                                                                                |
| E7  | Na página pública do evento no celular, a capa entra num cartão 16:9 com cantos arredondados abaixo da barra superior, como o cartaz do desktop; sem capa, a arte da marca. A capa se troca, mas não se remove pela interface; o resumo mostra a miniatura e "Enviada", porque a API não guarda o nome do arquivo. Apagar e cancelar seguem fora (P6). |

## 4. Entregas

| Parte | Conteúdo                                                                                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15A   | Backend: tentativa atual na BlindPay, preço mínimo na visão do evento, vendidos e vendas por evento, resumo de vendas e vendas recentes; capa (R2), categoria e cidade no evento; base de cidades |
| 15B   | Esqueleto: layout do sistema, barra lateral, Barra de abas, conta (menu e folha), Painel (todos os estados), Eventos, Perfil do produtor, logo no tema                                            |
| 15C   | Criar perfil (focado) e Recebimento: conta de recebimento, termos, dados, documentos e resultados da verificação                                                                                  |
| 15D   | Evento: criar em passos (rascunho e detalhes), página do evento com edição por seção, tipos de ingresso, publicar e publicado; a capa no cartaz da página do evento (SPEC-016 S21)                |

Cada parte é um PR próprio, com a conferência visual 360/1440 registrada; a 15D vai em dois, o evento
no sistema do produtor e a capa no cartaz da página pública. Ordem: 15A → 15B → SPEC-016
16A (moldura do site) → SPEC-014 9D (Meus ingressos, já na moldura) → 15C → 15D → validação real
(§11). O resto da SPEC-016 vem depois da validação.

## 5. Telas, rotas e componentes

### 5.1 Esqueleto e Painel (página "App")

| Tela                                      | Rota                | Celular     | Desktop     |
| ----------------------------------------- | ------------------- | ----------- | ----------- |
| Painel                                    | `/producer`         | `291:2431`  | `284:1571`  |
| Painel no modo claro                      | `/producer`         | —           | `287:11368` |
| Menu da conta (desktop) / folha (celular) | sobreposição        | `293:2539`  | `288:11539` |
| Barra recolhida                           | —                   | —           | `288:11914` |
| Configuração pendente                     | `/producer`         | `298:4040`  | `298:3589`  |
| Primeiro evento (pronto, sem eventos)     | `/producer`         | `299:4266`  | `299:3865`  |
| Vendas pausadas                           | `/producer`         | `297:3249`  | `297:2973`  |
| Pedido de informações                     | `/producer`         | `297:3789`  | `297:3517`  |
| Período do Painel (menu)                  | sobreposição        | —           | `407:2745`  |
| Link copiado (Próximo evento)             | `/producer`         | —           | `410:16610` |
| Carregando o sistema                      | todas               | `430:17165` | `430:6770`  |
| Falha ao carregar o sistema               | todas               | `430:17265` | `430:17034` |
| Eventos                                   | `/producer/events`  | `307:3341`  | `307:2983`  |
| Eventos · Aba vazia                       | `/producer/events`  | `432:3813`  | `432:3428`  |
| Eventos · Busca sem resultado             | `/producer/events`  | —           | `432:3625`  |
| Eventos · Encerrados                      | `/producer/events`  | —           | `432:17453` |
| Eventos · Linha em hover                  | `/producer/events`  | —           | `437:16993` |
| Eventos · Ações ("⋯")                     | sobreposição        | —           | `410:2920`  |
| Perfil do produtor                        | `/producer/profile` | `300:4356`  | `300:4078`  |
| Perfil · Recebimento por estado           | `/producer/profile` | `433:17580` | `433:3828`  |

### 5.2 Criar perfil, Recebimento e Evento (página "Produtor")

| Tela                                                 | Rota                                    | Celular     | Desktop     |
| ---------------------------------------------------- | --------------------------------------- | ----------- | ----------- |
| Criar perfil (focado)                                | `/producer/start`                       | `305:5771`  | `303:4779`  |
| Criar perfil · Nome vazio                            | `/producer/start`                       | `519:9493`  | `498:3443`  |
| Criar perfil · Falha                                 | `/producer/start`                       | `501:4639`  | `498:3500`  |
| Recebimento · Configuração (raiz, etapa Termos)      | `/producer/receiving`                   | `501:5529`  | —           |
| Recebimento · Configuração · Seus dados (raiz)       | `/producer/receiving`                   | `520:5646`  | —           |
| Recebimento · Configuração · Documentos (raiz)       | `/producer/receiving`                   | `520:5797`  | —           |
| Recebimento · Nova tentativa · Seus dados (raiz)     | `/producer/receiving`                   | `520:5949`  | —           |
| Recebimento · Termos                                 | `/producer/receiving/terms`             | `302:4201`  | `301:2818`  |
| Termos · Falha ao abrir                              | `/producer/receiving/terms`             | `519:9557`  | `520:9000`  |
| Termos · Sem aceite                                  | `/producer/receiving/terms`             | `519:9623`  | `520:9102`  |
| Termos · Nova tentativa                              | `/producer/receiving/terms`             | `501:5493`  | `499:4710`  |
| Seus dados · 1 Quem é você                           | `/producer/receiving/data`              | `550:13465` | `550:15088` |
| Seus dados · 1 Quem é você · Erros                   | `/producer/receiving/data`              | `550:13631` | `550:15338` |
| Seus dados · 1 Quem é você · Nova tentativa          | `/producer/receiving/data`              | `550:13844` | `550:15627` |
| Seus dados · 1 Quem é você · Sem os dados anteriores | `/producer/receiving/data`              | `550:14017` | `550:15880` |
| Seus dados · 2 Telefone                              | `/producer/receiving/data?passo=2`      | `550:14222` | `550:16161` |
| Seus dados · 3 Endereço · Só o CEP                   | `/producer/receiving/data?passo=3`      | `550:14359` | `550:16378` |
| Seus dados · 3 Endereço · Consultando o CEP          | `/producer/receiving/data?passo=3`      | `550:14510` | —           |
| Seus dados · 3 Endereço · Preenchido pelo CEP        | `/producer/receiving/data?passo=3`      | `550:14647` | `550:16605` |
| Seus dados · 3 Endereço · CEP não encontrado         | `/producer/receiving/data?passo=3`      | `550:14843` | `550:16885` |
| Documentos · 1 Escolher o documento                  | `/producer/receiving/documents`         | `547:10342` | `547:10491` |
| Documentos · 2 Frente · Vazio                        | `/producer/receiving/documents?passo=2` | `545:10251` | `545:10365` |
| Documentos · 2 Frente · Enviando                     | `/producer/receiving/documents?passo=2` | `547:10705` | `547:10797` |
| Documentos · 2 Frente · Enviada                      | `/producer/receiving/documents?passo=2` | `547:10987` | `547:11099` |
| Documentos · 2 Frente · Erro no arquivo              | `/producer/receiving/documents?passo=2` | `548:13394` | `548:13508` |
| Documentos · 2 Frente · Falha no arquivo             | `/producer/receiving/documents?passo=2` | `548:14010` | `548:14112` |
| Documentos · 3 Verso · Enviado                       | `/producer/receiving/documents?passo=3` | `547:11297` | `547:11401` |
| Documentos · 4 Selfie · Vazio                        | `/producer/receiving/documents?passo=4` | `547:11599` | `547:11705` |
| Documentos · 4 Selfie · Tipo de arquivo              | `/producer/receiving/documents?passo=4` | `548:13712` | `548:13814` |
| Documentos · 5 Conferir e enviar                     | `/producer/receiving/documents?passo=5` | `547:11901` | `547:12037` |
| Documentos · 5 Conferir · Falha no envio             | `/producer/receiving/documents?passo=5` | `548:14308` | `548:14468` |
| Documentos · 5 Conferir · Envio em processamento     | `/producer/receiving/documents?passo=5` | `548:14714` | `548:14862` |
| Documentos · 5 Conferir · Envio recusado             | `/producer/receiving/documents?passo=5` | `548:15104` | `548:15256` |
| Documentos · Passaporte · 2 Página com a foto        | `/producer/receiving/documents?passo=2` | `548:15502` | `548:15606` |
| Documentos · Passaporte · 4 Conferir e enviar        | `/producer/receiving/documents?passo=4` | `548:15804` | `548:15924` |
| Recebimento · Em análise                             | `/producer/receiving`                   | `302:4594`  | `301:3623`  |
| Em análise · Conta com erro                          | `/producer/receiving`                   | `520:8833`  | `520:9204`  |
| Recebimento · Pendência (aviso com Responder)        | `/producer/receiving`                   | `545:10102` | —           |
| Pendência · Carregando                               | `/producer/receiving`                   | `520:10861` | `520:10688` |
| Pendência · Falha ao carregar                        | `/producer/receiving`                   | `520:11193` | `520:11010` |
| Pendência · Pergunta 1 de 3                          | `/producer/receiving/rfi`               | `543:9892`  | `548:11301` |
| Pendência · Pergunta 2 de 3                          | `/producer/receiving/rfi?passo=2`       | `544:9916`  | `548:11614` |
| Pendência · Pergunta 3 de 3                          | `/producer/receiving/rfi?passo=3`       | `544:10082` | `548:11967` |
| Pendência · Pergunta 1 · Campo vazio                 | `/producer/receiving/rfi`               | `544:10219` | `548:12295` |
| Pendência · Pergunta 3 · Formato                     | `/producer/receiving/rfi?passo=3`       | `544:10360` | `548:12618` |
| Pendência · Pergunta 3 · Falha ao enviar             | `/producer/receiving/rfi?passo=3`       | `544:10487` | `548:12936` |
| Pendência · Respondida                               | `/producer/receiving`                   | `501:5183`  | `499:4447`  |
| Pendência · Prazo encerrado                          | `/producer/receiving`                   | `520:11501` | `520:11360` |
| Recebimento · Recusado                               | `/producer/receiving`                   | `302:4856`  | `301:4010`  |
| Recusado · Vários motivos                            | `/producer/receiving`                   | `501:5276`  | `499:4574`  |
| Recusado · Sem motivo                                | `/producer/receiving`                   | `520:11765` | `520:11627` |
| Recusado · Falha ao carregar o motivo                | `/producer/receiving`                   | `520:12063` | `520:11888` |
| Recebimento · Liberando                              | `/producer/receiving`                   | `302:4981`  | `301:4205`  |
| Liberando · Falha                                    | `/producer/receiving`                   | `501:5323`  | `498:4144`  |
| Aprovada · Conta a caminho                           | `/producer/receiving`                   | `501:5385`  | `498:4248`  |
| Recebimento · Pronto                                 | `/producer/receiving`                   | `302:5084`  | `301:4372`  |
| Recebimento · Conta com erro                         | `/producer/receiving`                   | `302:5193`  | `301:4545`  |
| Evento · Novo · 1 Nome e categoria                   | `/producer/events/new`                  | `586:10877` | `586:11098` |
| Evento · Novo · 2 Data e horário                     | `/producer/events/new?passo=2`          | `587:11157` | `587:11387` |
| Novo · 2 Data e horário · Início no passado          | `/producer/events/new?passo=2`          | `595:14202` | `595:14275` |
| Evento · Novo · 3 Capacidade                         | `/producer/events/new?passo=3`          | `587:11300` | `587:11593` |
| Evento · Detalhes · 1 Local                          | `/producer/events/[id]/details`         | `588:11433` | `588:11718` |
| Detalhes · 1 Local · Buscando a cidade               | `/producer/events/[id]/details`         | `588:11602` | `588:11959` |
| Evento · Detalhes · 2 Capa                           | `/producer/events/[id]/details?passo=2` | `590:11793` | `590:12190` |
| Detalhes · 2 Capa · Erro no arquivo                  | `/producer/events/[id]/details?passo=2` | `590:11903` | `590:12385` |
| Evento · Detalhes · 3 Tipos de ingresso              | `/producer/events/[id]/details?passo=3` | `590:11998` | `590:12568` |
| Evento · Detalhes · 4 Descrição e reembolso          | `/producer/events/[id]/details?passo=4` | `590:12104` | `590:12782` |
| Evento · Tipo de ingresso                            | sobreposição                            | `594:12889` | `594:13318` |
| Tipo de ingresso · Preço abaixo do mínimo            | sobreposição                            | `594:13040` | `594:13557` |
| Tipo de ingresso · Quantidade acima da capacidade    | sobreposição                            | `594:13181` | `594:13796` |
| Evento · Rascunho (resumo e publicação)              | `/producer/events/[id]`                 | `591:12345` | `591:12579` |
| Evento · Editar uma seção (Data e horário)           | `/producer/events/[id]?editar=data`     | `593:12739` | `593:12840` |
| Evento · Publicar (confirmação)                      | sobreposição                            | `595:13523` | —           |
| Evento · Publicar bloqueado                          | `/producer/events/[id]`                 | `595:13689` | `595:13914` |
| Evento · Publicado                                   | `/producer/events/[id]`                 | `592:12539` | `592:12678` |
| Página do evento com a capa (Compra e Site público)  | `/e/[slug]`                             | `600:3351`  | `387:4114`  |

### 5.3 Componentes

| Figma (página)                                               | Código (shadcn/ui, adaptado)                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| Barra lateral (Barra lateral)                                | `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter` |
| Item de navegação                                            | `SidebarMenuButton` (+ `SidebarMenuBadge`, tooltip recolhido) |
| Conta na barra lateral, Menu da conta (Painel), Item de menu | `NavUser`: `DropdownMenu`, `DropdownMenuItem`                 |
| Alça                                                         | `SidebarTrigger`                                              |
| Avatar, Tendência (Avatar e indicadores)                     | `Avatar`, `Badge`                                             |
| Aba de seção, Progresso                                      | `Tabs` (linha), `Progress`                                    |
| Etapa (Etapas)                                               | composição com `Button`                                       |
| Área de texto (Campo de texto)                               | `Textarea`                                                    |
| Envio de arquivo e Envio de capa (Envio de arquivo)          | `<input type="file">` com `Button`; a capa com prévia         |
| Cabeçalho da folha, Barra de ações (Folha)                   | `Drawer` (vaul) e barra fixa de vidro                         |

Ícones Lucide novos: `upload`, `file-text`, `pencil`, `external-link`, `trash-2`, `layout-grid`,
`wallet`, `panel-left`, `chevrons-up-down`, `arrow-up`, `arrow-down`, `link` e os das categorias
(`music`, `party-popper`, `drama`, `mic`, `trophy`, `tent`, `baby`, `graduation-cap`, `utensils`);
preenchidos das abas: `layout-grid-fill`, `calendar-fill`, `wallet-fill`.

## 6. Comportamento

### Esqueleto

- **Layout do sistema:** exige sessão; sem ela, a identificação da SPEC-014 com `origin: "login"`,
  voltando à página pedida. Sem perfil de produtor (`GET /api/producers/me` → `404
producer_not_found`), vai para `/producer/start`. A barra lateral guarda aberta ou recolhida no
  navegador (cookie do `SidebarProvider`).
- **Estado do produtor:** `GET /api/producers/me`, relido a cada 10 s enquanto alguma etapa espera
  (D-17): análise da BlindPay, conta de recebimento a caminho na rede ou carteira sendo registrada.
- **Carregando e falha:** enquanto sessão, produtor e eventos carregam, a navegação aparece e a conta
  e a página ficam em esqueleto; se a API não responde, "Sem conexão" (o aviso do checkout) e
  "Tentar de novo".
- **Conta:** o menu (desktop) e a folha (celular) levam a `/producer/profile`, `/me/tickets` e `/`;
  "Sair" encerra a sessão Privy e volta ao Início do site.
- **Painel:** com perfil e sem `ready`, a configuração em etapas e "Enquanto isso", com os
  rascunhos. Com `ready`, os números, o gráfico, o próximo evento, as vendas recentes e os eventos.
  Avisos no topo: `compliance_request` com evento publicado → "Vendas pausadas" (erro);
  `approved_rfi` → "A BlindPay pediu informações" (atenção); primeira visita depois da aprovação →
  "Tudo pronto para vender" (sucesso, dispensável). Miniaturas dos eventos usam a capa; sem capa, a
  arte da marca.
- **Período:** Últimos 7, 30 ou 90 dias (30 por padrão); a tendência compara com o período anterior
  de mesma duração e some quando ele não teve venda. O gráfico tem uma barra por dia do período e
  destaca o melhor dia, ou o dia apontado, com a data e o valor. A configuração em etapas leva a etapa
  atual ao Recebimento ("Continuar"); os eventos do Painel abrem nos rascunhos enquanto ela aparece.
- **Eventos:** abas À venda, Rascunhos e Encerrados (encerrado: `endsAt`, ou `startsAt`, no
  passado), busca por nome no navegador, colunas evento, data, status, vendidos (com barra) e receita.
  O publicado que já aconteceu mostra o Status Encerrado; o cancelado, Cancelado. A linha inteira abre
  o evento (no hover, o nome sublinha); o "⋯" tem Editar e, no publicado, Ver página e Copiar link
  ("Link copiado"). Cada aba vazia e a busca sem resultado têm o seu texto; sem nenhum evento, "Crie
  seu primeiro evento".
- **Perfil do produtor:** nome público (só leitura) e o resumo do Recebimento por estado
  (configuração pendente, em análise, pedido de informações, recusado, liberando, pronto), com "Ver
  detalhes". No celular, página interna com voltar.
- **Tema:** segue o sistema (claro ou escuro), com os tokens dos dois modos.

### Criar perfil e Recebimento (KYC Standard, pessoa física)

- **Criar perfil:** tela focada (N5), com as etapas Perfil, Recebimento e Evento no cartão.
  `POST /api/producers` com `displayName`; em seguida, sem esperar o produtor, a
  configuração Stellar: `POST /api/producers/onboarding/stellar/activate`; em `signing`, o navegador
  assina o `hashToSign` com `signRawHash` e envia a `.../stellar/activate/signature` (o fluxo da
  conta do comprador, D-28); em `409 activation_signature_stale`, prepara e assina de novo uma vez.
  Pronto o perfil, entra no sistema, no Recebimento. Quem já tem perfil e abre `/producer/start`
  (pelo "Vender ingressos" do site ou pela URL) vai para `/producer`.
- **Rotas (R9, v1.7):** as mesmas no desktop e no celular. `/producer/receiving` mostra a etapa
  atual (no desktop, com a lista ao lado; na raiz do celular, o cartão da etapa com "Continuar" e a
  lista abaixo) ou o resultado; `/terms`, `/data`, `/documents` e `/rfi` mostram a etapa (no
  desktop, com a lista; no celular, página interna). Os passos de cada etapa usam `?passo=N` com
  entrada no histórico, para o voltar do navegador e do celular voltar um passo sem perder o que foi
  preenchido (R10). Uma etapa ou passo ainda não liberado, ou depois do envio, volta para o primeiro
  pendente; recarregar sem os dados na memória volta para o começo de `/data`. No desktop, com RFI
  aberto, `/producer/receiving` mostra direto a primeira pergunta.
- **Etapas:** Conta de recebimento, Termos da BlindPay, Seus dados, Documentos e Verificação, em
  linha do tempo (Etapa). Desktop: a lista à esquerda e a etapa à direita; celular: nas páginas
  internas, "Etapa N de 5" com o progresso em N/5; na raiz, a lista abaixo da etapa ou do resultado.
- **Conta de recebimento:** "Preparando…" até `stellar.status` ficar ativo. Um erro passageiro, depois
  do limite da retomada (R6), vira o toast "Conta de recebimento" com "Tentar de novo", sem bloquear a
  verificação (D-23); `failed` vira a Conta com erro (R3).
- **Termos:** `POST /api/producers/onboarding/tos` com `redirectUrl` = a origem do web +
  `/producer/receiving/data` (v1.7; a API devolve `{ url }` da BlindPay); volta com `tos_id` na URL,
  que fica no `sessionStorage` até a submissão e sai da URL. Voltar sem `tos_id` é Termos · Sem aceite.
- **Seus dados**, em 3 passos (R10): (1) nome, sobrenome, CPF (`taxId`) e nascimento; (2) telefone;
  (3) endereço no Brasil: o CEP primeiro, e o ViaCEP (`viacep.com.br/ws/<cep>/json/`, do navegador)
  preenche rua, cidade e estado; o produtor completa número e complemento. CEP não encontrado ou
  consulta que falha mostra o aviso e os campos vazios para preencher à mão. Rua e número formam o
  `addressLine1`; o bairro do ViaCEP não é enviado, porque a BlindPay não o pede; `country: "BR"`.
  Validação ao sair do campo: CPF pelos dígitos ("CPF inválido. Confira os números."); nascimento,
  uma data real, no passado e a partir de 1900 ("Data inválida. Use DD/MM/AAAA."), sem regra de
  idade no Access: a elegibilidade é da verificação da BlindPay; telefone com DDD ("Telefone
  inválido. Use DDD e número."). Os dados ficam só na memória da página até o envio; recarregar
  volta ao começo. Na nova tentativa, vêm preenchidos com o `draft` (R2).
- **Documentos**, uma tela por item (R10): escolher o tipo (RG → `ID_CARD`, CNH → `DRIVERS`,
  Passaporte → `PASSPORT`), frente, verso (RG e CNH), selfie e conferir e enviar. Cada arquivo é
  enviado ao ser escolhido (`POST .../files`): PDF até 3 MB e fotos em JPG ou PNG, reduzidas no
  navegador quando passam de 3 MB (R5); a selfie só aceita foto (R8). No celular, "Escolher" abre a
  câmera ou a galeria. "Enviar para verificação", na conferência, chama `POST .../customer`
  (`type: "individual"`, `kycType: "standard"`).
- **Resultados**, por `GET /api/producers/me` (no celular, a raiz da aba Recebimento):

| Estado da API                                                             | Tela                       | O que acontece                                                                                                              |
| ------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `compliance.status` `verifying`                                           | Em análise                 | "Criar evento" leva ao rascunho                                                                                             |
| `compliance.status` `compliance_request` ou `approved_rfi` com RFI aberto | Pendência                  | Seções do RFI (`GET .../rfi`) com o texto da compliance como veio; resposta única (`POST .../rfi`)                          |
| `compliance.status` `rejected`                                            | Recusado                   | Motivo lido na hora (15A), como na R4; "Corrigir e enviar de novo" repassa pelos Termos e reabre Seus dados preenchido (R2) |
| `stellar.status` `failed`                                                 | Conta com erro             | "Tentar de novo" prepara a conta de novo e pede a assinatura (R3); em análise, o aviso fica acima do resultado              |
| verificação operacional e `stellar.status` ainda não `active`             | Aprovada · Conta a caminho | Texto de espera; a retomada (R6) conclui a conta                                                                            |
| `onboardingStatus` `wallet_registration_pending`                          | Liberando recebimento      | O app chama `.../stellar/activate` de novo para registrar a carteira `bw_...`                                               |
| `onboardingStatus` `ready`                                                | Pronto                     | "Criar evento"                                                                                                              |

- **Campos do RFI**, uma seção por tela (R10), com "Pergunta N de M"; a última envia a resposta
  inteira de uma vez. No celular, a raiz mostra o aviso com o prazo e "Responder", que abre
  `/producer/receiving/rfi`. Cada seção mostra `title` e `description` sem alteração; campo com `items` vira
  lista; campo de arquivo (chave terminada em `_file` ou `_files`, ou `multiple: true`) vira Envio de
  arquivo; os demais, Campo de texto. `required` e `regex` validam antes do envio; o prazo vem de
  `expiresAt`. O `status` do RFI decide a tela: `pending`, Pendência; `submitted`, Respondida;
  `expired`, Prazo encerrado; sem RFI (`null` ou `cancelled`), Em análise, ou o resultado
  operacional no `approved_rfi`. Depois de responder, a Respondida fica na tela até a BlindPay mudar
  o status (a leitura do pedido passa a responder `404`), relendo o produtor a cada 10 s. No
  `approved_rfi`, as vendas continuam: o aviso diz "As vendas continuam enquanto isso." em vez de
  "Sem resposta, a verificação é recusada.". Limitações conhecidas: campo de vários arquivos aceita
  um (o produtor junta as páginas num PDF), e o link de modelo que a BlindPay pode anexar à seção
  (`supporting_document`) não aparece.
- **Erros da API → tela (v1.7):**
  - `POST /api/producers`: `400 invalid_producer_profile` vira o erro do campo ("Escreva o nome que
    vai aparecer para quem compra."); `409 producer_already_exists` leva a `/producer`; falha de rede
    e `5xx`, Criar perfil · Falha.
  - `POST .../tos`: falha de rede, `503` e `422 terms_session_failed` viram Termos · Falha ao abrir.
  - `POST .../files`: tipo e tamanho são conferidos antes do envio. PDF acima de 3 MB e `413`
    viram Erro no arquivo ("PDF maior que 3 MB. Escolha outro arquivo."); arquivo vazio e `400
invalid_onboarding_file`, "Não deu para usar este arquivo. Escolha outro."; tipo fora da lista,
    Tipo de arquivo ("A selfie precisa ser uma foto em JPG ou PNG.";
    na frente e no verso, "O documento precisa ser PDF, JPG ou PNG."); `422 document_upload_failed`,
    "A BlindPay não aceitou este arquivo. Escolha outro."; foto que o navegador não consegue reduzir,
    "Não deu para usar esta foto. Escolha outra."; falha de rede e `503`, Falha no arquivo.
  - `POST .../customer`: `409 customer_attempt_already_active` vira Envio em processamento; `422
customer_creation_failed`, `422 customer_attempt_failed` e `400 invalid_onboarding_input`, Envio
    recusado ("Revisar dados" volta a Seus dados); falha de rede e `503`, Falha no envio, e "Tentar
    de novo" repete o mesmo envio, com a mesma chave.
  - `GET .../customer`: falha vira Recusado · Falha ao carregar o motivo e, na nova tentativa, Seus
    dados · Sem os dados anteriores; sem avisos, Recusado · Sem motivo.
  - `GET .../rfi`: enquanto carrega, Pendência · Carregando; na falha, Pendência · Falha ao
    carregar. `POST .../rfi`: `required`, `regex` e `400 invalid_rfi_response` viram o erro do campo
    (Campos e Formato); `404 rfi_not_found` relê o RFI; falha de rede, `503` e `422
rfi_submission_failed`, Falha ao enviar.
  - `.../stellar/activate`: `502 stellar_activation_failed` vira a Conta com erro; `503`, a retomada
    tenta de novo (R6); `409 activation_signature_stale` prepara e assina de novo uma vez. No registro
    da carteira, `502 blindpay_wallet_registration_failed` vira Liberando · Falha na hora, e `503`,
    depois das tentativas da retomada (R6).

### Evento

- **Rotas e passos (E4):** `/producer/events/new` cria o rascunho em 3 passos (`?passo=2` e
  `?passo=3`): nome e categoria; data e horário; capacidade. `/producer/events/[id]/details`
  completa os detalhes em 4 (`?passo=2` a `?passo=4`): local; capa; tipos de ingresso; descrição e
  reembolso. `/producer/events/[id]` é a página do evento, e `?editar=<seção>` abre a edição de uma
  seção (`nome`, `data`, `capacidade`, `local`, `capa`, `ingressos` ou `descricao`). Cada passo e
  cada edição é uma entrada no histórico, como no Recebimento: o voltar do navegador e do celular
  volta um passo sem perder o que foi preenchido. No celular, página interna com voltar e "Etapa N
  de 3" com o progresso; no desktop, a lista Etapas (Rascunho, Detalhes e Publicação) ao lado. Um
  passo ainda não liberado volta ao primeiro pendente.
- **Criar o rascunho:** os 3 passos ficam na memória da página. "Criar rascunho" chama
  `POST /api/events`, com início e término em data e hora de Brasília enviados em ISO 8601 com o
  offset de `America/Sao_Paulo`, e abre o primeiro passo dos detalhes com o toast "Rascunho criado.
  O resto pode ficar para depois.". Criação e detalhes são um fluxo só na memória: voltar dos
  detalhes à criação mostra o que foi salvo, e o último passo da criação passa a dizer "Continuar" e
  grava as mudanças (`PATCH`), sem criar outro rascunho. Recarregar na criação volta ao primeiro
  passo, vazio, como no Recebimento; nos detalhes, os valores vêm de `GET /api/events/:id`.
- **Detalhes:** cada passo grava no "Continuar" (`PATCH /api/events/:id`, só o que mudou) e pode
  ficar vazio. Local: local, cidade e endereço ("Rua e número."). Capa. Tipos de ingresso: a lista,
  "Adicionar tipo de ingresso" e "N de M lugares nos tipos". Descrição (até 5.000 caracteres) e
  política de reembolso (até 2.000). O último "Continuar" abre a página do evento.
- **Cidade:** campo de busca com sugestões de `GET /api/cities?query=` (a partir de 2 letras, sem
  acento, 10 resultados, "Nome, UF"); guarda o código do IBGE e se troca, mas não se apaga (§8).
- **Capa:** escolhida a imagem, o navegador confere tipo e tamanho (JPG, PNG ou WebP até 5 MB), pede
  a URL (`POST .../cover/upload-url`), envia direto ao R2 com progresso e confirma
  (`PUT .../cover`) na hora, sem esperar o "Continuar"; "Trocar" repete o fluxo. Erro de tipo,
  tamanho ou envio vira Erro no arquivo, com "Escolher outro arquivo". A interface não remove a capa
  (E7).
- **Tipos de ingresso:** "Adicionar tipo de ingresso" e o tipo (no celular, a linha; no desktop, o
  "⋯" com Editar) abrem a janela do tipo, em folha no celular: nome, descrição opcional, preço em
  reais e quantidade, gravados com `POST` ou `PATCH .../ticket-types`. O preço mostra o mínimo
  (`ticketMinPriceCents`) e a frase da taxa (P5); a quantidade mostra o que cabe ("Até N pela
  capacidade.": a capacidade menos os outros tipos), também no rascunho.
- **Página do evento (E5):** o status no cabeçalho e o resumo por seção, cada uma com "Editar": nome
  e categoria; data e horário; capacidade; local; capa (miniatura e "Enviada"); tipos de ingresso
  ("N tipos · N de M lugares"); descrição e reembolso. Seção vazia diz o que falta, e a exigida para
  publicar acrescenta "obrigatória para publicar" (capa: "Falta enviar · obrigatória para
  publicar").
- **Editar uma seção:** os campos do passo correspondente, sob "Editar". No celular, página interna
  com voltar e "Salvar"; no desktop, no lugar do resumo, com "Cancelar" e "Salvar", e a publicação
  ao lado. "Salvar" grava (`PATCH`) e volta ao resumo; "Cancelar" e o voltar descartam. Capa e Tipos
  de ingresso gravam na hora (o envio e a janela do tipo), e o botão é "Concluir". No publicado, as
  regras da SPEC-004 §5 valem: início sempre no futuro, capacidade não abaixo da soma dos tipos e
  quantidade não abaixo do vendido.
- **Publicação:** os requisitos são verificação aprovada, capa do evento, categoria e cidade, pelo
  menos um tipo de ingresso, data no futuro e tipos dentro da capacidade ("N de M lugares").
  Cumpridos, o cabeçalho diz "Pronto para publicar" e "Todos os requisitos estão cumpridos."; senão,
  "Faltam N itens para publicar" (ou "Falta 1 item") com os itens, e o botão fica desabilitado com o
  motivo ("Falta a verificação ser aprovada e a capa do evento."). O item que se resolve no próprio
  evento leva à seção (capa: "Enviar capa" → `?editar=capa`). Desktop: o cartão "Publicação" ao
  lado do resumo, com "Publicar evento"; celular: "Publicar evento" na barra de baixo abre a folha
  de confirmação com os requisitos. Os dois avisam "Publicado, o evento não volta a ser rascunho e
  os tipos de ingresso não podem mais ser apagados.". "Publicar evento" chama
  `POST /api/events/:id/publish`.
- **Requisito da verificação (E6),** pelo produtor (`GET /api/producers/me`), na ordem da tabela:

| Estado                                                        | Linha                             | Detalhe                                           | Ação                                 |
| ------------------------------------------------------------- | --------------------------------- | ------------------------------------------------- | ------------------------------------ |
| `onboardingStatus` `ready`                                    | Verificação aprovada              | —                                                 | —                                    |
| `stellar.status` `failed`                                     | Conta de recebimento com erro     | Prepare a conta de novo no Recebimento.           | "Resolver" → `/producer/receiving`   |
| `compliance.status` `compliance_request`                      | Pedido de informações da BlindPay | Responda para a verificação seguir.               | "Responder" → `/producer/receiving`  |
| `compliance.status` `rejected`                                | Verificação recusada              | Corrija os dados e envie de novo.                 | "Corrigir" → `/producer/receiving`   |
| `compliance.status` `verifying`                               | Verificação em análise            | Publicar fica liberado quando a BlindPay aprovar. | —                                    |
| verificação aprovada, conta a caminho ou carteira registrando | Liberando o recebimento           | Publicar fica liberado em instantes.              | —                                    |
| sem envio (`compliance.status` nulo)                          | Verificação pendente              | Termine a configuração do recebimento.            | "Configurar" → `/producer/receiving` |

- **Motivo do botão desabilitado:** a verificação entra como "a verificação ser aprovada"; Liberando,
  como "o recebimento ser liberado"; Conta com erro, como "a conta de recebimento ficar pronta". Os
  outros itens: "a capa do evento", "a categoria e a cidade" (ou só a que falta), "um tipo de
  ingresso", "uma data no futuro" e "os tipos caberem na capacidade".
- **Publicado:** status "Publicado" e a mesma página, editável; "Ver página" (no desktop, no
  cabeçalho; no celular, na barra de baixo, com "Copiar link"); cartões "À venda" (link
  `<origem do app>/e/<slug>` e "Copiar link", com "Link copiado") e "Vendas" (vendidos de capacidade
  e receita, com `soldTickets` e `salesCents` de `GET /api/events`).
- **Validação, ao sair do campo e no "Continuar":** nome ("Escreva o nome do evento.") e categoria
  ("Escolha uma categoria.") obrigatórios; data DD/MM/AAAA e horário HH:MM com máscara ("Data
  inválida. Use DD/MM/AAAA." e "Horário inválido. Use HH:MM."); início obrigatório e no futuro ("Já
  passou. Use uma data futura."); término opcional, com data e horário juntos e depois do início ("O
  término precisa ser depois do início."); capacidade inteira a partir de 1 ("Informe quantas
  pessoas o evento comporta."), e no publicado não abaixo da soma dos tipos ("Os tipos já somam N
  lugares. Use N ou mais."); tipo com nome ("Escreva o nome do tipo."), preço a partir do mínimo ("O
  mínimo é R$ 60,00.", com o valor da API) e quantidade de 1 até o que cabe ("Passa da capacidade:
  use até N.").
- **Erros da API → tela:** `422 ticket_price_below_minimum` (com `minimumCents`),
  `422 ticket_quantity_exceeds_capacity`, `422 event_starts_in_past`, `422 event_ends_before_start`,
  `409 ticket_quantity_below_committed` ("Não pode ficar abaixo do que já foi vendido ou
  reservado.") e `400 invalid_event` / `invalid_ticket_type` viram o erro do campo;
  `422 invalid_cover` vira Erro no arquivo da capa; `422 event_not_publishable` e
  `422 event_without_ticket_types` releem o evento e mostram o que falta; `409 producer_not_ready`
  relê o produtor e volta ao Publicar bloqueado; falha de rede, `5xx` e
  `503 cover_storage_unavailable`, toast de erro com "Tentar de novo".
- **Página pública do evento (SPEC-016 S21, E7):** o cartaz de `/e/[slug]` mostra a capa (`coverUrl`,
  cortada no centro): no desktop, o cartaz de 740 × 440 (`387:4114`); no celular, um cartão 16:9
  com `radius/xl` abaixo da barra superior (`600:3351`). Sem capa, a arte da marca, como hoje.
- **Limitação conhecida:** os `POST` de evento e de tipo de ingresso não têm chave de idempotência;
  repetir um envio que ficou sem resposta pode criar um rascunho ou um tipo em dobro, que a interface
  não apaga (P6).

## 7. Regras (critérios de aceite)

| Etapa       | Regra                                                                                                | Origem             |
| ----------- | ---------------------------------------------------------------------------------------------------- | ------------------ |
| Acesso      | O sistema só abre com sessão e perfil de produtor; quem só compra fica no site público               | D-29, N5           |
| Navegação   | Só os itens que existem; a conta e "Sair" sempre ao alcance                                          | N1–N3              |
| Painel      | Vendas recentes não mostram nome, e-mail nem nenhum dado de quem comprou                             | RN-010, N6         |
| Perfil      | Um perfil de produtor por conta; o nome aparece como "Organizado por" na página do evento            | SPEC-003, D-20     |
| Conta       | A conta de recebimento é preparada ao criar o perfil, sem depender da verificação; o produtor assina | D-23, D-28         |
| Verificação | Dados e documentos vão direto para a BlindPay; o Access não guarda cópia                             | SPEC-003 §13       |
| Verificação | Recusa cria uma tentativa nova; não se edita cadastro recusado                                       | SPEC-003, BlindPay |
| Arquivos    | Só documentos brasileiros; selfie em JPG ou PNG; até 3 MB, com as fotos reduzidas no navegador       | R5, R8, SPEC-003   |
| Conta       | Uma ativação de conta por vez no navegador; a seguinte espera a anterior ser confirmada na rede      | R7                 |
| RFI         | Texto da compliance sem alteração; resposta única; prazo de 27 dias                                  | BlindPay           |
| Rascunho    | Pode ser criado antes da verificação aprovada                                                        | SPEC-004           |
| Capa        | Só JPG, PNG ou WebP até 5 MB, conferidos no R2 antes de valer; a chave é do próprio evento           | D-30, E1           |
| Cidade      | Sempre um município da base do IBGE; o endereço não decide a cidade                                  | D-30, E3           |
| Publicação  | Exige produtor `ready`, capa, categoria, cidade, um tipo, data no futuro e tipos na capacidade       | SPEC-004, E1–E3    |
| Preço       | Mínimo `TICKET_MIN_PRICE_CENTS`; a taxa de serviço é paga por quem compra                            | D-26, SPEC-005     |
| Publicado   | Não volta a rascunho; tipos não podem ser apagados                                                   | SPEC-004           |

## 8. Ajustes de backend (15A)

- **`GET /api/producers/onboarding/customer`:** lê na BlindPay (`GET /customers/{id}`) a tentativa
  atual e devolve `{ status, reasons: [{ code, message }], draft }`. `status` é o `kyc_status` da
  BlindPay; `reasons` são os `kyc_warnings` não resolvidos (código da AiPrise e mensagem em inglês;
  o web mostra a frase em português e a mensagem como veio, R4), e os `fraud_warnings` ficam fora (P3); `draft`, os
  dados sem arquivo para preencher a nova tentativa (nome, sobrenome, nascimento `YYYY-MM-DD`, CPF,
  telefone, endereço com o país, e o país e o tipo do documento). Nada é gravado nem logado. Sem
  tentativa, `404 blindpay_customer_not_found`; falha da BlindPay, `503
compliance_provider_unavailable` ou `422 customer_fetch_failed`, como no resto do onboarding.
- **SPEC-004, visão privada do evento:** ganha `ticketMinPriceCents` (o valor de
  `TICKET_MIN_PRICE_CENTS`).
- **SPEC-004, `GET /api/events`:** cada evento ganha `soldTickets` (ingressos de compras com
  pagamento confirmado ou emitidas) e `salesCents` (soma dos subtotais dessas compras, sem a taxa
  de serviço), lidos sob a política `purchases_producer_read`.
- **`GET /api/producers/me/sales?period=7d|30d|90d`:** `{ period, tickets, salesCents, previous:
{ tickets, salesCents }, daily: [{ date, tickets, salesCents }] }`, com as mesmas compras do item
  anterior, contadas pela data da confirmação no fuso `America/Sao_Paulo`. `period` é obrigatório;
  `7d` é hoje e os 6 dias anteriores, e `previous` é o período anterior de mesma duração; `daily`
  traz todos os dias do período, do mais antigo ao de hoje, com zero onde não houve venda.
- **`GET /api/producers/me/sales/recent?limit=5`:** as últimas compras confirmadas: `{ eventName,
ticketTypeName, quantity, subtotalCents, confirmedAt }`, `limit` de 1 a 20 (padrão 5). Nenhum dado
  de quem comprou. Consulta fora disso, nas duas rotas: `400 invalid_sales_query`.
- **Cidades:** tabela `cities` (`ibge_code` inteiro, chave; `name`; `uf` de 2 letras), carregada por
  migration a partir da lista de municípios do IBGE (API de Localidades), versionada no repositório.
  `GET /api/cities?query=` (autenticada): busca sem acento pelo início do nome ou de qualquer palavra
  dele, até 10, ordem alfabética; menos de 2 letras, `400 invalid_city_query`.
- **SPEC-004, evento:** ganha `category` (enum `EventCategory`; na API, em minúsculas como os
  estados: `shows`, `parties`, `theater`, `standup`, `sports`, `festivals`, `kids`, `courses`,
  `food`), `cityCode` (FK para `cities`) e `coverKey` (chave no R2), todos opcionais no rascunho.
  Categoria e cidade se trocam, mas não se apagam; código fora da base, `400 invalid_event` com
  `fields: ["cityCode"]`. As visões privada e pública ganham `category`, `city: { code, name, uf }` e
  `coverUrl` (`R2_PUBLIC_BASE_URL` + chave). Publicar sem algum deles → `422 event_not_publishable`
  com `missing` (`cover`, `category`, `city`).
- **Capa:** `POST /api/events/:id/cover/upload-url` com `{ contentType }` (`image/jpeg`,
  `image/png` ou `image/webp`) → `{ uploadUrl, key, expiresAt }`: PUT assinado no R2 por 10 min, com
  `Content-Type` assinado; a chave é `events/<eventId>/<uuid>.<ext>`. `PUT /api/events/:id/cover`
  com `{ key }` confere a chave do evento e o objeto no R2 (`HEAD`: o tipo assinado, até 5 MB) e
  grava `coverKey`; fora disso, `422 invalid_cover`. Só objeto do próprio evento é apagado (tipo ou
  tamanho errado): chave de outro evento é recusada sem tocar no objeto dele. `DELETE
/api/events/:id/cover` limpa a capa do rascunho; no evento publicado, `409 event_cover_required`.
  Trocar ou remover apaga o objeto anterior depois de gravar. Envio abandonado, ou objeto que o R2
  não apagou, fica sem dono no bucket; é aceito. Sem o R2 configurado (só fora de production), as
  três rotas respondem `503 cover_storage_unavailable` e `coverUrl` vem `null`.
- **SPEC-008, `GET /api/me/tickets` e `/:id`:** o evento ganha `coverUrl`, para os cartões de Meus
  ingressos (9D).

## 9. Configuração

Variáveis novas, com entrada no `.env.example`: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET` e `R2_PUBLIC_BASE_URL`, as cinco juntas ou nenhuma, obrigatórias
em production. Vazias em development, não há capa e, portanto, nenhum evento publica: testar a
publicação fora do ponta a ponta pede o bucket de desenvolvimento (§11).
`BLINDPAY_ALLOWED_REDIRECT_ORIGINS` precisa incluir a origem do web em cada ambiente (já existe). Os
tokens novos (P8) entram no snapshot `packages/ui/tokens/figma-tokens.json` na 15B.

## 10. Testes

- **Backend (15A):** unitários do mapeamento de avisos e do `draft` (sem arquivos) e da chave da
  capa; integração do endpoint da tentativa (recusada, aprovada, sem tentativa, falha da BlindPay),
  do `ticketMinPriceCents`, dos vendidos e vendas por evento e do resumo e das vendas recentes
  (compras confirmadas, emitidas, pendentes, falhas e de outro produtor; período anterior; fuso;
  nenhum dado de comprador na resposta); cidades (busca sem acento, limite); capa (URL assinada,
  confirmação válida, tipo e tamanho inválidos, chave de outro evento, troca e remoção, com o R2
  simulado); publicação sem capa, categoria ou cidade.
- **Unitários (web):** item ativo da navegação; para onde o layout leva sem sessão e sem perfil;
  estado do Painel a partir do produtor; tendência; etapa atual do Recebimento e a rota de cada
  etapa e de cada passo; CPF, máscaras, nascimento → ISO e telefone +55; CEP → endereço (achado,
  não achado e falha); regras e redução de arquivos; campos e estado do RFI e a divisão em
  perguntas; fila de ativação (R7); data e hora de Brasília → ISO; preço em reais ↔ centavos;
  validação da capa no navegador; o que cabe na capacidade; requisitos de publicação, a linha da
  verificação por estado (E6) e o motivo; o resumo de cada seção; erros da API → tela e estado do
  campo (§6).
- **Ponta a ponta (Playwright, API simulada):** navegação pela barra lateral (aberta e recolhida) e
  pelas abas; menu e folha da conta com "Sair" e com a ida ao site; sem perfil → criar
  perfil → conta de recebimento (assinatura simulada e erro); com perfil, `/producer/start` → Painel;
  termos com `tos_id` e sem aceite; dados passo a passo com o CEP preenchendo o endereço (e o CEP
  não encontrado) e o voltar sem perder o preenchido; documentos um por tela (com erro de arquivo);
  nenhum formulário rola em 360 × 780 e 1440 × 900; envio em processamento,
  recusado e com falha; em análise, pendência com resposta e prazo encerrado, recusado com nova
  tentativa preenchida e sem motivo, conta a caminho, liberando (e a falha), pronto e conta com erro;
  as mesmas rotas no desktop e no celular; Painel em todos os estados; Eventos; criar o rascunho em
  3 passos (com o início no passado) e os detalhes em 4 (cidade, capa com envio, erro e troca, tipo
  abaixo do mínimo e acima da capacidade); voltar dos detalhes à criação sem outro rascunho; editar
  uma seção; publicar bloqueado por estado da verificação; publicar, com a confirmação no celular, e
  o link do publicado; a página pública do evento com a capa e sem ela.
- **Conferência visual:** cada tela do §5 em 360 e 1440 (e o Painel no modo claro), registrada no PR.

## 11. Validação real

Na Testnet com BlindPay Development e um bucket R2 de desenvolvimento, pelo produto: uma conta nova
cria o perfil, prepara a conta de recebimento (assinatura no navegador) e passa pela verificação
(Development aprova sozinho; nome `Fail` força a recusa); cria um evento com capa, categoria e cidade
e o publica; outra conta compra pelo checkout da SPEC-014, paga o Pix de teste e recebe o ingresso,
que aparece em Meus ingressos e nas vendas recentes do Painel. Fecha o smoke 3C da SPEC-003 e o ponta
a ponta da SPEC-005.

## 12. Fora do escopo

- o site público: Início, Explorar, Para produtores, Conta e a moldura (SPEC-016);
- empresa (KYB) e comprovante de endereço no formulário (P1, P2);
- cancelar e apagar evento, apagar tipo de ingresso (P6);
- detalhe de taxas (D-27), gráficos e comparações além do Painel (SPEC-012), saldo e saque;
- check-in (entra como item da navegação com a SPEC-009);
- e-mails de aviso ao produtor; recorte ou tratamento da capa no servidor; edição do nome público;
  troca manual de tema;
- novo aceite quando a BlindPay atualiza os termos: a cotação do Pix passa a ser recusada para o
  produtor que não aceitou a versão nova, e o Access ainda não tem como pedir o aceite (SPEC-003 §18).
  Dívida registrada em 14/10/2026, a resolver antes da abertura ao mercado.

## 13. Definição de pronto

- [ ] Telas do §5 e componentes do §5.3 revisados pelo Matheus.
- [x] 15A: endpoints e campos do §8, com testes (PR #29, 08/10/2026).
- [x] 15B: esqueleto e Painel com conferência visual em 360/1440 e modo claro (PR #31, 09/10/2026).
- [x] SPEC-016 16A (moldura do site) e SPEC-014 9D (Meus ingressos) no ar, logo depois da 15B
      (PR #33, 11/10/2026, e PR #34, 12/10/2026).
- [x] 15C: Criar perfil e Recebimento com conferência visual (PRs #39, #40 e #41, de 30/10 a
      01/11/2026).
- [ ] 15D: Evento com conferência visual.
- [ ] Build, lint, typecheck, unitários, integração e ponta a ponta passam.
- [ ] Validação real executada (§11).
