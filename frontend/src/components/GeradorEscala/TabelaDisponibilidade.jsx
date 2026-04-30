// componente: TabelaDisponibilidade.jsx
// Apresentacional puro: matriz de disponibilidades com toggle por célula
// e botões de ação em massa (global e por membro).
import React from 'react';
import { formatDataKey, formatDataDDMM } from '../../utils/escalaHelpers';

export default function TabelaDisponibilidade({
  equipa,
  datasEscala,
  indisponibilidades,
  toggleIndisponibilidade,
  marcarTodosIndisponiveis,
  marcarTodosDisponiveis,
  marcarMembroIndisponivel,
  desmarcarMembroIndisponivel,
}) {
  return (
    <div className="input-area" style={{ overflowX: 'auto' }}>

      {/* Cabeçalho responsivo com dois botões de ação global */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 style={{ margin: 0 }}>✅ Disponibilidades</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            onClick={marcarTodosDisponiveis}
            title="Marca todos os membros como disponíveis em todos os dias"
            style={{ padding: '7px 16px', backgroundColor: '#1a5c38', color: '#2ecc71', border: '1px solid #2ecc71', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85em' }}
          >
            ✅ Marcar Todos como Disponíveis
          </button>
          <button
            onClick={marcarTodosIndisponiveis}
            title="Marca todos os membros como indisponíveis em todos os dias"
            style={{ padding: '7px 16px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85em' }}
          >
            ❌ Marcar Todos como Indisponíveis
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
      <table className="escala-matrix">
        <thead>
          <tr>
            <th>Membro / Funções</th>
            {datasEscala.map((d, i) => <th key={i}>{formatDataDDMM(d)}</th>)}
          </tr>
        </thead>
        <tbody>
          {equipa.map(membro => (
            <tr key={membro.id}>

              {/* Coluna do membro com botões de ação em massa */}
              <td className="membro-celula">
                <strong>{membro.nome}</strong>
                <div className="funcoes-mini">{membro.funcoes.join(', ')}</div>
                <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                  <button
                    onClick={() => desmarcarMembroIndisponivel(membro.id)}
                    title="Marcar todos os dias como Disponível"
                    style={{ padding: '2px 7px', fontSize: '0.7em', backgroundColor: '#1a5c38', color: '#2ecc71', border: '1px solid #2ecc71', borderRadius: '4px', cursor: 'pointer', lineHeight: 1.4 }}
                  >
                    ✅ Todos OK
                  </button>
                  <button
                    onClick={() => marcarMembroIndisponivel(membro.id)}
                    title="Marcar todos os dias como Indisponível"
                    style={{ padding: '2px 7px', fontSize: '0.7em', backgroundColor: '#5c1a1a', color: '#ff6b6b', border: '1px solid #e74c3c', borderRadius: '4px', cursor: 'pointer', lineHeight: 1.4 }}
                  >
                    ❌ Todos Fora
                  </button>
                </div>
              </td>

              {/* Células de disponibilidade (toggle) */}
              {datasEscala.map((d, i) => {
                const key = `${membro.id}_${formatDataKey(d)}`;
                const isIndisponivel = indisponibilidades[key];
                return (
                  <td
                    key={i}
                    onClick={() => toggleIndisponibilidade(membro.id, d)}
                    className={isIndisponivel ? 'celula-falta' : 'celula-ok'}
                  >
                    {isIndisponivel ? '❌ Indisponível' : '✅ Disponível'}<br />
                    <span style={{ fontSize: '0.75em', opacity: 0.8 }}>{formatDataDDMM(d)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
