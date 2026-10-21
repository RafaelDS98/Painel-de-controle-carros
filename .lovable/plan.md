# Entrada/saída rápida por placa, Configurações do Pátio organizadas e documentação para nova sessão

## 1. Registro rápido de entrada/saída por placa
- Novo botão **"Entrada/Saída"** fixo no topo do Pátio e na tela Veículos (e atalho no menu lateral), que abre uma janela direta — sem precisar buscar e abrir o veículo.
- Campo **Placa** igual ao SGLOC: ao digitar 2+ letras, aparece a lista de veículos cadastrados com selo Ativo e resumo (Prefixo, Ano, Modelo). Só é possível escolher uma placa da lista; placa fora do cadastro não é aceita (mensagem "Placa não cadastrada — peça ao Master/Gerente para cadastrar").
- Depois de escolher: mostra se há agendamento em aberto (liga a ele) ou registra avulso, com escolha de Entrada/Saída, Local (lista pesquisável), observação e foto conforme as configurações.
- O mesmo campo de placa com lista passa a ser usado na ficha do veículo e nos registros do Pátio.

## 2. Configurações do Pátio mais simples
Reorganizar a janela em abas, como em "Configurações da Agenda":
- **Locais**: tabela única com todos os locais (busca no topo), uma linha por local com colunas **Tipo** (Pátio próprio / Oficina externa), **Grupos** e **Ativo**.
  - Caixinha em cada linha + "marcar todos os filtrados" e ações em lote: **Marcar como pátio próprio**, **Marcar como oficina externa**, **Adicionar ao grupo…**, **Remover do grupo…**.
  - Permite **vários pátios próprios** (hoje só um). Botão "Novo local".
- **Grupos**: lista de grupos com quantidade de locais, editar/renomear/desativar (seleção dos locais com a mesma busca e caixinhas).
- **Check-in/Check-out**: obrigatoriedade, foto e tamanho máximo.
- **Notificações e tempos**: timer, som, intervalo, "Duração do aviso na tela (segundos)".
- **Oficina e status**: campos editáveis pela Oficina e status por tela.
- Um botão Salvar por aba, com aviso de alterações não salvas.

## 3. Barra superior fixa e mais alta em todas as telas
- Atalhos "Novo agendamento", "Nova O.S.", "Configurações" e o novo "Entrada/Saída" ficam sempre na barra superior, em todas as telas (respeitando as permissões de cada usuário), em vez de aparecerem só na Agenda.
- Barra mais alta, sem rolagem lateral, com os atalhos ocupando o espaço vazio ao lado do caminho da página e alinhados de forma organizada.
- "Configurações" abre as configurações da tela atual (Agenda, Pátio etc.).

## 4. Documentação para continuar em nova sessão
- **AGENTS.md**: regras novas (seleção de placa só do cadastro; vários pátios próprios via função em lote; configurações do pátio em abas) e resumo de onde fica cada módulo.
- **roadmap.md**: marcar o concluído, listar pendências com o motivo (ex.: ID SGLOC da loja 11, filtro de categoria, agendamento automático do SGLOC, testes reais de encaminhamento/O.S. por Atendimento) e uma seção "Como continuar" com o estado atual e o que nunca reaplicar (ex.: 0026_yard_oficina.sql).

## Detalhes técnicos
- Componente `PlateCombobox` (busca em `vehicles` por placa normalizada, limite 20, debounce) devolvendo `{id, plate}`; `QuickCheckInDialog` reaproveita a lógica de `vehicle-check-in.tsx` extraída para `src/lib/check-in-log.ts`/hook compartilhado.
- Validação no banco: trigger em `check_in_records` exigindo que `plate` exista em `vehicles` (novas linhas apenas).
- Migração nova: função `set_own_yards(_ids uuid[], _value boolean)` e `set_group_members_bulk` restritas a Master (`has_role`); `set_own_yard` deixa de desmarcar os demais. Sem reescrever migrações anteriores.
- Pátio passa a tratar qualquer `is_own_yard = true` como pátio próprio (`yard-utils.ts`), com teste.
- Testes: placa inexistente rejeitada; lote marca vários pátios; Pátio separa múltiplos pátios próprios.
