# Revisão visual e de responsividade do painel

Análise feita nas telas Home, Agenda, Oficina/Pátio, Consultas, Ordens de Serviço, Veículos e Dashboard, nos modos claro e escuro, no computador (1280px) e no celular (390px).

## Problemas encontrados

**Barra superior**
- Na Agenda, os atalhos se sobrepõem ao título ("Nova O.S." escrito em cima de "Agenda") e aparecem botões a mais (Minha conta, Históricos, Lixeira, Importar agenda) que não cabem.
- No celular, a barra quebra: o nome da tela fica cortado, um botão aparece pela metade na esquerda e os atalhos ficam empilhados por cima do caminho "ANPEXC > Agenda".

**Botões duplicados e espaços vazios**
- Pátio da Oficina: aparece um segundo cabeçalho azul ("ANPEXC / Pátio da Oficina") com sino duplicado, tema, sair e Config, repetindo a barra superior.
- Agenda, Oficina, Consultas e O.S.: os botões de módulo no topo repetem o que o menu lateral já mostra (Agenda > subtelas).
- Ordens de Serviço: "Ir para a Agenda" e "Nova O.S." ficam em duas linhas separadas, com espaço vazio; "Nova O.S." também já está na barra superior.
- Agenda: "Filtros ativos" fica numa faixa separada por duas linhas finas, longe dos filtros; o resumo "Hoje / Esta semana" ocupa outra faixa inteira. Somadas, são cerca de 150px de espaço vazio antes dos indicadores.
- Agenda: "Última atualização", "Atualizar do SGLOC", "Recarregar" e "Período carregado" ficam em 3 caixas soltas; dá para juntar numa só linha compacta.
- Agenda: a linha "Todas as oficinas" ocupa a largura toda sozinha.
- Indicadores (6 cartões): ficam altos e com tamanhos diferentes porque alguns títulos quebram em duas linhas.
- Grade semanal: Sexta e Sábado vazios ocupam a mesma largura dos dias cheios, o que deixa as placas e modelos cortados ("QDS5…", "DUSTER INTE…"). O botão "Abrir agendamento" estoura a largura do cartão.
- Pátio: o cartão "Total no pátio 0" repete a contagem que já aparece na aba "Pátio próprio · 0".
- Home: o destaque usa só 2/3 da largura, deixando um bloco vazio à direita.

**Celular**
- Os botões de módulo quebram em duas linhas.
- Na Agenda, as listas de filtros ficam achatadas (altura menor que o texto) e os 6 filtros empilhados empurram a agenda para baixo da tela.
- Em Veículos, os 10+ filtros aparecem todos abertos, um por linha, antes da lista. Os campos de lista têm larguras diferentes dos de texto.

**Leitura das letras (claro/escuro)**
- Escuro: os títulos de notícia na Home ficam em azul-marinho sobre o fundo azul-escuro, quase invisíveis. O ícone da Home ativa e os ícones do "Resumo da operação" também somem.
- Escuro: a etiqueta da notícia em destaque ("Atualizações no ponto eletrônico") fica apagada sobre a foto.
- Escuro: o botão principal (azul-marinho) tem pouco contraste com o fundo; "Pesquisar" e "Nova O.S." parecem desativados.
- Claro: a situação "Recebido" usa verde-limão forte com texto escuro, destoando das outras cores suaves.
- Claro: a Agenda ativa no menu usa amarelo forte, diferente do restante do menu; os itens "Em breve" ficam claros demais.
- Datas aparecem no formato americano (mm/dd/yyyy) em O.S. e nos filtros da Agenda.

## O que será feito

1. **Barra superior única e estável**: mostrar só os 4 atalhos fixos; os demais (Minha conta, Históricos, Lixeira, Importar) vão para o menu do usuário ou um botão "Mais". No celular: menu + nome da tela + lupa + avatar, e os atalhos dentro de um botão "+".
2. **Remover duplicações**: tirar o cabeçalho azul do Pátio, os botões de módulo repetidos no topo das telas (o menu lateral já cuida disso; no celular viram uma barra rolável), "Ir para a Agenda" na O.S. e o cartão "Total no pátio".
3. **Agenda mais enxuta**: status de atualização numa só linha; filtros em grade de 4 colunas com "oficinas" junto dos demais; chips de filtros ativos dentro do próprio painel de filtros; "Hoje/Esta semana" ao lado do título "Grade semanal"; cartões de indicadores com altura igual e títulos de uma linha.
4. **Grade semanal**: dias vazios ficam estreitos, e os dias com agendamentos ganham a largura; o botão "Abrir agendamento" cabe no cartão; no celular, um dia por vez com setas.
5. **Filtros no celular**: Agenda e Veículos mostram só a busca + "Filtros" (abre uma gaveta). Corrigir a altura achatada das listas.
6. **Contraste**: clarear o azul principal no modo escuro; títulos de notícia e ícones passam a usar a cor de texto/destaque legível; etiqueta do destaque mais clara sobre a foto; "Recebido" com o mesmo verde suave das outras situações; item ativo do menu no mesmo padrão em todos os grupos; "Em breve" um pouco mais legível.
7. **Datas em português** (dd/mm/aaaa) nos campos de data.
8. **Home**: destaque ocupando a largura toda (ou 2 destaques lado a lado quando houver).
9. Conferir de novo todas as telas nos dois temas, no computador e no celular, antes de entregar.

Nada muda em regras, permissões, banco ou SGLOC.

## Detalhes técnicos

- Topbar: `layout-shell.tsx` — limitar ações globais; mover extras da Agenda (`usePageAction`) para dropdown; layout mobile com `grid-cols-[auto_minmax(0,1fr)_auto]`.
- Remover header próprio de `workshop-yard.tsx` e a barra `tabs` passada por `_authenticated/index.tsx` e `ordens-servico.index.tsx` em `md+`; manter rolável em mobile.
- `maintenance-dashboard.tsx`: reorganizar status/filtros/chips/KPIs; grade com `grid-template-columns` ponderado por contagem (`minmax(5rem, n fr)`); `SelectTrigger` com altura fixa `h-10`.
- Tokens em `src/styles.css` (.dark): `--primary` mais claro, novo `--link`; `--status-finished`/"Recebido" vindo do catálogo de cor — mapear cor viva para token suave.
- Inputs de data: componente com `lang="pt-BR"` ou máscara dd/mm/aaaa.
- Verificação com Playwright (claro/escuro, 1280 e 390) e testes existentes.
