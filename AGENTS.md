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
- Prazos usam datas de calendário em America/Sao_Paulo e a última mudança para a situação marcada como conclusão no edit_log — evita comparar horários UTC como dias locais e mantém a entrega auditável.
- Retrabalhos são novos agendamentos ligados por `rework_of` e `rework_reason`, nunca atualizações do original — preserva seus limites de edição e histórico.
- Contatos vão para `contact_log` com o usuário autenticado, lidos via RLS — preserva autoria.
- Situações e campos opcionais vêm das tabelas de configuração; campos originais continuam em colunas e novos campos ficam em `custom_fields` — permite personalizar sem perder dados ou histórico.
- Urgência só é alterada por gerente/master, filtrada no banco nos triggers BEFORE INSERT e UPDATE (descarta a mudança vinda de atendimento sem bloquear o resto) — tela, importação e chamadas diretas não burlam.
- Perfis de usuários são listados e alterados só por funções protegidas no banco que exigem master e impedem alterar o próprio perfil — a tela não grava user_roles diretamente.
- Excluir agendamento = arquivar (archived_at/archived_by), só master, garantido no trigger de edição e na RLS de leitura; o painel carrega só ativos por activeOnly (src/lib/agenda-safety.ts) e a deduplicação de importação usa existing_sgloc_references (inclui arquivados) — nada é apagado e nada some de uma tela só.
- Perfil Oficina usa o módulo "oficina" (user_modules decide só pelo perfil): MaintenanceDashboard em mode="oficina" esconde criar/importar/lote/excluir/configurar; o banco bloqueia INSERT (trigger) e urgência. Visibilidade TEMPORÁRIA: vê/edita todos os ativos (RLS "Oficina reads/updates active"); forwarded_*, workshop_users, sectors e user_sectors ficam sem uso até existir o fluxo entre setores, quando a visibilidade será restringida.
- Setor do usuário é só rótulo (profiles.sector, lista catalog_items kind "sector"), sem efeito em módulos, permissões ou RLS.
- Setor do agendamento = profiles.sector do criador, via appointment_creator_sectors() (só o rótulo) — filtra sem expor dados de usuários.
- Migrations em drizzle/migrations são histórico já aplicado direto no banco (sem _journal); a verdade é o que está em produção. Tabelas sectors, user_sectors e workshop_users existem mas não são usadas pelo painel.

## Fluxo de trabalho (Claude direto no GitHub, sem gastar créditos do Lovable)
- Alterações de código são feitas por Claude na pasta local do repositório e enviadas por commit/push ao GitHub; o Lovable só recebe o branch sincronizado — sem créditos. Nunca reescrever histórico (sem force push, rebase ou amend de commits já enviados) e manter o branch sempre funcionando.
- Antes de cada commit rodar `bun run lint`, `bun run build` e `bunx vitest run` quando o Node/Bun estiver instalado na máquina; se não estiver, Claude valida em ambiente próprio e avisa o que não pôde testar. O teste visual no painel publicado é sempre do Rafael.
- Mudanças de banco (tabelas, triggers, RLS, funções) viram arquivo em drizzle/migrations e SQL entregue ao Rafael, que aplica no SQL Editor do Supabase; só depois a tela que depende delas é enviada. A verdade do banco é o que está em produção.
- Ao terminar cada mudança, atualizar este arquivo (decisão técnica nova) e o roadmap.md (item concluído ou pendente) para a próxima sessão continuar de onde parou.
- Envio ao SGLOC nunca é silencioso: com integração ou escrita desligada, criação/reenvio fica `push_failed` com o motivo e o botão "Reenviar" (pushAppointmentToSgloc); só atualização sem sgloc_reference é ignorada.
- Layout autenticado: shell `src/components/layout/layout-shell.tsx` (sidebar colapsável + topbar com breadcrumb e busca Ctrl+K) via `_authenticated/route.tsx`; novas rotas entram na NAV/SECTION_LABELS do shell; módulos futuros ficam desabilitados ("Em breve").
- Tema global: hook `src/hooks/use-theme.ts` (`.dark` no `<html>`, localStorage "theme", anti-flash em `__root.tsx`); gráficos leem `--chart-*` via `useChartColors`. Dashboard Home em `/dashboard`; Agenda segue como home `/`.
