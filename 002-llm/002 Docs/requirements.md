# Especificação de Requisitos - Bolha Venda (Sales Bubble)

Este documento detalha os **Requisitos Funcionais (RF)** e **Requisitos Não-Funcionais (RNF)** para a plataforma Bolha Venda.

---

## 1. Requisitos Funcionais (RF)

### RF01 - Gestão de Usuários e Autenticação
- **RF01.1**: O sistema deve permitir o cadastro de Usuários Pessoas Físicas (CPF) e Pessoas Jurídicas / Empresas (CNPJ).
- **RF01.2**: O sistema deve diferenciar as permissões e limites de atuação entre contas de Usuário e contas de Empresa.
- **RF01.3**: O sistema deve permitir login via e-mail/senha e autenticação social.

### RF02 - Canvas Interativo de Bolhas (Visual Whiteboard)
- **RF02.1**: O sistema deve disponibilizar um canvas visual (folha em branco com bolhas dinâmicas).
- **RF02.2**: O canvas deve permitir navegação fluida por Pan (clicar, segurar e arrastar o cursor) e Zoom (scroll do mouse ou pinch-to-zoom).
- **RF02.3**: As bolhas devem exibir visualmente o progresso das cotas, preço inicial, preço-alvo, tempo restante e tipo (Venda ou Compra).

### RF03 - Criação e Gestão de Bolhas
- **RF03.1 - Bolhas de Venda (Empresas)**: Empresas podem criar bolhas de venda definindo produto, lote total de cotas, preço inicial, preço de desconto final e tempo de expiração.
- **RF03.2 - Bolhas de Compra (Usuários/Empresas)**: Usuários ou Empresas podem criar bolhas indicando intenção de compra de produtos/peças, preço desejado e tempo limite.
- **RF03.3**: Criadores de bolhas de compra podem indicar fornecedores/empresas recomendadas para receberem notificação da bolha.

### RF04 - Regras de Entrada e Adesão em Cotas
- **RF04.1**: Usuários (PF) podem adquirir **apenas 1 cota por bolha**.
- **RF04.2**: Empresas (PJ) podem adquirir **múltiplas cotas por bolha**.
- **RF04.3**: A entrada em uma cota deve recalcular instantaneamente o preço atual da bolha baseado na curva de desconto.

### RF05 - Submissão de Lances por Empresas (C2B / B2B)
- **RF05.1**: Empresas cadastradas podem visualizar bolhas de compra criadas por usuários e submeter lances comerciais (preço e prazo de entrega).
- **RF05.2**: O criador da bolha de compra ou os participantes podem aceitar ou comparar lances das empresas.

### RF06 - Encerramento e Explosão da Bolha
- **RF06.1**: Toda bolha deve possuir um temporizador pré-definido.
- **RF06.2**: Ao atingir 00:00:00 ou atingir 100% das cotas, a bolha "explode" (encerrando a fase de adesão).
- **RF06.3**: O sistema deve notificar todos os participantes e o criador no momento do encerramento.

### RF07 - Triagem Pós-Encerramento e Score
- **RF07.1**: Após a explosão, o sistema abre uma etapa de **Triagem** para conectar criador e compradores de cotas.
- **RF07.2**: As partes confirmam o cumprimento do acordo (envio do produto, pagamento, aceitação).
- **RF07.3**: O sistema calcula e atualiza o **Score de Reputação** do comprador e do vendedor com base no desfecho da triagem.

---

## 2. Requisitos Não-Funcionais (RNF)

### RNF01 - Desempenho e Renderização do Canvas
- **RNF01.1**: O canvas deve renderizar até 500 bolhas simultâneas mantendo no mínimo 60 FPS durante operações de pan e zoom.
- **RNF01.2**: O tempo de resposta para atualização de entrada de cotas no canvas via WebSockets deve ser inferior a 200ms.

### RNF02 - Escalabilidade e Concorrência
- **RNF02.1**: O motor de temporizadores e explosão de bolhas deve suportar disparos simultâneos sem atrasos superiores a 2 segundos.
- **RNF02.2**: O banco de dados deve tratar acessos concorrentes à última cota disponível em uma bolha de forma atômica (prevenindo overbooking de cotas).

### RNF03 - Usabilidade e Acessibilidade
- **RNF03.1**: A interface de navegabilidade do canvas deve ser intuitiva em dispositivos Desktop (mouse/trackpad) e Mobile (touchscreen).
- **RNF03.2**: Cores das bolhas devem possuir alto contraste e sinalização visual clara sobre o status (Ativa, Quase Cheia, Expirando, Encerrada).

### RNF04 - Segurança e Conformidade
- **RNF04.1**: Dados sensíveis de usuários (CPF/CNPJ, e-mail) devem ser armazenados com criptografia em conformidade com a LGPD.
- **RNF04.2**: Todas as requisições de compra de cotas e criação de bolhas devem ser autenticadas via JSON Web Tokens (JWT).
