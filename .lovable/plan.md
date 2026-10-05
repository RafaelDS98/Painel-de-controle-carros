# Sincronização automática SGLOC → painel (Etapa 12)

## O que foi conferido antes do plano
- Trigger `enforce_appointment_edit_rules`: a 1ª linha é `IF auth.uid() IS NULL THEN RETURN NEW` — o caminho do servidor (service role) já passa livre: não consome `creator_edits_used`/`manager_edit_used`, não cai nos limites e pode gravar `sgloc_*`. Só um detalhe: em agendamento arquivado também passaria; a rotina vai filtrar arquivados no código (ver d).
- `sgloc_settings` hoje: `interval_minutes = 5`, `enabled = true`. Existe 1 conta em `sgloc_accounts` e o usuário rafael344960@gmail.com existe.
- `appointments`: 130 linhas, 128 já com `sgloc_reference`; só 2 sem (ambas com placa e data).
- `pg_cron` e `pg_net` NÃO estão ativos no banco. O projeto tem `cron-auth.ts` (gerado), que confere `LOVABLE_CRON_SECRET` — é o mecanismo de agendamento da plataforma para rotas de servidor.
- Conector já tem `readList`, `readItem`, `sglocPlate`, `sglocHour`, `todayInSaoPaulo`, `maskValue`, `getUserToken`, `markExpired`.

## a) Agendamento
- Rota de servidor `POST /api/public/hooks/sgloc-sync` protegida por `authenticateCronRequest` (401 sem o segredo).
- Tarefa agendada da plataforma chamando essa rota a cada 15 min (tick fixo, nunca recriado). Primeiro passo da implementação: confirmar na documentação da plataforma como cadastrar a tarefa que usa `LOVABLE_CRON_SECRET`; se não estiver disponível, alternativa é ativar `pg_cron` + `pg_net` com o mesmo segredo guardado no cofre do banco.
- A cada tick a rota decide: integração ativa? conta designada ok? já passou `interval_minutes` desde o início da última execução `success`/`partial` do tipo `schedule`? Senão responde "pulado" sem gravar execução (evita encher `sgloc_sync_runs`).
- 96 ticks/dia, cada um só lê `sgloc_settings` e 1 linha de `sgloc_sync_runs` — custo baixo.

## b) Busca, janela, paginação e correspondência
- Endpoint: `GET api/agendamanutencao/list` com `data_inicial`/`data_final` (filtra DATAAGENDA), `per_page` 100, `page` 1..`last_page` (teto de 50 páginas por execução; se estourar, execução `partial` e aviso).
- Janela: hoje (São Paulo) − `window_days_back` (7) até + `window_days_ahead` (45), colunas já existentes. Proponho deixá-las editáveis na mesma tela.
- Detalhe por id (`{id}`) não é chamado em lote (custo); a listagem já trouxe os mesmos campos no teste de leitura. Se algum campo faltar, buscar detalhe só para itens novos.
- Chave de correspondência: `sgloc_reference` = `id` do SGLOC (índice único parcial já existe; a importação por planilha já grava o ID SGLOC nele). `sheet_id` e `os_number` não servem (repetíveis/opcionais).
- Risco de duplicar: linhas da planilha sem ID SGLOC. Proteção: antes de criar, procurar linha ativa SEM `sgloc_reference` com mesma placa normalizada + mesma data (+ hora se houver). Achou exatamente 1 → vincula (grava `sgloc_reference`, não cria). Achou mais de 1 → não cria, conta como "ambíguo" e lista no relatório. Arquivados com aquele `sgloc_reference` (via `existing_sgloc_references`) nunca são recriados nem restaurados.

## c) Mapeamento SGLOC → appointments
- Função pura `mapSglocItem` em `core.ts`, usando `normalize.ts` (placa, data, hora, HTML, texto) e as mesmas regras da importação: id→sgloc_reference, DATAAGENDA→date, hora→time, placa→plate, km→km_scheduled, cliente/contato→contact, telefone→contact_number, defeito→issue, obs→note, fornecedor→workshop (+supplier_id), pedido externo→external_order, loja_id→store_id (+store pelo `sgloc_stores`), operador_id, marca, modelo, tipo_agenda→schedule_type, os→os_number, realizado/confirmado→sgloc_performed/sgloc_confirmed. Nomes exatos das chaves confirmados contra o relatório do teste de leitura antes de codar.
- Campos só do painel nunca são tocados: status, prazos, urgência, retrabalho, custom_fields, contadores de edição, created_by, archived_*.
- Atualização: só colunas que mudaram de fato; valor vazio no SGLOC NÃO apaga valor preenchido no painel.
- Novos: `status ''`, `created_by` nulo, `registered_at` hoje, `sync_state 'synced'`.
- Linha local em `pending_push`/`push_failed`: não sobrescreve; conta como "protegida".
- Não retornado: linha ativa com `sgloc_reference`, data dentro da janela e ausente na resposta → `sgloc_sync_state 'not_returned'`, `sgloc_missing_count + 1`. Só marca se a listagem completou todas as páginas sem erro. Se voltar depois, volta para `synced` e zera o contador.
- Histórico: o trigger de log já grava com `changed_by` nulo → aparece "Sistema (SGLOC)".

