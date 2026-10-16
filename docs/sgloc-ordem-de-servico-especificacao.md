# SGLOC — Ordem de Serviço (O.S.): levantamento para replicação

Fonte: análise somente leitura de `arrais.sgloc.com.br/ordemservico` (lista), `/ordemservico/26997` (edição) e `/ordemservico/novo` (criação), em 15/10/2026. Nada foi gravado ou alterado no SGLOC.

## 1. Fluxo geral
1. **Lista** (`/ordemservico`): grid DevExtreme com agrupamento por coluna, filtros, exportação. Botões: Novo, Novo com IA, Limpar Filtro, Expandir/Fechar Grupos. Rodapé: Pesquisar, Limpar, Exportar Pagamento, Excluir Pagamento, Controle Aceites, Relatórios.
2. **Criar** (`/ordemservico/novo`): abre com Status = "Para aprovação", Data = hoje (somente leitura), Hora = agora, Loja e C. Custo pré-preenchidos, "Operador que recepcionou" = usuário logado, Autorização = usuário padrão, Pendência = "sem pendência".
3. **Editar** (`/ordemservico/{numero}`): duplo clique na linha da lista. Número é gerado pelo sistema (somente leitura).
4. **Ciclo de status** (valor → rótulo). Sequência principal: `2` Para aprovação → `4` Aprovada → `1` Em andamento → Finalizadas (código ainda não identificado). Status que fogem dessa sequência (podem ocorrer pelo caminho): `6` Em cotação, `5` Aguardando entrega e `3` Cancelada. O `1` é somente "Em andamento". Regra exibida na tela: **só é permitido finalizar O.S. aprovada.** (O filtro da lista ainda tem os agrupamentos "Finalizadas" e "NÃO FINALIZADAS"; o código do status "Finalizada" não aparece no select de edição, a confirmar.)
5. **Movimentação do veículo**: para movimentar o veículo, preencher na abertura e na finalização data, hora, km, tanque e posição. A data da O.S. deve ser maior que a da última movimentação. Veículos "alugados" não são movimentados.

## 2. Campos obrigatórios (aba Principal)
| Campo (name) | Rótulo | Obs. |
|---|---|---|
| OS_PLACA | Veículo | busca por placa/prefixo; ao escolher carrega contratos do veículo |
| OS_KM | Km | |
| OS_DATA | Data | somente leitura, = hoje |
| OS_LOJA | Loja | multi-loja (matriz + filiais) |
| OS_FORNEC | Oficina/Autopeças | fornecedor |
| OS_STATUS | Status | valores acima |
| OS_TIPOOS | Tipo O.S | 20 tipos (ver §4) |
| OS_CENTRO | C. Custo | ~170 centros |

## 3. Campos opcionais da aba Principal
OS_HORA, OS_TANQUE_INICIAL (Reserva, 1/8…7/8, Cheio), GNV_INICIAL (1–4), POSICAO_INICIAL, OS_TIPOATENDIMENTO (P Programado, E Emergencial, N Normal/Rotina, D Devolução), CONTRATO_ID, CONDUTOR (operador que recepcionou), CONDUTOR_NOME, CONDUTOR_CONTATO, OS_NF, RECUPERADO (sim/não), OS_EXTERNA (Referência O.S.), OS_OBS1/OS_OBS2, PREVISAO_CONCLUSAO, OS_CONPGTO (forma de pagamento), OS_SOLICITA, OS_AUTOR (autorização), OS_PENDENCIA (S/N) + OS_DESCPEND (habilita só com pendência), "Agendar serviços p/ próxima O.S", EXECUTADO (S Sim, A Em andamento, N Não), AUTORIZADOCLIENTE (Sim/Não/Pendente).

**Dados de finalização** (liberados na finalização): OS_DATAFINAL, OS_HORAFINAL, OS_KM_FINAL, OS_TANQUE_FINAL, GNV_FINAL, POSICAO_FINAL.

Posições iniciais: OR Oficina Revisão, OT Oficina Terceiros, OQ Pátio Controle Qualidade, OF Pintura e Funilaria. Posições finais: DQ, DC, DP, DL, DT, DV, DR, D0 (disponível/pátios).

