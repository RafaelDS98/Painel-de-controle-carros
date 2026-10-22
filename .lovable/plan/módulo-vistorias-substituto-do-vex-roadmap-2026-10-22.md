# Módulo Vistorias (substituto do VEX) — Roadmap

Módulo novo dentro do painel ANPEXC, com o mesmo login, cores, logo e banco. Fica em `/vistorias`, com menu lateral próprio e um botão fixo **"Voltar ao painel ANPEXC"** no topo e no menu. Sem subdomínio: o acesso é só pelo próprio painel.

A vistoria é feita pelo celular, no navegador, dentro do próprio painel (por enquanto sem app instalável; as regras e dados ficam no banco para que o futuro aplicativo reaproveite tudo sem retrabalho).

## Etapa 0 — Roadmap, base e acesso direto (esta entrega começa aqui)
- **Acesso direto "como aplicativo":** abrir `anpexc.app/vistoria` já mostra a tela de login com a marca ANPEXC Vistorias; depois do login o usuário cai direto na tela inicial do vistoriador, não na Home do painel.
- **Tela inicial do vistoriador (celular):** botão grande "Nova vistoria", campo de placa logo no topo (digitar ou escolher da frota), atalhos para os tipos de operação mais usados (ex.: Entrada manutenção, Saída manutenção — tipos, grupos e campos da vistoria são criados e editados pelo Master, ex.: campos "Foto da placa", "Foto da lateral" dentro do grupo "Avarias", com tipo de campo, obrigatoriedade e ordem; a tela do vistoriador monta o checklist a partir dessa configuração), lista "Continuar rascunho" e "Minhas vistorias de hoje". Do login ao checklist em 2 toques.
- **Instalar na tela do celular:** botão "Adicionar à tela inicial" que cria um ícone ANPEXC Vistorias no celular, abrindo em tela cheia direto em `/vistoria`, como um app, sem loja.
- **Login lembrado:** sessão continua aberta no celular por até 12h (não pede senha toda vez); sair só pelo menu.
- **Quem só faz vistoria:** perfis/usuários com apenas a permissão de vistoria sempre entram direto nessa tela; quem tem mais acessos vê o botão "Voltar ao painel ANPEXC".
- Mesmo login do painel (mesma conta e senha), sem cadastro separado.
- Registrar este roadmap em `roadmap.md` e as regras no AGENTS.md.
- Estrutura do módulo: menu lateral próprio (Página inicial, Vistorias, Nova vistoria, Localizar por placa, Ao Vivo, Clientes, Relatórios, Configurações), botão de voltar ao ANPEXC e atalho "Vistorias" no menu do painel.
- Permissões novas na tela de Permissões (acessar módulo, fazer vistoria, cancelar, configurar), Master controla.

## Etapa 1 — Fazer vistoria + consultar (primeira versão utilizável)
- Configuração mínima já pronta: tipos de operação (Entrada/Saída manutenção, Entrega/Devolução reserva, Entrega/Devolução definitiva, Saída/Retorno demanda, Implantação, Cautelar) e questionários (Automóvel, Utilitário, Moto, Van/Ônibus, Cautelar) com perguntas e fotos obrigatórias.
- **Nova vistoria (celular):** escolher placa da frota cadastrada (mesma base de Veículos), tipo de operação, questionário, cliente, motorista, KM, combustível; responder checklist (OK / avaria / N.A.), fotos pela câmera com data/hora, marcação de avarias com foto e observação, assinatura do vistoriador e do motorista na tela. Salva rascunho para não perder se a internet cair no meio.
- **Lista de vistorias:** filtros do VEX (período, tipo de operação, tipo base, placa, chassi, frota, vistoriador, cliente, status, com/sem avaria), tabela paginada, totalizadores por tipo/operação/vistoriador, exportação CSV/Excel.
- **Detalhe:** respostas, galeria de fotos com ampliar, histórico, laudo em PDF para baixar/compartilhar, cancelamento (com motivo e regra de permissão).
- **Localizar por placa:** linha do tempo das vistorias do veículo e comparação lado a lado de duas vistorias (ex.: entrega x devolução para achar avaria nova).
- Integração com o painel: vistoria de Entrada/Saída manutenção pode registrar a entrada/saída no Pátio do veículo.
- **Tela do checklist igual ao app VEX:** três abas (Campos / Checklist / Fotos); cada item com botões grandes de toque — Bom (verde), Ruim (vermelho), Atenção/reparo (amarelo), N/A — e etiqueta "Obrigatório"; não deixa concluir com obrigatório em branco. Fotos com moldura-guia (Frente, Lateral dianteira direita, Traseira…).
- **Tipos base de vistoria (mesmo fluxo do VEX):**
  - Pré-vistoria (empresa > empresa): fotos e dados antes de escolher o cliente.
  - Entrega (empresa > cliente): pode puxar os dados de uma pré-vistoria.
  - Cautelar (empresa > cliente): atualização intermediária opcional entre entrega e coleta.
  - Coleta (cliente > empresa): devolução; puxa a entrega anterior para comparar e apontar avarias novas.
  - Coleta com entrega (empresa > cliente > empresa): coleta e entrega numa só vistoria; só é concluída depois da assinatura de entrega.
  - Autoinspeção (cliente > empresa): feita por link (Etapa 5).
