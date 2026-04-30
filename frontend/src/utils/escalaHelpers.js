/**
 * escalaHelpers.js
 * Funções puras de formatação de datas para o módulo GeradorEscala.
 * Importadas diretamente pelos componentes filhos — eliminam a necessidade
 * de passar formatadores como props.
 */

/** Gera a chave única de um objeto Date para uso em mapas de estado. */
export const formatDataKey = (d) =>
  `${d.getDate()}-${d.getMonth()}-${d.getFullYear()}`;

/** Formata um objeto Date como "DD/MM". */
export const formatDataDDMM = (d) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
