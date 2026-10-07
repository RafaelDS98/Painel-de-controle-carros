# ANPEXC — Guia do Projeto

Este documento orienta pessoas e assistentes de IA que precisam entender, manter ou ampliar o painel de agendamentos de manutenção da ANPEXC.

## 1. Objetivo do sistema

O projeto é um painel operacional, em português do Brasil, para acompanhar a agenda semanal de manutenção da frota ANPEXC. A tela principal reúne:

- importação e substituição da agenda por planilha;
- filtros e busca instantânea;
- indicadores operacionais;
- grade semanal de segunda a sábado;
- atualização da situação de cada veículo;
- seis gráficos de distribuição;
- tabela detalhada, ordenável e paginada;
- exportação dos dados filtrados em CSV ou Excel;
- ficha completa do agendamento em modal;
- temas claro e escuro.

## 2. Estado atual

- Os dados ficam no Lovable Cloud: `appointments`, `profiles`, `edit_log` e `contact_log` (as duas últimas ainda sem uso).
- É preciso entrar com e-mail e senha em `/auth`. Quem não tem `role` em `profiles` vê "Aguardando liberação de acesso".
- O primeiro master é promovido manualmente no backend.
- A importação de planilha INSERE registros (não apaga os existentes). A coluna opcional "Previsão de Entrega" preenche `original_deadline` e `current_deadline`.
- A troca de situação grava direto no banco.
- `agenda-data.ts` serviu apenas para a carga inicial única dos 21 registros.

## 3. Stack e comandos

- TanStack Start v1 e TanStack Router, com rotas baseadas em arquivos;
- React 19 e TypeScript;
- Vite;
- Tailwind CSS v4;
- componentes shadcn/ui baseados em Radix UI;
- Recharts para os gráficos;
- SheetJS (`xlsx`) para importação e exportação;
- Lucide React para ícones.

Comandos principais:

```bash
bun install
bun run dev
bun run build
bun run lint
bun run format
```

Use `bun` para dependências e scripts. Não introduza React Router DOM: o roteamento deste projeto é TanStack Router.

## 4. Mapa do código

```text
src/
├── components/
│   ├── maintenance-dashboard.tsx  # Toda a experiência operacional atual
│   └── ui/                        # Componentes reutilizáveis shadcn/ui
├── lib/
│   ├── agenda-data.ts             # Dataset inicial real, em formato de planilha
│   └── utils.ts                   # Utilitário `cn` para classes
├── routes/
│   ├── __root.tsx                 # Documento HTML, providers e tratamento global
│   └── index.tsx                  # Rota `/` e metadados próprios da página
├── router.tsx                     # Criação do router e QueryClient
├── start.ts                       # Configuração de início do TanStack Start
└── styles.css                     # Tailwind v4 e tokens semânticos do tema
```

`src/routeTree.gen.ts` é gerado automaticamente. Nunca edite esse arquivo manualmente.

## 5. Fluxo dos dados

### Dataset inicial

`initialAgenda` mantém os nomes de colunas da planilha original. Ao carregar o módulo do painel, `normalizedInitial` converte cada linha para o tipo interno `Appointment`:

| Coluna da planilha | Campo interno |
| --- | --- |
| ID | `id` |
| Data Cadastro | `registeredAt` |
| Data Atendimento | `date` |
| Hora | `time` |
| Placa | `plate` |
| Loja | `store` |
| Modelo | `model` |
| Contato | `contact` |
| Local/Oficina | `workshop` |
| Problemas Relatado | `issue` |
| Observação | `note` |
| Operador | `operator` |
| O.S Externa | `externalOrder` |

O campo interno `status` não existe na planilha original e começa vazio.

### Importação

O botão **Importar agenda** aceita `.xlsx`, `.xls` e `.csv`. O arquivo é lido no navegador por importação dinâmica de `xlsx`, sempre usando a primeira aba.

A importação exige, com grafia idêntica, todas estas colunas:

```text
ID
Data Cadastro
Data Atendimento
Hora
Placa
Loja
Modelo
Contato
Local/Oficina
Problemas Relatado
Observação
Operador
O.S Externa
```

