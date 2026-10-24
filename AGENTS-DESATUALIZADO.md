<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Decisões técnicas
- Subpastas têm AGENTS.md próprio (src/components, src/lib, src/lib/sgloc): leia antes de mexer nelas.
- O painel lê/grava no Lovable Cloud pelo cliente do navegador com RLS — evita estado só em memória.
- Acesso e papéis ficam em `user_roles`, consultados por funções protegidas no banco — separa privilégio dos dados pessoais e impede autoatribuição.
- `appointments.id` é uuid; o ID da planilha fica em `sheet_id` — importações podem repetir IDs.
- Regras de edição por perfil ficam em trigger BEFORE UPDATE em appointments e o histórico em trigger AFTER UPDATE (edit_log só leitura para usuários) — a tela só espelha, o banco decide.
- Prazos usam datas de calendário America/Sao_Paulo; a última mudança no edit_log decide a conclusão — não comparar UTC como dia local.
- Retrabalhos são novos agendamentos ligados por `rework_of` e `rework_reason`, nunca atualização do original — preserva limites de edição e histórico.
- Contatos vão para `contact_log` com o usuário autenticado, lidos via RLS — preserva autoria.
- Situações e campos opcionais vêm das tabelas de configuração; novos campos vão para `custom_fields` sem perder dados ou histórico.
- Urgência só gerente/master, filtrada em triggers BEFORE INSERT/UPDATE — tela, importação e chamadas diretas não burlam.
- Perfis são listados/alterados só por funções protegidas no banco (exigem master e impedem alterar o próprio) — a tela não grava user_roles.
- Excluir agendamento = arquivar (archived_at/archived_by), só master, em trigger e RLS; o painel carrega só ativos (agenda-safety.ts) e a dedupe de importação inclui arquivados — nada é apagado nem some de uma tela só.
- Perfil Oficina uses the oficina module and sees active appointments; forwarding is available to creation roles through os_forward_appointment, while workshop_users remains unused — preserves current visibility and separates routing from access grants.
- Fleet uses vehicles plus extra_data, normalized plate reconciliation and vehicle_screen_access enforced by RLS; OS links use vehicle_id populated by a trigger — avoids duplicate vehicle stores and preserves workflow links independently of screen permission.
- Yard separates configured own-yard locations from external workshops; workshop_movements records closed/open stays, and os_forward_appointment atomically creates/reuses the linked OS under appointment locking — prevents duplicate forwarding and invented historical durations.
- Setor é só rótulo (profiles.sector, catalog_items kind "sector"; o do agendamento via appointment_creator_sectors()) — sem efeito em módulos, permissões ou RLS.
- Migrations em drizzle/migrations são histórico já aplicado no banco (sem _journal); a verdade é o que está em produção.
- Listas que podem passar de 1000 linhas buscam em blocos `.range(0,999)` — consulta única é cortada no limite padrão e a contagem sai errada.
- Filtros cruzados dos gráficos (estilo Power BI) ficam em módulos puros e testados (`chart-selection.ts`, `dashboard-filter.ts`); as telas só aplicam o estado.

## Fluxo de trabalho (Claude direto no GitHub, sem gastar créditos do Lovable)
- Alterações de código são feitas por Claude na pasta local e enviadas por commit/push ao GitHub; o Lovable só recebe o branch sincronizado — sem créditos. Nunca reescrever histórico e manter o branch sempre funcionando.
- Antes de commitar rodar `bun run lint`, `bun run build` e `bunx vitest run`; sem Node/Bun na máquina, Claude valida em ambiente próprio e avisa o que não testou. O teste visual no publicado é do Rafael.
- Mudanças de banco (tabelas, triggers, RLS, funções) viram arquivo em drizzle/migrations e SQL entregue ao Rafael, que aplica no SQL Editor; só depois a tela que depende delas é enviada.
- Ao terminar cada mudança, atualizar este arquivo (decisão nova) e o roadmap.md (concluído ou pendente).
- Envio ao SGLOC nunca é silencioso: desligado, criação/reenvio fica `push_failed` com o motivo e botão "Reenviar"; só atualização sem sgloc_reference é ignorada.
- Layout: shell `layout-shell.tsx` com atalhos globais na topbar (via `?acao=`, lido por `usePageAction`) e subtelas em `children` da NAV usando parâmetro de URL (`?tab=`, `?aba=`) — uma fonte para menu, abas e atalhos.
- Tema global: hook `use-theme.ts` (`.dark` no `<html>`, localStorage "theme", anti-flash em `__root.tsx`); gráficos leem `--chart-*` via `useChartColors`. Home/notícias em `/home`, Agenda em `/`.
- `src/integrations` é gerado pela plataforma e fica fora do eslint; o resto segue `prettier`, de modo que `bun run lint` termine sem erros — formate antes de commitar.
- Permissões por usuário: user_permissions + has_permission()/permission_default(); aba/ação nova entra em PERMISSIONS (src/lib/permissions.ts), permission_default() e get_my_permissions() juntas — o master libera sem código.
- Sessão nova: ler estes AGENTS.md e "Como continuar" no roadmap.md antes de mudar algo.
- Encerramento: O.S. Finalizada(7)/Cancelada(3) só via os_close/os_cancel (cancelar = master/gerente), editar/reabrir exige action.os_edit_closed; agendamentos encerrados usam closed_at/close_kind e saem de Agenda/Pátio; atendimento sem agendamento = origin 'atendimento' — o banco decide, telas filtram closed_at.