## 4. Tabelas de apoio
- **Status:** 6 Em cotação, 5 Aguardando entrega, 2 Para aprovação, 4 Aprovada, 1 Em andamento, 3 Cancelada.
- **Tipo O.S (id → nome):** 35 Adaptação de veículos, 7 Assist. manutenção, 2 Avarias, 9 Combustível, 4 Inst. acessórios, 6 Lavagem, 1 M. corretiva, 37 M. preventiva, 32 Manut. interna locadora, 41 Pneus, 33 Rastreador, 40 Reparo diversos, 38 Retorno de serviços, 3 Revisão concessionária, 8 Serv. em garantia, 31 Funilaria, 34 Guincho, 36 Serviços externos, 39 Serviços interior, 5 Serviços elétricos.
- **Conta orçamentária** (itens e pagamentos): plano de contas com códigos tipo `02.13 - SERVIÇOS MECÂNICOS (EXTERNO) - DESPESAS OPERACIONAL`.
- Cadastros relacionados: Veículo (marca, modelo, categoria), Fornecedor, Centro de custo, Contrato, Cliente, Operador/usuário, Mecânico, Classificação de serviço.

## 5. Itens da O.S. ("Serviços Efetuados")
Colunas: Aprovação (Pendente/Autorizado/Negado), Cód. Serv, Cód. Peça, Descrição, Quant, Val. Unit., Total, Peça/Serviço, Conta Orçam., Mecânico, Laudo, Classificação, Solicitante, Autorizador, Criado, Atualizado, Data Movimentação, Observação, Última Ocorrência, ID Item.
Ações em lote: Marcar todos concluídos, Autorizar todos, Desautorizar todos.
Novo item: tipo Peça (saída no estoque) ou Serviço programado, Descrição, Quant. (padrão 1,00), Valor, Peça/Serviço, Conta Orçam., Data saída estoque, Observação, Mecânico, Laudo.
Totais: Total O.S., Total Serviço, Total Estoque, Total Compras, Total O.S. + Compras.

## 6. Abas
- **Observações do Cliente:** lista de observações (descrição, editar, excluir).
- **Pagamentos:** conta orçamentária, fornecedor, quant. parcelas, intervalo (dias), valor total, forma de pagamento (ex.: cartão de crédito), emissão, primeiro vencimento, dia de pagamento, documento. Usuários com permissão de "aceite" lançam pagamentos já aceitos.
- **Compras:** vincular/desvincular compras pelo número; totais O.S. e O.S. + compras.
- **Cotações:** até 3 fornecedores por item (valor unitário, total, prazo de pagamento).
- **Avaliação:** nota do fornecedor por critérios (Controle de Qualidade, Mercado Livre).
- **Orçamento do Cliente:** descrição para o cliente, quant., valor, imprimir no orçamento, formação de preço (taxa %), desconto, taxa de serviço, emissão, status do orçamento, negociação do cliente.
- **Recebimentos**, **Itens negados**, **Mecânicos**, **Anexos**.
- Painel lateral: Dados do cliente, Últimas locações, Recebimentos, Ordens de serviço do veículo.
- Botões do rodapé: Voltar, Gravar, Ordem Serviço (impressão), Resumo O.S, O.S Interna.

## 7. Colunas da lista (para compatibilidade de exportação)
Status, Status Pgto, Tipo, No., Tipo Atendimento, Data Abertura, Data Finalização, Placa, Prefixo, Modelo, KM, Pos. Op., Oficina, Centro Custo, Nota Fiscal, Total O.S., Total Compras, Total OS + Compras, Valor ORC., Valor PGTO Cliente, Total O.S Estoque, Total O.S Serviço, Contrato, Operador, Cliente (avarias), Recuperado, Negociação Cliente, Executado, Autorizado Cliente, Nota Cliente.
Status Pgto observado: "Não Lançado".

## 8. Filtros da lista
Status/legenda, Tipo O.S/legenda, Número O.S., C. Custo, Recuperado, Referência O.S., Data inicial/final (padrão = mês corrente), Palavra-chave, Oficina/Autopeças, Nº Compra, Com pendência(s), Loja, Placa/Prefixo, Montadora, Modelo, Contrato, Informação de pagamento (Em aberto/Pago/Cortesia), Peça (estoque), Categoria do veículo, Cliente, Tipo de atendimento, Mecânico, Classificação de serviço.

## 9. Aprofundamento (rodada 2)