Se faltar qualquer coluna, a substituição é interrompida e a interface informa os nomes ausentes. Datas são normalizadas para `YYYY-MM-DD`; horas são normalizadas para `HH:mm`. Toda agenda importada começa sem situações definidas.

### Transformações derivadas

O array `filtered` é a fonte de todos os indicadores, gráficos e resultados exibidos. Ele combina:

- texto em placa, contato, problema ou modelo;
- período de atendimento;
- contato;
- oficina;
- modelo;
- operador.

`sorted` aplica a ordenação da tabela sobre `filtered`. As exportações usam `sorted`, portanto respeitam todos os filtros e a ordenação ativos.

### Classificação dos serviços

`serviceCategory()` classifica o texto de **Problemas Relatado** por palavras-chave e nesta prioridade:

1. `FREIO` → Freios;
2. `SUSPENS` → Suspensão;
3. `PNEU`, `ALINH` ou `BALANCE` → Pneus;
4. `REVIS` ou `MANUTEN` → Revisão;
5. demais textos → Corretiva.

Como a função retorna uma única categoria, a ordem acima afeta registros que citam vários tipos de serviço. Preserve essa decisão ou altere-a conscientemente com testes.

## 6. Situações dos veículos

O tipo `ServiceStatus` permite exatamente:

- vazio — situação ainda não atualizada;
- **Recebido** — o cliente chegou para realizar o serviço;
- **Em execução** — o veículo está em serviço;
- **Peça** — o veículo aguarda compra de peça;
- **Finalizado** — o serviço terminou e o veículo foi entregue.

`updateStatus()` atualiza o registro no estado principal e sincroniza o registro aberto no modal. A situação aparece na grade, na tabela, no modal e nas exportações.

Ao adicionar uma situação, atualize conjuntamente:

1. o tipo `ServiceStatus`;
2. `serviceStatuses`;
3. `statusClasses()`;
4. os tokens correspondentes em `src/styles.css`;
5. qualquer regra de importação ou exportação aplicável.

## 7. Estrutura da tela

`MaintenanceDashboard` concentra a tela atual e segue esta ordem:

1. cabeçalho da marca, importação e alternância de tema;
2. título e período carregado;
3. mensagem de importação ou erro;
4. busca e filtros;
5. cinco KPIs;
6. grade semanal;
7. seis gráficos Recharts;
8. tabela detalhada e paginação;
9. modal da ficha do agendamento.

Os KPIs são calculados sobre os registros filtrados:

- total de agendamentos;
- placas únicas;
- contatos únicos;
- oficinas preenchidas e únicas;
- média de agendamentos por data com movimento.

A tabela mostra oito linhas por página. Ao criar filtros novos, redefina a página para 1 para evitar uma página vazia depois da filtragem.

## 8. Padrões de interface e design

### Tokens antes de cores diretas

As cores e funções visuais vivem em `src/styles.css`, usando variáveis em `oklch` registradas no bloco `@theme inline`. Em JSX, use classes semânticas como:

- `bg-background`, `text-foreground`;
- `bg-card`, `text-card-foreground`;
- `bg-primary`, `text-primary-foreground`;
- `text-muted-foreground`, `border-input`, `ring-ring`;
- `bg-service-review`, `bg-service-repair`;
- `bg-status-received`, `bg-status-progress`, `bg-status-part`, `bg-status-finished`.

Não coloque valores hexadecimais, RGB/HSL ou cores utilitárias rígidas nos componentes. Sempre defina primeiro um token semântico com variantes clara e escura.

### Componentes e controles

- Use os componentes existentes em `src/components/ui` para botões, campos e diálogos.
- Use `cn()` para classes condicionais.
- Use ícones Lucide em ações compactas e forneça `aria-label` quando não houver texto visível.
- Evite botões HTML crus quando existir um componente equivalente.
- Não aninhe elementos interativos. O card da grade usa um artigo, uma ação de detalhes e um seletor de situação como controles irmãos.
- Mantenha textos operacionais em português do Brasil.
- Preserve boa leitura em desktop, notebook e tablet, incluindo rolagem horizontal da tabela larga.

