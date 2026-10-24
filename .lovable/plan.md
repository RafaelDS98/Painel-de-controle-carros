# Finalizar e cancelar O.S. + Histórico de O.S.

## O que muda para o usuário
1. **Finalizar O.S. (com etapa "Aguardando retirada")** — quando a O.S. tiver serviço executado no veículo (revisão, manutenção, troca de óleo, pneus etc.), ao concluir o serviço ela vai para **Aguardando retirada**: aparece numa aba "Aguardando retirada" na Agenda, para o Atendimento acompanhar e avisar o cliente (registrando o contato). Quando o veículo for retirado, o botão "Finalizar" encerra de vez. Botão disponível para todos os perfis com acesso a O.S. Pede KM final, tanque, GNV e posição final (já existe no banco) e uma observação opcional. A O.S. passa para a situação **Finalizada** com data/hora e autor.
2. **Cancelar O.S.** — botão "Cancelar" visível só para **Master e Gerente**. Exige motivo (obrigatório). Situação vira **Cancelada**, com data, autor e motivo registrados.
3. **Situações Finalizada/Cancelada** — já existem na lista de situações; passam a ser tratadas como "encerradas" (sempre discriminadas entre si: Finalizada e Cancelada aparecem separadas em listas, filtros, contagens e relatórios, para visualização e análise). Uma O.S. encerrada fica travada: ninguém altera dados, itens ou situação, a não ser quem tiver a nova permissão **"Alterar O.S. finalizada/cancelada"** (Master tem por padrão; Master libera para outros em Usuários → Permissões). Reabrir também usa essa permissão.
4. **Fora da tela principal** — O.S. encerradas deixam de aparecer na lista principal de O.S. e o agendamento ligado a elas sai da Agenda e do Pátio (não fica ocupando espaço). Nada é apagado.
5. **Histórico de O.S.** — nova aba "Histórico de O.S." dentro de Ordens de Serviço (e acessível pela Consulta de O.S.), com filtro Finalizadas / Canceladas / Todas, período, placa, oficina e loja, mostrando quem encerrou, quando e o motivo. A atual tela Históricos ganha separação por categoria: **Histórico de O.S.** e **Histórico de alterações de atendimentos e agendamentos** (inclui os atendimentos abertos pelo novo botão **"Abrir atendimento"** da tela inicial: para veículos passantes ou urgências sem agendamento prévio; preenche os mesmos campos do agendamento, mas a data é sempre a do dia em que o botão foi acionado e não há "data do agendamento") (base para futuras categorias).

## Regras (o banco decide, a tela só espelha)
- Finalizar: qualquer perfil com acesso a O.S. (inclusive Oficina).
- Cancelar: somente Master/Gerente, motivo obrigatório.
- Editar/reabrir O.S. encerrada: somente quem tem a permissão nova.
- Cada finalização/cancelamento/reabertura fica no histórico de alterações da O.S.

## Detalhes técnicos
- Migração nova:
  - `ordens_servico`: colunas `cancelled_at`, `cancelled_by`, `cancel_reason`, `closed_by`, `close_note` (nulas).
  - `os_status`: coluna `is_closed boolean default false`, marcada em FINALIZADA/CANCELADA.
  - Ajustar `os_finalize` para aceitar todos com `has_os_read`/módulo O.S., gravar `closed_by`; nova RPC `os_cancel(_os_id, _reason)` checando `has_role` master/gerente; nova RPC `os_reopen(_os_id, _status_id)` exigindo `has_permission(uid,'action.os_edit_closed')`.
  - `os_transition_status` bloqueia ir para FINALIZADA/CANCELADA por fora das RPCs; `enforce_os_edit_rules` e `os_item_*`/`os_update` recusam O.S. encerrada sem a permissão.
  - `permission_default` e `get_my_permissions` recebem `action.os_edit_closed` (padrão só Master).
  - `search_ordens_servico` ganha filtro `encerradas` (padrão exclui encerradas; histórico pede só elas).
- Frontend: `PERMISSIONS`/`permissionDefault` em `src/lib/permissions.ts`; botões e diálogos no detalhe (`ordens-servico.$id` / `ordens-servico.tsx`); lista principal com filtro padrão "abertas"; nova aba Histórico de O.S.; Agenda/Pátio escondem agendamentos cuja O.S. vinculada está encerrada (`agenda-safety.ts` / dados do Pátio).
- Testes: regras puras em `src/lib/os.ts` (quem pode finalizar/cancelar/editar encerrada, filtro padrão), atualizando `os.test.ts` e `permissions.test.ts`.
- Atualizar AGENTS.md e roadmap.md.

## Ponto a confirmar
Hoje o atendimento na Agenda tem situação própria (separada da O.S.). O plano esconde da Agenda/Pátio o atendimento cuja **O.S. vinculada** foi finalizada/cancelada. Se preferir também um "Finalizar/Cancelar" direto no agendamento sem O.S., é só avisar.
