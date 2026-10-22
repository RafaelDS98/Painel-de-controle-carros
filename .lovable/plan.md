# Módulo Vistorias (substituto do VEX) — Roadmap

Módulo novo dentro do painel ANPEXC, com o mesmo login, cores, logo e banco. Fica em `/vistorias`, com menu lateral próprio e um botão fixo **"Voltar ao painel ANPEXC"** no topo e no menu. Também pode abrir direto por um subdomínio (ex.: vistorias.anpexc.app) depois.

A vistoria é feita pelo celular, no navegador, dentro do próprio painel (sem instalar app).

## Etapa 0 — Roadmap e base (esta entrega começa aqui)
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

## Etapa 5 — Histórico do VEX e extras
- Importar vistorias antigas do VEX (precisaremos de exportação Excel/CSV e, se possível, fotos).
- Extras avaliados depois: checklist por link (autoinspeção do cliente sem login), leitura de placa pela câmera, cerco geográfico.

## Fora do escopo (não usados hoje pela operação)
Classificação e modelos de veículos, claviculário, fila de vistorias, bilhetagem de e-mails, histórico de versão de dados, versões de aplicativo/dispositivos.

## Detalhes técnicos
- Rotas em `src/routes/_authenticated/vistorias.*` com layout próprio (Outlet) reaproveitando o shell/tema; botão de retorno para `/home`.
- Tabelas novas: `inspection_operation_types`, `inspection_questionnaires`, `inspection_questions`, `inspection_photo_slots`, `inspections`, `inspection_answers`, `inspection_photos`, `inspection_damages`, `inspection_clients`; veículo via `vehicles.id`/placa normalizada; RLS com `has_permission()`; nº sequencial por trigger; cancelamento por função protegida e log de alterações.
- Bucket privado `vistorias` para fotos/assinaturas (links temporários), compressão da foto no celular antes do envio.
- PDF do laudo gerado no navegador; Ao Vivo via Realtime.
- Permissões novas entram em PERMISSIONS, `permission_default()` e `get_my_permissions()` juntas.
- Testes para regras de cancelamento, numeração, filtros e comparação de vistorias.
