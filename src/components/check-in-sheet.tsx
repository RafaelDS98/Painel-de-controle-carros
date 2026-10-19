import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Camera, Upload, X, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { YardAppointment, YardSettings } from "@/lib/yard-utils";
import type { StatusOption } from "@/lib/agenda-config";

interface CheckInSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: YardAppointment | null;
  type: "entrada" | "saida";
  settings: YardSettings;
  statuses: StatusOption[];
  currentUserId: string;
  onDone: () => void;
}

export function CheckInSheet({
  open,
  onOpenChange,
  appointment,
  type,
  settings,
  statuses,
  currentUserId,
  onDone,
}: CheckInSheetProps) {
  const [note, setNote] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const captureRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const isEntrada = type === "entrada";
  const alreadyDone = isEntrada ? !!appointment?.checkInAt : !!appointment?.checkOutAt;
  const required = isEntrada ? settings.check_in_required : settings.check_out_required;
  const photoEnabled = settings.photo_capture_enabled || settings.photo_upload_enabled;

  function handleFile(file: File | null) {
    if (!file) return;
    const maxBytes = settings.photo_max_mb * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(`Foto muito grande. Máximo ${settings.photo_max_mb}MB.`);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (captureRef.current) captureRef.current.value = "";
    if (uploadRef.current) uploadRef.current.value = "";
  }

  async function handleSave() {
    if (!appointment) return;
    if (required && !note.trim()) {
      toast.error("Observação é obrigatória.");
      return;
    }
    if (required && photoEnabled && !photoFile) {
      toast.error("Foto é obrigatória.");
      return;
    }

    setSaving(true);
    try {
      let photoUrl: string | null = null;

      if (photoFile) {
        const ext = photoFile.name.split(".").pop() ?? "jpg";
        const path = `${appointment.dbId}/${type}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("check-in-photos")
          .upload(path, photoFile, { upsert: false });
        if (uploadError) {
          toast.error(`Falha no upload da foto: ${uploadError.message}`);
        } else {
          const { data: urlData } = supabase.storage
            .from("check-in-photos")
            .getPublicUrl(path);
          photoUrl = urlData?.publicUrl ?? null;
        }
      }

      const now = new Date().toISOString();
      const colPrefix = isEntrada ? "check_in" : "check_out";

      const { error: recordError } = await (supabase as any).from("check_in_records").insert({
        appointment_id: appointment.dbId,
        os_number: appointment.osNumber,
        type,
        occurred_at: now,
        note: note.trim() || null,
        photo_url: photoUrl,
        performed_by: currentUserId,
      });

      if (recordError) {
        toast.error(`Falha ao registrar: ${recordError.message}`);
        setSaving(false);
        return;
      }

      const updatePayload: Record<string, unknown> = {
        [`${colPrefix}_at`]: now,
        [`${colPrefix}_note`]: note.trim() || null,
        [`${colPrefix}_photo_url`]: photoUrl,
        [`${colPrefix}_by`]: currentUserId,
      };

      const { error: updateError } = await (supabase as any)
        .from("appointments")
        .update(updatePayload)
        .eq("id", appointment.dbId);

      if (updateError) {
        toast.error(`Falha ao atualizar agendamento: ${updateError.message}`);
        setSaving(false);
        return;
      }

      toast.success(
        isEntrada ? "Entrada registrada com sucesso." : "Saída registrada com sucesso.",
        { duration: settings.toast_duration_ms },
      );
      setNote("");
      setPhotoFile(null);
      setPhotoPreview(null);
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(val: boolean) {
    if (!val) {
      setNote("");
      setPhotoFile(null);
      setPhotoPreview(null);
    }
    onOpenChange(val);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEntrada ? "Registrar entrada" : "Registrar saída"} —{" "}
            {appointment?.plate || "—"}
          </SheetTitle>
          <SheetDescription>
            {isEntrada
              ? "Registre a chegada física do veículo na oficina."
              : "Registre a saída/liberação do veículo."}
          </SheetDescription>
        </SheetHeader>

        {alreadyDone ? (
          <div className="mt-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center">
            <p className="font-semibold text-green-700 dark:text-green-400">
              {isEntrada ? "Entrada" : "Saída"} já registrada
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEntrada
                ? new Date(appointment!.checkInAt!).toLocaleString("pt-BR")
                : new Date(appointment!.checkOutAt!).toLocaleString("pt-BR")}
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {/* Info read-only */}
            <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
              <p>
                <span className="font-medium">Veículo:</span>{" "}
                {[appointment?.brand, appointment?.model].filter(Boolean).join(" · ") || "—"}
              </p>
              <p>
                <span className="font-medium">Loja:</span> {appointment?.store || "—"}
              </p>
              <p>
                <span className="font-medium">Contato:</span> {appointment?.contact || "—"}
              </p>
              {appointment?.contactNumber && (
                <p>
                  <span className="font-medium">Tel:</span> {appointment.contactNumber}
                </p>
              )}
              <p>
                <span className="font-medium">Problema:</span> {appointment?.issue || "—"}
              </p>
            </div>

            {/* Observação */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Observação{required ? " *" : ""}
              </label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                placeholder="Descreva o estado do veículo, observações visuais..."
                rows={3}
                maxLength={500}
              />
              <p className="text-right text-[11px] text-muted-foreground">
                {note.length}/500
              </p>
            </div>

            {/* Foto */}
            {photoEnabled && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Foto{required ? " *" : ""}
                </label>
                {photoPreview ? (
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-full rounded-lg border object-cover"
                      style={{ maxHeight: 240 }}
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute right-2 top-2 size-7"
                      onClick={removePhoto}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {settings.photo_capture_enabled && (
                      <>
                        <input
                          ref={captureRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                        />
                        <Button
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => captureRef.current?.click()}
                        >
                          <Camera className="size-4" /> Tirar foto
                        </Button>
                      </>
                    )}
                    {settings.photo_upload_enabled && (
                      <>
                        <input
                          ref={uploadRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                        />
                        <Button
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => uploadRef.current?.click()}
                        >
                          <Upload className="size-4" /> Escolher arquivo
                        </Button>
                      </>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Máx {settings.photo_max_mb}MB · JPG, PNG, WebP
                </p>
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-2 border-t pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 gap-1.5"
                disabled={saving || (required && !note.trim()) || (required && photoEnabled && !photoFile)}
                onClick={() => void handleSave()}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}