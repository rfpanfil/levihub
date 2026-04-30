// componente: GestaoVagas.jsx
// Apresentacional puro: para cada dia da escala, exibe as vagas ativas
// e os controles de adição/remoção de funções.
import React from 'react';
import { formatDataKey, formatDataDDMM } from '../../utils/escalaHelpers';

export default function GestaoVagas({
  datasEscala,
  vagasPorDia,
  catalogoVagas,
  funcoesPadraoUsuario,
  diasSemanaNomes,
  adicionarVaga,
  removerVaga,
}) {
  return (
    <div className="input-area" style={{ overflowX: 'auto' }}>
      <h2>⚙️ Vagas e Funções por Dia</h2>
      <p className="tab-description">Adicione ou remova instrumentos específicos para cada dia do mês.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
        {datasEscala.map(d => {
          const key = formatDataKey(d);
          const vagasAtuais = vagasPorDia[key] || [];

          return (
            <div key={key} style={{ padding: '15px', backgroundColor: '#282c34', borderRadius: '8px', borderLeft: '4px solid #61dafb' }}>
              <strong style={{ display: 'block', marginBottom: '10px', fontSize: '1.1em', color: 'white' }}>
                Dia {formatDataDDMM(d)} - {diasSemanaNomes[d.getDay()]}
              </strong>

              {/* Vagas ativas com botão de remover */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '15px' }}>
                {[...vagasAtuais]
                  .sort((a, b) => {
                    const indexA = funcoesPadraoUsuario.indexOf(a.label);
                    const indexB = funcoesPadraoUsuario.indexOf(b.label);
                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                    if (indexA !== -1) return -1;
                    if (indexB !== -1) return 1;
                    return a.label.localeCompare(b.label);
                  })
                  .map((v) => (
                    <span key={v.id} style={{ backgroundColor: '#4a505c', padding: '6px 12px', borderRadius: '20px', fontSize: '0.9em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {v.label}
                      <button
                        onClick={() => removerVaga(key, v.id)}
                        style={{ background: 'none', border: 'none', color: '#ff4b4b', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2em', lineHeight: '10px' }}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                {vagasAtuais.length === 0 && (
                  <span style={{ color: '#ff4b4b', fontStyle: 'italic' }}>Nenhuma função escalada (Folga)</span>
                )}
              </div>

              {/* Seletor de adição */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <select
                  id={`select_${key}`}
                  style={{ flex: 1, minWidth: '200px', padding: '8px', borderRadius: '5px', backgroundColor: '#3c414d', color: 'white', border: '1px solid #4a505c' }}
                >
                  <option value="">➕ Adicionar mais instrumentos / vozes...</option>
                  {catalogoVagas
                    .filter(cat => !vagasAtuais.some(va => va.id === cat.id))
                    .map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                </select>
                <button
                  onClick={() => {
                    const select = document.getElementById(`select_${key}`);
                    if (select.value) adicionarVaga(key, select.value);
                    select.value = '';
                  }}
                  style={{ padding: '8px 20px', backgroundColor: '#61dafb', color: '#282c34', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Adicionar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