## d) Proteções
- Sobreposição: índice único parcial em `sgloc_sync_runs` onde `status='running'`; a execução começa inserindo a linha `running` — se falhar, já há uma em andamento. Execuções `running` há mais de 15 min são encerradas como `abandoned` antes de começar.
- Manual: 1 a cada 30 s (pela última `started_at`) e respeitando a trava acima.
- Erro parcial: cada item em try/catch; falha de item vai para `error_detail` (máx. 50, com ref SGLOC e motivo, placa mascarada), conta em `errors`, execução termina `partial`. Erro de página/rede/401 encerra como `failed` sem marcar `not_returned`.
- 401: `markExpired` na conta designada, execução `failed` com "Conta SGLOC designada expirou; reconecte em Minha conta". Nunca renova sozinha.
- Dados vazios/estranhos: item sem id ou sem data/placa válidas é ignorado e contado em `skipped`; leitura tolerante já existente.
- Logs: nenhum token, e-mail, telefone ou nome; só contagens, tipos de erro e `maskValue`.
- Arquivados: carregados para não recriar, mas nunca atualizados.

## e) Simulação (dry-run)
- Coluna nova `sgloc_settings.sync_live boolean default false`. Enquanto falsa, as execuções (agendadas e manuais) rodam em simulação: buscam e comparam tudo, gravam só a linha em `sgloc_sync_runs` com `dry_run = true` e contagens (criaria, atualizaria, vincularia, protegidas, ambíguas, não retornados, ignorados, erros) + amostra mascarada de até 20 itens.
- Botões na tela: "Simular agora" e "Sincronizar agora". Para ligar "Sincronização automática de verdade" é preciso ter uma simulação concluída nos últimos 24 h; a tela mostra o resultado dela e pede confirmação.

## Tela Configurações > SGLOC
- Intervalo em horas + minutos (15 min a 24 h), padrão 8 h.
- Conta da rotina: lista dos usuários com conta SGLOC conectada (nome + e-mail SGLOC + validade), aviso vermelho se não conectada/expirada.
- Última sincronização: data/hora, tipo (agendada/manual, simulação/real), resultado e contagens; próxima prevista = início da última bem-sucedida + intervalo (arredondado ao tick de 15 min), ou "desligada".
- Texto "Não há sincronização automática" substituído.

## f) Arquivos e migração
Migração `0015_sgloc_auto_sync.sql` (aditiva):
- `sgloc_settings`: default `interval_minutes` 480; UPDATE do registro para 480 (backfill da mudança); CHECK 15–1440 (NOT VALID não é necessário após o update); `sync_user_id uuid` preenchido pelo id de rafael344960@gmail.com via `auth.users`; `sync_live boolean default false`.
- `sgloc_sync_runs`: `dry_run boolean default false`, `linked`, `protected`, `not_returned`, `ambiguous` integer default 0, `sample jsonb default '[]'`; índice único parcial `status='running'`.
- Função `list_sgloc_connected_users()` SECURITY DEFINER, só master (nome, e-mail SGLOC, validade, sem token).

Código:
- `src/lib/sgloc/sync-core.ts` (puro): `mapSglocItem`, `diffAppointment`, `planSync` (decide criar/atualizar/vincular/proteger/não retornado), `syncWindow`, `nextRunAt`, `shouldRunTick`.
- `src/lib/sgloc/sync.server.ts`: `runSglocSync({ trigger, dryRun })` com busca paginada e gravação.
- `src/routes/api/public/hooks/sgloc-sync.ts`: rota do tick.
- `src/lib/sgloc/sgloc.functions.ts`: `saveSglocSettings` ganha intervalo/conta/sync_live (validação 15–1440, conta precisa estar conectada); novas `runSglocSyncNow`, `getSglocSyncStatus`, `listSglocConnectedUsers` (todas com assertMaster).
- `src/components/sgloc-settings.tsx`: campos e quadro de status.
- `AGENTS.md` (conector): regra da sincronização.

Testes (`src/lib/sgloc/sync-core.test.ts`, sem rede):
- mapeamento com dados vazios/estranhos e normalização; vazio não apaga valor;
- correspondência por `sgloc_reference`, vínculo por placa+data, ambíguo não cria, arquivado não recria;
- `pending_push`/`push_failed` protegidos; `not_returned` só dentro da janela e só com listagem completa; volta para `synced`;
- `shouldRunTick` (intervalo, desligado, conta ausente), `nextRunAt`, janela em São Paulo;
- simulação não gera escrita; máscara nos itens de amostra.
Mais tsc e a suíte inteira; teste no navegador como master só da tela (a simulação real depende da sua conta SGLOC).

## Dúvidas e suposições para você decidir
1. Vínculo por placa + data para linhas antigas sem ID SGLOC: aprova? (hoje são só 2 linhas.)
2. Valor vazio vindo do SGLOC não apaga dado do painel — ok, ou o SGLOC deve poder limpar campos?
3. Linhas criadas pela sincronização ficam com Situação vazia e loja pelo `sgloc_stores` — ok?
4. Janela 7 dias para trás / 45 para frente, editável na tela — ok?
5. "Não retornado": só marcar, sem aviso extra no painel além da etiqueta na ficha? Ou destacar com X execuções seguidas?
6. Linha arquivada que mudou no SGLOC: ignorar (proposto) ou avisar o master?
7. Trava de 24 h exigindo simulação antes de ligar o modo real — ok?
8. Se a plataforma não oferecer a tarefa agendada com segredo, aprova ativar `pg_cron`/`pg_net` no banco?
