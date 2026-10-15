// Aba de observações do cliente — lista com add/delete.
import { useState } from "react";
import { Plus, Trash2, MessageSquare, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { OsObservation } from "@/lib/os/os-types";

interface OsObservationsTabProps {
  observations: OsObservation[];
  onAdd: (content: string) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}

export function OsObservationsTab({ observations, onAdd, onDelete, readOnly }: OsObservationsTabProps) {
  const [newContent, setNewContent] = useState("");
  const [showForm, setShowForm] = useState(false);

  const handleAdd = () => {
    if (!newContent.trim()) return;
    onAdd(newContent.trim());
    setNewContent("");
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      {/* Observations list */}
      {observations.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground text-sm">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
          Nenhuma observação do cliente registrada.
        </div>
      ) : (
        <div className="space-y-3">
          {observations.map((obs) => (
            <div key={obs.id} className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm whitespace-pre-wrap flex-1">{obs.content}</p>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={() => onDelete(obs.id)}
                    title="Excluir observação"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(obs.created_at).toLocaleString("pt-BR")}
                </span>
                {obs.created_by && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {obs.created_by.slice(0, 8)}…
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {!readOnly && (
        <div>
          {!showForm ? (
            <Button
              variant="outline"
              onClick={() => setShowForm(true)}
              className="gap-1.5 w-full border-dashed"
            >
              <Plus className="h-4 w-4" />
              Adicionar Observação
            </Button>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Descreva a observação do cliente sobre o veículo ou serviço..."
                rows={4}
                autoFocus
              />
              <div className="flex gap-2">
                <Button onClick={handleAdd} disabled={!newContent.trim()} className="bg-teal-600 hover:bg-teal-700">
                  <Plus className="h-4 w-4 mr-1" />
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setNewContent(""); }}>
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