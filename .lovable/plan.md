# Grupos de pátios, check-in/check-out em Veículos e histórico

## Respostas rápidas
- **Toast**: é o aviso pequeno que aparece no canto da tela por alguns segundos (ex.: "Novo carro no pátio"). "Duração do toast" = quanto tempo ele fica visível (4000 ms = 4 segundos). Vamos renomear para "Duração do aviso na tela (segundos)".
- **Mostrar Externo**: pode sim. Basta marcar a caixa e clicar em "Salvar statuses por tela"; com nenhuma marcada, todos os status aparecem.

## 1. Pátios e grupos (Configurações do Pátio)
- Botão **Novo pátio**: cadastra um local próprio (nome) — passa a contar como pátio.
- Botão **Novo grupo** (ex.: "Pátios Arrais", "Oficinas externas", "Oficinas de pintura"): nome + lista pesquisável com caixinhas para escolher os locais que fazem parte. Editar, renomear e desativar grupos. Um local pode estar em mais de um grupo.
- Só Master cria/edita; todos veem.
- Tela do Pátio: além de "Pátio próprio" e "Serviço externo", uma aba por grupo, com total de carros e tempo no local.

## 2. Check-in/Check-out em Veículos
- Na ficha do veículo, botões **Registrar entrada** e **Registrar saída**:
  - Se o carro tem agendamento/oficina em aberto, a entrada/saída é ligada a ele (mesmo registro do Pátio).
  - Se não tem, registra **avulso pela placa**, escolhendo o local (pátio/oficina).
- Observação e foto/arquivo seguem as opções já existentes em Configurações (obrigatoriedade, foto, tamanho máximo). Fotos ficam em armazenamento privado.

## 3. Histórico de check-ins e check-outs
- Nova aba em **Históricos → Check-ins** (igual à consulta de O.S.): filtros por placa, período, local, tipo (entrada/saída), usuário e vínculo (agendamento/avulso); tabela paginada, exportação Excel e acesso à foto.
- Na ficha do veículo, lista dos check-ins/outs daquele carro.

## Detalhes técnicos
- Migração nova: tabelas `yard_groups` e `yard_group_members` (RLS: leitura autenticada, escrita só master via `has_role`); `check_in_records` ganha `plate`, `workshop_id` e `appointment_id` opcional (avulso), com validação por trigger; RPC protegida para registrar entrada/saída; bucket privado para fotos com políticas por usuário autenticado.
- Consultas paginadas (>1000); regras puras em `src/lib/yard-groups.ts` e `src/lib/check-in-log.ts` com testes.
- Não altera SGLOC, sem dados de teste, roadmap e AGENTS.md atualizados.
