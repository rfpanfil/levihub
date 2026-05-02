// componente: PainelRegras.jsx
// Semi-Smart: gerencia internamente o estado do formulário de regras
// e as validações, usando o contexto global para os dados da escala.
import React, { useState } from 'react';
import { useScale } from '../../context/ScaleContext';
import { formatDataKey, formatDataDDMM } from '../../utils/escalaHelpers';

export default function PainelRegras() {
  const {
    regras,
    equipa,
    catalogoVagas,
    vagasPorDia,
    datasEscala,
    indisponibilidades,
    getDiasDisponiveisMembro,
    handleAdicionarRegra: onAdicionarRegra,
    removerRegra: onRemoverRegra,
  } = useScale();

  // --- Estado interno do formulário de regras ---
  const [regraTipo, setRegraTipo] = useState('frequencia');
  const [regraMembro1, setRegraMembro1] = useState('');
  const [regraAlvo, setRegraAlvo] = useState('');
  const [regraAlvoData, setRegraAlvoData] = useState('');
  const [regraFuncao, setRegraFuncao] = useState('');
  const [regraQuantidade, setRegraQuantidade] = useState(1);
  const [regraError, setRegraError] = useState('');

  const resetForm = () => {
    setRegraMembro1(''); setRegraAlvo(''); setRegraAlvoData('');
    setRegraFuncao(''); setRegraQuantidade(1); setRegraError('');
  };

  const handleTipoChange = (e) => {
    setRegraTipo(e.target.value);
    resetForm();
  };

  // --- Lógica de validação e construção da regra ---
  const handleAdicionarRegra = () => {
    setRegraError('');
    const membroNome = equipa.find(m => m.id.toString() === regraMembro1)?.nome;
    let descricao = '';

    if (regraTipo === 'frequencia') {
      if (!regraMembro1 || !regraFuncao || !regraQuantidade) {
        setRegraError('Por favor, preencha todos os campos.');
        return;
      }
      descricao = `🎯 ${membroNome} PRECISA tocar EXATAMENTE ${regraQuantidade}x na função ${regraFuncao}`;
    } else {
      if (!regraMembro1 || !regraAlvo) {
        setRegraError('Por favor, preencha todos os campos.');
        return;
      }
      if (regraTipo === 'tocar_com_no_dia' && !regraAlvoData) {
        setRegraError('Por favor, selecione o dia.');
        return;
      }
      if ((regraTipo === 'tocar_com' || regraTipo === 'tocar_com_no_dia') && regraMembro1 === regraAlvo) {
        setRegraError('Um membro não pode ter regra consigo mesmo.');
        return;
      }

      if (regraTipo === 'dia_especifico') {
        if (indisponibilidades[`${regraMembro1}_${regraAlvo}`]) {
          setRegraError(`Impossível: ${membroNome} está de Falta.`);
          return;
        }
        const [d, m] = regraAlvo.split('-');
        descricao = `${membroNome} PRECISA tocar/cantar no dia ${d.padStart(2, '0')}/${String(parseInt(m) + 1).padStart(2, '0')}`;
      } else if (regraTipo === 'tocar_com') {
        descricao = `${membroNome} PRECISA ser escalado(a) com ${equipa.find(m => m.id.toString() === regraAlvo)?.nome}`;
      } else if (regraTipo === 'tocar_com_no_dia') {
        if (
          indisponibilidades[`${regraMembro1}_${regraAlvoData}`] ||
          indisponibilidades[`${regraAlvo}_${regraAlvoData}`]
        ) {
          setRegraError('Impossível: Alguém está de Falta.');
          return;
        }
        const [d, m] = regraAlvoData.split('-');
        descricao = `${membroNome} PRECISA ser escalado(a) com ${equipa.find(m => m.id.toString() === regraAlvo)?.nome} no dia ${d.padStart(2, '0')}/${String(parseInt(m) + 1).padStart(2, '0')}`;
      }
    }

    onAdicionarRegra({
      id: Date.now(),
      membro1: regraMembro1,
      tipo: regraTipo,
      alvo: regraAlvo,
      alvoData: regraAlvoData,
      funcao: regraFuncao,
      quantidade: regraQuantidade,
      descricao,
    });
    resetForm();
  };

  // Helper: funções únicas em uso na escala atual
  const funcoesEmUso = [...new Set(Object.values(vagasPorDia).flat().map(v => v.label))];

  return (
    <div className="input-area">
      <h2>🔗 Regras Específicas (Opcional)</h2>

      <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>

        {/* Seletor de Tipo */}
        <div>
          <label>Tipo de Regra:</label>
          <select value={regraTipo} onChange={handleTipoChange} style={{ padding: '8px', borderRadius: '5px' }}>
            <option value="frequencia">🎯 Controlar Quantidade Mensal</option>
            <option value="tocar_com">PRECISA ser escalado(a) com...</option>
            <option value="dia_especifico">PRECISA tocar/cantar no dia...</option>
            <option value="tocar_com_no_dia">PRECISA ser escalado(a) com... no dia</option>
          </select>
        </div>

        {/* Campos do formulário de frequência */}
        {regraTipo === 'frequencia' ? (
          <>
            <div>
              <label>Função:</label>
              <select
                value={regraFuncao}
                onChange={e => { setRegraFuncao(e.target.value); setRegraMembro1(''); setRegraError(''); }}
                style={{ padding: '8px', borderRadius: '5px' }}
              >
                <option value="">Selecione a Função...</option>
                {funcoesEmUso.map((fLabel, i) => (
                  <option key={i} value={fLabel}>{fLabel}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Membro:</label>
              <select
                value={regraMembro1}
                onChange={e => { setRegraMembro1(e.target.value); setRegraQuantidade(1); setRegraError(''); }}
                style={{ padding: '8px', borderRadius: '5px' }}
                disabled={!regraFuncao}
              >
                <option value="">Selecione o Membro...</option>
                {equipa
                  .filter(m => {
                    // Prevenção de erro: Garantir que funcoes é string/array antes de iterar
                    const funcoesArr = Array.isArray(m.funcoes) ? m.funcoes : (m.funcoes ? m.funcoes.split(',') : []);
                    const temFuncao = regraFuncao
                      ? funcoesArr.some(f => {
                          const vagaCat = catalogoVagas.find(v => v.label === regraFuncao);
                          return vagaCat && vagaCat.aceita.some(a => a.toLowerCase() === f.trim().toLowerCase());
                        })
                      : false;
                    return temFuncao && getDiasDisponiveisMembro(m.id, regraFuncao) > 0;
                  })
                  .map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nome} (Livre: {getDiasDisponiveisMembro(m.id, regraFuncao)}x)
                    </option>
                  ))}
              </select>
            </div>

            {regraMembro1 && (
              <div>
                <label>Vezes:</label>
                <select
                  value={regraQuantidade}
                  onChange={e => { setRegraQuantidade(parseInt(e.target.value)); setRegraError(''); }}
                  style={{ padding: '8px', borderRadius: '5px' }}
                >
                  {Array.from({ length: getDiasDisponiveisMembro(regraMembro1, regraFuncao) }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>{num} vez(es)</option>
                  ))}
                </select>
              </div>
            )}
          </>
        ) : (
          /* --- Campos para as outras regras --- */
          <>
            <div>
              <label>Membro:</label>
              <select
                value={regraMembro1}
                onChange={e => { setRegraMembro1(e.target.value); setRegraError(''); }}
                style={{ padding: '8px', borderRadius: '5px' }}
              >
                <option value="">Selecione...</option>
                {equipa.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>

            <div>
              <label>{regraTipo === 'dia_especifico' ? 'Dia Alvo:' : 'Membro Alvo:'}</label>
              <select
                value={regraAlvo}
                onChange={e => { setRegraAlvo(e.target.value); setRegraError(''); }}
                style={{ padding: '8px', borderRadius: '5px' }}
              >
                <option value="">Selecione...</option>
                {regraTipo === 'dia_especifico'
                  ? datasEscala.map((d, i) => (
                      <option key={i} value={formatDataKey(d)}>{formatDataDDMM(d)}</option>
                    ))
                  : equipa
                      .filter(m => m.id.toString() !== regraMembro1)
                      .map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>

            {regraTipo === 'tocar_com_no_dia' && (
              <div>
                <label>No Dia:</label>
                <select
                  value={regraAlvoData}
                  onChange={e => { setRegraAlvoData(e.target.value); setRegraError(''); }}
                  style={{ padding: '8px', borderRadius: '5px' }}
                >
                  <option value="">Selecione o Dia...</option>
                  {datasEscala.map((d, i) => (
                    <option key={i} value={formatDataKey(d)}>{formatDataDDMM(d)}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        <button
          onClick={handleAdicionarRegra}
          style={{ padding: '8px 15px', backgroundColor: '#61dafb', color: '#282c34', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          + Adicionar
        </button>
      </div>

      {regraError && (
        <p style={{ color: '#ff4b4b', marginTop: '15px', fontWeight: 'bold' }}>⚠️ {regraError}</p>
      )}

      {regras.length > 0 && (
        <ul style={{ marginTop: '20px', paddingLeft: '20px' }}>
          {regras.map(r => (
            <li key={r.id} style={{ marginBottom: '8px', color: '#ffd700' }}>
              {r.descricao}
              <button
                onClick={() => onRemoverRegra(r.id)}
                style={{ marginLeft: '10px', background: 'none', border: 'none', color: '#ff4b4b', cursor: 'pointer' }}
              >
                [Remover]
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
