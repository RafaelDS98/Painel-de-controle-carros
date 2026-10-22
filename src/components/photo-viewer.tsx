export function PhotoViewer({ src, onClose }: { src: string | null; onClose: () => void }) {
  if (!src) return null;
  return (
    <button
      type="button"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      aria-label="Fechar foto"
    >
      <img src={src} alt="Foto" className="max-h-full max-w-full object-contain" />
    </button>
  );
}
