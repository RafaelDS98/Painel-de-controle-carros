import { useEffect, useState } from "react";

/** Cores dos gráficos lidas dos tokens --chart-1..5; re-lê quando o tema (.dark no <html>) muda. */
export function useChartColors(count = 5): string[] {
  const [colors, setColors] = useState<string[]>(() =>
    Array.from({ length: count }, () => "oklch(0.51 0.13 252)"),
  );
  useEffect(() => {
    const read = () => {
      const style = getComputedStyle(document.documentElement);
      const next = Array.from({ length: count }, (_, i) => {
        const value = style.getPropertyValue(`--chart-${i + 1}`).trim();
        return value || "oklch(0.51 0.13 252)";
      });
      setColors(next);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [count]);
  return colors;
}
