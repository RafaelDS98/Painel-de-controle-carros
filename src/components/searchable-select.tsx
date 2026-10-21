import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** Filtro pesquisável: lista em ordem alfabética; digite parte do nome (sem ligar para acento/caixa) para filtrar. Valor "" = todos. */
export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  className,
}: {
  className?: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const sorted = useMemo(() => [...options].sort((a, b) => a.localeCompare(b, "pt-BR")), [options]);
  const shown = useMemo(() => {
    const q = fold(query);
    return q ? sorted.filter((o) => fold(o).includes(q)) : sorted;
  }, [sorted, query]);
  return (
    <Popover
      modal
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className={cn(
            "relative flex h-10 min-h-10 w-full min-w-0 shrink-0 flex-1 sm:min-w-44 items-center rounded-md border border-input bg-background px-3 pr-8 text-left text-sm text-foreground outline-none focus:ring-2 focus:ring-ring",
            className,
          )}
        >
          <span className="truncate">{value || label}</span>
          <ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Digite para pesquisar…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>Nada encontrado.</CommandEmpty>
            <CommandGroup>
              {!query && (
                <CommandItem
                  value="__todos"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 size-4", value === "" ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{label}</span>
                </CommandItem>
              )}
              {shown.slice(0, 300).map((option, index) => (
                <CommandItem
                  key={`${index}-${option}`}
                  value={`${option}__${index}`}
                  onSelect={() => {
                    onChange(option);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check
                    className={cn("mr-2 size-4", value === option ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{option}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
