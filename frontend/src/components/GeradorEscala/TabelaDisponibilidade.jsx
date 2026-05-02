// componente: TabelaDisponibilidade.jsx
import React from 'react';
import { useScale } from '../../context/ScaleContext';
import { formatDataKey, formatDataDDMM } from '../../utils/escalaHelpers';

export default function TabelaDisponibilidade() {
  const {
    equipa,
    datasEscala,
    indisponibilidades,
    toggleIndisponibilidade,
    marcarTodosIndisponiveis,
    marcarTodosDisponiveis,
    marcarMembroIndisponivel,
    desmarcarMembroIndisponivel,
  } = useScale();

  return (
    <div className="input-area w-full overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>

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

      <div className="w-full overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="escala-matrix w-full">
          <thead>
            <tr>
              <th>Membro / Funções</th>
              {datasEscala.map((d, i) => <th key={i}>{formatDataDDMM(d)}</th>)}
            </tr>
          </thead>
          <tbody>
            {equipa.map(membro => {
              // Verifica se as funcoes do membro estao no formato array ou string
              const funcoesArr = Array.isArray(membro.funcoes) ? membro.funcoes : (membro.funcoes ? membro.funcoes.split(',') : []);
              
              return (
              <tr key={membro.id}>

                {/* Coluna do membro com botões de ação em massa */}
                <td className="membro-celula min-w-[150px]">
                  <strong>{membro.nome}</strong>
                  <div className="funcoes-mini">{funcoesArr.join(', ')}</div>
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
                      className={isIndisponivel ? 'celula-falta min-w-[100px]' : 'celula-ok min-w-[100px]'}
                    >
                      {isIndisponivel ? '❌ Indisponível' : '✅ Disponível'}<br />
                      <span style={{ fontSize: '0.75em', opacity: 0.8 }}>{formatDataDDMM(d)}</span>
                    </td>
                  );
                })}
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}
