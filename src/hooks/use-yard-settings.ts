import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_YARD_SETTINGS, type YardSettings } from "@/lib/yard-utils";

export function useYardSettings() {
  const [settings, setSettings] = useState<YardSettings>(DEFAULT_YARD_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await (supabase as any)
        .from("yard_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setSettings({
          timer_green_hours:
            Number(data.timer_green_hours) || DEFAULT_YARD_SETTINGS.timer_green_hours,
          timer_yellow_hours:
            Number(data.timer_yellow_hours) || DEFAULT_YARD_SETTINGS.timer_yellow_hours,
          check_in_required: data.check_in_required ?? true,
          check_out_required: data.check_out_required ?? true,
          photo_capture_enabled: data.photo_capture_enabled ?? true,
          photo_upload_enabled: data.photo_upload_enabled ?? true,
          photo_max_mb: data.photo_max_mb || 10,
          notification_sound_enabled: data.notification_sound_enabled ?? true,
          polling_seconds: data.polling_seconds || 30,
          toast_duration_ms: data.toast_duration_ms || 4000,
          new_highlight_minutes: data.new_highlight_minutes || 5,
          editable_fields: Array.isArray(data.editable_fields)
            ? (data.editable_fields as string[])
            : DEFAULT_YARD_SETTINGS.editable_fields,
          board_config: data.board_config ?? {},
        });
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function updateSettings(patch: Partial<YardSettings>, userId: string) {
    const dbPatch: Record<string, unknown> = {};
    if (patch.timer_green_hours !== undefined)
      dbPatch["timer_green_hours"] = patch.timer_green_hours;
    if (patch.timer_yellow_hours !== undefined)
      dbPatch["timer_yellow_hours"] = patch.timer_yellow_hours;
    if (patch.check_in_required !== undefined)
      dbPatch["check_in_required"] = patch.check_in_required;
    if (patch.check_out_required !== undefined)
      dbPatch["check_out_required"] = patch.check_out_required;
    if (patch.photo_capture_enabled !== undefined)
      dbPatch["photo_capture_enabled"] = patch.photo_capture_enabled;
    if (patch.photo_upload_enabled !== undefined)
      dbPatch["photo_upload_enabled"] = patch.photo_upload_enabled;
    if (patch.photo_max_mb !== undefined) dbPatch["photo_max_mb"] = patch.photo_max_mb;
    if (patch.notification_sound_enabled !== undefined)
      dbPatch["notification_sound_enabled"] = patch.notification_sound_enabled;
    if (patch.polling_seconds !== undefined) dbPatch["polling_seconds"] = patch.polling_seconds;
    if (patch.toast_duration_ms !== undefined)
      dbPatch["toast_duration_ms"] = patch.toast_duration_ms;
    if (patch.new_highlight_minutes !== undefined)
      dbPatch["new_highlight_minutes"] = patch.new_highlight_minutes;
    if (patch.editable_fields !== undefined) dbPatch["editable_fields"] = patch.editable_fields;
    if (patch.board_config !== undefined) dbPatch["board_config"] = patch.board_config;
    dbPatch["updated_at"] = new Date().toISOString();
    dbPatch["updated_by"] = userId;
    const { error } = await (supabase as any).from("yard_settings").update(dbPatch).eq("id", 1);
    if (!error) setSettings((prev) => ({ ...prev, ...patch }));
    return !error;
  }

  return { settings, loading, updateSettings };
}
