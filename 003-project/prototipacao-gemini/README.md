# Protótipo Hi-Fi navegável — Bolha Venda (v2)

Protótipo de alta fidelidade para o **Gate A (S0)**, alinhado ao PRD v2.1, à Spec F1–F10, ao style guide, à especificação de telas e ao plano de acessibilidade (`002-llm/002 Docs/04-design/`).

A v2 parte do protótipo original do Gemini e incorpora o que o protótipo AlterEgo fazia melhor: menu, legenda, microcopy, telas internas, estados e acessibilidade. A versão anterior está preservada em `_v1-original/`.

## Como abrir

Não precisa instalar nada. Abra `index.html` no navegador (duplo clique funciona) ou sirva a pasta:

```bash
npx serve .
# ou
python -m http.server 8080
```

Sem internet, tudo funciona; só as fontes Inter e JetBrains Mono caem para as fontes do sistema.

## Telas (rotas)

| Rota | Tela |
| :--- | :--- |
| `#/` | T01 Canvas de bolhas + T03 detalhe (drawer no desktop, bottom sheet no mobile) |
| `#/lista` | T02 Lista acessível, sem reordenar sob o foco ("Atualizar ordem") |
| `#/b/{id}` | Abre o canvas com o detalhe da bolha |
| diálogos | T12 Entrar, T12p Pix, T12b Sair, T16a Lance, T16 Escolha de lance, T03c Denúncia, T22 Notificações |
| `#/criar` | T10 Criar bolha de venda (5 etapas) e T11 bolha de compra |
| `#/cadastro` | T05/T05a/T06 Cadastro PF ou PJ com verificação de CNPJ |
| `#/minhas-bolhas` | T17 Triagem do vendedor (abas, busca, envio individual e em lote, endereço com LGPD, casos) |
| `#/minhas-cotas` | T18/T19/T25 Item do comprador (linha do tempo, arrependimento, caso) |
| `#/score` | T20/T21 Meu score e contestação |
| `#/tokens` | Tokens, bolhas, componentes e estados |

## O que mudou em relação à v1

- **Bolhas de sabão em DOM real.** Película translúcida, borda colorida, reflexo iridescente e brilho especular. Cada bolha é um `<button>` com rótulo descritivo, então mouse, toque, teclado e leitor de tela usam a mesma camada.
- **Texto nunca sai da bolha.** O conteúdo fica num retângulo inscrito no círculo e muda de nível de detalhe pelo diâmetro na tela. Preços longos encolhem até caber.
- **Hover** aumenta a bolha em 6% com leve brilho.
- **Estouro.** Ao encerrar, a bolha balança, some e espalha gotículas e fragmentos iridescentes; depois reaparece como "Encerrada". Com movimento reduzido, vira um fade.
- **Menu do AlterEgo**: busca com atalho `/`, chips Venda/Compra, Categoria e Faixa de preço funcionais, "Só as que participo", Canvas | Lista, notificações e menu da conta.
- **Legenda no topo do canvas**: Venda, Compra, Quase cheia, Expirando, Encerrada e a contagem de bolhas na área.
- **Contador de término no detalhe.** Quando falta menos de 1 hora, um bloco vermelho no topo mostra `mm:ss` ao vivo e o aviso de saída bloqueada.
- **Mobile**: barra inferior (Explorar, Minhas, Criar, Avisos, Conta), bottom sheet com alça arrastável, pinça para zoom, filtros e busca em tela cheia, tabelas viram cartões.
- **Acessibilidade (WCAG 2.1 AA)**: skip links, foco visível âmbar de 3 px, alvos de 44 px, diálogos com foco preso e devolução de foco, uma região `aria-live` com throttling, resumo de erros com links, navegação espacial por setas, atalhos `+ − 0 L / ?`, `prefers-reduced-motion`, cor nunca como único canal.
- **Correções da v1**: contador do Pix real, rastreio sem `prompt()`, validação no wizard, bolha de compra implementada, tema claro completo, sem Tailwind CDN nem imagens externas.

## Painel do moderador

Botão "Moderador" no canto inferior esquerdo (no mobile, também no menu Conta). Permite:

- trocar a persona: Carlos (PF), TecnoLotes (PJ) ou Visitante;
- simular cota entrando e estourar a bolha aberta, ou pausar a simulação automática;
- forçar cenários de pagamento: cotas esgotadas, cartão recusado, Pix indisponível;
- forçar estados do mapa e da lista: carregando, vazio, offline;
- alternar tema claro e movimento reduzido, e pular para qualquer tela.

## Estrutura

```text
index.html
css/base.css        tokens, componentes, header, navegação, diálogos
css/canvas.css      canvas, bolhas de sabão, estouro, detalhe, lista
css/screens.css     telas internas
js/util.js          ícones, formatação, diálogos, anúncios, validações
js/data.js          estado e dados simulados
js/canvas.js        pan, zoom, pinça, LOD, teclado, minimapa, estouro
js/detail.js        detalhe da bolha
js/modals.js        entrar, Pix, sair, lance, denúncia, atalhos
js/screens/*.js     lista, criar, cadastro, triagens, score, tokens
js/app.js           roteador, header, filtros, moderador, tempo real
```
