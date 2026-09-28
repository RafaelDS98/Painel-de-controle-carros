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
- Dados persistem no Lovable Cloud (tabelas appointments, profiles, edit_log, contact_log); o painel lê/grava direto via cliente do navegador com RLS — evita estado só em memória.
- Acesso exige perfil com `role` preenchido (função `has_access`); o papel só é atribuído manualmente no backend — impede autoatribuição de privilégio.
- `appointments.id` é uuid; o ID da planilha fica em `sheet_id` — importações podem repetir IDs.
- Regras de edição por perfil ficam em trigger BEFORE UPDATE em appointments e o histórico em trigger AFTER UPDATE (edit_log só leitura para usuários) — a tela só espelha, o banco decide.
- Prazos usam datas de calendário em America/Sao_Paulo e a última mudança de situação para Finalizado no edit_log — evita comparar horários UTC como dias locais e mantém a entrega auditável.
- A ficha de agendamento compartilha os campos da criação manual e envia somente colunas alteradas no UPDATE — mantém o trigger de permissões e o histórico como fonte das regras.
