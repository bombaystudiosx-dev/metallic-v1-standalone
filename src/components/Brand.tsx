export default function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="Metallic.V1">
    <span className="brand-mark">M<span>V</span>1</span>
    {!compact && <span className="brand-name">Metallic.V1</span>}
  </div>;
}
