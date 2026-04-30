// componente: ConfiguracaoDatas.jsx
// Apresentacional puro: renderiza os controles de configuração do período (mês/ano/dia)
// e a listagem de pills com as datas encontradas.
import React from 'react';
import { formatDataDDMM } from '../../utils/escalaHelpers';

export default function ConfiguracaoDatas({
  mes, setMes,
  ano, setAno,
  diaSemanaAlvo, setDiaSemanaAlvo,
  datasEscala,
  mesesNomes,
  diasSemanaNomes,
}) {
  return (
    <div className="controls" style={{ marginBottom: '30px' }}>
      <h2>📅 Configuração do Mês</h2>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '15px' }}>

        <div style={{ flex: 1, minWidth: '150px' }}>
          <label>Mês:</label>
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '5px', backgroundColor: '#282c34', color: 'white', border: '1px solid #4a505c' }}
          >
            {mesesNomes.map((nome, index) => (
              <option key={index} value={index}>{nome}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: '150px' }}>
          <label>Ano:</label>
          <input
            type="number"
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '5px', backgroundColor: '#282c34', color: 'white', border: '1px solid #4a505c' }}
          />
        </div>

        <div style={{ flex: 1, minWidth: '150px' }}>
          <label>Dia dos Cultos:</label>
          <select
            value={diaSemanaAlvo}
            onChange={(e) => setDiaSemanaAlvo(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '5px', backgroundColor: '#282c34', color: 'white', border: '1px solid #4a505c' }}
          >
            {diasSemanaNomes.map((nome, index) => (
              <option key={index} value={index}>{nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#282c34', borderRadius: '8px', border: '1px dashed #61dafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <strong style={{ color: '#61dafb' }}>Dias da escala: </strong>
          {datasEscala.map((data, idx) => (
            <span key={idx} style={{ backgroundColor: '#4a505c', padding: '3px 10px', borderRadius: '15px', fontSize: '0.9em', whiteSpace: 'nowrap' }}>
              {formatDataDDMM(data)}
            </span>
          ))}
        </div>
        <span style={{ fontSize: '0.8em', color: '#9ab', fontStyle: 'italic' }}>
          Para alterar as colunas/funções padrão, vá à aba 👤 Perfil.
        </span>
      </div>
    </div>
  );
}
