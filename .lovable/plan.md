# Backlog ANPEXC — organizado por prioridade

Formato profissional: cada item tem ID, prioridade (P0 crítico, P1 importante, P2 desejável), tamanho (P/M/G) e critério de pronto. O backlog vira a seção principal do `roadmap.md`, substituindo as listas soltas (o histórico concluído vai para um bloco "Concluído" no fim).

## Sprint 1 — Fechar o que está aberto e validar (P0)
| ID | Item | Tam. | Pronto quando |
|---|---|---|---|
| QA-01 | Testar uma vistoria completa logado (celular): campos, checklist, fotos com edição, assinaturas, laudo PDF | M | PDF sai com logo, fotos e assinaturas; aparece no Ao Vivo sem recarregar |
| QA-02 | Corrigir logo ausente no laudo PDF | P | Logo visível no PDF |
| QA-03 | Testar encaminhamento real com conta Atendimento | P | Carro aparece na Oficina com aviso imediato |
| QA-04 | Testar perfil Oficina (quadro, O.S., notícias, aviso) | P | Sem erros de acesso |
| VIS-01 | Fila offline: rascunhos pendentes enviados sozinhos quando a internet volta | M | Vistoria feita sem rede chega ao servidor sozinha |

## Sprint 2 — Vistorias Etapa 3: Configurações (P1)
| ID | Item | Tam. |
|---|---|---|
| VIS-10 | Editor Master de tipos de operação (tipo base, questionários permitidos, ativar/ordem) | M |
| VIS-11 | Editor de grupos e campos (tipo, obrigatório, ordem por arrastar, copiar) | G |
| VIS-12 | Editor de questionários (perguntas, fotos exigidas, nº de pneus) | M |
| VIS-13 | Termo de aceite e textos do laudo editáveis | P |
| VIS-14 | Página pública de validação do código do laudo | P |
| VIS-15 | Filtros por vistoriador e cliente na lista | P |
| VIS-16 | Entrada/Saída manutenção registra movimento no Pátio | M |

## Sprint 3 — Vistorias Etapas 4 e 5 (P1/P2)
- VIS-20 Cadastro de clientes com contatos/e-mails (M)
- VIS-21 Envio automático do laudo por e-mail (M)
- VIS-22 Relatórios por período/vistoriador com exportação (M)
- VIS-30 Leitura de placa e QR Code pela câmera (G)
- VIS-31 Cerco geográfico configurável por operação (G)
- VIS-32 Autoinspeção por link com validade (G)
- VIS-33 Mapa das vistorias na página inicial (M)

## Sprint 4 — O.S. e substituição do SGLOC (P1)
- OS-01 Pagamentos, compras, cotações e anexos na O.S. (G)
- OS-02 Filtro Categoria do veículo e montadora por O.S. (P)
- SG-01 Tarefa agendada da sincronização SGLOC (15 min)
- SG-02 Ativar envio real ao SGLOC com teste controlado
- SG-03 Plano de desligamento do SGLOC: checklist do que ainda depende dele

## Dependem do Rafael (bloqueados)
- DEP-01 Escolher pátios próprios em Pátio → Configurações → Locais
- DEP-02 Lista de lojas (código/nome) e planilha das O.S. com coluna Loja
- DEP-03 Decidir limpeza da linha "1146 VEÍCULOS" e montadora "MITISHUBISH"
- DEP-04 Base complementar da frota (reserva, tipo, ano, status operacional)
- DEP-05 Exportação do VEX para importar histórico (Etapa 6)
- DEP-06 Definições dos módulos Motoristas, Contratos, Financeiro e Relatórios
- DEP-07 Cor da situação "Recebido" em Configurações > Situações

## Qualidade contínua (P2)
- TEC-01 Testes automáticos das regras de vistoria (obrigatórios, numeração, cancelamento, comparação)
- TEC-02 Revisão de segurança do banco (verificação automática) e correção dos alertas
- TEC-03 Revisão visual claro/escuro e celular das telas de Vistorias
- TEC-04 Atualizar o documento de continuidade a cada sprint

## Como trabalhamos
- Um sprint por vez; cada item fecha com teste real e marcação no backlog.
- Pedidos novos entram primeiro no backlog com ID e prioridade, depois são encaixados.

## Detalhes técnicos
- Reescrever `roadmap.md` com as seções acima; preservar "Como continuar" e mover itens `[x]` para "Concluído".
- Nenhuma mudança de código ou banco nesta entrega.
