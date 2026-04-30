/**
 * services/config.js
 * Configuração centralizada da API.
 *
 * Fonte única da verdade para a URL base do backend.
 * Todos os componentes e páginas devem importar daqui,
 * em vez de declarar a constante manualmente.
 *
 * Uso:
 *   import { API_BASE_URL } from '../services/config';
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://levihub-api.onrender.com';