### Tema escuro

O tema escuro é local ao contêiner do painel: o estado `dark` adiciona a classe `.dark` ao elemento principal. Se o tema passar a ser global ou persistente, revise essa estratégia para evitar diferenças entre o documento e o painel.

## 9. Rotas e metadados

- `/` é definida em `src/routes/index.tsx` e renderiza `MaintenanceDashboard`.
- `src/routes/__root.tsx` deve continuar renderizando `<Outlet />`.
- Toda nova rota deve ser criada em `src/routes` e ter metadados exclusivos: título, descrição, `og:title`, `og:description`, `og:type` e `twitter:card`.
- Não crie um `App.tsx` para trocar páginas manualmente.
- Não edite `index.html` para metadados; use `head()` na rota.

## 10. Convenções para alterações

1. Preserve os nomes reais das colunas da planilha na camada de entrada.
2. Normalize dados externos antes de colocá-los no estado `Appointment`.
3. Derive KPIs e gráficos do mesmo conjunto filtrado; não mantenha cópias calculadas em estado.
4. Use `useMemo` para transformações relevantes dependentes de estado.
5. Não use afirmação TypeScript não nula (`!`); trate valores ausentes explicitamente.
6. Não invente dados de frota, clientes, oficinas ou serviços.
7. Ao adicionar um link para outra página, crie a rota correspondente na mesma alteração.
8. Para regras novas de negócio, documente os significados e casos-limite antes de espalhá-las pela interface.
9. Se o painel continuar crescendo, extraia seções focadas de `maintenance-dashboard.tsx` sem duplicar o estado principal ou a lógica de filtragem.

## 11. Persistência futura

Caso seja solicitado histórico, colaboração entre operadores ou conservação das situações após recarregar, será necessário adicionar uma camada persistente. Uma implementação segura deve:

- armazenar agendamentos e situações de forma centralizada;
- identificar usuários antes de permitir alterações;
- registrar quem alterou cada situação e quando;
- controlar permissões no servidor, nunca no armazenamento do navegador;
- evitar que uma nova importação apague silenciosamente o histórico;
- definir uma chave estável para conciliar registros importados, em vez de depender apenas da posição da linha.

Até essa implementação existir, não use `localStorage` como substituto de banco para dados operacionais compartilhados.

## 12. Campos novos, normalização e "dado vazio nunca quebra a tela"

### Mapa dos campos novos (appointments)
| Coluna | Rótulo | Origem no export do SGLOC |
|---|---|---|
| brand | Marca | — (digitado) |
| contact_number | Telefone do contato | — (digitado) |
| km_scheduled | KM do agendamento | — (inteiro >= 0) |
| os_number | O.S Fornecedor | "OS FORNEC" (numérico) |
| schedule_type | Tipo (E = Emergencial, N = Normal) | "Tipo" (HTML removido; contém "emerg" → E) |
| sgloc_reference | ID SGLOC | "ID" quando numérico; nunca duplicado |
| store_id, operator_id, supplier_id, client_id | códigos do SGLOC | Fase 2 |
| sgloc_sync_state, sgloc_synced_at, sgloc_last_error, sgloc_missing_count | controle técnico | nunca exibidos nem exportados |

### Normalização (`src/lib/normalize.ts`)
- Placa: maiúsculas, só letras e números. Data: AAAA-MM-DD, DD/MM/AAAA, Date ou serial do Excel; inválida vira vazio. Hora: HH:mm ou HH:mm:ss vira HH:mm; inválida vira vazio. HTML é removido e entidades decodificadas. Qualquer valor vira texto aparado.

