# Regras de src/lib
- Exibição, filtros, exportação e importação (grava por linha, erro por linha) passam por src/lib/agenda-safety.ts; avisos de dado velho por agenda-freshness.ts; seções em SectionBoundary — nada derruba a tela.
- Planilhas exportadas pelo SGLOC declaram dimensão errada; sempre recalcular o !ref com fixSheetRange (src/lib/sheet-range.ts) antes de ler — senão a leitura devolve zero linhas.
- Indicadores usam os filtros do painel mais a seleção dos gráficos (src/lib/chart-selection.ts: estado único, E entre gráficos, OU dentro, gráfico não se filtra); balões alternam com o mesmo padrão — sem estados paralelos.
- color_token aceita token antigo ou #RRGGBB, exibido só por statusColorProps (src/lib/agenda-config.ts) — contraste e neutro num só lugar.
- Sincronização/importação concluída dispara AGENDA_CHANGED_EVENT (agenda-freshness.ts) e a Agenda recarrega na hora — não depende do intervalo de 2 min.
