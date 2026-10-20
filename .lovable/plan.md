# Pátio, encaminhamento e O.S. vinculada

## Resultado
- Corrigir o carregamento do Pátio, sem apagar agendamentos nem executar sincronização SGLOC.
- Mostrar **Pátio próprio** e **Serviço externo** em duas abas, com totais sempre visíveis; falhas aparecem como indisponibilidade, nunca como zero.
- Organizar externos por oficina e mostrar há quanto tempo o veículo está naquele local. Para registros antigos sem data de movimentação, mostrar “Sem registro de entrada”, sem inventar duração.
- Adicionar **Encaminhar para oficina** na ficha do agendamento e no Pátio para Master, Gerente e Atendimento; preservar o acesso atual do perfil Oficina, sem restringir seus veículos nesta atualização.

## Encaminhamento
1. Escolher oficina em lista pesquisável e confirmar os dados necessários da O.S.: placa, KM, loja, tipo e centro de custo.
2. Gravar encaminhamento e criar O.S. em uma única operação: se algo falhar, nada fica parcialmente salvo.
3. Vincular a O.S. ao agendamento e ao veículo pela placa normalizada; preencher os dados disponíveis do cadastro.
4. Se o agendamento já possuir uma O.S. ativa vinculada, apresentar essa O.S. e reutilizar o vínculo, sem criar duplicação silenciosa.
5. Atualizar imediatamente Agenda, Pátio e totais após confirmar, com número da O.S. e destino visíveis.

## Detalhes técnicos
- A atualização antiga do Pátio não pode ser aplicada como está: usa campos inexistentes (`profiles.role`, `edit_log.created_at`), não protege as tabelas novas e propõe fotos públicas. Criar migração aditiva corrigida, preservando as anteriores, com permissões explícitas, RLS e funções alinhadas às regras atuais.
- Usar `user_roles` para autorização; preservar limites de previsão, urgência, arquivamento e histórico existentes.
- Reutilizar `workshops`, `appointments`, `vehicles` e `ordens_servico`, sem catálogos ou ordens paralelos. Encaminhamento protegido no banco, com bloqueio de concorrência para evitar duas O.S. pelo mesmo clique.
- Registrar mudanças de local com data e autor para calcular tempo por oficina; não alterar configurações SGLOC nem enviar dados ao SGLOC nesta atualização.
- Consultas paginadas para não cortar totais em 1.000 registros; conferir erros de todas as consultas do Pátio.
- Manter fotos fora de acesso público; qualquer configuração de armazenamento seguirá as permissões do agendamento.

## Verificação
- Testar classificação pátio/externos, contagens, placa normalizada, permissões e prevenção de duplicação.
- Conferir carregamento autenticado, busca de oficina, confirmação do encaminhamento e leitura do vínculo da O.S. no painel.
- Não encaminhar um carro real apenas para testar: validar gravações com transações revertidas; indicar claramente qualquer confirmação visual de gravação que permaneça pendente.
- Atualizar regras do projeto e lista de tarefas; não publicar automaticamente.