### Regra "dado vazio nunca quebra a tela" (`src/lib/agenda-safety.ts`)
- Campo vazio ou nulo aparece como "—" em cards, tabela, ficha, KPIs e gráficos; nunca "undefined", "null" ou "Invalid Date".
- Registro sem data aparece no grupo "Sem data" da grade e como "—" na tabela; filtros por período o excluem (exceto sem período); na ordenação por data ele fica por último.
- Filtros e agrupamentos comparam sem diferenciar maiúsculas e acentos e mostram o texto como veio; vazios aparecem como "(sem valor)".
- Gráficos vazios mostram "Sem dados no período"; médias nunca dividem por zero; a paginação se ajusta quando o filtro reduz o total.
- Textos longos: uma linha com dica na tabela, até duas linhas no cartão, quebras preservadas na ficha.
- Exportação CSV/Excel: escapa aspas, vírgulas, ponto e vírgula e quebras de linha; nulos viram vazio; textos começando com =, +, - ou @ recebem apóstrofo; colunas técnicas nunca entram.
- Falha ao carregar mostra mensagem com "Tentar de novo"; grade, gráficos, tabela e ficha têm proteção própria para um erro não derrubar o painel.
- Planilhas exportadas pelo SGLOC declaram dimensão errada (ex.: A1:C1 com 129 linhas x 16 colunas); sempre recalcular o !ref antes de ler (`fixSheetRange`), na importação manual e na edição em lote.
- O fixture sintético `src/lib/sgloc-fixture.ts` cobre os casos estranhos do export e é usado nos testes.

## 13. Checklist antes de concluir uma mudança

- O projeto compila sem erros.
- A tela inicial abre com os registros padrão.
- Busca, filtros, grade, KPIs e gráficos continuam consistentes entre si.
- Situações atualizam grade, modal, tabela e exportação.
- Importação válida funciona e uma coluna ausente produz mensagem clara.
- CSV e Excel exportam apenas os resultados filtrados.
- O modal abre pelo card e pela linha da tabela.
- Não há elementos interativos aninhados nem erros no console.
- A interface foi conferida em desktop e tablet.
- Metadados da rota continuam específicos da ANPEXC.
- O fixture do SGLOC é importado sem erro (testes automáticos passando).
- Nenhuma tela mostra "undefined", "null" ou "Invalid Date".
- A exportação sai correta com textos que têm quebra de linha, aspas e vírgulas.

## 14. Contexto do repositório

O repositório é sincronizado com o Lovable. Não reescreva histórico já publicado com force push, rebase, amend ou squash. Mantenha a branch conectada sempre em estado funcional.
## Excluir = arquivar (Lixeira)
- "Excluir" na tela arquiva o agendamento; só master exclui e restaura (validado no banco). Arquivados somem de agenda, indicadores, gráficos, filtros e exportação; ficam na Lixeira (só master) e não podem ser editados até restaurar. Exclusão e restauração ficam no histórico com placa, data e loja. A importação nunca recria um ID SGLOC arquivado.

## Filtro cruzado dos gráficos
- Clicar em barra/fatia/ponto seleciona; clicar de novo desmarca; Ctrl/Cmd soma; Esc ou "Limpar tudo" limpa. Seleções filtram cartões, outros gráficos, balões, grade e lista (E entre gráficos, OU no mesmo). Itens dos balões também alternam.

## Lote A — sincronização manual, setor e listas
- `sgloc_settings.auto_sync_enabled` (padrão desligado) liga a rotina de tempo em tempo; `enabled` continua sendo só a integração/envio. Desligada: "Próxima prevista: desligada (somente manual)" e só um aviso neutro na agenda se a última atualização real tiver mais de 24 h.
- Botão "Atualizar do SGLOC" (oficina, gerente, master): sincronização real com a conta designada, 1 a cada 2 min no total, mensagens claras se modo simulação, sem conta ou conexão expirada. A recarga da agenda a cada 2 min pausa com a aba oculta.
- Filtro "Setor": setor do usuário que criou o agendamento (`profiles.sector`, via `appointment_creator_sectors()`); sem criador = "(sem valor)". Entra em filtros ativos, KPIs, gráficos, grade, tabela e exportação (coluna "Setor").
- Listas: adicionar/renomear/desativar/excluir só master e gerente (`catalog_add` manual, `catalog_update`, `catalog_delete`, `catalog_usage`); importação/SGLOC continuam cadastrando o que falta. Excluir preserva o texto nos agendamentos; excluir setor tira o setor dos usuários. Gerente acessa pelo botão "Listas".