- **Assinatura digital** do vistoriador e do cliente/motorista na tela, gravada no laudo.
- **Sem internet (modo offline básico):** o checklist e as fotos ficam guardados no celular e são enviados sozinhos quando a conexão volta, com aviso "pendente de envio". (Offline completo, abrindo o sistema sem nenhuma internet, fica para o futuro aplicativo.)

## Etapa 2 — Página inicial e Ao Vivo
- KPIs (hoje, mês, veículos, vistoriadores ativos), Top 5 vistoriadores, gráfico dos últimos 7 dias, últimas 10 vistorias.
- Ao Vivo: quadro com uma coluna por tipo de operação, cartões com placa/modelo/data/contador de avarias, rolagem por coluna, busca por placa, atualização em tempo real.

## Etapa 3 — Configurações completas
- Editor de questionários (criar, copiar, ordenar, perguntas, fotos exigidas, nº de pneus, ativar/inativar).
- Tipos de operação editáveis (tipo base Coleta/Entrega, questionários permitidos).
- Campos fixos e personalizados da vistoria; textos do laudo PDF e termo de aceite.

## Etapa 4 — Clientes, e-mails e relatórios
- Cadastro de clientes (com contatos e e-mails que recebem laudo).
- Envio automático do laudo por e-mail ao concluir a vistoria (modelos baseados nos HTML enviados).
- Relatórios: quantidade por período, por vistoriador, exportação, histórico de alterações.

## Etapa 5 — Recursos avançados de campo
- **Começar vistoria pela placa (câmera):** na tela do vistoriador, botão de câmera ao lado do campo placa; aponta para o carro, a placa é lida automaticamente, conferida com a frota cadastrada e a vistoria já abre com o veículo preenchido. Também lê QR Code/código de barras (ex.: etiqueta no para-brisa). Se não reconhecer, digita normalmente.
- **Cerco geográfico:** Master cadastra áreas autorizadas no mapa (pátio, lojas, oficinas) com raio; cada tipo de operação pode exigir estar dentro de uma área. Ao iniciar/concluir, o celular informa a localização; fora da área a vistoria é bloqueada (ou só sinalizada, conforme configuração). Localização fica gravada na vistoria e aparece no detalhe/mapa.
- **Checklist por link (autoinspeção):** o painel gera um link único e com validade para enviar por WhatsApp ao cliente/motorista; ele faz o checklist e as fotos obrigatórias pelo celular sem login, assina e envia. A vistoria entra marcada como "Autoinspeção" para revisão.
- **Mapa das vistorias:** na Página inicial, mapa com as vistorias do dia pela localização registrada.

## Etapa 6 — Histórico do VEX
- Importar vistorias antigas do VEX (precisaremos de exportação Excel/CSV e, se possível, fotos).

## Fora do escopo (não usados hoje pela operação)
Classificação e modelos de veículos, claviculário, fila de vistorias, bilhetagem de e-mails, histórico de versão de dados, versões de aplicativo/dispositivos.

## Detalhes técnicos
- Rotas em `src/routes/_authenticated/vistorias.*` com layout próprio (Outlet) reaproveitando o shell/tema; botão de retorno para `/home`.
- Tabelas novas: `inspection_operation_types`, `inspection_questionnaires`, `inspection_questions`, `inspection_photo_slots`, `inspections`, `inspection_answers`, `inspection_photos`, `inspection_damages`, `inspection_clients`; veículo via `vehicles.id`/placa normalizada; RLS com `has_permission()`; nº sequencial por trigger; cancelamento por função protegida e log de alterações.
- Bucket privado `vistorias` para fotos/assinaturas (links temporários), compressão da foto no celular antes do envio.
- PDF do laudo gerado no navegador; Ao Vivo via Realtime.
- Permissões novas entram em PERMISSIONS, `permission_default()` e `get_my_permissions()` juntas.
- Testes para regras de cancelamento, numeração, filtros e comparação de vistorias.

---

# Parte 2 — Layout visual do módulo Vistorias

Estrutura de telas baseada nos prints do VEX, mas com a identidade ANPEXC (cores azul/âmbar, fonte, logo, tema claro/escuro e o mesmo topo do painel). Nada do verde VEX.

## Moldura geral (computador)
```text
+--------------------------------------------------------------+
| [logo ANPEXC] Vistorias   | busca | tema | usuário | <- Painel |
+-----------+--------------------------------------------------+
| Início    |  Título da tela            [ação principal]      |
| Vistorias |  Filtros (linha compacta, recolhível)            |
| Nova      |  Conteúdo (cartões / tabela / quadro)            |
| Placa     |                                                  |
| Ao Vivo   |                                                  |
| Clientes  |                                                  |
| Relatórios|                                                  |
| Config. > |                                                  |
| <- Painel |                                                  |
+-----------+--------------------------------------------------+
```
- Menu lateral próprio do módulo, recolhível, com subitens (Configurações > Tipos de operação, Grupos e campos, Questionários, Áreas no mapa, E-mails, Laudo PDF). Mesmo comportamento do menu atual (dicas ao passar o mouse, lista flutuante quando recolhido).
- Botão "Voltar ao painel ANPEXC" no topo e no rodapé do menu.

