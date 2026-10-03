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
- Acesso e papéis ficam em `user_roles`, consultados por funções protegidas no banco — separa privilégio dos dados pessoais e impede autoatribuição.
- `appointments.id` é uuid; o ID da planilha fica em `sheet_id` — importações podem repetir IDs.
- Regras de edição por perfil ficam em trigger BEFORE UPDATE em appointments e o histórico em trigger AFTER UPDATE (edit_log só leitura para usuários) — a tela só espelha, o banco decide.
- Prazos usam datas de calendário em America/Sao_Paulo e a última mudança para a situação marcada como conclusão no edit_log — evita comparar horários UTC como dias locais e mantém a entrega auditável.
- A ficha de agendamento compartilha os campos da criação manual e envia somente colunas alteradas no UPDATE — mantém o trigger de permissões e o histórico como fonte das regras.
- Retrabalhos são novos agendamentos ligados por `rework_of` e `rework_reason`, nunca atualizações do original — preserva seus limites de edição e histórico.
- A edição em lote usa o UUID exportado, compara cada campo com a linha atual do banco e usa o mesmo UPDATE da ficha — evita duplicação e preserva as travas e o histórico.
- Atalhos de período usam datas de calendário em America/Sao_Paulo e a grade mostra apenas a semana atual no intervalo selecionado — evita misturar dias homônimos de semanas diferentes.
- Contatos são inseridos na tabela existente `contact_log` com o usuário autenticado e lidos por agendamento via RLS — preserva a autoria sem criar estrutura paralela.
- Situações e campos opcionais vêm das tabelas de configuração; campos originais continuam em colunas e novos campos ficam em `custom_fields` — permite personalizar sem perder dados ou histórico.
- Urgência só é alterada por gerente/master: o trigger de edição descarta a mudança de `priority_urgent` vinda de atendimento sem bloquear o resto — a tela apenas espelha. A ordenação por prioridade é calculada no navegador a partir da situação de conclusão configurada.
- Perfis de usuários são listados e alterados só por funções protegidas no banco que exigem master e impedem alterar o próprio perfil — a tela não grava user_roles diretamente.
- Urgência na criação também é filtrada no banco por trigger BEFORE INSERT (só gerente/master mantêm priority_urgent) — importações e chamadas diretas não burlam a regra.
- Campos de controle do SGLOC (sgloc_*) só mudam por rotina de sistema ou master, garantido no trigger de edição; tokens do SGLOC ficam em sgloc_accounts, acessível só pelo servidor, e a tela lê o status pela função get_my_sgloc_status — evita expor credenciais.
- Dados digitados e importados passam pelas funções puras de src/lib/normalize.ts (placa, data, hora, HTML, texto); a importação nunca cria um segundo registro com o mesmo sgloc_reference, apenas ignora a linha — evita duplicar agendamentos do SGLOC.
- Exibição, filtros, ordenação, agrupamento e exportação passam pelas funções puras de src/lib/agenda-safety.ts, e as seções principais ficam em SectionBoundary — dado vazio ou estranho nunca derruba a tela.
- Planilhas exportadas pelo SGLOC declaram dimensão errada; sempre recalcular o !ref com fixSheetRange (src/lib/sheet-range.ts) antes de ler — senão a leitura devolve zero linhas.
- Usuários são criados só pela função de servidor createPanelUser (src/lib/admin-users.functions.ts), que confere no servidor se quem chama é master e usa a chave de serviço apenas lá; a troca da senha provisória no primeiro acesso usa a marca must_change_password nos metadados do usuário.
- Indicadores e histórico do veículo usam os mesmos filtros do painel; seleção de placa é separada da busca textual e a faixa de filtros reflete ambos — permite remover um critério sem apagar os demais.
