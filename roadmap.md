- [x] Exibir previsão original e atual na ficha e permitir editar o prazo atual com as permissões existentes.
- [x] Mostrar situação do prazo na grade, tabela e ficha, inclusive conclusão com base no histórico.
- [x] Confirmar importação existente e verificar os cenários de prazo solicitados.
- [x] Criar agendamento manualmente com data, hora e placa obrigatórias.
- [x] Editar os campos da ficha com a trava existente e salvar somente alterações reais.
- [x] Validar criação e edição reais com uma conta master autorizada; remover o agendamento temporário.
- [x] Registrar retrabalho como novo agendamento vinculado, sem editar o original.
- [x] Exibir vínculo, motivo, badge, filtro e indicador de retrabalhos.
- [x] Verificar criação e filtro no painel; remover os registros temporários.
- [x] Exportar agendamentos filtrados para edição em lote com ID real e campos editáveis.
- [x] Reimportar alterações por ID, sem criar registros, preservando permissões e histórico.
- [x] Mostrar resumo e erros por linha; validar reimportação sem alterações e edição parcial.
- [x] Abrir detalhes dos indicadores calculados sobre os agendamentos filtrados.
- [x] Aplicar atalhos de período e mostrar entregas pendentes hoje e nesta semana.
- [x] Registrar e listar contatos na ficha; verificar os três fluxos no painel.
- [x] Configurar situações e campos exclusivamente pelo master com regras protegidas no banco.
- [x] Aplicar campos e situações dinâmicos à ficha, busca, prazos e atualização em lote.
- [x] Verificar migração de mecânicos e fluxos reais sem deixar dados de teste.
- [x] Prioridade: atendimento não altera urgência (banco), toggle na ficha, ordenação "Prioridade" padrão e selo Urgente.
- [x] Aba Usuários e permissões (master) com seleção de perfil.
- [x] Lote 4: filtros ativos sincronizados, detalhes de indicadores e histórico de placas em todas as listas.
- [x] Verificar TSC, testes e fluxo master no navegador; separar testes reais de leitura.
- [x] Limite de edições configurável pelo master (perfil e usuário).
- [x] Cor livre nas Situações (seletor de cor).
- [x] Sincronização SGLOC → painel (simulação, manual, tela, rota do tick, testes).
- [x] Previsão de entrega 1x para atendimento/oficina com liberação por gerente/master; Oficina edita encaminhados e não cria.
- [ ] Cadastrar a tarefa agendada de 15 min chamando a rota do tick (bloqueado: sem mecanismo de agendamento da plataforma disponível ao agente; pg_cron não aprovado).
- [x] Importação manual: grava linha a linha com resumo (criados/ignorados/erros por linha), leva a grade à semana importada; agenda recarrega a cada 2 min e ao voltar à aba; aviso de carga/sincronização falha, atrasada ou em simulação.
- [x] Agenda recarrega na hora após sincronizar/simular/importar, com aviso do que entrou.
- [x] Loja, Marca, Operador, Mecânico e Local/Oficina como listas com "Adicionar ...", aba Configurações > Listas, importação/sincronização cadastram o que falta, loja sem ID SGLOC bloqueia só o envio dela.
- [x] Perfil Oficina operacional + aba Oficina (vê/edita todos os ativos, sem criar/importar/lote/excluir/urgência).
- [x] Campo Setor no usuário (lista "Setores", semeada com Oficina).
- [x] Limite de alterações da Previsão de Entrega por perfil/usuário (Atendimento e Oficina, padrão 1).
- [x] Lote A: auto-sync desligável, Atualizar do SGLOC, filtro Setor, gestão de listas (gerente/master)
- [x] Fluxo de trabalho com Claude direto no GitHub documentado no AGENTS.md (sem créditos do Lovable).
- [x] Envio ao SGLOC: motivo visível quando integração/escrita está desligada (aviso na tela + push_failed com "Reenviar" na criação).
- [ ] Envio ao SGLOC: confirmar no Supabase `sgloc_settings` (enabled e write_enabled = true) e que o operador tem conta SGLOC conectada; criar novo atendimento no painel e ver o resultado (Enviado ao SGLOC / motivo da falha).
- [ ] Instalar Node/Bun na máquina do Rafael para rodar o painel e os testes localmente.

