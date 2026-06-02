// arquivo: frontend/src/context/ScaleContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { formatDataKey } from '../utils/escalaHelpers';
import { gerarEscalas } from '../utils/scaleLogic';

const ScaleContext = createContext();

export const useScale = () => {
  return useContext(ScaleContext);
};

export const ScaleProvider = ({ children }) => {
  const mesesNomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const diasSemanaNomes = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];

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
    Promise.all([
      apiFetch('/equipe').then(r => r.json()),
      apiFetch('/funcoes').then(r => r.json()),
      apiFetch('/usuario/me').then(r => r.json()),
    ]).then(([equipeData, funcoesData, perfilData]) => {
      if (equipeData.equipe) setEquipa(equipeData.equipe);
      if (perfilData && !perfilData.error) {
        setFuncoesPadraoUsuario(perfilData.funcoes_padrao ? perfilData.funcoes_padrao.split(',') : []);
      }
      if (funcoesData.funcoes) {
        const catalogo = funcoesData.funcoes
          .map(f => ({ 
              id: f.id.toString(), 
              label: f.nome, 
              aceita: [f.nome],
              permitidas_acumular: f.permitidas_acumular || [],
              obrigatorias_acumular: f.obrigatorias_acumular || []
          }))
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

    const vagasPadrao = {};
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
      vagasPadrao[key] = vagasDoDia;
    });

    setVagasPorDia(vagasPadrao);
    setIndisponibilidades({});
    setRegras([]);
    setEscalasGeradas([]);
    setOrdemMatriz([]);

    Promise.all([
      apiFetch(`/escala/vagas?mes=${mes}&ano=${ano}`).then(r => r.json()),
      apiFetch(`/escala/disponibilidades?mes=${mes}&ano=${ano}`).then(r => r.json()),
      apiFetch(`/escala/regras?mes=${mes}&ano=${ano}`).then(r => r.json()),
    ]).then(([vagasData, dispData, regrasData]) => {
      if (vagasData.vagas_por_dia && Object.keys(vagasData.vagas_por_dia).length > 0) {
        const vagasMergeadas = {};
        diasEncontrados.forEach(d => {
          const key = formatDataKey(d);
          vagasMergeadas[key] = vagasData.vagas_por_dia[key] ?? vagasPadrao[key];
        });
        setVagasPorDia(vagasMergeadas);
      }
      if (dispData.indisponibilidades && Object.keys(dispData.indisponibilidades).length > 0) {
        setIndisponibilidades(dispData.indisponibilidades);
      }
      if (regrasData && regrasData.regras && regrasData.regras.length > 0) {
        setRegras(regrasData.regras);
      }
    }).catch(err => console.warn('[Escala] Falha ao carregar configuração salva:', err));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, ano, diaSemanaAlvo, catalogoVagas, funcoesPadraoUsuario]);

  // =========================================================================
  // HELPERS DE PERSISTÊNCIA
  // =========================================================================

  const salvarVagas = (novasVagas) => {
    apiFetch('/escala/vagas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, ano, vagas_por_dia: novasVagas }),
    }).catch(err => console.warn('[Escala] Falha ao salvar vagas:', err));
  };

  const salvarDisponibilidades = (novasIndisponibilidades) => {
    apiFetch('/escala/disponibilidades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, ano, indisponibilidades: novasIndisponibilidades }),
    }).catch(err => console.warn('[Escala] Falha ao salvar disponibilidades:', err));
  };

  const salvarRegras = (novasRegras) => {
    apiFetch('/escala/regras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, ano, regras: novasRegras }),
    }).catch(err => console.warn('[Escala] Falha ao salvar regras:', err));
  };

  // =========================================================================
  // HANDLERS DE VAGAS
  // =========================================================================

  const adicionarVaga = (diaKey, vagaId) => {
    const vaga = catalogoVagas.find(v => v.id === vagaId);
    setVagasPorDia(prev => {
      if (prev[diaKey].some(v => v.id === vagaId)) return prev;
      const novas = { ...prev, [diaKey]: [...prev[diaKey], vaga] };
      salvarVagas(novas);
      return novas;
    });
  };

  const removerVaga = (diaKey, vagaId) => {
    setVagasPorDia(prev => {
      const novas = { ...prev, [diaKey]: prev[diaKey].filter(v => v.id !== vagaId) };
      salvarVagas(novas);
      return novas;
    });
  };

  // =========================================================================
  // HANDLERS DE DISPONIBILIDADE
  // =========================================================================

  const toggleIndisponibilidade = (membroId, dataObj) => {
    const key = `${membroId}_${formatDataKey(dataObj)}`;
    setIndisponibilidades(prev => {
      const novas = { ...prev, [key]: !prev[key] };
      salvarDisponibilidades(novas);
      return novas;
    });
  };

  const marcarTodosIndisponiveis = () => {
    const novas = {};
    equipa.forEach(membro => datasEscala.forEach(d => {
      novas[`${membro.id}_${formatDataKey(d)}`] = true;
    }));
    setIndisponibilidades(novas);
    salvarDisponibilidades(novas);
  };

  const marcarMembroIndisponivel = (membroId) => {
    setIndisponibilidades(prev => {
      const novas = { ...prev };
      datasEscala.forEach(d => { novas[`${membroId}_${formatDataKey(d)}`] = true; });
      salvarDisponibilidades(novas);
      return novas;
    });
  };

  const desmarcarMembroIndisponivel = (membroId) => {
    setIndisponibilidades(prev => {
      const novas = { ...prev };
      datasEscala.forEach(d => { delete novas[`${membroId}_${formatDataKey(d)}`]; });
      salvarDisponibilidades(novas);
      return novas;
    });
  };

  const marcarTodosDisponiveis = () => {
    setIndisponibilidades({});
    salvarDisponibilidades({});
  };

  // =========================================================================
  // HANDLERS DE REGRAS
  // =========================================================================

  const handleAdicionarRegra = (regraObj) => {
    setRegras(prev => {
      const novas = [...prev, regraObj];
      salvarRegras(novas);
      return novas;
    });
  };
  const removerRegra = (id) => {
    setRegras(prev => {
      const novas = prev.filter(r => r.id !== id);
      salvarRegras(novas);
      return novas;
    });
  };

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

  const handleGerarEscala = async () => {
    setIsGerando(true);
    setTimeout(() => {
      const escalas = gerarEscalas(
        equipa, datasEscala, indisponibilidades, regras, vagasPorDia
      );
      
      // Computa as vagas únicas que estão sendo usadas em todo o mês
      const uniqueVagasMap = new Map();
      Object.values(vagasPorDia).flat().forEach(vaga => {
        if (!uniqueVagasMap.has(vaga.id)) uniqueVagasMap.set(vaga.id, vaga);
      });
      const ordemInicial = Array.from(uniqueVagasMap.values());
      
      const newOrdem = ordemInicial.filter(vaga => funcoesPadraoUsuario.includes(vaga.label));
      const extras = ordemInicial.filter(vaga => !funcoesPadraoUsuario.includes(vaga.label));
      
      setOrdemMatriz([...newOrdem, ...extras]);
      setEscalasGeradas(escalas);
      setEscalaAtualIndex(0);
      setIsGerando(false);
    }, 500);
  };

  const isCandidatoValido = (membro, vaga) => {
    if (!membro.funcoes) return false;
    const funcoesArray = Array.isArray(membro.funcoes) ? membro.funcoes : membro.funcoes.split(',');
    const funcoesMembro = funcoesArray.map(f => f.trim().toLowerCase());
    return vaga.aceita.some(f => funcoesMembro.includes(f.toLowerCase()));
  };

  const handleTrocarMembro = (diaKey, vagaLabel) => {
    if (!escalasGeradas || escalasGeradas.length === 0) return;
    
    const escalaAtual = escalasGeradas[escalaAtualIndex];
    const alocadosNesteDia = escalaAtual[diaKey];
    if (!alocadosNesteDia) return;

    const alocacaoIndex = alocadosNesteDia.findIndex(a => a.vaga.label === vagaLabel);
    if (alocacaoIndex === -1) return;

    const alocacaoAtual = alocadosNesteDia[alocacaoIndex];
    const membroAtualId = alocacaoAtual.membro ? alocacaoAtual.membro.id : null;

    if (membroAtualId !== null) {
      const disponiveisHoje = alocadosNesteDia.filter(a => a.membro && a.membro.id !== membroAtualId).map(a => a.membro.id);
      if (disponiveisHoje.length > 0) {
          // Simplificação: apenas rotacionamos entre candidatos disponíveis
      }
    }

    const candidatos = equipa.filter(m => {
      if (m.id === membroAtualId) return true;
      const isUnavailable = indisponibilidades[`${m.id}_${diaKey}`];
      if (isUnavailable || !isCandidatoValido(m, alocacaoAtual.vaga)) return false;
      
      const alocacoesDoMembroHoje = alocadosNesteDia.filter(a => a.membro && a.membro.id === m.id);
      if (alocacoesDoMembroHoje.length >= 2) return false;
      if (alocacoesDoMembroHoje.length === 1) {
        const vagaExistente = alocacoesDoMembroHoje[0].vaga;
        const vagaAtual = alocacaoAtual.vaga;
        
        const permitidasAtual = vagaAtual.permitidas_acumular || [];
        const obrigatoriasAtual = vagaAtual.obrigatorias_acumular || [];
        const permitidasExistente = vagaExistente.permitidas_acumular || [];
        const obrigatoriasExistente = vagaExistente.obrigatorias_acumular || [];

        const ehObrigatorio = obrigatoriasAtual.includes(vagaExistente.label) || obrigatoriasExistente.includes(vagaAtual.label);
        const ehPermitido = permitidasAtual.includes(vagaExistente.label) || permitidasExistente.includes(vagaAtual.label);

        if (!ehObrigatorio && !ehPermitido) {
          return false;
        }
      }
      return true;
    });
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

  const value = {
    mesesNomes,
    diasSemanaNomes,
    equipa, setEquipa,
    catalogoVagas, setCatalogoVagas,
    funcoesPadraoUsuario, setFuncoesPadraoUsuario,
    isLoading, setIsLoading,
    mes, setMes,
    ano, setAno,
    diaSemanaAlvo, setDiaSemanaAlvo,
    datasEscala, setDatasEscala,
    vagasPorDia, setVagasPorDia,
    indisponibilidades, setIndisponibilidades,
    regras, setRegras,
    escalasGeradas, setEscalasGeradas,
    escalaAtualIndex, setEscalaAtualIndex,
    isGerando, setIsGerando,
    ordemMatriz, setOrdemMatriz,
    draggedRow, setDraggedRow,
    swapMessage, setSwapMessage,
    adicionarVaga,
    removerVaga,
    toggleIndisponibilidade,
    marcarTodosIndisponiveis,
    marcarMembroIndisponivel,
    desmarcarMembroIndisponivel,
    marcarTodosDisponiveis,
    handleAdicionarRegra,
    removerRegra,
    getDiasDisponiveisMembro,
    handleDragStartRow,
    handleDragEnterRow,
    handleDragEndRow,
    handleGerarEscala,
    handleTrocarMembro
  };

  return (
    <ScaleContext.Provider value={value}>
      {children}
    </ScaleContext.Provider>
  );
};
