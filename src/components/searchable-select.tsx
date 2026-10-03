import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

/** Filtro pesquisável: digite parte do nome para filtrar a lista. Valor "" = todos. */
export function SearchableSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" role="combobox" aria-expanded={open} aria-label={label} className="relative flex h-10 min-w-44 flex-1 items-center rounded-md border border-input bg-background px-3 pr-8 text-left text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
          <span className="truncate">{value || label}</span>
          <ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Digite para filtrar…" />
          <CommandList>
            <CommandEmpty>Nada encontrado.</CommandEmpty>
            <CommandGroup>
              {[label, ...options].map((option, index) => {
                const optionValue = index === 0 ? "" : option;
                return (
                  <CommandItem key={`${index}-${option}`} value={`${option}__${index}`} onSelect={() => { onChange(optionValue); setOpen(false); }}>
                    <Check className={cn("mr-2 size-4", value === optionValue ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{option}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