## Telas (computador)
1. **Página inicial** — 5 cartões de indicador no topo (Hoje, Mês, Veículos, Vistoriadores ativos, Com avaria); abaixo duas colunas: Top 5 vistoriadores (barras) e Últimos 7 dias (linha); depois Últimas vistorias (tabela curta com link do laudo) ao lado do Mapa das vistorias com botão tela cheia.
2. **Vistorias (lista)** — filtros em grade compacta (Período, Tipo de operação, Tipo base, Placa, Chassi, Frota, Vistoriador, Cliente, Status, Avaria) com "Mais filtros"; tabela com selo de placa, ícones de laudo/histórico e botão de expandir linha; rodapé com paginação e três quadros de totais (por tipo, por operação, por vistoriador) e botões CSV/Excel.
3. **Detalhe da vistoria** — cabeçalho escuro com placa, modelo, ano, KM, vistoriador, data e botões Ver laudo / Baixar / Enviar WhatsApp; abas Resumo · Checklist · Fotos · Avarias · Histórico. Aba Fotos = galeria: miniaturas à esquerda, foto grande à direita, "Ver original" e setas.
4. **Localizar por placa** — campo de placas em "etiquetas" (várias placas, pesquisa exata/parcial); resultado com dados do veículo, local atual no Pátio e linha do tempo de vistorias; botão "Comparar" abre duas vistorias lado a lado (fotos e itens diferentes destacados em vermelho).
5. **Ao Vivo** — quadro com uma coluna por tipo de operação, contador no título, rolagem própria em cada coluna e rolagem horizontal geral; cartão com placa (selo escuro), modelo, data/hora, ícone do laudo e etiqueta de avarias (verde "0 avarias" / vermelha "N avarias"); busca por placa no topo; clicar no cartão abre o detalhe em painel lateral.
6. **Configurações** — lista em tabela (ID, nome, ordem editável, botões Perguntas/Fotos, status Ativo, Copiar). Editor de grupos e campos: cada grupo é um bloco recolhível com contador de campos e botões adicionar/editar/excluir; campos em linhas com tipo, "Obrigatório" e reordenação arrastando.
7. **Clientes e Relatórios** — mesmo padrão de lista com filtros + tabela + exportação; relatórios com gráficos por período.

## Telas do vistoriador (celular)
```text
+----------------------+
| ANPEXC Vistorias  [=]|
| Olá, Fulano          |
| [ Placa ______ ][cam]|
| [   NOVA VISTORIA   ]|
| Atalhos: Entrada |   |
|          Saída  ...  |
| Continuar rascunho   |
| Minhas de hoje       |
+----------------------+
```
- **Início rápido:** saudação, campo de placa grande com botão de câmera, botão "Nova vistoria" ocupando a largura, atalhos de tipo de operação em botões, rascunhos e vistorias do dia.
- **Assistente da vistoria:** topo fixo com placa, tipo e questionário; três abas Campos · Checklist · Fotos; barra de progresso.
- **Checklist:** um cartão por item com 4 botões grandes de toque (Bom verde, Ruim vermelho, Atenção amarelo, N/A) e etiqueta "Obrigatório"; avaria abre foto + observação.
- **Fotos:** grade 2 colunas com molduras-guia (Frente, Lateral dianteira direita…), selo "Obrigatório", botão câmera flutuante.
- **Assinaturas e conclusão:** tela de assinatura em tela cheia (vistoriador e cliente), resumo e botão "Concluir"; aviso "pendente de envio" quando sem internet.
- Botões com no mínimo 44px, textos legíveis no sol (alto contraste), funciona deitado ou em pé.

## Padrões visuais
- Cores do ANPEXC já existentes: azul principal, âmbar de destaque; verde/vermelho/amarelo só para estado (Bom/Ruim/Atenção, avarias).
- Selo de placa no mesmo estilo branco do painel; números grandes nos indicadores; tabelas compactas como nas telas de O.S.
- Estados vazios com ícone e frase curta (ex.: "Nenhuma vistoria neste tipo de operação").
- Tudo validado em claro/escuro, computador (1280) e celular (390).

## Ordem de construção do layout (acompanha o roadmap)
- Etapa 0: moldura do módulo, menu, topo, botão voltar, início rápido do celular e login direto.
- Etapa 1: assistente da vistoria (celular), lista, detalhe/galeria, localizar por placa e comparação.
- Etapa 2: página inicial e Ao Vivo.
- Etapa 3: telas de configuração e editor de grupos/campos.
- Etapa 4+: clientes, relatórios, mapa, autoinspeção por link (mesmo assistente sem menu).
