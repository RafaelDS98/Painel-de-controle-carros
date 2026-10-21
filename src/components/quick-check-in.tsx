import { useState } from "react";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlateCombobox } from "@/components/plate-combobox";
import { VehicleCheckIn } from "@/components/vehicle-check-in";

/** Entrada/saída direta: escolhe a placa cadastrada e registra, sem abrir o veículo. */
export function QuickCheckInButton({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [plate, setPlate] = useState<string | null>(null);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} title="Entrada/Saída">
        <LogIn /> {!compact && "Entrada/Saída"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setPlate(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Entrada / Saída de veículo</DialogTitle>
            <DialogDescription>Digite a placa e escolha o veículo cadastrado.</DialogDescription>
          </DialogHeader>
          <PlateCombobox value={plate} onChange={setPlate} autoFocus />
          {plate && <VehicleCheckIn key={plate} plate={plate} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
