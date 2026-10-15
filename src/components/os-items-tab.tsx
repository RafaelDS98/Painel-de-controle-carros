// Tabela de itens/serviços da O.S. com edição inline e ações em lote.
import { useState } from "react";
import { Plus, Trash2, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { OsItem, ItemApproval, ItemType } from "@/lib/os/os-types";
import { approvalDisplay, approvalColor, formatMoney } from "@/lib/os/os-safety";
import { countByApproval, groupItemsByType } from "@/lib/os/os-safety";

interface OsItemsTabProps {
  items: OsItem[];
  onAdd: (item: { description: string; qty: number; unitPrice: number; itemType: ItemType }) => void;
  onUpdate: (itemId: string, changes: Record<string, unknown>) => void;
  onDelete: (itemId: string) => void;
  onBatchApprove: (approval: ItemApproval) => void;
  readOnly?: boolean;
}

export function OsItemsTab({ items, onAdd, onUpdate, onDelete, onBatchApprove, readOnly }: OsItemsTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newPrice, setNewPrice] = useState("0");
  const [newType, setNewType] = useState<ItemType>("service");

  const counts = countByApproval(items);
  const grouped = groupItemsByType(items);

  const handleAdd = () => {
    if (!newDesc.trim()) return;
    onAdd({
      description: newDesc.trim(),
      qty: parseFloat(newQty) || 1,
      unitPrice: parseFloat(newPrice) || 0,
      itemType: newType,
    });
    setNewDesc("");
    setNewQty("1");
    setNewPrice("0");
    setNewType("service");
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-amber-500" />
          Pendentes: <strong>{counts.pending}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
          Autorizados: <strong>{counts.authorized}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <XCircle className="h-3.5 w-3.5 text-red-500" />
          Negados: <strong>{counts.denied}</strong>
        </span>
        <span className="ml-auto text-muted-foreground">
          Serviços: <strong className="text-foreground">{formatMoney(grouped.serviceTotal)}</strong>
          {" · "}
          Peças: <strong className="text-foreground">{formatMoney(grouped.partTotal)}</strong>
          {" · "}
          Total: <strong className="text-teal-700 dark:text-teal-400">{formatMoney(grouped.serviceTotal + grouped.partTotal)}</strong>
        </span>
      </div>

      {/* Batch actions */}
      {!readOnly && items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBatchApprove("Autorizado")}
            className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Autorizar Todos
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBatchApprove("Negado")}
            className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
          >
            <XCircle className="h-3.5 w-3.5" />
            Negar Todos
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBatchApprove("Pendente")}
            className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950"
          >
            <Clock className="h-3.5 w-3.5" />
            Resetar Todos
          </Button>
        </div>
      )}

      {/* Items table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Aprovação</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-[70px] text-right">Qtd</TableHead>
              <TableHead className="w-[100px] text-right">Valor Unit.</TableHead>
              <TableHead className="w-[100px] text-right">Total</TableHead>
              <TableHead className="w-[80px]">Tipo</TableHead>
              <TableHead className="w-[120px]">Mecânico</TableHead>
              {!readOnly && <TableHead className="w-[50px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={readOnly ? 7 : 8} className="text-center py-8 text-muted-foreground">
                  Nenhum item adicionado. Clique em "Adicionar Item" para começar.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: approvalColor(item.approval) + "1a",
                        color: approvalColor(item.approval),
                      }}
                    >
                      {approvalDisplay(item.approval)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate">{item.description}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.qty}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(item.unit_price)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatMoney(item.total)}</TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {item.item_type === "service" ? "Serviço" : "Peça"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.mechanic_name ?? "—"}</TableCell>
                  {!readOnly && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                          onClick={() => onUpdate(item.id, { approval: "Autorizado" })}
                          title="Autorizar"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-600 hover:bg-red-50"
                          onClick={() => onDelete(item.id)}
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add item form */}
      {!readOnly && (
        <div>
          {!showAddForm ? (
            <Button
              variant="outline"
              onClick={() => setShowAddForm(true)}
              className="gap-1.5 w-full border-dashed"
            >
              <Plus className="h-4 w-4" />
              Adicionar Item
            </Button>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="lg:col-span-2 space-y-1.5">
                  <Label className="text-xs">Descrição *</Label>
                  <Input
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Descrição do serviço ou peça"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Quantidade</Label>
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor Unitário</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={newType} onValueChange={(v) => setNewType(v as ItemType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service">Serviço</SelectItem>
                      <SelectItem value="part">Peça</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAdd} disabled={!newDesc.trim()} className="bg-teal-600 hover:bg-teal-700">
                  <Plus className="h-4 w-4 mr-1" />
                  Confirmar
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}