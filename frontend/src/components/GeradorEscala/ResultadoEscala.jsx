// componente: ResultadoEscala.jsx
// Apresentacional: exibe a matriz final com drag-and-drop, estatísticas e exportação.
import React from 'react';
import { formatDataKey, formatDataDDMM } from '../../utils/escalaHelpers';

export default function ResultadoEscala({
  escalasGeradas, escalaAtualIndex, setEscalaAtualIndex,
  ordemMatriz, datasEscala, mes, ano, mesesNomes,
  draggedRow, handleDragStartRow, handleDragEnterRow, handleDragEndRow,
  handleTrocarMembro, handleImprimir, handleWhatsApp,
}) {
  if (!escalasGeradas || escalasGeradas.length === 0) return null;
  const escalaAtual = escalasGeradas[escalaAtualIndex];

  return (
    <div className="result-area" style={{ marginTop: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #4a505c', paddingBottom: '15px', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <h2>✅ Escala de {mesesNomes[mes]}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#9ab' }}>Opção {escalaAtualIndex + 1} de {escalasGeradas.length}</span>
          <button onClick={() => setEscalaAtualIndex((prev) => (prev + 1) % escalasGeradas.length)} style={{ padding: '8px 15px', backgroundColor: 'transparent', border: '1px solid #61dafb', color: '#61dafb', borderRadius: '5px', cursor: 'pointer' }}>🔄 Ver outra</button>
        </div>
      </div>

      <div id="escala-resultado-matriz" style={{ padding: '20px', backgroundColor: '#282c34', borderRadius: '8px', overflowX: 'auto', maxWidth: '100%' }}>
        <h3 style={{ textAlign: 'center', color: 'white', marginTop: 0 }}>Escala de Louvor - {mesesNomes[mes]} / {ano}</h3>
        <table className="escala-matrix" style={{ backgroundColor: '#282c34', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ backgroundColor: '#3c414d', borderBottom: '3px solid #61dafb' }}>Função</th>
              {datasEscala.map((d, i) => <th key={i} style={{ borderBottom: '3px solid #61dafb' }}>{formatDataDDMM(d)}</th>)}
            </tr>
          </thead>
          <tbody>
            {ordemMatriz.map((vagaCatalogo, index) => (
              <tr key={vagaCatalogo.id} draggable
                onDragStart={(e) => { handleDragStartRow(index); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnter={() => handleDragEnterRow(index)}
                onDragEnd={handleDragEndRow}
                onDragOver={(e) => e.preventDefault()}
                style={{ transition: 'background-color 0.2s', backgroundColor: draggedRow === index ? 'rgba(97, 218, 251, 0.1)' : 'transparent' }}
              >
                <td style={{ backgroundColor: '#3c414d', fontWeight: 'bold', color: '#61dafb', cursor: 'grab' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: '#9ab', cursor: 'grab', fontSize: '1.2em' }} data-html2canvas-ignore="true">☰</span>
                    {vagaCatalogo.label}
                  </div>
                </td>
                {datasEscala.map((d, colIndex) => {
                  const diaKey = formatDataKey(d);
                  const alocacao = escalaAtual[diaKey]?.find(a => a.vaga.label === vagaCatalogo.label);
                  if (!alocacao) return <td key={colIndex} style={{ backgroundColor: '#2c3038', color: '#666', textAlign: 'center' }}>-</td>;
                  const pessoa = alocacao.membro.nome;
                  return (
                    <td key={colIndex} style={{ textAlign: 'center', color: pessoa === '---' ? '#ff4b4b' : 'white', fontWeight: pessoa !== '---' ? 'bold' : 'normal' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                        <span>{pessoa}</span>
                        <button onClick={() => handleTrocarMembro(diaKey, vagaCatalogo.label)} title="Substituir pessoa" data-html2canvas-ignore="true" style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '1.1em', padding: 0 }}>🔄</button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#1e2229', borderRadius: '8px', border: '1px solid #4a505c' }}>
        <h3 style={{ textAlign: 'center', color: '#61dafb', margin: '0 0 15px 0' }}>📊 Participações neste Mês</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center' }}>
          {(() => {
            const contagem = {};
            Object.values(escalaAtual).forEach(dia => {
              dia.forEach(aloc => {
                if (!aloc.membro || aloc.membro.nome === '---') return;
                const nome = aloc.membro.nome;
                if (!contagem[nome]) contagem[nome] = { cultos: 0, criancas: 0 };
                if (aloc.vaga.label.includes('Crianças')) contagem[nome].criancas += 1;
                else contagem[nome].cultos += 1;
              });
            });
            return Object.entries(contagem).sort((a, b) => a[0].localeCompare(b[0])).map(([nome, stats]) => (
              <div key={nome} style={{ backgroundColor: '#282c34', padding: '10px 15px', borderRadius: '5px', borderLeft: '3px solid #2ecc71', minWidth: '150px' }}>
                <strong style={{ display: 'block', color: 'white', marginBottom: '5px' }}>{nome}</strong>
                <div style={{ fontSize: '0.85em', color: '#9ab' }}>
                  <span>⛪ Cultos: <strong style={{ color: 'white' }}>{stats.cultos}</strong></span><br />
                  <span>🧸 Crianças: <strong style={{ color: 'white' }}>{stats.criancas}</strong></span>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '15px', marginTop: '25px', justifyContent: 'center' }}>
        <button onClick={handleImprimir} style={{ padding: '12px 25px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1em' }}>📸 Imprimir / Baixar Imagem</button>
        <button onClick={handleWhatsApp} style={{ padding: '12px 25px', backgroundColor: '#25D366', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1em' }}>💬 Enviar via WhatsApp</button>
      </div>
    </div>
  );
}