### 9.1 Onde a O.S. nasce e de onde é chamada
- **Menu Frota → Ordem de Serviço** (`/ordemservico`): criação manual.
- **Agenda Manutenção de Veículos** (`/agendamanutencao`): é a *solicitação* que antecede a O.S. Campos: placa*, tipo de atendimento, data de cadastro*, agendado para*, hora*, KM do agendamento, solicitante (nome e telefone), **número da O.S.**, local/oficina, número da O.S. externa, problema relatado, realizado (S/N), observação, grupo do veículo/data/hora de reserva*. Tem o botão **"Gerar O.S"**, que liga o agendamento à O.S. (campo número da O.S.). Na lista: Placa, ID, Realizado, Tipo (ex.: Normal), Data Cadastro, Data Atendimento, Hora, Loja, Modelo, Contato, fornecedor, Local/Oficina, Problema relatado, Observação, Operador, O.S Externa.
- **Plano de Manutenção / Programação de Serviços** (`/planomanutencao/v2`, `/programacaoservicos`, `/programacaomodelo`, `/itens-manutencao`): alimenta "Serviço Prog." dentro dos itens da O.S. e o histórico da O.S. Interna.
- **Painel Oficina** (`/painel-oficina`): quadro por oficina com O.S. **Aprovada** e **Em andamento** (placa, modelo, status, nº, fornecedor, data, tempo parado). Atualiza sozinho.
- **Lavagem** (`/lavagem`), **Cotação de Peças e Serviços** (`/cotacao`), **Ordem de Compras** (`/compras`, vinculável à O.S.), **Movimento em estoque** e **Estorno O.S / Compras** (`/movimento-estoque`, `/estorno-estoque`), **Ocorrências / Sinistros** e **Movimentação de Veículos** (a O.S. movimenta o veículo).
- **Controle de Aceites** e **Exportar/Excluir Pagamento** (rodapé da lista): ligam a O.S. ao financeiro (contas a pagar).
- **Novo com IA**: abre um modal "Nova Ordem de Serviço com I.A" onde se carrega um PDF/imagem (nota ou orçamento); a IA devolve os dados para o usuário conferir e então "Lançar". Há o aviso de conferir os dados retornados.

### 9.2 Cadastros que configuram a O.S.
- **Status Ordem Serviço** (`/status-ordem-servico`): 7 status, todos "padrão do sistema": Finalizadas, Em andamento, Para aprovação, Canceladas, Aprovada, Aguardando entrega (5), Em cotação (6). Códigos conhecidos: 1, 2, 3, 4, 5, 6. "Finalizadas" aparece no select de edição só quando a O.S. já está finalizada (na O.S. 21196 o status lido foi "Finalizadas").
- **Tipo Ordem Serviço** (`/tipo-ordem-servico`): cada tipo tem flags **Ativo**, **Entra custo manut. veículos** (`CALC_RENTABILIDADE_VEIC`) e **Exibe abas de recebimento** (`EXIBE_ABAS_RECEBIMENTO`). Abas de Recebimento = Sim em AVARIAS, M.CORRETIVA, PNEUS (e possivelmente outros tipos além dos 10 listados na tela). Todos os tipos vistos entram no custo de manutenção. Há ainda campos de disponibilidade (grupo, data, hora).
- **Classificação de Serviço**, **Plano de Contas**, **Centro de Custo / Centro de Resultado**, **Posição Operacional**, **Fornecedores**, **Tipos de Pagamento/Recebimento**, **Estoque (grupos e produtos)**.

### 9.3 Finalização (observado em O.S. finalizada nº 21196)
- Status "Finalizadas" com **data final 30/04/2026 e hora final 18:00**; km final, tanque final e posição final ficaram **em branco**, então não são exigidos para finalizar quando a movimentação não se aplica. Execução = "Não" e Autorizado cliente = "Não" também ficaram assim.
- Os campos de finalização continuam editáveis após finalizar.
- Itens mantêm "Criado", "Atualizado" e "Data Movimentação" (data da saída de estoque).
- O status de pagamento da lista evolui por conta do financeiro: **Não Lançado → (A vencer) → Vencido → Pago**; valores vistos: Não Lançado, Vencido, Pago.

