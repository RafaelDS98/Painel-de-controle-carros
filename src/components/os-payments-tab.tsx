// Aba de pagamentos da O.S. — tabela básica com lançamento (v1).
import { useState } from "react";
import { Plus, Trash2, CreditCard, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { OsPayment, PaymentStatus } from "@/lib/os/os-types";
import { formatMoney } from "@/lib/os/os-safety";

const STATUS_COLORS: Record<PaymentStatus, string> = {
  "Não Lançado": "#6b7280",
  "A vencer": "#f59e0b",
  "Vencido": "#ef4444",
  "Pago": "#10b981",
};

interface OsPaymentsTabProps {
  payments: OsPayment[];
  onAdd: (payment: {
    fornecedor: string;
    valorTotal: number;
    formaPagamento: string;
    qtdParcelas: number;
    emissao: string;
    primeiroVencimento: string;
  }) => void;
  onDelete: (id: string) => void;
  onAccept: (id: string) => void;
  readOnly?: boolean;
}

export function OsPaymentsTab({ payments, onAdd, onDelete, onAccept, readOnly }: OsPaymentsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [fornecedor, setFornecedor] = useState("");
  const [valorTotal, setValorTotal] = useState("0");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [qtdParcelas, setQtdParcelas] = useState("1");
  const [emissao, setEmissao] = useState("");
  const [primeiroVencimento, setPrimeiroVencimento] = useState("");

  const totalGeral = payments.reduce((sum, p) => sum + p.valor_total, 0);

  const handleAdd = () => {
    if (!fornecedor.trim() || parseFloat(valorTotal) <= 0) return;
    onAdd({
      fornecedor: fornecedor.trim(),
      valorTotal: parseFloat(valorTotal),
      formaPagamento,
      qtdParcelas: parseInt(qtdParcelas) || 1,
      emissao,
      primeiroVencimento,
    });
    setFornecedor("");
    setValorTotal("0");
    setFormaPagamento("");
    setQtdParcelas("1");
    setEmissao("");
    setPrimeiroVencimento("");
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {payments.length} lançamento{payments.length !== 1 ? "s" : ""}
        </span>
        <span className="font-semibold tabular-nums text-teal-700 dark:text-teal-400">
          Total: R$ {formatMoney(totalGeral)}
        </span>
      </div>

      {/* Payments table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="w-[120px] text-right">Valor Total</TableHead>
              <TableHead className="w-[80px] text-center">Parcelas</TableHead>
              <TableHead className="w-[120px]">Forma Pag.</TableHead>
              <TableHead className="w-[110px]">Emissão</TableHead>
              <TableHead className="w-[110px]">1º Venc.</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px] text-center">Aceito</TableHead>
              {!readOnly && <TableHead className="w-[50px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={readOnly ? 8 : 9} className="text-center py-8 text-muted-foreground">
                  Nenhum pagamento lançado.
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.fornecedor ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatMoney(p.valor_total)}</TableCell>
                  <TableCell className="text-center">{p.qtd_parcelas}x</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.forma_pagamento ?? "—"}</TableCell>
                  <TableCell className="text-sm">{p.emissao ? new Date(p.emissao + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell className="text-sm">{p.primeiro_vencimento ? new Date(p.primeiro_vencimento + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell>
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: STATUS_COLORS[p.status_pagamento] + "1a",
                        color: STATUS_COLORS[p.status_pagamento],
                      }}
                    >
                      {p.status_pagamento}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {p.aceito ? (
                      <CheckCircle className="mx-auto h-4 w-4 text-emerald-500" />
                    ) : (
                      !readOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-teal-600"
                          onClick={() => onAccept(p.id)}
                        >
                          Aceitar
                        </Button>
                      )
                    )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:bg-red-50"
                        onClick={() => onDelete(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add form */}
      {!readOnly && (
        <div>
          {!showForm ? (
            <Button variant="outline" onClick={() => setShowForm(true)} className="gap-1.5 w-full border-dashed">
              <Plus className="h-4 w-4" />
              Lançar Pagamento
            </Button>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fornecedor *</Label>
                  <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor Total *</Label>
                  <Input type="number" min="0" step="0.01" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Forma de Pagamento</Label>
                  <Input value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} placeholder="Ex: Boleto, PIX" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Qtd. Parcelas</Label>
                  <Input type="number" min="1" max="48" value={qtdParcelas} onChange={(e) => setQtdParcelas(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Data Emissão</Label>
                  <Input type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">1º Vencimento</Label>
                  <Input type="date" value={primeiroVencimento} onChange={(e) => setPrimeiroVencimento(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAdd} disabled={!fornecedor.trim() || parseFloat(valorTotal) <= 0} className="bg-teal-600 hover:bg-teal-700">
                  <CreditCard className="h-4 w-4 mr-1" />
                  Lançar
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}