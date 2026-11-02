// componente: GestaoVagas.jsx
import React from 'react';
import { useScale } from '../../context/ScaleContext';
import { formatDataKey, formatDataDDMM } from '../../utils/escalaHelpers';

export default function GestaoVagas() {
  const {
    datasEscala,
    vagasPorDia,
    catalogoVagas,
    funcoesPadraoUsuario,
    diasSemanaNomes,
    escalasGeradas,
    adicionarVaga,
    adicionarVagaTodosOsDias,
    removerVaga,
  } = useScale();

  // Lista de funções que ainda faltam em pelo menos 1 dia do mês
  const funcoesDisponiveisNoMes = catalogoVagas.filter((cat) =>
    datasEscala.some((d) => {
      const atuais = vagasPorDia[formatDataKey(d)] || [];
      return !atuais.some((va) => String(va.id) === String(cat.id) || va.label === cat.label);
    })
  );

  return (
    <div className="input-area" style={{ overflowX: 'auto' }}>
      <h2>⚙️ Vagas e Funções por Dia</h2>
      <p className="tab-description">Adicione ou remova instrumentos específicos para cada dia do mês.</p>

      {escalasGeradas && escalasGeradas.length > 0 && (
        <div
          style={{
            marginTop: '10px',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(46, 204, 113, 0.12)',
            border: '1px solid rgba(46, 204, 113, 0.35)',
            color: '#a7f3d0',
            fontSize: '0.9em',
          }}
        >
          💡 <strong>Escala ativa protegida:</strong> Ao adicionar ou remover um instrumento abaixo, ele entra (ou sai) automaticamente na escala já gerada — <strong>sem perder os ajustes que você já otimizou</strong>!
        </div>
      )}

      {datasEscala.length > 1 && funcoesDisponiveisNoMes.length > 0 && (
        <div
          style={{
            marginTop: '14px',
            padding: '12px 15px',
            borderRadius: '8px',
            backgroundColor: '#1e2229',
            border: '1px dashed rgba(97, 218, 251, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: '#61dafb', fontWeight: 600, fontSize: '0.92em' }}>
            📅 Esqueceu um instrumento no mês todo?
          </span>
          <select
            id="select_todos_os_dias"
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '8px',
              borderRadius: '5px',
              backgroundColor: '#3c414d',
              color: 'white',
              border: '1px solid #4a505c',
            }}
          >
            <option value="">➕ Escolher função para incluir em todos os dias...</option>
            {funcoesDisponiveisNoMes.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const select = document.getElementById('select_todos_os_dias');
              if (select && select.value) {
                adicionarVagaTodosOsDias(select.value);
                select.value = '';
              }
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2ecc71',
              color: '#111827',
              border: 'none',
              borderRadius: '5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Incluir em Todos os Dias
          </button>
        </div>
      )}

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
