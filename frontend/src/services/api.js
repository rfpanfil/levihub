// arquivo: frontend/src/services/api.js
import { API_BASE_URL } from './config';

/**
 * Wrapper centralizado para requisições fetch da aplicação.
 * 
 * Injeta automaticamente a URL base e a configuração de credentials
 * para permitir o envio e recebimento de Cookies HttpOnly (SameSite).
 * Substitui o uso de localStorage.getItem('token') e cabeçalhos Authorization manuais.
 * 
 * @param {string} endpoint - O caminho da API (ex: '/usuario/me'). Deve começar com '/'.
 * @param {object} options - Opções nativas do fetch (method, body, headers, etc).
 * @returns {Promise<Response>}
 */
export const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const finalOptions = {
    ...options,
    credentials: 'include', // GARANTE O ENVIO DO COOKIE ACCESS_TOKEN
  };

  return fetch(url, finalOptions);
};
