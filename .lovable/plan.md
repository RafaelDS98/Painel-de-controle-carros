# Pátio, encaminhamento, O.S. vinculada e frota

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

## Veículos da empresa
- Ativar **Veículos** no menu e abrir a tela com todos os carros cadastrados, sem exigir pesquisa inicial.
- Importar as 1.138 linhas da planilha enviada, conciliando com a frota existente pela placa normalizada: atualizar veículos conhecidos e adicionar os novos, sem apagar os ausentes ou duplicar placas. Linhas inválidas aparecem em um resumo da importação.
- Mostrar lista paginada com placa, modelo, montadora, loja, posição operacional, categoria, KM e situação, com ficha detalhada do veículo e suas O.S. vinculadas.
- Manter os filtros da referência SGLOC: placa, chassi, montadora, modelo, posição operacional, situação, categoria, grupo, ano/modelo, prefixo, ano de emplacamento, reserva, estado, final de placa, loja/tipo de loja, idade em meses, status do veículo e tipo; ordenação por final de placa. Filtros de informações ainda ausentes na planilha serão identificados como indisponíveis, sem inventar valores.
- Master e Gerente terão **Novo veículo**, com validação e prevenção de placa duplicada no banco; sem limite de frota.
- Todos os perfis terão acesso por padrão. Master poderá permitir ou bloquear o acesso à tela individualmente em Usuários; o bloqueio será validado no banco, não apenas escondendo o menu.
- Usar os campos adicionais presentes na planilha para preservar os dados de compra, propriedade e seguro, respeitando as permissões; não incluir ações financeiras, acessórios ou depreciação nesta etapa.

## Detalhes técnicos
- A atualização antiga do Pátio não pode ser aplicada como está: usa campos inexistentes (`profiles.role`, `edit_log.created_at`), não protege as tabelas novas e propõe fotos públicas. Criar migração aditiva corrigida, preservando as anteriores, com permissões explícitas, RLS e funções alinhadas às regras atuais.
- Usar `user_roles` para autorização; preservar limites de previsão, urgência, arquivamento e histórico existentes.
- Reutilizar `workshops`, `appointments`, `vehicles` e `ordens_servico`, sem catálogos ou ordens paralelos. Encaminhamento protegido no banco, com bloqueio de concorrência para evitar duas O.S. pelo mesmo clique.
- Registrar mudanças de local com data e autor para calcular tempo por oficina; não alterar configurações SGLOC nem enviar dados ao SGLOC nesta atualização.
- Consultas paginadas para não cortar totais em 1.000 registros; conferir erros de todas as consultas do Pátio.
- Reutilizar a tabela `vehicles` e adicionar apenas campos faltantes; controle individual do módulo Veículos separado de dados pessoais e dos demais módulos. Preservar buscas mínimas de veículo necessárias à O.S. conforme as permissões atuais, sem expor a ficha completa a quem foi bloqueado.
- Manter fotos fora de acesso público; qualquer configuração de armazenamento seguirá as permissões do agendamento.

## Verificação
- Testar classificação pátio/externos, contagens, placa normalizada, permissões e prevenção de duplicação.
- Testar conciliação da frota, cadastro restrito a Master/Gerente e bloqueio individual da tela Veículos, além dos filtros com valores concretos.
- Conferir carregamento autenticado, busca de oficina, confirmação do encaminhamento e leitura do vínculo da O.S. no painel.
- Não encaminhar um carro real apenas para testar: validar gravações com transações revertidas; indicar claramente qualquer confirmação visual de gravação que permaneça pendente.
- Atualizar regras do projeto e lista de tarefas; não publicar automaticamente.
