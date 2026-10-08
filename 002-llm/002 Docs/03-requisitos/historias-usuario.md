# Histórias de Usuário — Bolha Venda (Release 1.0)

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Rascunho para revisão
**Base:** [PRD v2.1](../../PRD.MD) · [Spec do Produto v1.1](../../SPEC.md) · [ERS](ers.md) · [Plano de Projeto](../planing-project.md)

> **Organização.** As histórias estão agrupadas pelos épicos E2–E9 do [plano](../planing-project.md). E0 (Discovery) e E1 (Fundações) são trabalho técnico e de pesquisa, sem histórias de usuário. Cada história traz:
> - **Épico / Sprint:** sprint-alvo da previsão do plano, a recalibrar depois da S2.
> - **Estimativa:** **estimativa inicial** em pontos (Fibonacci 1, 2, 3, 5, 8, 13), feita antes do planning poker. O time reestima no refinamento.
> - **Requisitos:** IDs de RF/RN/RNF da [ERS](ers.md).
> - **Critérios de aceite:** em Gherkin (Dado/Quando/Então), com o caminho feliz e as bordas.
>
> **INVEST.** Toda história cabe numa sprint (≤ 8 pts; nenhuma de 13). As dependências inevitáveis estão anotadas em "Depende de". Os pagamentos reais (E6) chegam na S5. Até lá, as histórias de E4/E5 usam o `PaymentPort` com um adaptador fake, o que mantém as histórias independentes e testáveis.
>
> **Personas:** Carlos Silva (PF), TecnoLotes Ltda (PJ), Visitante e Moderador. Os códigos de erro seguem a [ERS §3](ers.md#3-requisitos-específicos).

**Resumo por épico**

| Épico | Tema | Histórias | Pontos (estimativa inicial) | Sprints |
| :--- | :--- | :--- | :--- | :--- |
| E2 | Identidade e perfil | US-001 – US-009 | 37 | S1–S2 |
| E3 | Canvas interativo | US-010 – US-016 | 38 | S2–S3 |
| E4 | Bolhas e cotas | US-017 – US-024 | 39 | S3 |
| E5 | Tempo real, timers, explosão e notificações | US-025 – US-033 | 35 | S4 |
| E6 | Pagamento e estorno | US-034 – US-042 | 44 | S5 |
| E7 | Lances C2B/B2B | US-043 – US-047 | 18 | S5–S6 |
| E8 | Triagem, score e contestação | US-048 – US-058 | 47 | S6–S7 |
| E9 | Qualidade, segurança, moderação, LGPD e go-live | US-059 – US-074 | 64 | S7–S8 |
| **Total** | | **74** | **322** | |

---

## E2 — Identidade e Perfil (PRD RF01)

### US-001 — Cadastro de pessoa física
**Épico:** E2 · **Sprint:** S1 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-001, RF-008, RF-009, RN-031, RN-032

> **Como** Carlos (PF), **quero** criar minha conta com CPF, **para** participar de bolhas com segurança e aparecer só por pseudônimo.

```gherkin
# language: pt
Funcionalidade: Cadastro PF

  Cenário: Cadastro válido gera pseudônimo
    Dado que informo nome, e-mail novo, senha, CPF válido e nascimento há 30 anos
    E aceito os Termos de Uso e a Política de Privacidade vigentes
    Quando envio o cadastro
    Então recebo 201 e minha conta fica "ACTIVE"
    E recebo o pseudônimo "Bolhista#XXXX", com 4 caracteres hexadecimais
    E o aceite fica registrado em consents com versão, data, IP e user agent
    E o CPF fica gravado cifrado no banco

  Cenário: CPF com dígito inválido
    Dado que informo o CPF "123.456.789-00"
    Quando envio o cadastro
    Então recebo 422 com código "CPF_INVALID"

  Cenário: CPF já cadastrado
    Dado que já existe uma conta com o CPF "529.982.247-25"
    Quando outra pessoa tenta se cadastrar com esse CPF
    Então recebe 409 com código "DOCUMENT_ALREADY_REGISTERED"

  Cenário: Menor de idade
    Dado que informo uma data de nascimento de 17 anos atrás
    Quando envio o cadastro
    Então recebo 422 com código "VALIDATION_FAILED" no campo "birth_date"
```

### US-002 — Cadastro de pessoa jurídica com CNPJ verificado
**Épico:** E2 · **Sprint:** S2 · **Estimativa inicial:** 8 pts
**Requisitos:** RF-002, RF-008, RN-027

> **Como** TecnoLotes (PJ), **quero** cadastrar minha empresa com CNPJ verificado, **para** vender lotes e dar lances com credibilidade.

```gherkin
# language: pt
Funcionalidade: Cadastro PJ

  Cenário: CNPJ ativo
    Dado que a BrasilAPI responde situação "ATIVA" para o CNPJ informado
    Quando concluo o cadastro PJ
    Então minha conta fica "ACTIVE", com razão social e CNAE preenchidos pela fonte

  Cenário: CNPJ irregular
    Dado que a BrasilAPI responde situação "BAIXADA"
    Quando concluo o cadastro PJ
    Então recebo 422 "CNPJ_NOT_ACTIVE" com a mensagem "CNPJ com situação cadastral irregular"

  Cenário: Fallback para ReceitaWS
    Dado que a BrasilAPI excede o timeout de 5 s
    E a ReceitaWS responde "ATIVA"
    Quando concluo o cadastro PJ
    Então minha conta fica "ACTIVE"

  Cenário: Provedores indisponíveis
    Dado que BrasilAPI e ReceitaWS estão fora do ar
    Quando concluo o cadastro PJ
    Então minha conta fica "PENDING_VERIFICATION"
    E ao tentar comprar uma cota recebo 403 "ACCOUNT_NOT_VERIFIED"
    E o sistema tenta verificar de novo a cada 15 min por 24 h
```

### US-003 — Revalidação de CNPJ
**Épico:** E2 · **Sprint:** S2 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-003, RN-027

> **Como** plataforma, **quero** revalidar os CNPJs a cada 30 dias, **para** que empresas irregulares não iniciem novos negócios.

```gherkin
# language: pt
Funcionalidade: Revalidação de CNPJ

  Cenário: CNPJ fica inapto com bolha ativa
    Dado uma PJ verificada há 30 dias, com uma bolha de venda "ACTIVE"
    E o provedor passa a responder "INAPTA"
    Quando a revalidação roda
    Então a PJ recebe 403 "ACCOUNT_NOT_VERIFIED" ao criar bolha, aderir ou dar lance
    Mas a bolha "ACTIVE" segue até a explosão e a triagem continua
```

### US-004 — Login por e-mail e senha
**Épico:** E2 · **Sprint:** S1 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-004, RF-011, RNF-022

> **Como** usuário cadastrado, **quero** entrar com e-mail e senha, **para** acessar minhas bolhas e meu perfil.

```gherkin
# language: pt
Funcionalidade: Login

  Cenário: Credenciais válidas
    Quando faço login com e-mail e senha corretos
    Então recebo um access token válido por 15 min
    E um cookie httpOnly de refresh válido por 30 dias
    E GET /me retorna tipo de conta, pseudônimo, score 500 e faixa "Regular"

  Cenário: Senha errada não revela o motivo
    Quando faço login com a senha errada
    Então recebo 401 "INVALID_CREDENTIALS", com a mesma mensagem usada para e-mail inexistente

  Cenário: Força bruta
    Dado que errei a senha 3 vezes
    Quando tento de novo
    Então recebo 428 "CAPTCHA_REQUIRED"
    E depois de 5 tentativas no mesmo minuto recebo 429 com Retry-After
```

### US-005 — Sessão segura
**Épico:** E2 · **Sprint:** S1 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-006

> **Como** usuário, **quero** que minha sessão se renove sozinha e seja revogada no logout, **para** ficar conectado sem expor minha conta.

```gherkin
# language: pt
Funcionalidade: Refresh rotativo

  Cenário: Renovação
    Dado que meu access token expirou
    Quando o cliente chama POST /auth/refresh
    Então recebo um novo par de tokens e o refresh anterior fica inválido

  Cenário: Reuso de refresh roubado
    Dado que um refresh já rotacionado é reapresentado
    Quando POST /auth/refresh é chamado com ele
    Então recebo 401 "REFRESH_TOKEN_REUSED"
    E todos os tokens da família são revogados

  Cenário: Logout
    Quando faço logout
    Então o meu refresh token passa a retornar 401
```

### US-006 — Entrar com Google
**Épico:** E2 · **Sprint:** S2 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-005

> **Como** Carlos, **quero** entrar com minha conta Google, **para** não criar outra senha.

```gherkin
# language: pt
Funcionalidade: Login Google

  Cenário: Primeiro acesso exige completar o cadastro
    Dado que entro com Google pela primeira vez, com e-mail verificado
    Quando tento entrar numa bolha
    Então recebo 403 "ACCOUNT_INCOMPLETE"
    E sou levado a informar o tipo de conta e o CPF ou CNPJ

  Cenário: E-mail já cadastrado com senha
    Dado que existe uma conta com senha para o mesmo e-mail
    Quando entro com Google
    Então o vínculo só é criado depois que eu fizer login com a senha dessa conta
```

### US-007 — Recuperar senha
**Épico:** E2 · **Sprint:** S2 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-007

> **Como** usuário, **quero** redefinir minha senha pelo e-mail, **para** recuperar o acesso.

```gherkin
# language: pt
Funcionalidade: Recuperação de senha

  Cenário: Link válido
    Dado que pedi a recuperação há 10 min
    Quando defino uma nova senha pelo link
    Então a senha muda e todas as minhas sessões são revogadas

  Cenário: Link expirado ou reutilizado
    Dado um link emitido há 31 min, ou já usado
    Quando tento usá-lo
    Então recebo 410

  Cenário: Não revela se o e-mail existe
    Quando peço recuperação para um e-mail inexistente
    Então recebo a mesma resposta 202 de um e-mail existente
```

### US-008 — Permissões por perfil
**Épico:** E2 · **Sprint:** S1 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-010, RF-012

> **Como** PO, **quero** que cada perfil (Visitante, PF, PJ, Moderador) só faça o permitido na Spec §2, **para** aplicar as regras do negócio no servidor.

```gherkin
# language: pt
Funcionalidade: Controle de acesso

  Esquema do Cenário: Matriz papel × ação
    Dado que estou autenticado como "<papel>"
    Quando executo "<ação>"
    Então recebo "<resultado>"

    Exemplos:
      | papel     | ação                          | resultado      |
      | Visitante | GET /bubbles?bbox=…           | 200            |
      | Visitante | POST /bubbles                 | 401            |
      | PF        | POST /bubbles/{id}/bids       | 403 FORBIDDEN  |
      | PJ        | POST /bubbles/{id}/bids       | 201            |
      | Moderador | POST /bubbles/{id}/quotas     | 403 FORBIDDEN  |
```

### US-009 — Aceitar nova versão dos termos
**Épico:** E2 · **Sprint:** S2 · **Estimativa inicial:** 2 pts
**Requisitos:** RF-009

> **Como** plataforma, **quero** exigir o aceite de cada nova versão dos termos, **para** manter a base legal do tratamento comprovável.

```gherkin
# language: pt
Funcionalidade: Reaceite dos termos

  Cenário: Nova versão publicada
    Dado que a versão 2 dos Termos foi publicada e eu aceitei só a versão 1
    Quando tento entrar numa bolha
    Então recebo 422 "CONSENT_REQUIRED"
    E depois de aceitar a versão 2 consigo entrar
```

---

## E3 — Canvas Interativo (PRD RF02)

### US-010 — Navegar com pan e zoom
**Épico:** E3 · **Sprint:** S2 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-013

> **Como** Carlos, no celular, **quero** arrastar e dar zoom com os dedos, **para** explorar as bolhas com naturalidade.

```gherkin
# language: pt
Funcionalidade: Pan e zoom

  Cenário: Gestos de toque
    Dado que estou no canvas, num celular
    Quando arrasto com um dedo e faço pinça para aproximar
    Então o viewport se desloca com inércia e o zoom aumenta

  Cenário: Limites de zoom
    Quando tento aproximar além de 4× ou afastar além de 0,1×
    Então o zoom fica preso em 4× ou 0,1×

  Cenário: Teclado
    Quando uso as setas e as teclas "+" e "−"
    Então o viewport se move e o zoom muda
```

### US-011 — Ver as bolhas da região
**Épico:** E3 · **Sprint:** S2 · **Estimativa inicial:** 8 pts
**Requisitos:** RF-014, RF-021

> **Como** usuário, **quero** que o canvas carregue só as bolhas da área que estou vendo, agrupadas por categoria, **para** navegar rápido e achar ofertas parecidas.

```gherkin
# language: pt
Funcionalidade: Carga por viewport

  Cenário: Só a área visível
    Dado 5.000 bolhas ativas espalhadas pelo canvas
    Quando abro o canvas numa região com 300 bolhas
    Então GET /bubbles?bbox=… retorna só bolhas dentro do bbox
    E o cliente assina só os tiles visíveis

  Cenário: Truncamento
    Dado uma região com 800 bolhas
    Quando ela fica visível
    Então recebo no máximo 500 bolhas e "truncated: true"

  Cenário: LOD
    Quando o zoom está em 0,3×
    Então cada bolha aparece só como círculo colorido e anel de progresso, sem texto

  Cenário: Posição automática
    Quando publico uma bolha da categoria "Eletrônicos"
    Então ela é posicionada pelo sistema perto do cluster "Eletrônicos", sem sobrepor outra bolha
```

### US-012 — Entender uma bolha num relance
**Épico:** E3 · **Sprint:** S3 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-015, RF-016, RN-011, RN-034, RNF-019

> **Como** Carlos, **quero** ver na bolha o preço atual, o próximo degrau, o tempo e se ela está quase cheia ou expirando, **para** decidir rápido se entro.

```gherkin
# language: pt
Funcionalidade: Componente visual da bolha

  Cenário: Informações com zoom > 1×
    Dado uma bolha com filled 7, min 10, max 20 e degraus 0→R$100, 10→R$90, 20→R$80
    Quando a vejo com zoom 1,5×
    Então leio "7/20", com o marcador da meta em 10
    E "R$ 100,00" e "faltam 3 cotas para R$ 90,00"

  Cenário: Flags simultâneas
    Dado uma bolha com 16 de 20 cotas e 40 min restantes
    Então vejo o selo "Quase cheia" (ícone e texto) e o selo "Expirando" com contagem mm:ss

  Cenário: Bolha encerrada
    Dado uma bolha que explodiu há 23 h
    Então ela aparece esmaecida
    E depois de 24 h ela não está mais no canvas
```

### US-013 — Ver o detalhe da bolha sem expor participantes
**Épico:** E3 · **Sprint:** S3 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-019, RF-094, RF-008

> **Como** Carlos, **quero** abrir o detalhe com todas as condições e ver os participantes só por pseudônimo, **para** decidir com transparência sem expor ninguém.

```gherkin
# language: pt
Funcionalidade: Detalhe da bolha

  Cenário: Condições antes do botão
    Quando abro o detalhe de uma bolha de venda
    Então vejo os degraus, a meta, a capacidade, o teto PJ, o prazo de envio e o fim da bolha antes de "Entrar na bolha"

  Cenário: Identificação do anunciante PJ
    Dado que o criador é a TecnoLotes Ltda
    Então vejo a razão social e o CNPJ dela

  Cenário: Participantes pseudonimizados
    Dado que Carlos participa da bolha
    Quando outro usuário abre o detalhe
    Então vê "Bolhista#4F2A — 1 cota" e nunca o nome, o e-mail ou o CPF de Carlos
```

### US-014 — Lista acessível e filtros
**Épico:** E3 · **Sprint:** S3 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-020, RF-022, RNF-012

> **Como** pessoa usuária de leitor de tela, **quero** uma lista equivalente ao canvas, com filtros, **para** encontrar bolhas e entrar nelas sem mouse.

```gherkin
# language: pt
Funcionalidade: Lista alternativa

  Cenário: Navegação por teclado
    Dado que alterno para "Lista"
    Quando navego só com Tab e setas, usando o NVDA
    Então ouço título, preço atual, progresso e tempo restante de cada bolha
    E consigo abrir uma bolha e entrar nela

  Cenário: Anúncios sem excesso
    Dado uma bolha recebendo 10 cotas em 2 s
    Então o aria-live anuncia no máximo 1 atualização a cada 5 s

  Cenário: Filtro por tipo
    Quando aplico o filtro "Compra"
    Então nenhuma bolha de venda aparece na lista nem no canvas
    E o filtro fica na URL
```

### US-015 — Explorar sem login
**Épico:** E3 · **Sprint:** S2 · **Estimativa inicial:** 2 pts
**Requisitos:** RF-012

> **Como** visitante, **quero** navegar no canvas sem criar conta, **para** conhecer as ofertas antes de me cadastrar.

```gherkin
# language: pt
Funcionalidade: Acesso de visitante

  Cenário: Login só na hora de agir
    Dado que não estou autenticado
    Quando clico em "Entrar na bolha"
    Então sou levado ao login
    E depois do login volto ao detalhe da mesma bolha
```

### US-016 — Canvas fluido com 500 bolhas
**Épico:** E3 · **Sprint:** S2 · **Estimativa inicial:** 8 pts
**Requisitos:** RNF-001, RNF-005

> **Como** Carlos, num Android de gama média, **quero** que o canvas continue fluido com muitas bolhas, **para** navegar sem travamentos.

```gherkin
# language: pt
Funcionalidade: Desempenho do canvas

  Cenário: Benchmark de CI
    Dado 500 bolhas visíveis num dispositivo de referência
    Quando executo 30 s de pan/zoom roteirizado
    Então o frame time p95 é ≤ 16,7 ms
    E o PR é bloqueado se a meta falhar

  Cenário: Carregamento inicial
    Dado uma rede 4G emulada
    Então o LCP é ≤ 2,5 s e o JS inicial é ≤ 350 KB gzip
```

---

## E4 — Motor de Bolhas e Cotas (PRD RF03, RF06)

### US-017 — Criar bolha de venda com degraus
**Épico:** E4 · **Sprint:** S3 · **Estimativa inicial:** 8 pts
**Requisitos:** RF-023, RF-025, RF-027, RF-030, RN-002, RN-004, RN-005, RN-012, RN-016

> **Como** TecnoLotes, **quero** criar uma bolha de venda com degraus de preço, **para** dar desconto só se o volume vier.

```gherkin
# language: pt
Funcionalidade: Criação de bolha de venda

  Cenário: Rascunho válido
    Dado que preencho título, 3 imagens, max 100, min 40 e degraus 0→R$100, 40→R$90, 70→R$80, 100→R$75
    E duração de 3 dias e shipping_days 7
    Quando salvo
    Então a bolha fica em "DRAFT", visível só para mim

  Cenário: Degrau com preço crescente
    Dado os degraus 0→R$100, 40→R$110
    Quando salvo
    Então recebo 422 "INVALID_PRICE_TIERS"

  Esquema do Cenário: Limites
    Dado "<campo>" = "<valor>"
    Quando salvo
    Então recebo 422 "<código>"
    Exemplos:
      | campo        | valor | código              |
      | duração      | 30min | INVALID_DURATION    |
      | duração      | 6d    | INVALID_DURATION    |
      | min_quotas   | 120   | INVALID_QUOTA_RANGE |
      | max_pj_share | 5%    | INVALID_PJ_SHARE    |
      | imagens      | 6     | VALIDATION_FAILED   |

  Cenário: Rascunho salvo automaticamente
    Dado que estou no passo 3 do formulário
    Quando fecho o navegador e volto
    Então os dados digitados estão lá
```

### US-018 — Criar bolha de compra
**Épico:** E4 · **Sprint:** S3 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-024, RF-025, RF-031, RF-035, RN-024

> **Como** Carlos, **quero** criar uma bolha de compra com preço-alvo e convidar fornecedores, **para** juntar compradores e atrair lances de empresas.

```gherkin
# language: pt
Funcionalidade: Criação de bolha de compra

  Cenário: Bolha com fornecedores sugeridos
    Dado que crio uma bolha de compra com max 50, min 20, alvo R$ 60,00 e 2 dias
    E indico 2 CNPJs e 1 e-mail como fornecedores
    Quando publico
    Então os 3 recebem o convite em até 1 min
    E eu ocupo automaticamente 1 cota, paga no cartão

  Cenário: Pagamento do criador recusado
    Dado que meu cartão é recusado na pré-autorização de R$ 60,00
    Quando publico a bolha de compra
    Então recebo 402 "PAYMENT_DECLINED" e a bolha continua "DRAFT"

  Cenário: Sexto fornecedor
    Quando indico 6 fornecedores
    Então recebo 422 "VALIDATION_FAILED"
```

### US-019 — Publicar bolha
**Épico:** E4 · **Sprint:** S3 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-026, RF-029, RN-025

> **Como** vendedor, **quero** publicar minha bolha e ter as condições congeladas, **para** que os compradores confiem na oferta.

```gherkin
# language: pt
Funcionalidade: Publicação

  Cenário: Publicação
    Dado um rascunho válido e meu recebedor aprovado
    Quando publico
    Então a bolha fica "ACTIVE", com expires_at = agora + duração
    E aparece em menos de 1 s no canvas de outro usuário do mesmo tile

  Cenário: Condições imutáveis
    Dado uma bolha "ACTIVE"
    Quando tento alterar os degraus
    Então recebo 409 "BUBBLE_NOT_DRAFT"
    Mas consigo alterar a descrição, e a edição fica em audit_log
```

### US-020 — Cancelar bolha sem adesões
**Épico:** E4 · **Sprint:** S3 · **Estimativa inicial:** 2 pts
**Requisitos:** RF-028, RN-026

> **Como** criador, **quero** cancelar uma bolha que ninguém aderiu, **para** corrigir um erro de oferta.

```gherkin
# language: pt
Funcionalidade: Cancelamento pelo criador

  Cenário: Sem cotas de terceiros
    Dado uma bolha "ACTIVE" sem cotas nem reservas de outras contas
    Quando cancelo
    Então ela fica "CANCELLED" e os timers são removidos

  Cenário: Com participantes
    Dado uma bolha com 1 cota de outra conta
    Quando tento cancelar
    Então recebo 409 "BUBBLE_HAS_QUOTAS"
```

### US-021 — PF entra com 1 cota, sem overbooking
**Épico:** E4 · **Sprint:** S3 · **Estimativa inicial:** 8 pts
**Requisitos:** RF-032, RF-033, RF-035, RF-036, RF-038, RN-001, RN-003, RNF-006, RNF-017

> **Como** Carlos, **quero** entrar numa bolha com 1 cota e ter a vaga garantida, **para** pagar o preço coletivo.

```gherkin
# language: pt
Funcionalidade: Aquisição de cota PF

  Cenário: Caminho feliz
    Dado uma bolha de venda "ACTIVE" com 10 de 100 cotas pagas
    Quando confirmo o resumo e entro com cartão
    Então recebo 201 e "Você está na bolha!"
    E filled_quotas passa a 11

  Cenário: Corrida pela última cota
    Dado uma bolha com 99 de 100 cotas ocupadas
    Quando 100 compradores diferentes pedem 1 cota ao mesmo tempo
    Então exatamente 1 recebe 201 e 99 recebem 409 "QUOTA_SOLD_OUT", sem cobrança
    E filled_quotas + reserved_quotas = 100

  Cenário: A 101ª requisição depois da lotação
    Dado que a bolha acabou de lotar com 100 cotas pagas e explodiu
    Quando chega a 101ª requisição de cota
    Então ela recebe 409 "BUBBLE_NOT_ACTIVE" e nenhuma linha é alterada

  Cenário: PF tentando a 2ª cota
    Dado que já tenho 1 cota nesta bolha
    Quando peço outra cota
    Então recebo 409 "PF_QUOTA_LIMIT" com "Você já participa desta bolha"

  Cenário: Duas abas ao mesmo tempo
    Dado que confirmo em duas abas com Idempotency-Keys diferentes
    Então fico com exatamente 1 cota e a outra aba recebe 409 "PF_QUOTA_LIMIT"

  Cenário: Duplo clique
    Dado que repito a requisição com a mesma Idempotency-Key
    Então recebo a mesma resposta, com 1 cota e 1 cobrança

  Cenário: Criador tentando participar
    Dado que sou o criador desta bolha de venda
    Quando tento entrar
    Então recebo 409 "CREATOR_CANNOT_JOIN"
```

### US-022 — PJ compra várias cotas dentro do teto
**Épico:** E4 · **Sprint:** S3 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-034, RF-059, RN-002, RN-010

> **Como** TecnoLotes, comprando no atacado, **quero** adquirir várias cotas numa só operação, **para** abastecer meu estoque, respeitando o teto da bolha.

```gherkin
# language: pt
Funcionalidade: Aquisição de cotas PJ

  Cenário: Dentro do teto
    Dado uma bolha com max 100 e max_pj_share 50%, em que já tenho 45 cotas
    Quando peço mais 5
    Então recebo 201 e fico com 50

  Cenário: PJ estourando o teto
    Dado que tenho 45 cotas nessa bolha
    Quando peço mais 6
    Então recebo 409 "PJ_SHARE_EXCEEDED", com max_allowed 50 e already_held 45
    E a mensagem "Sua empresa pode ocupar no máximo 50 cotas nesta bolha"

  Cenário: PJ compra 100% de uma vez
    Dado uma bolha "ACTIVE" vazia, com max_pj_share 100% e max 30
    Quando peço 30 cotas no cartão
    Então a bolha vai direto de "ACTIVE" para "EXPIRED_SUCCESS", motivo FULL, na mesma transação

  Cenário: Pedido acima das vagas restantes
    Dado uma bolha com 8 vagas livres
    Quando peço 10
    Então recebo 409 "QUOTA_EXCEEDS_REMAINING", com remaining_quotas 8
```

### US-023 — Ver o preço cair a cada cota
**Épico:** E4 · **Sprint:** S3 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-037, RN-006

> **Como** participante, **quero** ver o preço cair quando um degrau é atingido, **para** convidar mais gente e saber quanto vou pagar.

```gherkin
# language: pt
Funcionalidade: Preço por degraus

  Cenário: Mudança de degrau
    Dado degraus 0→10000, 10→9000, 20→8000 (centavos) e filled 9
    Quando a 10ª cota é paga
    Então current_price passa a 9000 no mesmo bubble.updated em que filled_quotas = 10

  Cenário: Reserva Pix não muda o preço
    Dado filled 9 e uma reserva Pix pendente
    Então current_price continua 10000
```

### US-024 — Sair da bolha
**Épico:** E4 · **Sprint:** S3 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-039, RN-013

> **Como** Carlos, **quero** sair de uma bolha antes da última hora, **para** desistir sem custo.

```gherkin
# language: pt
Funcionalidade: Saída de cota

  Cenário: Saída permitida
    Dado que tenho 1 cota e faltam 3 h para a bolha acabar
    Quando saio
    Então recebo 204, a pré-autorização é liberada e o preço é recalculado para todos

  Cenário: Última hora
    Dado que faltam 40 min
    Então o botão "Sair da bolha" aparece desabilitado com "Saídas são bloqueadas na última hora para proteger o grupo"
    E a API responde 409 "BUBBLE_EXPIRING_LOCKED"

  Cenário: Criador da bolha de compra
    Dado que sou o criador de uma bolha de compra
    Quando tento sair
    Então recebo 409 "CREATOR_CANNOT_JOIN" e sou orientado a cancelar a bolha
```

---

## E5 — Tempo Real, Timers e Explosão (PRD RF02.1, RF05.1, RF08)

### US-025 — Ver o canvas mudar em tempo real
**Épico:** E5 · **Sprint:** S4 · **Estimativa inicial:** 8 pts
**Requisitos:** RF-017, RF-018, RF-064, RNF-002, RNF-018

> **Como** Carlos, **quero** ver as cotas e os preços mudarem ao vivo, **para** sentir o grupo se formando.

```gherkin
# language: pt
Funcionalidade: Tempo real

  Cenário: Atualização entre clientes
    Dado os clientes A e B vendo o mesmo tile
    Quando A adquire uma cota
    Então B vê o anel e o preço atualizados, com p99 < 200 ms do commit à renderização

  Cenário: Evento fora de ordem
    Dado que a bolha está na version 12 no cliente
    Quando chega um bubble.updated com version 11
    Então ele é descartado

  Cenário: Reconexão
    Dado que fico 20 s sem rede enquanto outras pessoas aderem
    Quando a conexão volta
    Então o cliente recarrega o snapshot e mostra o filled_quotas igual ao do banco

  Cenário: Outbox resiliente
    Dado que o relay cai depois do commit de uma cota
    Quando o relay volta
    Então o evento é publicado uma única vez para os consumidores
```

### US-026 — Bolha explode no horário
**Épico:** E5 · **Sprint:** S4 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-057, RF-058, RF-061, RN-009, RNF-004

> **Como** participante, **quero** que a bolha encerre exatamente no horário, **para** confiar no prazo anunciado.

```gherkin
# language: pt
Funcionalidade: Explosão por tempo

  Cenário: Meta atingida
    Dado uma bolha com min 40, filled 72 e expires_at às 18:00:00
    Quando o relógio chega às 18:00:00
    Então até 18:00:02 ela está "EXPIRED_SUCCESS", motivo TIME, com preço final R$ 80

  Cenário: Bolha expirando sem meta
    Dado uma bolha com min 40 e filled 35
    Quando expires_at chega
    Então ela vai para "EXPIRED_FAILED" e depois "CANCELLED"
    E todos os participantes são avisados do estorno integral

  Cenário: Reserva pendente não salva a meta
    Dado min 10, filled 9 e 1 reserva Pix pendente
    Quando expires_at chega
    Então a reserva é cancelada e a bolha vai para "EXPIRED_FAILED"

  Cenário: Bloqueio pós-explosão
    Dado uma bolha já explodida
    Quando alguém tenta entrar
    Então recebe 409 "BUBBLE_NOT_ACTIVE" com "Esta bolha já foi encerrada"

  Cenário: Worker reiniciado
    Dado que o worker reinicia 10 min antes de expires_at
    Então a explosão ainda ocorre em até 2 s após o horário
```

### US-027 — Bolha explode ao lotar
**Épico:** E5 · **Sprint:** S4 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-059, RN-010, RN-029

> **Como** participante, **quero** que a bolha feche assim que todas as cotas forem pagas, **para** garantir o melhor preço sem esperar o prazo.

```gherkin
# language: pt
Funcionalidade: Explosão por lotação

  Cenário: Última cota paga
    Dado uma bolha com 99 de 100 cotas pagas
    Quando a 100ª é paga no cartão
    Então na mesma transação a bolha fica "EXPIRED_SUCCESS", motivo FULL
    E todos na room recebem bubble.exploded

  Cenário: Últimas vagas só reservadas
    Dado filled 98 e 2 reservas Pix pendentes, com max 100
    Quando outra pessoa tenta entrar
    Então recebe 409 "QUOTA_SOLD_OUT" com "Cotas esgotadas — 2 reservas aguardando pagamento"
    E a bolha continua "ACTIVE" até os dois Pix serem pagos
```

### US-028 — Reconciliador recupera timers perdidos
**Épico:** E5 · **Sprint:** S4 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-060, RNF-004

> **Como** operador, **quero** um varredor que explode bolhas vencidas mesmo que o Redis perca os jobs, **para** nunca deixar uma bolha aberta além do prazo.

```gherkin
# language: pt
Funcionalidade: Reconciliador

  Cenário: Redis sem jobs
    Dado uma bolha publicada e o Redis esvaziado em seguida
    Quando expires_at passa
    Então a bolha explode em até 70 s, pelo reconciliador
    E o atraso aparece no alerta de SLO

  Cenário: Idempotência
    Dado que o job e o reconciliador processam a mesma bolha
    Então só uma transição e um BubbleExploded são registrados
```

### US-029 — Bolha que falha é cancelada
**Épico:** E5 · **Sprint:** S4 · **Estimativa inicial:** 2 pts
**Requisitos:** RF-062

> **Como** participante, **quero** que a bolha sem meta seja cancelada automaticamente, **para** saber logo que não vou pagar nada.

```gherkin
# language: pt
Funcionalidade: Desfecho de falha

  Cenário: Cancelamento automático
    Dado uma bolha "EXPIRED_FAILED"
    Então em até 5 s ela fica "CANCELLED" e o estorno integral é solicitado (E6)
```

### US-030 — Bolha de sucesso segue para a triagem
**Épico:** E5 · **Sprint:** S4 · **Estimativa inicial:** 2 pts
**Requisitos:** RF-063

> **Como** vendedor, **quero** que a bolha de sucesso abra a triagem sozinha, **para** começar a enviar.

```gherkin
# language: pt
Funcionalidade: Encaminhamento

  Cenário: Bolha de venda
    Dado uma bolha "EXPIRED_SUCCESS" com as capturas processadas
    Então ela fica "IN_TRIAGE" e TriageOpened é emitido

  Cenário: Bolha de compra
    Dado uma bolha de compra "EXPIRED_SUCCESS"
    Então ela só vai a "IN_TRIAGE" depois de BidSelected e das capturas
```

### US-031 — Ser avisado do que importa
**Épico:** E5 · **Sprint:** S4 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-079, RF-080

> **Como** participante, **quero** receber notificações in-app e por e-mail nos momentos-chave, **para** não perder prazos nem resultados.

```gherkin
# language: pt
Funcionalidade: Notificações

  Cenário: Explosão
    Quando uma bolha da qual participo explode
    Então em até 5 s tenho uma notificação in-app não lida
    E em até 1 min um e-mail é enfileirado, sem o meu CPF

  Cenário: Mudança de degrau só in-app
    Quando a bolha muda de degrau
    Então recebo notificação in-app e nenhum e-mail

  Cenário: Provedor de e-mail instável
    Dado que o provedor retorna erro temporário
    Então o envio é tentado de novo até 5 vezes, com backoff
```

### US-032 — Avisos de prazo
**Épico:** E5 · **Sprint:** S4 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-081, RF-016

> **Como** participante, **quero** ser avisado 1 h antes do fim da bolha e antes dos meus prazos, **para** agir a tempo.

```gherkin
# language: pt
Funcionalidade: Avisos

  Cenário: EXPIRING
    Dado uma bolha da qual participo
    Quando falta 1 h para expires_at
    Então recebo aviso in-app e por e-mail
    E o canvas mostra is_expiring = true

  Cenário: Janela de seleção de lance
    Dado que sou o criador de uma bolha de compra que explodiu com sucesso
    Quando faltam 2 h para o fim da janela de 24 h
    Então recebo o aviso "Escolha um lance"
```

### US-033 — Desligar e-mails não essenciais
**Épico:** E5 · **Sprint:** S4 · **Estimativa inicial:** 2 pts
**Requisitos:** RF-082

> **Como** usuário, **quero** desligar os e-mails não transacionais, **para** receber só o necessário.

```gherkin
# language: pt
Funcionalidade: Preferências

  Cenário: Desligar mudança de degrau
    Dado que desliguei os e-mails de "mudança de degrau"
    Quando a bolha muda de degrau
    Então não recebo e-mail, mas a notificação in-app é criada

  Cenário: Transacional obrigatório
    Então o toggle de "estorno realizado" aparece desabilitado
```

---

## E6 — Pagamento e Estorno (PRD RF07)

### US-034 — Entrar pagando com cartão
**Épico:** E6 · **Sprint:** S5 · **Estimativa inicial:** 8 pts
**Requisitos:** RF-047, RF-036, RN-007, RN-008
**Depende de:** contrato com o gateway (R4)

> **Como** Carlos, **quero** só reservar o valor no cartão ao entrar, **para** pagar de fato apenas se a bolha fechar.

```gherkin
# language: pt
Funcionalidade: Pré-autorização

  Cenário: Pré-autorização aprovada
    Dado uma bolha de venda com preço inicial R$ 100,00
    Quando entro com cartão
    Então R$ 100,00 é pré-autorizado no gateway e minha cota fica "ACTIVE"

  Cenário: Cartão recusado
    Quando o emissor recusa
    Então recebo 402 "PAYMENT_DECLINED" e nenhuma cota é criada

  Cenário: Autorizado, mas a bolha lotou
    Dado que a pré-autorização foi aprovada
    E a última vaga foi tomada um instante antes
    Então recebo 409 "QUOTA_SOLD_OUT" com "Nenhum valor foi cobrado"
    E o void da pré-autorização sai em até 10 s

  Cenário: Gateway fora do ar
    Quando o gateway não responde
    Então recebo 503 "PAYMENT_PROVIDER_UNAVAILABLE" e nenhuma vaga é ocupada
```

### US-035 — Entrar pagando com Pix
**Épico:** E6 · **Sprint:** S5 · **Estimativa inicial:** 8 pts
**Requisitos:** RF-048, RN-003, RN-029

> **Como** Carlos, sem cartão, **quero** entrar pagando com Pix e ter a vaga guardada enquanto pago, **para** participar mesmo assim.

```gherkin
# language: pt
Funcionalidade: Reserva Pix

  Cenário: Pix pago no prazo
    Dado que escolho Pix numa bolha com 2 dias restantes
    Então recebo o QR Code com reserved_until = agora + 15 min
    Quando pago em 5 min
    Então minha cota passa de "RESERVED" a "ACTIVE" e o preço é recalculado

  Cenário: Pix não pago
    Dado uma reserva criada há 15 min sem pagamento
    Então a vaga é liberada em até 1 min, sem penalidade de score

  Cenário: Pix pago depois do fim da bolha
    Dado que a bolha explodiu com a minha reserva pendente
    Quando pago o Pix
    Então recebo estorno integral automático em até 15 min

  Cenário: Últimos minutos
    Dado que faltam 4 min para o fim da bolha
    Então o Pix não é oferecido e a API responde 422 "PAYMENT_METHOD_UNSUPPORTED"

  Cenário: Prazo encurtado
    Dado que faltam 10 min para o fim da bolha
    Quando gero o Pix
    Então reserved_until = expires_at
```

### US-036 — Pagar só o preço final
**Épico:** E6 · **Sprint:** S5 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-049, RN-006, RN-007

> **Como** participante, **quero** pagar o preço final do degrau atingido, mesmo tendo entrado cedo, **para** receber o mesmo desconto que todos.

```gherkin
# language: pt
Funcionalidade: Captura do preço final

  Cenário: Captura parcial e estorno parcial
    Dado 3 participantes (cartão, cartão, Pix), preço inicial R$ 100 e preço final R$ 80
    Quando a bolha explode com sucesso
    Então os 2 cartões são capturados em R$ 80 cada
    E o Pix recebe estorno de R$ 20

  Cenário: Pré-autorização expirada
    Dado que a pré-autorização de 1 participante expirou
    Então o item dele vira "CANCELLED" (CAPTURE_FAILED), sem evento de score
    E os demais seguem para a triagem
```

### US-037 — Receber 100% de volta quando não dá negócio
**Épico:** E6 · **Sprint:** S5 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-051, RF-062, RN-030

> **Como** participante, **quero** receber 100% de volta se a bolha falhar ou for cancelada, **para** não correr risco financeiro.

```gherkin
# language: pt
Funcionalidade: Estorno integral

  Cenário: Bolha expirando sem meta
    Dado uma bolha com 35 participantes e meta de 40
    Quando ela expira
    Então em até 15 min 100% dos pagamentos estão "VOIDED" ou "REFUNDED", com o valor integral
    E a conciliação seguinte não aponta divergência

  Cenário: Saída de cota com Pix
    Dado que paguei R$ 100,00 por Pix e saio da bolha
    Então recebo estorno de R$ 100,00
```

### US-038 — Webhooks confiáveis
**Épico:** E6 · **Sprint:** S5 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-052, RNF-017

> **Como** plataforma, **quero** processar cada aviso do gateway exatamente uma vez, **para** nunca duplicar cotas, capturas ou estornos.

```gherkin
# language: pt
Funcionalidade: Webhooks Pagar.me

  Cenário: Webhook duplicado
    Dado o webhook "charge.paid" com id evt_123
    Quando ele chega 2 vezes
    Então as 2 respostas são 200
    E a cota Pix é confirmada uma única vez

  Cenário: Assinatura inválida
    Quando chega um webhook com assinatura inválida
    Então respondo 401 "WEBHOOK_SIGNATURE_INVALID" e nada muda

  Cenário: Fora de ordem
    Dado que "charge.paid" chega antes de "charge.created"
    Então o estado final do pagamento fica correto
```

### US-039 — Conciliação diária
**Épico:** E6 · **Sprint:** S5 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-053

> **Como** responsável financeiro, **quero** um relatório diário de divergências com o gateway, **para** detectar erros de dinheiro em até 1 dia.

```gherkin
# language: pt
Funcionalidade: Conciliação

  Cenário: Divergência detectada
    Dado um estorno no gateway sem registro local
    Quando a conciliação das 03:00 roda
    Então a divergência aparece no relatório
    E um alerta é disparado em até 5 min do fim do job
```

### US-040 — Cadastrar conta de recebimento
**Épico:** E6 · **Sprint:** S5 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-056

> **Como** vendedor (PJ, ou PF em C2C), **quero** cadastrar minha conta bancária como recebedor, **para** receber os repasses.

```gherkin
# language: pt
Funcionalidade: Recebedor

  Cenário: Sem recebedor
    Dado que não tenho recebedor aprovado
    Quando tento publicar uma bolha de venda ou dar um lance
    Então recebo 422 "RECIPIENT_REQUIRED"

  Cenário: Titularidade divergente
    Quando cadastro uma conta bancária de outro CPF
    Então o recebedor é recusado
```

### US-041 — Receber o repasse
**Épico:** E6 · **Sprint:** S5 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-054, RN-019, RN-028

> **Como** TecnoLotes, **quero** receber o valor de cada venda concluída, já descontada a taxa, **para** ter previsibilidade de caixa.

```gherkin
# language: pt
Funcionalidade: Repasse

  Cenário: Repasse após a janela de arrependimento
    Dado um item de R$ 80,00 entregue em D, sem arrependimento nem caso
    Quando D+7 termina
    Então o item fica "COMPLETED"
    E o repasse de R$ 75,20, menos a tarifa do gateway, é liberado em até 1 h

  Cenário: Caso aberto segura o repasse
    Dado um item com caso aberto
    Então nenhum repasse é liberado até a decisão
```

### US-042 — Ver meu histórico financeiro
**Épico:** E6 · **Sprint:** S5 · **Estimativa inicial:** 2 pts
**Requisitos:** RF-055

> **Como** usuário, **quero** ver autorizações, cobranças, estornos e repasses, **para** conferir meu dinheiro.

```gherkin
# language: pt
Funcionalidade: Extrato

  Cenário: Totais conferem
    Quando abro "Meus pagamentos"
    Então vejo cada movimento com bolha, valor, data e status
    E a soma bate com os registros de payments, refunds e payouts
```

---

## E7 — Lances Comerciais C2B/B2B (PRD RF04)

### US-043 — Enviar lance
**Épico:** E7 · **Sprint:** S5 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-040, RF-041, RN-014

> **Como** TecnoLotes, **quero** enviar um lance numa bolha de compra, **para** vender para um grupo já formado.

```gherkin
# language: pt
Funcionalidade: Lance

  Cenário: Lance válido
    Dado uma bolha de compra "ACTIVE" com preço-alvo R$ 60,00
    Quando envio um lance de R$ 55,00, com entrega em 10 dias
    Então recebo 201 e o criador é notificado

  Cenário: Lance acima do target
    Quando envio um lance de R$ 60,01
    Então recebo 422 "BID_ABOVE_TARGET" com "O lance precisa ser igual ou menor que o preço-alvo de R$ 60,00"

  Cenário: Lance no limite
    Quando envio um lance de exatamente R$ 60,00
    Então recebo 201

  Cenário: Bolha errada ou encerrada
    Quando envio um lance numa bolha de venda
    Então recebo 409 "WRONG_BUBBLE_TYPE"
    E numa bolha já explodida recebo 409 "BUBBLE_NOT_ACTIVE"

  Cenário: PF não dá lance
    Dado que sou PF
    Então recebo 403 "FORBIDDEN"
```

### US-044 — Ajustar ou retirar meu lance
**Épico:** E7 · **Sprint:** S6 · **Estimativa inicial:** 2 pts
**Requisitos:** RF-042

> **Como** TecnoLotes, **quero** melhorar ou retirar meu lance enquanto a bolha está aberta, **para** reagir à concorrência.

```gherkin
# language: pt
Funcionalidade: Substituição de lance

  Cenário: Novo lance substitui o anterior
    Dado que tenho um lance ativo de R$ 55,00
    Quando envio um de R$ 52,00
    Então o anterior fica "WITHDRAWN" e o novo vale, com o seu próprio submitted_at

  Cenário: Retirada após a explosão
    Dado que a bolha explodiu
    Quando tento retirar meu lance
    Então recebo 409 "BID_WITHDRAW_NOT_ALLOWED"
```

### US-045 — Comparar lances sem expor as empresas
**Épico:** E7 · **Sprint:** S6 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-043

> **Como** Carlos, **quero** comparar preço, prazo e score dos lances, **para** avaliar as ofertas, sem que as empresas se identifiquem antes da escolha.

```gherkin
# language: pt
Funcionalidade: Visibilidade dos lances

  Cenário: Lances pseudonimizados
    Dado uma bolha de compra "ACTIVE" com 3 lances
    Quando abro o detalhe
    Então vejo preço, prazo, condições e faixa de score de cada lance
    E as empresas aparecem só por pseudônimo, sem razão social nem CNPJ
```

### US-046 — Escolher o lance vencedor
**Épico:** E7 · **Sprint:** S6 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-044, RF-046, RF-050, RN-008, RN-015

> **Como** criador de bolha de compra, **quero** escolher o melhor lance em até 24 h, **para** fechar com o fornecedor que mais me convém.

```gherkin
# language: pt
Funcionalidade: Seleção de lance

  Cenário: Escolha dentro da janela
    Dado minha bolha de compra "EXPIRED_SUCCESS" há 3 h, com alvo de R$ 60,00
    Quando escolho o lance de R$ 50,00
    Então BidSelected é emitido e os participantes veem a razão social e o CNPJ da vencedora
    E cada cota no cartão é capturada em R$ 50,00 e cada Pix recebe estorno de R$ 10,00

  Cenário: Janela encerrada
    Dado que passaram 24 h desde a explosão
    Quando tento escolher
    Então recebo 409 "BID_SELECTION_WINDOW_CLOSED"

  Cenário: Não sou o criador
    Quando outra conta tenta escolher
    Então recebe 403 "FORBIDDEN"
```

### US-047 — Seleção automática
**Épico:** E7 · **Sprint:** S6 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-045, RN-015

> **Como** participante, **quero** que, sem escolha do criador, vença o menor lance, **para** a bolha não travar.

```gherkin
# language: pt
Funcionalidade: Fallback de seleção

  Cenário: Empate de preço
    Dado o lance A de R$ 50,00 às 10:00 e o lance B de R$ 50,00 às 09:00, sem escolha
    Quando a janela de 24 h termina
    Então B é selecionado em até 2 s

  Cenário: Sem lance válido
    Dado uma bolha de compra que explodiu sem nenhum lance
    Então ela vai para "CANCELLED" e todos recebem estorno integral
```

---

## E8 — Triagem, Score e Contestação (PRD RF05.2, RF05.3)

### US-048 — Acompanhar a triagem
**Épico:** E8 · **Sprint:** S6 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-065, RF-066, RN-016

> **Como** comprador ou vendedor, **quero** um painel com o status, os prazos e a próxima ação de cada item, **para** cumprir o combinado.

```gherkin
# language: pt
Funcionalidade: Painel de triagem

  Cenário: Itens criados
    Dado uma bolha com 7 compradores capturados e shipping_days 7
    Quando ela entra em "IN_TRIAGE"
    Então existem 7 itens "PENDING_SHIPMENT", com prazo = captura + 7 dias

  Cenário: Privacidade entre compradores
    Dado que sou comprador
    Quando tento abrir o item de outro comprador
    Então recebo 404 "NOT_FOUND"

  Cenário: Endereço só após a captura
    Dado que a captura do meu item ainda não ocorreu
    Então o vendedor não vê meu endereço
```

### US-049 — Registrar o envio
**Épico:** E8 · **Sprint:** S6 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-067, RN-021

> **Como** TecnoLotes, **quero** informar o código de rastreio, **para** cumprir o prazo e ganhar reputação.

```gherkin
# language: pt
Funcionalidade: Envio

  Cenário: Envio no prazo
    Dado um item "PENDING_SHIPMENT" com prazo amanhã
    Quando registro transportadora, rastreio e prazo estimado de 5 dias
    Então o item fica "SHIPPED" e ganho +5 de score

  Cenário: Não sou o vendedor
    Quando outra conta tenta registrar o envio
    Então recebe 403 "FORBIDDEN"
```

### US-050 — Envio atrasado e cancelamento
**Épico:** E8 · **Sprint:** S6 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-068, RN-016, RN-023

> **Como** comprador, **quero** poder cancelar e receber tudo de volta se o vendedor atrasar, **para** não ficar sem produto e sem dinheiro.

```gherkin
# language: pt
Funcionalidade: Atraso de envio

  Cenário: Item fica atrasado
    Dado que o prazo de envio venceu sem rastreio
    Então o item fica marcado "atrasado"
    E eu recebo a notificação com a opção "Cancelar"

  Cenário: Envio dentro da tolerância
    Dado um item atrasado há 2 dias
    Quando o vendedor registra o envio
    Então o item fica "SHIPPED" e o vendedor recebe −15, no lugar do +5

  Cenário: Fim da tolerância
    Dado um item atrasado há 3 dias e 1 s, sem envio
    Então ele fica "CANCELLED", recebo estorno integral e o vendedor recebe −60
    E um envio tentado depois disso → 409 "SHIPPING_DEADLINE_PASSED"

  Cenário: Comprador cancela durante o atraso
    Dado um item atrasado há 1 dia
    Quando cancelo
    Então o efeito é o mesmo: "CANCELLED", estorno integral e −60 para o vendedor
```

### US-051 — Confirmar o recebimento
**Épico:** E8 · **Sprint:** S7 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-069, RN-017

> **Como** comprador, **quero** confirmar que recebi, ou que isso aconteça sozinho, **para** o negócio seguir sem burocracia.

```gherkin
# language: pt
Funcionalidade: Recebimento

  Cenário: Confirmação manual
    Dado um item "SHIPPED"
    Quando confirmo o recebimento
    Então ele fica "DELIVERED", com confirmação BUYER

  Cenário: Confirmação automática
    Dado que o rastreio indica a entrega no dia D e eu não confirmo
    Quando D+7 chega
    Então o item fica "DELIVERED", com confirmação AUTO

  Cenário: Antes do envio
    Dado um item "PENDING_SHIPMENT"
    Quando tento confirmar o recebimento
    Então recebo 409 "TRIAGE_INVALID_TRANSITION"
```

### US-052 — Desistir da compra (arrependimento)
**Épico:** E8 · **Sprint:** S7 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-070, RN-018

> **Como** Carlos, **quero** desistir em até 7 dias após receber, **para** exercer meu direito de arrependimento sem penalidade.

```gherkin
# language: pt
Funcionalidade: Arrependimento

  Cenário: Dentro do prazo
    Dado um item entregue em 01/03
    Quando peço a desistência em 08/03 às 23:59 (horário de Brasília)
    Então o item fica "WITHDRAWAL_REQUESTED" e o repasse é bloqueado
    E nenhum evento de score negativo é gerado para mim

  Cenário: Fora do prazo
    Quando peço em 09/03
    Então recebo 409 "WITHDRAWAL_WINDOW_CLOSED"

  Cenário: Devolução confirmada
    Dado que devolvi o produto e o vendedor confirmou em 6 dias
    Então o item fica "CANCELLED" e recebo estorno integral

  Cenário: Devolução sem confirmação
    Dado que o vendedor não confirma a devolução em 10 dias
    Então um caso é aberto na fila de moderação
```

### US-053 — Abrir um caso de problema
**Épico:** E8 · **Sprint:** S7 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-071, RN-023

> **Como** comprador, **quero** abrir um caso quando o produto não chega ou vem errado, **para** que a plataforma resolva com justiça.

```gherkin
# language: pt
Funcionalidade: Caso de triagem

  Cenário: Abertura
    Dado um item "SHIPPED"
    Quando abro o caso "Não recebi", com descrição e 2 fotos
    Então os prazos automáticos e o repasse do item ficam pausados
    E o caso entra na fila de moderação

  Cenário: Fora da janela
    Dado um item "DELIVERED" há 8 dias
    Quando tento abrir um caso
    Então recebo 409 "TRIAGE_INVALID_TRANSITION"

  Cenário: Estorno parcial
    Dado um caso sobre um item de R$ 100,00
    Quando o moderador decide estorno parcial de R$ 30,00
    Então o item fica "COMPLETED" com valor de R$ 70,00 e taxa de R$ 4,20
    E o vendedor recebe −30

  Cenário: Improcedente
    Quando o moderador julga o caso improcedente
    Então o item retoma os prazos de onde parou
```

### US-054 — Encerrar a triagem da bolha
**Épico:** E8 · **Sprint:** S7 · **Estimativa inicial:** 2 pts
**Requisitos:** RF-072, RN-020

> **Como** plataforma, **quero** encerrar a bolha quando todos os itens terminarem, **para** fechar o ciclo e as métricas.

```gherkin
# language: pt
Funcionalidade: Fechamento

  Cenário: Pelo menos 1 concluído
    Dado 3 itens: "COMPLETED", "CANCELLED", "CANCELLED"
    Então a bolha fica "COMPLETED" e TriageClosed é emitido

  Cenário: Todos cancelados
    Dado 3 itens "CANCELLED"
    Então a bolha fica "CANCELLED"

  Cenário: Item pendente
    Dado 1 item ainda "DELIVERED"
    Então a bolha continua "IN_TRIAGE"
```

### US-055 — Score calculado por eventos objetivos
**Épico:** E8 · **Sprint:** S7 · **Estimativa inicial:** 8 pts
**Requisitos:** RF-073, RF-074, RF-075, RN-021, RN-033

> **Como** usuário, **quero** um score calculado só a partir do que realmente aconteceu, **para** que a reputação seja justa e previsível.

```gherkin
# language: pt
Funcionalidade: Cálculo do score

  Cenário: Conta nova
    Então meu score é 500, na faixa "Regular"

  Cenário: Transação concluída
    Quando um item meu como comprador chega a "COMPLETED"
    Então ganho +20 e o vendedor ganha +30
    E reprocessar o mesmo evento não duplica os pontos

  Cenário: Decaimento
    Dado um evento de −60 com 180 dias
    Então ele contribui −30

  Cenário: Limites
    Dado 1.000 eventos positivos
    Então o score fica em 1000

  Cenário: Score só informativo
    Dado uma conta com score 150 (faixa "Risco")
    Quando ela tenta entrar numa bolha
    Então a entrada não é bloqueada por causa do score
```

### US-056 — Entender meu score
**Épico:** E8 · **Sprint:** S7 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-076

> **Como** Carlos, **quero** ver por que meu score mudou, **para** confiar no sistema e melhorar.

```gherkin
# language: pt
Funcionalidade: Meu score

  Cenário: Extrato explicável
    Quando abro "Meu score"
    Então vejo cada evento com data, pontos, motivo, versão do modelo e contribuição atual
    E a soma do extrato é igual ao score exibido

  Cenário: Privacidade
    Quando outra conta abre o meu perfil
    Então vê a faixa e o score, mas não o extrato
```

### US-057 — Contestar um evento de score
**Épico:** E8 · **Sprint:** S7 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-077, RN-022

> **Como** TecnoLotes, **quero** contestar um evento negativo em até 5 dias, **para** corrigir uma penalidade injusta antes que ela conte.

```gherkin
# language: pt
Funcionalidade: Contestação

  Cenário: Dentro do prazo
    Dado um evento de −60 criado há 4 dias e 23 horas
    Quando contesto com justificativa e 2 anexos
    Então o evento fica "em revisão" e sai do cálculo do score até a decisão

  Cenário: Fora do prazo
    Dado um evento criado há 5 dias e 1 minuto
    Então recebo 409 "DISPUTE_WINDOW_CLOSED"

  Cenário: Segunda contestação
    Então recebo 409 "DISPUTE_ALREADY_OPEN"

  Cenário: Evento positivo
    Quando tento contestar um +30
    Então recebo 409 "SCORE_EVENT_NOT_DISPUTABLE"
```

### US-058 — Julgar contestação
**Épico:** E8 · **Sprint:** S7 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-078, RF-086, RN-022

> **Como** moderador, **quero** decidir as contestações com motivo registrado, **para** garantir o direito de defesa com imparcialidade.

```gherkin
# language: pt
Funcionalidade: Decisão de contestação

  Cenário: Procedente
    Dado uma contestação aberta há 2 dias úteis
    Quando a julgo procedente, com motivo
    Então o evento fica "REVERSED", o score é recalculado sem ele e o titular é notificado
    E audit_log registra o moderador, a data e o motivo

  Cenário: Imparcialidade
    Dado que fui eu quem decidiu o caso de origem
    Quando tento julgar a contestação
    Então recebo 403 "FORBIDDEN"

  Cenário: SLA estourado
    Dado uma contestação sem decisão há 5 dias úteis
    Então ela aparece destacada no topo da fila e gera alerta
```

---

## E9 — Qualidade, Segurança, Moderação, LGPD e Go-live (PRD RF09, RF01.4, RNF01–RNF06)

### US-059 — Suspender bolha irregular
**Épico:** E9 · **Sprint:** S7 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-083, RN-030

> **Como** moderador, **quero** suspender uma bolha fraudulenta e devolver tudo, **para** proteger os compradores.

```gherkin
# language: pt
Funcionalidade: Suspensão de bolha

  Cenário: Suspensão com participantes
    Dado uma bolha "ACTIVE" com 12 participantes
    Quando a suspendo com o motivo "fraude"
    Então ela fica "CANCELLED", os 12 pagamentos são estornados e 13 contas são notificadas

  Cenário: Sem motivo
    Quando tento suspender sem informar o motivo
    Então recebo 422 "VALIDATION_FAILED"
```

### US-060 — Suspender conta
**Épico:** E9 · **Sprint:** S7 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-084

> **Como** moderador, **quero** suspender uma conta abusiva, **para** conter o dano sem prejudicar quem já negociou com ela.

```gherkin
# language: pt
Funcionalidade: Suspensão de conta

  Cenário: Efeitos da suspensão
    Dado uma conta com 1 bolha "ACTIVE", 1 cota em bolha de terceiro e 1 triagem como vendedora
    Quando a suspendo
    Então a bolha dela vai para "CANCELLED", com estorno de 100%
    E a cota dela fica "RELEASED" e o preço daquela bolha é recalculado
    E a triagem continua, mas o repasse fica retido até a revisão
    E qualquer escrita da conta recebe 403 "ACCOUNT_SUSPENDED"
```

### US-061 — Denunciar bolha
**Épico:** E9 · **Sprint:** S7 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-085, RF-086

> **Como** usuário, **quero** denunciar uma bolha suspeita, **para** ajudar a manter a plataforma segura.

```gherkin
# language: pt
Funcionalidade: Denúncia

  Cenário: Denúncia registrada
    Quando denuncio uma bolha na categoria "enganoso", com descrição
    Então a denúncia entra na fila de moderação

  Cenário: Prioridade alta
    Dado 2 denúncias distintas nas últimas 24 h
    Quando uma 3ª pessoa denuncia
    Então a bolha fica com prioridade "HIGH" na fila

  Cenário: Denúncia repetida
    Quando o mesmo usuário denuncia de novo
    Então conta como 1 denúncia
```

### US-062 — Painel operacional
**Épico:** E9 · **Sprint:** S8 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-087, RNF-015

> **Como** operador de plantão, **quero** ver filas, timers, outbox e webhooks num painel, **para** agir antes que o usuário perceba.

```gherkin
# language: pt
Funcionalidade: Painel operacional

  Cenário: Timer atrasado
    Dado um job de expiração atrasado 6 s
    Então em até 1 min ele aparece no painel e o alerta de timer dispara

  Cenário: Webhooks falhando
    Dado 3% dos webhooks falhando em 5 min
    Então o alerta de webhook dispara
```

### US-063 — Trilha de auditoria
**Épico:** E9 · **Sprint:** S7 · **Estimativa inicial:** 3 pts
**Requisitos:** RF-088, RNF-021

> **Como** Jurídico, **quero** uma trilha imutável das ações sensíveis, **para** provar a conduta da plataforma.

```gherkin
# language: pt
Funcionalidade: Auditoria

  Cenário: Imutabilidade
    Quando a aplicação tenta UPDATE ou DELETE em audit_log
    Então o banco recusa por falta de permissão

  Cenário: Adulteração detectada
    Dado uma linha de audit_log alterada diretamente no banco
    Quando a verificação da cadeia de hash roda
    Então a quebra é detectada e alertada
```

### US-064 — Exportar meus dados
**Épico:** E9 · **Sprint:** S7 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-089

> **Como** titular, **quero** baixar meus dados, **para** exercer meus direitos de acesso e portabilidade (LGPD).

```gherkin
# language: pt
Funcionalidade: Exportação LGPD

  Cenário: Exportação completa
    Quando peço "Exportar meus dados"
    Então em até 15 dias recebo um link autenticado, válido por 7 dias
    E o JSON traz conta, consentimentos, cotas, lances, pagamentos, triagens e score
    E nenhum dado de terceiros além de pseudônimos

  Cenário: Pedido em andamento
    Dado uma exportação pendente
    Quando peço outra
    Então recebo 409 "EXPORT_ALREADY_IN_PROGRESS"
```

### US-065 — Corrigir meus dados
**Épico:** E9 · **Sprint:** S8 · **Estimativa inicial:** 2 pts
**Requisitos:** RF-090

> **Como** titular, **quero** corrigir nome, e-mail e endereço, **para** manter meus dados exatos.

```gherkin
# language: pt
Funcionalidade: Correção

  Cenário: Troca de e-mail
    Quando altero meu e-mail
    Então a troca só vale depois que eu clicar no link enviado ao novo endereço
    E a alteração fica em audit_log
```

### US-066 — Excluir minha conta
**Épico:** E9 · **Sprint:** S8 · **Estimativa inicial:** 5 pts
**Requisitos:** RF-091, RF-095

> **Como** titular, **quero** excluir minha conta quando não tiver mais negócios em andamento, **para** encerrar o tratamento dos meus dados.

```gherkin
# language: pt
Funcionalidade: Exclusão de conta

  Cenário: Com triagem aberta
    Dado que tenho uma triagem aberta
    Quando peço a exclusão
    Então recebo 409 "DELETION_BLOCKED_OBLIGATIONS", com a lista de pendências

  Cenário: Sem pendências
    Dado que não tenho cota ativa ou reservada, triagem aberta nem repasse pendente
    Quando peço a exclusão
    Então em até 15 dias meus dados pessoais ficam ilegíveis (crypto-shredding)
    E meu pseudônimo aparece como "Conta removida"
    E os registros financeiros ficam retidos pelo prazo legal

  Cenário: Expurgo por retenção
    Dado notificações com mais de 12 meses
    Quando o job diário roda
    Então elas são eliminadas e o relatório traz a contagem
```

### US-067 — Revogar consentimentos opcionais
**Épico:** E9 · **Sprint:** S8 · **Estimativa inicial:** 2 pts
**Requisitos:** RF-092

> **Como** titular, **quero** revogar comunicações e cookies opcionais, **para** controlar o uso dos meus dados.

```gherkin
# language: pt
Funcionalidade: Revogação

  Cenário: Revogação de comunicações
    Quando revogo as comunicações não transacionais
    Então em até 24 h nenhum envio desse tipo sai para mim
```

### US-068 — Falar com o encarregado
**Épico:** E9 · **Sprint:** S8 · **Estimativa inicial:** 1 pt
**Requisitos:** RF-093

> **Como** titular, **quero** um canal visível com o DPO, **para** tirar dúvidas e fazer solicitações.

```gherkin
# language: pt
Funcionalidade: Canal do encarregado

  Cenário: Protocolo
    Quando envio o formulário do encarregado
    Então recebo um número de protocolo e um e-mail de confirmação
```

### US-069 — Provar carga e concorrência
**Épico:** E9 · **Sprint:** S7 · **Estimativa inicial:** 8 pts
**Requisitos:** RNF-002, RNF-003, RNF-004, RNF-006, RNF-007, RNF-022

> **Como** PO, **quero** comprovar em teste de carga as metas técnicas do PRD, **para** aprovar o Gate E com evidência.

```gherkin
# language: pt
Funcionalidade: Teste de carga

  Cenário: Carga nominal
    Dado 10.000 conexões WS, 2.000 bolhas ativas e 50 cotas/s por 30 min
    Então o p99 do tempo real fica < 200 ms
    E o p99 de POST /quotas fica < 2 s
    E nenhum usuário legítimo recebe 429

  Cenário: Rajada na última cota
    Dado 1.000 requisições simultâneas pela última cota
    Então exatamente 1 tem sucesso e há 0 violações de invariante

  Cenário: 1.000 bolhas expirando juntas
    Então o p99 de exploded_at − expires_at fica ≤ 2 s
```

### US-070 — Auditoria de acessibilidade
**Épico:** E9 · **Sprint:** S8 · **Estimativa inicial:** 5 pts
**Requisitos:** RNF-012, RNF-020

> **Como** pessoa com deficiência, **quero** usar a plataforma com leitor de tela e teclado, **para** participar em igualdade.

```gherkin
# language: pt
Funcionalidade: WCAG 2.1 AA

  Cenário: Automática
    Quando o axe-core roda em todas as telas
    Então há 0 violações "serious" e "critical"

  Cenário: Manual
    Dado NVDA no Chrome e VoiceOver no iOS
    Então consigo me cadastrar, encontrar uma bolha, entrar, acompanhar a triagem e contestar o score

  Cenário: Movimento reduzido
    Dado prefers-reduced-motion ativo
    Então a explosão aparece como fade, sem animação
```

### US-071 — PWA e compatibilidade
**Épico:** E9 · **Sprint:** S8 · **Estimativa inicial:** 3 pts
**Requisitos:** RNF-013, RNF-014

> **Como** Carlos, **quero** instalar o Bolha Venda no celular e usá-lo no meu navegador, **para** acessar rápido.

```gherkin
# language: pt
Funcionalidade: PWA

  Cenário: Instalação
    Então a auditoria Lighthouse confirma que o app é instalável

  Cenário: Offline
    Dado que estou sem conexão
    Então vejo o shell e a última lista, com o aviso "sem conexão", e nenhuma ação transacional

  Cenário: Sem WebGL
    Dado um navegador sem WebGL
    Então vejo a lista alternativa com um aviso
```

### US-072 — Hardening de segurança e privacidade
**Épico:** E9 · **Sprint:** S8 · **Estimativa inicial:** 8 pts
**Requisitos:** RNF-010, RNF-011

> **Como** Tech Lead, **quero** fechar os controles de segurança e privacidade, **para** passar no pentest e cumprir a LGPD.

```gherkin
# language: pt
Funcionalidade: Segurança

  Cenário: Pentest
    Então não há achado crítico ou alto em aberto no Gate E

  Cenário: Logs sem PII
    Quando o scanner de PII roda sobre os logs de staging
    Então encontra 0 ocorrências de CPF, CNPJ ou e-mail

  Cenário: Incidente simulado
    Dado um vazamento simulado
    Então o plano prevê a comunicação à ANPD e aos titulares em até 3 dias úteis
```

### US-073 — Observabilidade e alertas
**Épico:** E9 · **Sprint:** S7 · **Estimativa inicial:** 3 pts
**Requisitos:** RNF-008, RNF-015

> **Como** on-call, **quero** traces, métricas de negócio e alertas por SLO, **para** detectar problemas em até 5 min.

```gherkin
# language: pt
Funcionalidade: Observabilidade

  Cenário: Trace ponta a ponta
    Quando entro numa bolha
    Então o mesmo trace_id aparece no front, na API e no worker

  Cenário: Alerta de SLO
    Dado o WS com p99 > 200 ms por 15 min
    Então o alerta dispara em até 5 min
```

### US-074 — Backup e restauração testados
**Épico:** E9 · **Sprint:** S8 · **Estimativa inicial:** 3 pts
**Requisitos:** RNF-009

> **Como** Tech Lead, **quero** um restore testado e cronometrado, **para** garantir RPO ≤ 15 min e RTO ≤ 4 h.

```gherkin
# language: pt
Funcionalidade: Recuperação

  Cenário: Restore cronometrado
    Quando restauro o PostgreSQL via PITR num ambiente isolado
    Então a perda medida é ≤ 15 min e o tempo total ≤ 4 h
    E a evidência é registrada no runbook
```

---

## Fontes consultadas (AlterEgo)

- **requirements-engineer** — *Manual de Processo — Fase 3 (Requisitos) e Fase 5 (UX)*, §5.2.1–5.2.2:
  - formato canônico "Como [papel], quero [ação], para [benefício]";
  - critérios INVEST (Independent, Negotiable, Valuable, Estimable, Small — cabe numa sprint, Testable);
  - critérios de aceite em BDD/Gherkin (Dado/Quando/Então).
- **qualidade-qa** — *Skill* (BDD como critério de aceite executável; Baraúna, *Cucumber e RSpec*, pp. 19–35): cenários escritos em português (`Dado`, `Quando`, `Então`) para ficarem legíveis para quem não programa, e ATDD como ponte entre critério de aceite e suíte de teste. Daí o `# language: pt` em todos os blocos.
- **qualidade-qa** — Roger S. Pressman, *Engenharia de Software*, pp. 442–443 (análise de valor-limite estendendo o particionamento de equivalência), base dos cenários de borda:
  - R$ 60,00 × R$ 60,01;
  - 4 d 23 h × 5 d + 1 min;
  - 45 + 5 × 45 + 6 cotas;
  - 7º × 8º dia do arrependimento;
  - 3 dias de tolerância + 1 s.
