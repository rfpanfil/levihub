// arquivo: frontend/src/context/ScaleContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { apiFetch } from '../services/api';
import { formatDataKey, formatDataDDMM } from '../utils/escalaHelpers';
import { gerarEscalas, escolherMelhorCandidatoParaSlot } from '../utils/scaleLogic';

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
  const draggedRowRef = useRef(null);
  const [swapMessage, setSwapMessage] = useState('');
  const msgTimerRef = useRef(null);

  const mostrarMensagem = (msg, duracao = 3800) => {
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    setSwapMessage(msg);
    msgTimerRef.current = setTimeout(() => setSwapMessage(''), duracao);
  };

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
      apiFetch(`/escala/matriz?mes=${mes}&ano=${ano}`).then(r => r.json()),
    ]).then(([vagasData, dispData, regrasData, matrizData]) => {
      if (vagasData.vagas_por_dia && Object.keys(vagasData.vagas_por_dia).length > 0) {
        const vagasMergeadas = {};
        diasEncontrados.forEach(d => {
          const key = formatDataKey(d);
          const vagasSalvas = vagasData.vagas_por_dia[key];
          if (vagasSalvas) {
            // Hidrata as vagas salvas com as configurações mais recentes de acúmulo do catálogo
            vagasMergeadas[key] = vagasSalvas.map(vSalva => {
              const vagaCatalogo = catalogoVagas.find(c => c.label === vSalva.label);
              return vagaCatalogo ? { 
                ...vSalva, 
                permitidas_acumular: vagaCatalogo.permitidas_acumular,
                obrigatorias_acumular: vagaCatalogo.obrigatorias_acumular
              } : vSalva;
            });
          } else {
            vagasMergeadas[key] = vagasPadrao[key];
          }
        });
        setVagasPorDia(vagasMergeadas);
      }
      if (dispData.indisponibilidades && Object.keys(dispData.indisponibilidades).length > 0) {
        setIndisponibilidades(dispData.indisponibilidades);
      }
      if (regrasData && regrasData.regras && regrasData.regras.length > 0) {
        setRegras(regrasData.regras);
      }
      if (matrizData && matrizData.error) {
        alert("Erro no backend ao carregar a matriz: " + matrizData.error);
      }
      if (matrizData && matrizData.escalas_geradas && matrizData.escalas_geradas.length > 0) {
        setEscalasGeradas(matrizData.escalas_geradas);
        setOrdemMatriz(matrizData.ordem_matriz || []);
        setEscalaAtualIndex(matrizData.escala_atual_index || 0);
      } else {
        setEscalasGeradas([]);
        setOrdemMatriz([]);
        setEscalaAtualIndex(0);
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

  useEffect(() => {
    if (draggedRow !== null) return;
    if (escalasGeradas.length > 0) {
        apiFetch('/escala/matriz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                mes, ano, 
                escalas_geradas: escalasGeradas, 
                ordem_matriz: ordemMatriz,
                escala_atual_index: escalaAtualIndex 
            }),
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert("Erro no backend ao salvar a matriz: " + data.error);
            } else if (data.detail) {
                alert("Erro de validação no backend: " + JSON.stringify(data.detail));
            }
        })
        .catch(err => alert('[Escala] Falha na requisição ao salvar matriz: ' + err.message));
    }
  }, [escalasGeradas, ordemMatriz, escalaAtualIndex, mes, ano, draggedRow]);

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
    const vaga = catalogoVagas.find(v => String(v.id) === String(vagaId));
    if (!vaga) return;

    setVagasPorDia(prev => {
      const atuais = prev[diaKey] || [];
      if (atuais.some(v => String(v.id) === String(vaga.id) || v.label === vaga.label)) return prev;
      const novas = { ...prev, [diaKey]: [...atuais, vaga] };
      salvarVagas(novas);
      return novas;
    });

    // Se já existe uma escala gerada/otimizada, injeta APENAS esta nova vaga neste dia
    // sem mexer em nenhuma outra pessoa ou função já escalada!
    if (escalasGeradas && escalasGeradas.length > 0) {
      setOrdemMatriz(prevOrdem => {
        if (prevOrdem.some(v => v.label === vaga.label)) return prevOrdem;
        return [...prevOrdem, vaga];
      });

      const escalaRef = escalasGeradas[escalaAtualIndex] || escalasGeradas[0] || {};
      const jaTinhaNaEscala = (escalaRef[diaKey] || []).some(a => a.vaga?.label === vaga.label);
      const membroPreview = jaTinhaNaEscala
        ? null
        : escolherMelhorCandidatoParaSlot(vaga, diaKey, escalaRef, equipa, indisponibilidades, regras);

      setEscalasGeradas(prevEscalas =>
        prevEscalas.map(escala => {
          const alocadosDia = escala[diaKey] || [];
          if (alocadosDia.some(a => a.vaga?.label === vaga.label)) return escala;
          const melhorMembro = escolherMelhorCandidatoParaSlot(
            vaga,
            diaKey,
            escala,
            equipa,
            indisponibilidades,
            regras
          );
          return {
            ...escala,
            [diaKey]: [...alocadosDia, { vaga, membro: melhorMembro }],
          };
        })
      );

      if (membroPreview) {
        const dataObj = datasEscala.find(d => formatDataKey(d) === diaKey);
        const dataLabel = dataObj ? formatDataDDMM(dataObj) : diaKey;
        const quem = membroPreview.nome === '---' ? 'sem candidato disponível (---)' : membroPreview.nome;
        mostrarMensagem(`✅ "${vaga.label}" adicionada em ${dataLabel} (${quem}) sem alterar sua escala!`);
      }
    }
  };

  const adicionarVagaTodosOsDias = (vagaId) => {
    const vaga = catalogoVagas.find(v => String(v.id) === String(vagaId));
    if (!vaga || datasEscala.length === 0) return;

    let diasAdicionados = 0;
    setVagasPorDia(prev => {
      const novas = { ...prev };
      datasEscala.forEach(d => {
        const dk = formatDataKey(d);
        const atuais = novas[dk] || [];
        if (!atuais.some(v => String(v.id) === String(vaga.id) || v.label === vaga.label)) {
          novas[dk] = [...atuais, vaga];
          diasAdicionados++;
        }
      });
      salvarVagas(novas);
      return novas;
    });

    if (escalasGeradas && escalasGeradas.length > 0) {
      setOrdemMatriz(prevOrdem => {
        if (prevOrdem.some(v => v.label === vaga.label)) return prevOrdem;
        return [...prevOrdem, vaga];
      });

      setEscalasGeradas(prevEscalas =>
        prevEscalas.map(escala => {
          const escalaAtualizada = { ...escala };
          datasEscala.forEach(d => {
            const dk = formatDataKey(d);
            const alocadosDia = escalaAtualizada[dk] || [];
            if (!alocadosDia.some(a => a.vaga?.label === vaga.label)) {
              const melhorMembro = escolherMelhorCandidatoParaSlot(
                vaga,
                dk,
                escalaAtualizada,
                equipa,
                indisponibilidades,
                regras
              );
              escalaAtualizada[dk] = [...alocadosDia, { vaga, membro: melhorMembro }];
            }
          });
          return escalaAtualizada;
        })
      );

      mostrarMensagem(`✅ "${vaga.label}" incluída em todos os dias do mês sem alterar sua escala atual!`);
    } else if (diasAdicionados > 0) {
      mostrarMensagem(`✅ "${vaga.label}" adicionada aos dias do mês!`);
    }
  };

  const removerVaga = (diaKey, vagaId) => {
    const vagaAlvo =
      catalogoVagas.find(v => String(v.id) === String(vagaId)) ||
      (vagasPorDia[diaKey] || []).find(v => String(v.id) === String(vagaId));

    const novasVagasPorDia = {
      ...vagasPorDia,
      [diaKey]: (vagasPorDia[diaKey] || []).filter(v => String(v.id) !== String(vagaId)),
    };
    setVagasPorDia(novasVagasPorDia);
    salvarVagas(novasVagasPorDia);

    if (escalasGeradas && escalasGeradas.length > 0 && vagaAlvo) {
      const aindaExisteEmAlgumDia = Object.values(novasVagasPorDia)
        .flat()
        .some(v => v && v.label === vagaAlvo.label);

      setEscalasGeradas(prevEscalas =>
        prevEscalas.map(escala => ({
          ...escala,
          [diaKey]: (escala[diaKey] || []).filter(a => a.vaga?.label !== vagaAlvo.label),
        }))
      );

      if (!aindaExisteEmAlgumDia) {
        setOrdemMatriz(prevOrdem => prevOrdem.filter(v => v.label !== vagaAlvo.label));
      }

      const dataObj = datasEscala.find(d => formatDataKey(d) === diaKey);
      const dataLabel = dataObj ? formatDataDDMM(dataObj) : diaKey;
      mostrarMensagem(`✅ "${vagaAlvo.label}" removida de ${dataLabel} sem alterar o restante da escala!`);
    }
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

  const handleDragStartRow = (index) => {
    draggedRowRef.current = index;
    setDraggedRow(index);
  };
  const handleDragEnterRow = (index) => {
    const currentIndex = draggedRowRef.current;
    if (currentIndex === null || currentIndex === index) return;
    draggedRowRef.current = index;
    setDraggedRow(index);
    setOrdemMatriz((prev) => {
      if (currentIndex < 0 || currentIndex >= prev.length || index < 0 || index >= prev.length) {
        return prev;
      }
      const newOrdem = [...prev];
      const [item] = newOrdem.splice(currentIndex, 1);
      newOrdem.splice(index, 0, item);
      return newOrdem;
    });
  };
  const handleDragEndRow = () => {
    draggedRowRef.current = null;
    setDraggedRow(null);
  };

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

    const vagaAtualCat = catalogoVagas.find(c => c.label === alocacaoAtual.vaga.label) || alocacaoAtual.vaga;

    const candidatos = equipa.filter(m => {
      if (m.id === membroAtualId) return true;
      const isUnavailable = indisponibilidades[`${m.id}_${diaKey}`];
      if (isUnavailable || !isCandidatoValido(m, vagaAtualCat)) return false;
      
      const alocacoesDoMembroHoje = alocadosNesteDia.filter(a => a.membro && a.membro.id === m.id);
      if (alocacoesDoMembroHoje.length >= 2) return false;
      if (alocacoesDoMembroHoje.length === 1) {
        const vagaExistenteRaw = alocacoesDoMembroHoje[0].vaga;
        const vagaExistente = catalogoVagas.find(c => c.label === vagaExistenteRaw.label) || vagaExistenteRaw;
        
        const permitidasAtual = vagaAtualCat.permitidas_acumular || [];
        const obrigatoriasAtual = vagaAtualCat.obrigatorias_acumular || [];
        const permitidasExistente = vagaExistente.permitidas_acumular || [];
        const obrigatoriasExistente = vagaExistente.obrigatorias_acumular || [];

        const ehObrigatorio = obrigatoriasAtual.includes(vagaExistente.label) || obrigatoriasExistente.includes(vagaAtualCat.label);
        const ehPermitido = permitidasAtual.includes(vagaExistente.label) || permitidasExistente.includes(vagaAtualCat.label);

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
      mostrarMensagem(`Apenas ${alocacaoAtual.membro.nome} está disponível para ${vagaLabel} neste dia.`, 3000);
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
    adicionarVagaTodosOsDias,
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
