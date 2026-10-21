import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isoToBr, maskBrDate, brToIso } from "@/lib/date-br";

type Props = {
  value: string | null | undefined;
  onChange: (e: { target: { value: string } }) => void;
  className?: string;
  "aria-label"?: string;
  disabled?: boolean;
  id?: string;
};

/** Campo de data exibido como dd/mm/aaaa; o valor continua em aaaa-mm-dd. */
export function DateInput({ value, onChange, className, disabled, id, ...rest }: Props) {
  const iso = value ?? "";
  const [text, setText] = useState(isoToBr(iso));
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (brToIso(text) !== iso) setText(isoToBr(iso));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);
  const emit = (v: string) => onChange({ target: { value: v } });
  return (
    <div className={cn("relative min-w-0", className)}>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        aria-label={rest["aria-label"]}
        disabled={disabled}
        value={text}
        className="w-full border-inherit bg-transparent pr-8"
        onChange={(e) => {
          const t = maskBrDate(e.target.value);
          setText(t);
          if (!t) emit("");
          else {
            const next = brToIso(t);
            if (next) emit(next);
          }
        }}
        onBlur={() => {
          if (text && !brToIso(text)) setText(isoToBr(iso));
        }}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label="Abrir calendário"
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        onClick={() => picker.current?.showPicker?.()}
      >
        <CalendarDays className="size-4" />
      </button>
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
        value={iso}
        onChange={(e) => emit(e.target.value)}
      />
    </div>
  );
}
