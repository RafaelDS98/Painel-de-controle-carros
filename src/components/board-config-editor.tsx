import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  CARD_FIELD_LABELS,
  type BoardColumnKey,
  type BoardConfig,
  type CardField,
} from "@/lib/yard-board";

const COLUMN_HELP: Record<BoardColumnKey, string> = {
  arriving: "Carros encaminhados que ainda não deram entrada.",
  working: "Situações marcadas como “Principal (em execução)”.",
  ready: "Situações marcadas como “Principal (prontos)”.",
};

/** Master escolhe nome/visibilidade das colunas e as informações dos cartões da tela principal. */
export function BoardConfigEditor({
  value,
  onChange,
}: {
  value: BoardConfig;
  onChange: (cfg: BoardConfig) => void;
}) {
  return (
    <section className="space-y-3">
      <h3 className="border-b pb-1 text-sm font-semibold">Tela principal da oficina</h3>
      <div className="space-y-2">
        {(Object.keys(value.columns) as BoardColumnKey[]).map((key) => (
          <div key={key} className="grid items-center gap-2 sm:grid-cols-[auto_1fr]">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={value.columns[key].visible}
                onCheckedChange={(v) =>
                  onChange({
                    ...value,
                    columns: { ...value.columns, [key]: { ...value.columns[key], visible: !!v } },
                  })
                }
              />
              Mostrar
            </label>
            <div>
              <Input
                aria-label={`Nome da coluna ${value.columns[key].label}`}
                value={value.columns[key].label}
                onChange={(e) =>
                  onChange({
                    ...value,
                    columns: {
                      ...value.columns,
                      [key]: { ...value.columns[key], label: e.target.value },
                    },
                  })
                }
              />
              <p className="mt-0.5 text-[11px] text-muted-foreground">{COLUMN_HELP[key]}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs font-medium">Informações mostradas em cada cartão</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(CARD_FIELD_LABELS) as CardField[]).map((f) => (
          <label key={f} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={value.cardFields.includes(f)}
              onCheckedChange={(v) =>
                onChange({
                  ...value,
                  cardFields: v
                    ? [...value.cardFields, f]
                    : value.cardFields.filter((x) => x !== f),
                })
              }
            />
            {CARD_FIELD_LABELS[f]}
          </label>
        ))}
      </div>
    </section>
  );
}
