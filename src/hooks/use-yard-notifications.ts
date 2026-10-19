import { useCallback, useEffect, useRef, useState } from "react";
import type { YardSettings } from "@/lib/yard-utils";

interface YardSnapshot {
  status: string;
  workshop: string;
}

export function useYardNotifications(
  items: { dbId: string; status: string; workshop: string }[],
  settings: YardSettings,
  enabled: boolean,
) {
  const knownRef = useRef<Map<string, YardSnapshot>>(new Map());
  const firstLoadRef = useRef(true);
  const [newCount, setNewCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem("yard-sound") !== "off",
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!items.length && firstLoadRef.current) return;

    const currentMap = new Map<string, YardSnapshot>();
    for (const item of items) {
      currentMap.set(item.dbId, { status: item.status, workshop: item.workshop });
    }

    if (firstLoadRef.current) {
      knownRef.current = currentMap;
      firstLoadRef.current = false;
      return;
    }

    let detected = 0;
    for (const [id, snap] of currentMap) {
      const prev = knownRef.current.get(id);
      if (!prev) {
        detected++;
      } else if (prev.status !== snap.status || prev.workshop !== snap.workshop) {
        detected++;
      }
    }

    knownRef.current = currentMap;

    if (detected > 0) {
      setNewCount((c) => c + detected);
      if (soundEnabled && settings.notification_sound_enabled) {
        try {
          if (!audioRef.current) {
            audioRef.current = new Audio("/notification.wav");
            audioRef.current.volume = 0.5;
          }
          audioRef.current.currentTime = 0;
          void audioRef.current.play().catch(() => {});
        } catch { /* audio not available */ }
      }
    }
  }, [items, settings.notification_sound_enabled, soundEnabled]);

  const clearNew = useCallback(() => setNewCount(0), []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("yard-sound", next ? "on" : "off");
      return next;
    });
  }, []);

  return { newCount, clearNew, soundEnabled, toggleSound };
}