- [x] Limpar a main: remover pastas de skills do Claude enviadas por engano; especificação de O.S movida para docs/.
- [x] Módulo de O.S. ligado ao banco real: lista, nova O.S. (também a partir de agendamento), ficha com itens, situação, finalizar e observações.
- [x] Centros de custo cadastrados a partir da lista enviada.
- [ ] O.S.: pagamentos, compras, cotações, anexos e envio ao SGLOC (próximas etapas).
- [x] Plano de próximos passos para reduzir retrabalho (entregue ao Rafael).

- [x] Consultas → Veículos / O.S.: busca detalhada de O.S. com filtros do SGLOC, total e Excel; 2.082 O.S. importadas (01/08–16/10/2026); montadoras cadastradas.
- [ ] Lojas das O.S. importadas — aguardando lista completa de lojas (código e nome) e planilha com a coluna Loja.
- [ ] Filtros sem dados ainda: montadora por O.S., categoria do veículo, cliente/peça cadastrados.

- [x] Frota (vehicles) importada, 3 lojas, Nova O.S. com autocompletar placa e busca em Oficina/Centro de custo, botões Nova O.S./Gerar O.S. na Agenda
- [ ] Filtro Categoria do Veículo na consulta de O.S.
- [x] Confirmar ID SGLOC da loja "11" (usado 11 provisoriamente)
- [x] Logo ANPEXC na tela de login (logo completa), no topo do painel (marca da fênix) e ícone do site (favicon)

## Camada visual (prompt de evolução do painel — escopo: visual + dashboard, sem módulos novos)
- [x] Shell com sidebar fixa colapsável + topbar (breadcrumb, busca Ctrl+K, tema, usuário) em todas as telas autenticadas; itens futuros (Frota, Motoristas, Contratos, Financeiro, Relatórios) visíveis desabilitados.
- [x] Dark mode global persistente (localStorage "theme", anti-flash no carregamento) migrado do painel da Agenda para o hook use-theme.
- [x] Dashboard Home em /dashboard com KPIs reais (veículos ativos, agendamentos 30 dias, O.S. em aberto, prazos vencidos), gráfico de agendamentos por dia, veículos por situação e últimas O.S.
- [x] Tokens visuais novos (accent-brand, accent-warm, row-hover/selected, kpi-number) em oklch para os dois temas.
- [x] Link "Não tem conta? Cadastre-se" na tela de login com contraste maior (fonte clara).
- [x] Compilação confirmada após o ajuste do styles.css; código formatado e `bun run lint` sem erros (arquivos gerados de `src/integrations` fora da verificação).
- [x] Botão "Nova O.S." legível na barra da Agenda nos dois temas (variante `outline` passou a definir a cor do texto).
- [ ] Módulos Motoristas, Contratos, Financeiro, Relatórios — aguardando dados e definições.
- [x] Agenda: campos de data inicial/final lado a lado numa única caixa de período; ícone do calendário branco no tema escuro e pop-up nativo escuro.
- [x] Dashboard: KPIs e gráficos com retorno ao passar o mouse e seleção estilo Power BI (clicar destaca, clicar de novo limpa, Ctrl soma, faixa de chips).
- [x] Dashboard: pop-up de detalhamento ao clicar (veículos, agendamentos, O.S., prazos) com campo de pesquisa por placa/modelo.
- [x] Dashboard: no pop-up, marcar por caixinha (um, alguns ou todos os carros) e usar a marcação como filtro/exportação.
- [x] Agenda: remover a logo repetida e o texto "Gestão de Agendamentos" da barra de ações (a logo já está na lateral); deixar o bloco discreto.
- [x] Agenda: botão "Limpar tudo" corrigido (dentro da caixa) e demais linhas de filtros com quebra para não estourar.
- [ ] Frota: linha importada por engano "1146 VEÍCULOS" e montadora "MITISHUBISH" — aguardando decisão do Rafael para limpar.
- [x] Pátio: atualização aplicada; carregamento verificado como Master sem erros, total externo 151 veículos distintos.
- [x] Oficina: encaminhamento via RPC atômica, criação/reuso de O.S. e vínculo por veículo; janela e busca verificadas sem mudar destinos reais.
- [x] Externos: abas por local, total sempre visível, permanência registrada nos novos encaminhamentos e histórico por local.
- [x] Veículos: planilha conciliada (1 novo, 1.136 atualizados, 1 resumo ignorado, 0 erros); preservados veículos ausentes e sem limite de frota.
- [x] Veículos: tela ativa com filtros, cadastro Master/Gerente e permissão individual Master protegida por RLS; ficha com O.S. por placa verificada.
- [ ] Pátio próprio: marcar os locais da empresa em Pátio → Configurações → Locais (agora em lote, vários pátios) — aguardando o Rafael escolher.
- [ ] Encaminhamento: confirmar com um agendamento real escolhido pelo Rafael — não foi alterado destino de carros nem criada O.S. fictícia nesta validação.
- [ ] Filtros de frota sem dados (reserva, tipo, ano emplacamento e status operacional): aguardando base complementar; controles indisponíveis quando faltam dados.

