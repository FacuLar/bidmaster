/* Taxonomía de clasificación de los bienes (búsqueda y filtros del catálogo). */

export const CATEGORIAS = [
  { k: 'arte', label: 'Arte', icon: '🎨' },
  { k: 'tecnologia', label: 'Tecnología', icon: '💻' },
  { k: 'moda', label: 'Moda', icon: '👗' },
  { k: 'joyas', label: 'Joyas', icon: '💎' },
  { k: 'vehiculos', label: 'Vehículos', icon: '🚗' },
  { k: 'hobbies', label: 'Hobbies', icon: '🎲' },
];

export const TAGS = [
  'Lujo', 'Tecnología', 'Consolas', 'Arte', 'Fotografía', 'Vintage', 'Colección',
  'Deportes', 'Edición Especial', 'Exclusivo', 'Garantía Oficial', 'Limitado',
  'Raro', 'Impecable',
];

export const USOS = [
  { k: 'nuevo', label: 'Nuevo' },
  { k: 'poco_uso', label: 'Poco uso' },
  { k: 'usado', label: 'Usado' },
  { k: 'sellado', label: 'Sellado' },
  { k: 'restaurado', label: 'Restaurado' },
];

export const labelCategoria = (k) => (CATEGORIAS.find((c) => c.k === k) || {}).label || k;
export const labelUso = (k) => (USOS.find((u) => u.k === k) || {}).label || k;

// Normaliza texto para búsquedas (saca acentos, minúsculas).
export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