### 9.4 Impressos (somente leitura)
- **Resumo O.S:** cabeçalho da empresa (matriz/filial), nº, tipo, veículo/modelo/ano/km/centro de custo, abertura e finalização, dados do fornecedor, itens, compras vinculadas, totais, observações, solicitante e autorização (1ª via).
- **Ordem de Serviço:** igual, na 2ª via, com forma de pagamento.
- **O.S Interna:** acrescenta tanque, operador que recepcionou e o **histórico de manutenção do veículo** (bomba d'água, correias, filtros, óleo, pastilhas, pneus etc., com data e km do último serviço).

## 9.5 Rodada 3 (15/10/2026)

**O.S. de teste gravada:** nº **27012**, placa SZM2E12 (TRANSIT 410 B), Km 42888 (preenchido automaticamente com o último km), data/hora de abertura, loja GRUPO NC CAPITAL, fornecedor ARRAIS E CIA LTDA., status "Para aprovação" (padrão), tipo ASSIST. MANUNTENÇÃO, C. Custo 37 - NC LOCADORA (padrão), observação "TESTE TESTE", autorização EDER DUARTE (padrão), sem itens. Ao gravar o sistema mostra o aviso "Ordem de Serviço gravada com sucesso!" e pergunta "Deseja imprimir a Ordem de Serviço?" (Não/Sim); depois exibe o impresso (1ª via) com o número. O número é sequencial global (a anterior era 26997 e existem O.S. anteriores à 27012 de outras lojas). Permaneceu na tela de edição `/ordemservico/27012`.
Comportamentos vistos na criação: ao escolher a placa carrega km, contratos do veículo e "Serviços Programados" (avisos "Contratos do veículo carregado com sucesso" e "Serviços Programado atualizados"); o campo Veículo é autocomplete (placa | Ativo | data de compra | ano | modelo).

**Canceladas (loja GRUPO NC CAPITAL):** 56 no total e 7 de 15/07 a 15/10/2026. Não existe status "negada" no nível da O.S.: a negação é por item (Aprovação = Negado).

**Aprovação:** campo "Autorização" (OS_AUTOR) lista 7 autorizadores cadastrados e vem com um padrão; cada item também tem "Autorizador" próprio (Pendente/Autorizado/Negado). Quem pode mudar para "Aprovada" depende de permissão por perfil (tela Perfis sem acesso para o usuário atual).

**Cadastros:** Fornecedor novo exige só Nome/Razão Social (demais opcionais, com flags "Oficina/Peças" e "Concessionária" que definem onde aparece); Veículo novo exige Placa, Chassi, Grupo, Loja Operação, Loja Proprietária, Status, Montadora/Modelo, Categoria, Ano/Modelo, Combustível, Tanque e Estado. Ambos têm botão Excel na lista.

**Tipos de O.S.:** os 20 estão Ativos e entram no custo de manutenção; só AVARIAS, M.CORRETIVA e PNEUS exibem as abas de recebimento.

**Tipo de campo dos filtros da lista:**
- Caixa de seleção múltipla com pesquisa (bootstrap-select): Status, Tipo O.S.
- Caixa de seleção única com pesquisa (select2): C. Custo, Recuperado, Loja, Montadora, Modelo, Informação de Pagamento, Peça (estoque), Categoria Veículo, Mecânico, Classificação de Serviço; Oficina/Autopeças e Cliente com busca remota.
- Seleção simples sem pesquisa: Tipo Atendimento.
- Texto: Número O.S., Referência O.S., Palavra-chave, Nº Compra, Placa/Prefixo, Contrato.
- Data com máscara e calendário: Data Inicial e Data Final (padrão: mês corrente).
- Caixa de marcação: Com Pendência(s).

## 10. Lacunas ainda não verificadas
- O **código numérico** de "Finalizadas" e as validações de servidor ao finalizar (só observei o front-end; não finalizei nenhuma O.S. por ser ação de escrita).
- Resultado real do "Novo com IA" (não enviei documento).
- O que o botão "Gerar O.S" preenche (não acionei).
- Permissões por perfil (aceite, autorização, quem pode excluir).
- Integração financeira detalhada (geração de contas a pagar a partir de Pagamentos, estorno).
- Os tipos de O.S. além dos 10 primeiros nos flags (a tela mostra 10 linhas).

## 11. Sugestão de modelo para o nosso sistema (rascunho, a discutir)
Tabela `ordens_servico` com os campos obrigatórios acima como NOT NULL, `numero` sequencial, `status` com os mesmos códigos, `tipo_os_id`, `centro_custo_id`, `loja_id`, `fornecedor_id`. Tabela filha `os_itens` (§5), tabelas `os_pagamentos`, `os_compras`, `os_cotacoes`, `os_observacoes_cliente`, `os_anexos`. Manter os mesmos rótulos de colunas da lista (§7) para facilitar exportações e conciliação com o SGLOC.