- [x] Permissões por usuário (abas e ações) em Usuários · Permissões; encaminhamento liberado para Atendimento; logo e Home voltam ao início.
- [x] Entrada/Saída rápida pela barra superior: placa só do cadastro (lista estilo SGLOC), ligada ao agendamento aberto ou avulsa; banco recusa placa avulsa não cadastrada.
- [x] Configurações do Pátio em abas; tabela de Locais com seleção múltipla para marcar pátio próprio/oficina externa e incluir/remover de grupos em lote; aviso em segundos.
- [x] Barra superior fixa e maior com atalhos globais; busca só pela lupa (abre a barra ao clicar ou Ctrl+K).
- [x] Menu lateral com subtelas (Agenda, Oficina/Pátio, Consultas, O.S.; Históricos → Alterações/Check-ins).
- [x] Menu recolhido: lista flutuante das subtelas ao passar o mouse ou clicar, filtrada pelas permissões existentes.
- [x] Consultas unificada no menu; Veículos/O.S. continuam alternáveis dentro da tela, com destaque do mesmo item lateral.
- [x] Documento de continuidade v2 atualizado após os ajustes de navegação solicitados em 21/10/2026.
- [x] O.S.: botões Agenda/Oficina/Consultas/Ordens de Serviço mantidos no topo da tela conforme o print.
- [x] Menu recolhido: nome da opção exibido ao passar o mouse (Dashboard, Usuários · Permissões, Notícias, Veículos, "em breve", recolher/expandir) e na barra superior (lupa, tema, notificações, usuário, sair).
- [x] Corrigir rolagem com a roda do mouse nas listas da janela Encaminhar para oficina; Tipo de O.S. e Centro de custo verificados com sessão Master, sem salvar encaminhamento.

## Como continuar (para uma sessão nova)
- Ler AGENTS.md (raiz e subpastas) antes de mexer; regras de negócio ficam no banco (triggers/funções), a tela só espelha.
- Migrações em drizzle/migrations já estão aplicadas; nunca reaplicar nem reescrever. `0026_yard_oficina.sql` é duplicada e NUNCA deve ser executada.
- Pendências que dependem do Rafael: escolher pátios próprios, lojas das O.S. importadas, limpeza da linha "1146 VEÍCULOS"/"MITISHUBISH", teste real de encaminhamento com conta Atendimento, tarefa agendada do SGLOC (sem mecanismo aprovado), envio real ao SGLOC.
- Validar sempre: `bunx tsgo --noEmit`, `bunx vitest run`, `bun run lint`.

