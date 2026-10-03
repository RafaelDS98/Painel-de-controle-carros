# Regra de prioridade — situação atual e verificação

Conferi o código e o banco: os 4 itens pedidos já estão implementados (Etapa 10 + ajuste explícito do trigger). Nada precisa ser recriado.

## O que já existe
1. **Trava no banco** — `enforce_appointment_edit_rules()`: para atendimento, `NEW.priority_urgent := OLD.priority_urgent` antes do cálculo de mudança de negócio e nos dois `RETURN NEW` do bloco de atendimento. Gerente/master: urgência conta como campo de negócio comum (entra em `_business_changed`, sujeita ao limite de edição do gerente; master sem limite).
2. **Interface** — checkbox "Marcar como urgente" no modal, desabilitado para atendimento com aviso "(somente gerente ou master)".
3. **Ordenação** — `priorityLevel` / `comparePriority` em `maintenance-dashboard.tsx`: Urgente aberto → Atrasado aberto → Hoje → Futuro (prazo mais próximo primeiro) → Sem prazo; empate por data/hora. "Prioridade" é a primeira coluna ordenável da tabela e a ordem padrão da tabela e da grade semanal. Conclusão vem de `status_options`.
4. **Visual** — `UrgentBadge` nos cards, na linha da tabela e no título do modal, só quando o status não é o de conclusão.

## O que farei ao aprovar (só verificação, sem mudar código)
- Teste no navegador como master: marcar/desmarcar urgente, ver o badge e o agendamento subir para o topo na grade e na tabela.
- Teste da trava de atendimento direto no banco: dentro de uma transação revertida, simular a sessão de um usuário atendimento (`set_config('request.jwt.claims', ...)` + `SET LOCAL ROLE authenticated`), tentar `UPDATE appointments SET priority_urgent = true` e confirmar que o valor não muda; repetir como gerente/master e confirmar que muda. Se a ferramenta não permitir simular perfis, informo isso claramente.
- Rodar os testes de ordenação existentes (`maintenance-dashboard.test.ts`).
- Desfazer qualquer alteração de teste nos dados.

## Detalhes técnicos
- Arquivos envolvidos (apenas leitura): `src/components/maintenance-dashboard.tsx`, `src/components/maintenance-dashboard.test.ts`, função `public.enforce_appointment_edit_rules`.
- Se algum teste falhar, corrijo apenas o ponto afetado e informo.
