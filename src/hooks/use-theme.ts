import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "theme";

/** Tema global: alterna a classe `.dark` no <html> e persiste em localStorage ("theme"). */
export function useTheme() {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "dark") return true;
      if (saved === "light") return false;
    } catch {
      /* storage indisponível */
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const toggleTheme = useCallback(() => {
    setDark((current) => {
      const next = !current;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
      } catch {
        /* storage indisponível */
      }
      return next;
    });
  }, []);

  return { dark, toggleTheme };
}
