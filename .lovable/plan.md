# Tela da oficina: carros enviados em destaque, pátio organizado e correções

## O que já foi conferido
- O carro **OZW1234** foi encaminhado às 15:39 para **ARRAIS FUNILARIA**, que está marcada como pátio próprio. Ele está gravado, mas sem situação. Hoje o Pátio mostra os carros mais antigos primeiro, sem opção de troca. Vai passar a ter a escolha "Mais antigo → mais novo" ou "Mais novo → mais antigo", e a escolha fica salva para cada usuário. Por isso o carro novo fica no fim de uma lista de 93 cartões e parece que não chegou.
- Consultas → O.S. dá erro para o perfil Oficina. As notícias não aparecem para esse perfil. O atalho "Ordens de Serviço" na Home abre mesmo para quem não tem acesso. A causa exata de cada um ainda não foi confirmada e será o primeiro passo.

## 1. Tela principal da oficina (pensada para o telão; o Master escolhe as colunas, os nomes delas e as informações mostradas em cada cartão, e pode trocar tudo em Configurar pátio)
A tela abre direto em **"Em atendimento agora"**, em três colunas fixas:
- **Chegando:** encaminhados que ainda não deram entrada. Ficam no topo, destacados, com o nome de quem enviou e há quanto tempo. Cada um tem o botão **"Dar entrada"** (faz o check-in).
- **Em execução / análise:** carros que já deram entrada e têm uma situação de execução.
- **Prontos / aguardando retirada:** carros finalizados que ainda não saíram.
- Carros em **Aguardando peças** ou **Aguardando retirada** saem da tela principal e vão para a aba **Pátio**.
- Em cada coluna, a ordem é: urgentes primeiro, depois os mais recentes. O tempo de cada carro aparece no cartão.
- Haverá o botão **"Modo telão"**: tela cheia, letras grandes, sem menu e atualização automática.

Quais situações ficam em cada coluna será configurado pelo Master em **Configurar pátio → Oficina e status**, com uma escolha por situação: Principal, Pátio ou Oculto.

## 2. Aviso quando chega um carro
- O aviso aparece na hora (até ~2 s), sem esperar os 30 s de atualização.
- O sino da barra superior mostra quantos carros chegaram. O alerta inclui som (se estiver ligado) e a mensagem **"Novo veículo: OZW1234 enviado por Fulano"**.
- O cartão pisca em destaque até alguém dar entrada nele.
- O aviso só aparece para quem tem acesso ao Pátio.

## 3. Aba Pátio organizada
- Filtro de data: **Hoje, Esta semana, Este mês, Personalizado**. Ele vale para a data de entrada ou de encaminhamento.
- Ordenar por: mais recente, mais tempo parado, ou placa.
- Os cartões ficam agrupados por situação, com contagem em cada grupo.

## 4. Correções
- **Consultas → O.S.:** corrigir o erro de carregamento. Com todos os campos vazios, a busca mostra todas as O.S., da mais recente para a mais antiga (padrão). Cada usuário pode inverter para "da mais antiga para a mais recente", e a escolha fica salva, com paginação.
- **Perfil Oficina:** passa a ter acesso à consulta e à abertura de O.S. por padrão. O Master continua podendo bloquear em Permissões.
- **Acesso por página:** cada tela confere a permissão ao abrir, e não só no menu. Atalhos na Home, na barra superior e links diretos sem permissão mostram "Sem acesso" e não abrem a tela.
- **Notícias para a Oficina:** descobrir por que não aparecem (pode ser falta de notícias publicadas ou a regra de leitura) e garantir que todos os perfis vejam as notícias publicadas.

## Detalhes técnicos
- Ordenar o Pátio por `forwarded_at`/`check_in_at` em ordem decrescente, com urgentes primeiro. Classificar "Chegando" por `forwarded_at` preenchido e `check_in_at` nulo.
- Adicionar a coluna `status_options.yard_column` (`main|yard|hidden`) com DEFAULT, em uma migration aditiva.
- Ligar o Realtime em `appointments` (com RLS mantida) com uma inscrição única no layout. O aviso dispara quando muda `forwarded_at`, em `use-yard-notifications`.
- Diagnosticar `search_ordens_servico` como Oficina (`has_access`/grants) e a política `news_read`. Ajustar `permission_default()` para dar `os` à Oficina.
- Criar um guard reutilizável por permissão nas rotas `/ordens-servico*`, `/veiculos`, `/noticias`, `/historicos` e filtrar os botões de Acesso rápido.
- Testes: ordenação e colunas do Pátio, filtro de datas (America/Sao_Paulo) e permissão padrão da Oficina. Atualizar AGENTS.md e roadmap.md.
