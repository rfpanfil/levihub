// arquivo: frontend/src/pages/GeradorEscala.jsx
// SMART CONTAINER: mantém todo o estado e lógica de negócio.
// A renderização foi delegada a 5 componentes apresentacionais.
import React, { useState, useEffect } from 'react';
import { gerarEscalas } from '../utils/scaleLogic';
import html2canvas from 'html2canvas';
import { formatDataKey } from '../utils/escalaHelpers';

import ConfiguracaoDatas     from '../components/GeradorEscala/ConfiguracaoDatas';
import GestaoVagas           from '../components/GeradorEscala/GestaoVagas';
import TabelaDisponibilidade  from '../components/GeradorEscala/TabelaDisponibilidade';
import PainelRegras          from '../components/GeradorEscala/PainelRegras';
import ResultadoEscala       from '../components/GeradorEscala/ResultadoEscala';

import { API_BASE_URL } from '../services/config';


const mesesNomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const diasSemanaNomes = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];

function GeradorEscala() {
  // --- Estado: dados da equipa e catálogo ---
  const [equipa, setEquipa] = useState([]);
  const [catalogoVagas, setCatalogoVagas] = useState([]);
  const [funcoesPadraoUsuario, setFuncoesPadraoUsuario] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Estado: configuração do período ---
  const dataAtual = new Date();
  const [mes, setMes] = useState(dataAtual.getMonth());
  const [ano, setAno] = useState(dataAtual.getFullYear());
  const [diaSemanaAlvo, setDiaSemanaAlvo] = useState(0);
  const [datasEscala, setDatasEscala] = useState([]);

  // --- Estado: vagas, disponibilidades e regras ---
  const [vagasPorDia, setVagasPorDia] = useState({});
  const [indisponibilidades, setIndisponibilidades] = useState({});
  const [regras, setRegras] = useState([]);

  // --- Estado: resultado gerado e drag-and-drop ---
  const [escalasGeradas, setEscalasGeradas] = useState([]);
  const [escalaAtualIndex, setEscalaAtualIndex] = useState(0);
  const [isGerando, setIsGerando] = useState(false);
  const [ordemMatriz, setOrdemMatriz] = useState([]);
  const [draggedRow, setDraggedRow] = useState(null);
  const [swapMessage, setSwapMessage] = useState('');

  // =========================================================================
  // EFEITOS
  // =========================================================================

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };
    Promise.all([
      fetch(`${API_BASE_URL}/equipe`, { headers }).then(r => r.json()),
      fetch(`${API_BASE_URL}/funcoes`, { headers }).then(r => r.json()),
      fetch(`${API_BASE_URL}/usuario/me`, { headers }).then(r => r.json()),
    ]).then(([equipeData, funcoesData, perfilData]) => {
      if (equipeData.equipe) setEquipa(equipeData.equipe);
      if (perfilData && !perfilData.error) {
        setFuncoesPadraoUsuario(perfilData.funcoes_padrao ? perfilData.funcoes_padrao.split(',') : []);
      }
      if (funcoesData.funcoes) {
        const catalogo = funcoesData.funcoes
          .map(f => ({ id: f.id.toString(), label: f.nome, aceita: [f.nome] }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setCatalogoVagas(catalogo);
      }
      setIsLoading(false);
    }).catch(err => { console.error(err); setIsLoading(false); });
  }, []);

  useEffect(() => {
    if (catalogoVagas.length === 0 || funcoesPadraoUsuario.length === 0) return;
    const diasEncontrados = [];
    const dataIteracao = new Date(ano, mes, 1);
    while (dataIteracao.getMonth() === parseInt(mes)) {
      if (dataIteracao.getDay() === parseInt(diaSemanaAlvo)) diasEncontrados.push(new Date(dataIteracao));
      dataIteracao.setDate(dataIteracao.getDate() + 1);
    }
    setDatasEscala(diasEncontrados);
    const novasVagas = {};
    diasEncontrados.forEach(d => {
      const key = formatDataKey(d);
      let vagasDoDia = catalogoVagas.filter(v => funcoesPadraoUsuario.includes(v.label));
      vagasDoDia.sort((a, b) => {
        const iA = funcoesPadraoUsuario.indexOf(a.label);
        const iB = funcoesPadraoUsuario.indexOf(b.label);
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1;
        if (iB !== -1) return 1;
        return a.label.localeCompare(b.label);
      });
      novasVagas[key] = vagasDoDia;
    });
    setVagasPorDia(novasVagas);
    setIndisponibilidades({});
    setRegras([]);
    setEscalasGeradas([]);
    setOrdemMatriz([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, ano, diaSemanaAlvo, catalogoVagas, funcoesPadraoUsuario]);

  // =========================================================================
  // HANDLERS DE VAGAS
  // =========================================================================

  const adicionarVaga = (diaKey, vagaId) => {
    const vaga = catalogoVagas.find(v => v.id === vagaId);
    setVagasPorDia(prev => {
      if (prev[diaKey].some(v => v.id === vagaId)) return prev;
      return { ...prev, [diaKey]: [...prev[diaKey], vaga] };
    });
  };

  const removerVaga = (diaKey, vagaId) => {
    setVagasPorDia(prev => ({ ...prev, [diaKey]: prev[diaKey].filter(v => v.id !== vagaId) }));
  };

  // =========================================================================
  // HANDLERS DE DISPONIBILIDADE
  // =========================================================================

  const toggleIndisponibilidade = (membroId, dataObj) => {
    const key = `${membroId}_${formatDataKey(dataObj)}`;
    setIndisponibilidades(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const marcarTodosIndisponiveis = () => {
    const novas = {};
    equipa.forEach(membro => datasEscala.forEach(d => {
      novas[`${membro.id}_${formatDataKey(d)}`] = true;
    }));
    setIndisponibilidades(novas);
  };

  const marcarMembroIndisponivel = (membroId) => {
    setIndisponibilidades(prev => {
      const novas = { ...prev };
      datasEscala.forEach(d => { novas[`${membroId}_${formatDataKey(d)}`] = true; });
      return novas;
    });
  };

  const desmarcarMembroIndisponivel = (membroId) => {
    setIndisponibilidades(prev => {
      const novas = { ...prev };
      datasEscala.forEach(d => { delete novas[`${membroId}_${formatDataKey(d)}`]; });
      return novas;
    });
  };

  // Limpa todas as indisponibilidades de uma vez
  const marcarTodosDisponiveis = () => setIndisponibilidades({});

  // =========================================================================
  // HANDLERS DE REGRAS (interface com PainelRegras semi-smart)
  // =========================================================================

  const handleAdicionarRegra = (regraObj) => setRegras(prev => [...prev, regraObj]);
  const removerRegra = (id) => setRegras(regras.filter(r => r.id !== id));

  // Helper usado pelo PainelRegras via prop
  const getDiasDisponiveisMembro = (membroId, funcaoAlvo) => {
    if (!membroId) return 0;
    const totalDias = datasEscala.length;
    const faltas = datasEscala.filter(d => indisponibilidades[`${membroId}_${formatDataKey(d)}`]).length;
    const alvoIsDobra = funcaoAlvo && funcaoAlvo.toLowerCase().includes('criança');
    const vagasComprometidas = regras
      .filter(r => r.tipo === 'frequencia' && r.membro1 === membroId.toString())
      .filter(r => (r.funcao.toLowerCase().includes('criança')) === alvoIsDobra)
      .reduce((sum, r) => sum + parseInt(r.quantidade), 0);
    return totalDias - faltas - vagasComprometidas;
  };

  // =========================================================================
  // HANDLERS DE RESULTADO / DRAG-AND-DROP
  // =========================================================================

  const handleDragStartRow = (index) => setDraggedRow(index);
  const handleDragEnterRow = (index) => {
    if (draggedRow === null || draggedRow === index) return;
    const newOrdem = [...ordemMatriz];
    const item = newOrdem.splice(draggedRow, 1)[0];
    newOrdem.splice(index, 0, item);
    setDraggedRow(index);
    setOrdemMatriz(newOrdem);
  };
  const handleDragEndRow = () => setDraggedRow(null);

  const handleGerarEscala = () => {
    setIsGerando(true);
    // setTimeout de 100ms apenas para deixar a UI mostrar o estado de loading
    // antes do cálculo síncrono bloquear momentaneamente a thread.
    setTimeout(() => {
      const resultados = gerarEscalas(equipa, datasEscala, indisponibilidades, regras, vagasPorDia);
      setEscalasGeradas(resultados);
      setEscalaAtualIndex(0);
      const vagasEmUso = catalogoVagas
        .filter(v => datasEscala.some(d => vagasPorDia[formatDataKey(d)]?.some(va => va.id === v.id)))
        .sort((a, b) => {
          const iA = funcoesPadraoUsuario.indexOf(a.label);
          const iB = funcoesPadraoUsuario.indexOf(b.label);
          if (iA !== -1 && iB !== -1) return iA - iB;
          if (iA !== -1) return -1;
          if (iB !== -1) return 1;
          return a.label.localeCompare(b.label);
        });
      setOrdemMatriz(vagasEmUso);
      setIsGerando(false);
      if (resultados.length > 0) window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const handleTrocarMembro = (diaKey, vagaLabel) => {
    const escalaAtual = escalasGeradas[escalaAtualIndex];
    const alocadosNesteDia = escalaAtual[diaKey];
    const alocacaoIndex = alocadosNesteDia.findIndex(a => a.vaga.label === vagaLabel);
    if (alocacaoIndex === -1) return;
    const alocacaoAtual = alocadosNesteDia[alocacaoIndex];
    const membroAtualId = alocacaoAtual.membro.id || null;

    const isCandidatoValido = (membro, vaga) => {
      if (indisponibilidades[`${membro.id}_${diaKey}`]) return false;
      const temFuncao = membro.funcoes.some(f => vaga.aceita.some(a => a.toLowerCase() === f.toLowerCase()));
      if (!temFuncao) return false;
      const outrasAloc = alocadosNesteDia.filter(a => a.membro.id === membro.id && a.vaga.label !== vaga.label);
      if (outrasAloc.length >= 2) return false;
      if (outrasAloc.length === 1) {
        const isMidiaOuSom = (l) => l.toLowerCase().includes('mídia') || l.toLowerCase().includes('som') || l.toLowerCase().includes('live');
        const isCrianca = (l) => l.includes('Crianças');
        const isAdultoMusical = (l) => !isCrianca(l) && !isMidiaOuSom(l);
        const ehDobraValida = (isAdultoMusical(outrasAloc[0].vaga.label) && isCrianca(vaga.label)) ||
                              (isCrianca(outrasAloc[0].vaga.label) && isAdultoMusical(vaga.label));
        if (!ehDobraValida) return false;
      }
      return true;
    };

    const candidatos = equipa.filter(m => isCandidatoValido(m, alocacaoAtual.vaga) || m.id === membroAtualId);
    candidatos.push({ id: null, nome: '---' });
    const currentIndex = candidatos.findIndex(c => c.id === membroAtualId);
    const proximoMembro = candidatos[(currentIndex + 1) % candidatos.length];

    if (candidatos.length <= 2 && membroAtualId !== null && proximoMembro.id === null) {
      setSwapMessage(`Apenas ${alocacaoAtual.membro.nome} está disponível para ${vagaLabel} neste dia.`);
      setTimeout(() => setSwapMessage(''), 3000);
    }

    const novasEscalas = [...escalasGeradas];
    novasEscalas[escalaAtualIndex] = {
      ...novasEscalas[escalaAtualIndex],
      [diaKey]: alocadosNesteDia.map((a, i) => i === alocacaoIndex ? { ...a, membro: proximoMembro } : a),
    };
    setEscalasGeradas(novasEscalas);
  };

  const handleImprimir = async () => {
    const elemento = document.getElementById('escala-resultado-matriz');
    if (!elemento) return;
    const canvas = await html2canvas(elemento, { backgroundColor: '#282c34', scale: 2 });
    const link = document.createElement('a');
    link.download = `escala_${mesesNomes[mes]}_${ano}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleWhatsApp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Escala do mês ${mesesNomes[mes]}`)}`, '_blank');
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="gerador-escala-container" style={{ position: 'relative' }}>

      {swapMessage && (
        <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#e74c3c', color: 'white', padding: '10px 20px', borderRadius: '8px', zIndex: 1000, boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
          ⚠️ {swapMessage}
        </div>
      )}

      <ConfiguracaoDatas
        mes={mes} setMes={setMes}
        ano={ano} setAno={setAno}
        diaSemanaAlvo={diaSemanaAlvo} setDiaSemanaAlvo={setDiaSemanaAlvo}
        datasEscala={datasEscala}
        mesesNomes={mesesNomes}
        diasSemanaNomes={diasSemanaNomes}
      />

      {isLoading ? (
        <p>A carregar base de dados...</p>
      ) : (
        <>
          <GestaoVagas
            datasEscala={datasEscala}
            vagasPorDia={vagasPorDia}
            catalogoVagas={catalogoVagas}
            funcoesPadraoUsuario={funcoesPadraoUsuario}
            diasSemanaNomes={diasSemanaNomes}
            adicionarVaga={adicionarVaga}
            removerVaga={removerVaga}
          />

          <TabelaDisponibilidade
            equipa={equipa}
            datasEscala={datasEscala}
            indisponibilidades={indisponibilidades}
            toggleIndisponibilidade={toggleIndisponibilidade}
            marcarTodosIndisponiveis={marcarTodosIndisponiveis}
            marcarTodosDisponiveis={marcarTodosDisponiveis}
            marcarMembroIndisponivel={marcarMembroIndisponivel}
            desmarcarMembroIndisponivel={desmarcarMembroIndisponivel}
          />

          <PainelRegras
            regras={regras}
            equipa={equipa}
            catalogoVagas={catalogoVagas}
            vagasPorDia={vagasPorDia}
            datasEscala={datasEscala}
            indisponibilidades={indisponibilidades}
            getDiasDisponiveisMembro={getDiasDisponiveisMembro}
            onAdicionarRegra={handleAdicionarRegra}
            onRemoverRegra={removerRegra}
          />

          <div style={{ textAlign: 'center', marginTop: '30px' }}>
            <button className="main-button" onClick={handleGerarEscala} disabled={isGerando} style={{ padding: '15px 40px', fontSize: '1.2em' }}>
              {isGerando ? 'Calculando rotas...' : '🎲 Gerar Escala Automática'}
            </button>
          </div>

          <ResultadoEscala
            escalasGeradas={escalasGeradas}
            escalaAtualIndex={escalaAtualIndex}
            setEscalaAtualIndex={setEscalaAtualIndex}
            ordemMatriz={ordemMatriz}
            datasEscala={datasEscala}
            mes={mes}
            ano={ano}
            mesesNomes={mesesNomes}
            draggedRow={draggedRow}
            handleDragStartRow={handleDragStartRow}
            handleDragEnterRow={handleDragEnterRow}
            handleDragEndRow={handleDragEndRow}
            handleTrocarMembro={handleTrocarMembro}
            handleImprimir={handleImprimir}
            handleWhatsApp={handleWhatsApp}
          />
        </>
      )}
    </div>
  );
}

export default GeradorEscala;