// Formateo de Folios Cortos y Legibles

export function formatFolioFondo(correlativo?: number | null, fallbackId?: string): string {
  if (typeof correlativo === 'number' && correlativo > 0) {
    return `#F-${String(correlativo).padStart(3, '0')}`;
  }
  if (fallbackId) {
    return `#F-${fallbackId.replace(/-/g, '').slice(0, 3).toUpperCase()}`;
  }
  return '#F-001';
}

export function formatFolioGasto(correlativo?: number | null, fallbackId?: string): string {
  if (typeof correlativo === 'number' && correlativo > 0) {
    return `#G-${String(100 + correlativo).padStart(3, '0')}`;
  }
  if (fallbackId) {
    return `#G-${fallbackId.replace(/-/g, '').slice(0, 3).toUpperCase()}`;
  }
  return '#G-101';
}