## Revisão visual (2026-10-21)
- [x] Topbar enxuta (atalhos só ícone abaixo de 1280px; extras da Agenda em "Mais"), cabeçalho duplicado do Pátio removido, abas de módulo só no celular, filtros da Agenda em grade e recolhidos no celular, grade semanal com dias vazios estreitos, contraste do modo escuro (--primary, --link), destaque da Home em largura total.
- [ ] Pendente: cor "Recebido" (verde-limão) é configurada em Configurações > Situações; (concluídos: filtros recolhíveis em Veículos e datas dd/mm/aaaa via DateInput).

## Tela da oficina (2026-10-21)
- [x] Aba "Em atendimento agora" (Chegando / Em execução / Prontos), "Dar entrada", modo telão; Master configura colunas, nomes e campos do cartão.
- [x] Aviso imediato de encaminhamento (Realtime) com placa e quem enviou.
- [x] Pátio: filtro Hoje/Semana/Mês/Personalizado e ordem mais novo↔mais antigo/placa (salva por usuário).
- [x] Consultas → O.S.: corrigido erro do perfil Oficina, mostra todas ao abrir, ordem escolhida pelo usuário.
- [x] Oficina consulta O.S. por padrão; telas de O.S./Notícias conferem permissão ao abrir; atalhos da Home filtrados.
- [x] Notícias publicadas visíveis para a Oficina.

## Módulo Vistorias (substituto do VEX) — plano aprovado em .lovable/plan/módulo-vistorias-*.md
- [x] Etapa 0: /vistoria com login direto (sessão 12h), início rápido no celular, menu próprio, botão "Voltar ao painel ANPEXC", "Adicionar à tela inicial", item no menu do painel, permissões de vistoria.
- [ ] Etapa 1: tabelas/config de tipos, grupos e campos; assistente de checklist (Campos/Checklist/Fotos, assinatura, rascunho offline); lista, detalhe/galeria, PDF, localizar por placa e comparação; tipos base (pré-vistoria, entrega, cautelar, coleta, coleta com entrega).
- [ ] Etapa 2: página inicial com indicadores e Ao Vivo.
- [ ] Etapa 3: configurações completas (questionários, grupos/campos editáveis pelo Master).
- [ ] Etapa 4: clientes, e-mail do laudo, relatórios.
- [ ] Etapa 5: leitura de placa pela câmera, cerco geográfico, checklist por link, mapa.
- [ ] Etapa 6: importar histórico do VEX (aguarda exportação do VEX).

## Vistorias — Etapa 1 (concluída em 22/10/2026)
- Checklist no celular (Campos/Checklist/Fotos/Assinar), fotos comprimidas com data/hora, avaria com foto+observação, assinaturas, rascunho no aparelho (pendente de envio sem internet).
- Lista com filtros/CSV, detalhe com galeria, laudo (imprimir/PDF), WhatsApp, cancelamento com motivo; Localizar por placa com comparação.
- Pendente: editor Master de tipos/grupos/campos (Etapa 3), envio automático em fila offline, integração com Pátio, filtro por vistoriador/cliente.
- Vistorias (22/10): foto opcional em cada item do checklist (mostra só o nome do arquivo; abre ao clicar), carimbo com campo + data/hora, laudo PDF no formato atual (dados principais, pneus, combustível, checklist, fotos 2 por página, termo, assinaturas, código de validação). Pendente: termo editável pelo Master (Etapa 3) e página pública de validação do código.
- Vistorias (22/10): editor de foto (traço fino com cor e selos A/F/P/Q/R/T), legenda no laudo, escolha de questionário. Etapa 2 concluída: Página inicial (KPIs, Top 5, 7 dias, últimas 10) e Ao Vivo em tempo real. Próxima: Etapa 3 (configurações/editor de grupos e campos, termo editável).
