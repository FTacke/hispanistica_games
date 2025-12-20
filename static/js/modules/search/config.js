/**
 * Search (Advanced) Configuration & Constants
 */
export const MEDIA_ENDPOINT = "/media";

export const REGIONAL_OPTIONS = [
  { value: "ARG-CHU", text: "Argentina / Chubut", country: "ARG" },
  { value: "ARG-CBA", text: "Argentina / Córdoba", country: "ARG" },
  { value: "ARG-SDE", text: "Argentina / Santiago del Estero", country: "ARG" },
  { value: "ESP-CAN", text: "España / Canarias", country: "ESP" },
  { value: "ESP-SEV", text: "España / Sevilla", country: "ESP" },
];

export const SELECT2_CONFIG = {
  placeholder: "Seleccionar...",
  allowClear: true,
  closeOnSelect: false,
  language: {
    noResults: () => "No se encontraron resultados",
  },
};

export function allowTempMedia() {
  return true;
}
