import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../services/api';
import { Plus, Trash2, Edit2, ArrowLeft, Search, Eye, EyeOff, Filter, Clock, Save, Copy, Check, Calendar } from 'lucide-react';
import './Planejamento.css';

// Formata há quanto tempo a música foi adicionada em um planejamento pela última vez
function formatarTempoSemPlanejar(isoDateStr) {
  if (!isoDateStr) return null;
  const data = new Date(isoDateStr.endsWith('Z') ? isoDateStr : `${isoDateStr.replace(' ', 'T')}Z`);
  if (isNaN(data.getTime())) return null;

  const agora = new Date();
  const diffMs = Math.max(0, agora.getTime() - data.getTime());
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias === 0) return 'hoje';
  if (diffDias === 1) return 'há 1 dia';
  if (diffDias < 30) return `há ${diffDias} dias`;
  const meses = Math.floor(diffDias / 30);
  if (meses === 1) return `há 1 mês (${diffDias}d)`;
  if (meses < 12) return `há ${meses} meses (${diffDias}d)`;
  const anos = Math.floor(diffDias / 365);
  return anos === 1 ? `há 1 ano (${diffDias}d)` : `há ${anos} anos (${diffDias}d)`;
}

// Calcula todos os domingos de um determinado ano e mês (1-12)
function gerarDomingosDoMes(ano, mes) {
  const domingos = [];
  const data = new Date(ano, mes - 1, 1);
  while (data.getMonth() === mes - 1) {
    if (data.getDay() === 0) {
      const dia = String(data.getDate()).padStart(2, '0');
      const mesStr = String(mes).padStart(2, '0');
      domingos.push(`Domingo (${dia}/${mesStr})`);
    }
    data.setDate(data.getDate() + 1);
  }
  return domingos;
}

export default function Planejamento() {
  const [periodos, setPeriodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [innerTab, setInnerTab] = useState('repertorio'); // 'repertorio' | 'domingos'
  
  const [showModal, setShowModal] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState(null);
  const [novoNome, setNovoNome] = useState('');

  // Estados da tela de detalhes (com controle de alterações pendentes antes de Salvar)
  const [musicasPeriodo, setMusicasPeriodo] = useState([]);
  const [savedMusicasPeriodo, setSavedMusicasPeriodo] = useState([]);
  const [loadingMusicas, setLoadingMusicas] = useState(false);
  const [savingPeriodo, setSavingPeriodo] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Estados da aba "Montar Louvor: Domingo / Mês (WhatsApp)"
  const [cultos, setCultos] = useState([]);
  const [savedCultosStr, setSavedCultosStr] = useState('[]');
  const [savingCultos, setSavingCultos] = useState(false);
  const [novoCultoTitulo, setNovoCultoTitulo] = useState('');
  const [mesGerador, setMesGerador] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  });
  const [copiedId, setCopiedId] = useState(null);

  // Opções de formatação do texto para WhatsApp
  const [whatsOpts, setWhatsOpts] = useState({
    artista: true,
    tom: true,
    link: true,
    primeira_linha: false,
  });

  // Modal de Adicionar Música e Filtros Avançados
  const [showAddModal, setShowAddModal] = useState(false);
  const [todasMusicas, setTodasMusicas] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchMusica, setSearchMusica] = useState('');
  const [showFiltersPanel, setShowFiltersPanel] = useState(true);
  const [sortTempoMode, setSortTempoMode] = useState('mais_tempo');
  const [selectedCategorias, setSelectedCategorias] = useState([]);
  const [selectedTemas, setSelectedTemas] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagFilterInput, setTagFilterInput] = useState('');

  // Controle de colunas
  const colunasPossiveis = [
    { key: 'artista', label: 'Artista/Versão' },
    { key: 'categoria', label: 'Categorias' },
    { key: 'tema_central', label: 'Tema Central' },
    { key: 'codigo', label: 'Código' },
    { key: 'primeira_linha', label: 'Primeira Linha' },
    { key: 'tom', label: 'Tom' },
    { key: 'primeira_nota', label: '1ª Nota' },
    { key: 'versao_vocal', label: 'Versão P/ Vocal' },
    { key: 'compasso', label: 'Compasso' },
    { key: 'bpm', label: 'BPM ≈' },
    { key: 'link', label: 'Link' },
    { key: 'versao_parecida', label: 'Versão Parecida' },
  ];
  
  const [visibleCols, setVisibleCols] = useState(() => {
    const saved = localStorage.getItem('planejamento_visible_cols');
    if (saved) return JSON.parse(saved);
    return ['artista', 'categoria', 'primeira_linha', 'tom', 'bpm'];
  });

  const [showColSettings, setShowColSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem('planejamento_visible_cols', JSON.stringify(visibleCols));
  }, [visibleCols]);

  useEffect(() => {
    carregarPeriodos();
  }, []);

  const mostrarFeedback = (msg) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(''), 3500);
  };

  // Verifica se há alterações não salvas na lista de músicas do período
  const hasUnsavedMusicas = useMemo(() => {
    if (musicasPeriodo.length !== savedMusicasPeriodo.length) return true;
    const atuaisIds = musicasPeriodo.map(m => m.id).join(',');
    const salvasIds = savedMusicasPeriodo.map(m => m.id).join(',');
    return atuaisIds !== salvasIds;
  }, [musicasPeriodo, savedMusicasPeriodo]);

  // Verifica se há alterações não salvas nos domingos/cultos
  const hasUnsavedCultos = useMemo(() => {
    return JSON.stringify(cultos) !== savedCultosStr;
  }, [cultos, savedCultosStr]);

  const carregarPeriodos = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/planejamento/');
      if (res.ok) {
        const data = await res.json();
        setPeriodos(data.periodos || []);
      } else {
        setError('Erro ao carregar períodos.');
      }
    } catch (e) {
      setError('Erro de conexão.');
    }
    setLoading(false);
  };

  const abrirModalCriar = () => {
    setEditingPeriodId(null);
    setNovoNome('');
    setShowModal(true);
  };

  const abrirModalEditar = (periodo, e) => {
    e.stopPropagation();
    setEditingPeriodId(periodo.id);
    setNovoNome(periodo.nome);
    setShowModal(true);
  };

  const handleSalvarPeriodo = async (e) => {
    e.preventDefault();
    if (!novoNome.trim()) return;
    try {
      if (editingPeriodId) {
        const res = await apiFetch(`/planejamento/${editingPeriodId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: novoNome })
        });
        if (res.ok) {
          if (selectedPeriod?.id === editingPeriodId) {
            setSelectedPeriod({ ...selectedPeriod, nome: novoNome });
          }
          setNovoNome('');
          setEditingPeriodId(null);
          setShowModal(false);
          carregarPeriodos();
        }
      } else {
        const res = await apiFetch('/planejamento/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: novoNome })
        });
        if (res.ok) {
          setNovoNome('');
          setShowModal(false);
          carregarPeriodos();
        }
      }
    } catch (err) {
      alert('Erro ao salvar período.');
    }
  };

  const handleExcluirPeriodo = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Excluir este planejamento?')) return;
    try {
      const res = await apiFetch(`/planejamento/${id}`, { method: 'DELETE' });
      if (res.ok) {
        carregarPeriodos();
        if (selectedPeriod?.id === id) setSelectedPeriod(null);
      }
    } catch (err) {
      alert('Erro ao excluir.');
    }
  };

  const abrirPeriodo = (periodo) => {
    setSelectedPeriod(periodo);
    setInnerTab('repertorio');
    carregarMusicasDoPeriodo(periodo.id);
  };

  const voltarParaLista = () => {
    if (hasUnsavedMusicas || hasUnsavedCultos) {
      if (!window.confirm('Você tem alterações ainda não salvas neste planejamento. Deseja sair sem salvar?')) {
        return;
      }
    }
    setSelectedPeriod(null);
  };

  const carregarMusicasDoPeriodo = async (id) => {
    setLoadingMusicas(true);
    try {
      const res = await apiFetch(`/planejamento/${id}/musicas`);
      if (res.ok) {
        const data = await res.json();
        const lista = data.musicas || [];
        const cultosSalvos = data.programacao_cultos || [];
        setMusicasPeriodo(lista);
        setSavedMusicasPeriodo(lista);
        setCultos(cultosSalvos);
        setSavedCultosStr(JSON.stringify(cultosSalvos));
      }
    } catch (e) {
      alert('Erro ao carregar músicas do período.');
    }
    setLoadingMusicas(false);
  };

  const carregarBibliotecaUsuario = async () => {
    setSearching(true);
    try {
      const res2 = await apiFetch('/musicas/custom');
      if (res2.ok) {
        const dados = await res2.json();
        setTodasMusicas(dados.musicas || []);
      }
    } catch (e) {
      console.error(e);
    }
    setSearching(false);
  };

  useEffect(() => {
    if (showAddModal) {
      carregarBibliotecaUsuario();
    }
  }, [showAddModal]);

  const opcoesFiltros = useMemo(() => {
    const catsSet = new Set();
    const temasSet = new Set();
    const tagsSet = new Set();

    todasMusicas.forEach(m => {
      (m.categorias || []).forEach(c => {
        if (c && c.trim()) catsSet.add(c.trim());
      });
      if (m.tema_central && m.tema_central.trim()) {
        temasSet.add(m.tema_central.trim());
      }
      if (m.tags) {
        m.tags.split(',').forEach(t => {
          const clean = t.trim().toLowerCase();
          if (clean) tagsSet.add(clean);
        });
      }
    });

    return {
      categorias: Array.from(catsSet).sort((a, b) => a.localeCompare(b)),
      temas: Array.from(temasSet).sort((a, b) => a.localeCompare(b)),
      tags: Array.from(tagsSet).sort((a, b) => a.localeCompare(b)),
    };
  }, [todasMusicas]);

  const searchResults = useMemo(() => {
    const termo = searchMusica.trim().toLowerCase();

    let lista = todasMusicas.filter(m => {
      if (termo) {
        const matchNome = (m.nome_musica || '').toLowerCase().includes(termo);
        const matchArtista = (m.artista || '').toLowerCase().includes(termo);
        if (!matchNome && !matchArtista) return false;
      }

      if (selectedCategorias.length > 0) {
        const catsMusica = (m.categorias || []).map(c => c.trim().toLowerCase());
        const temCat = selectedCategorias.some(sel => catsMusica.includes(sel.toLowerCase()));
        if (!temCat) return false;
      }

      if (selectedTemas.length > 0) {
        const temaMusica = (m.tema_central || '').trim().toLowerCase();
        const temTema = selectedTemas.some(sel => sel.toLowerCase() === temaMusica);
        if (!temTema) return false;
      }

      if (selectedTags.length > 0) {
        const tagsMusica = (m.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        const temTag = selectedTags.some(sel => tagsMusica.includes(sel.toLowerCase()));
        if (!temTag) return false;
      }

      if (sortTempoMode === 'nunca_planejadas') {
        if (m.ultimo_planejamento_em || m.ultimo_periodo_nome) return false;
      }

      return true;
    });

    lista = [...lista].sort((a, b) => {
      if (sortTempoMode === 'mais_tempo') {
        const aNunca = !a.ultimo_planejamento_em && !a.ultimo_periodo_nome;
        const bNunca = !b.ultimo_planejamento_em && !b.ultimo_periodo_nome;
        if (aNunca && !bNunca) return -1;
        if (!aNunca && bNunca) return 1;
        if (!aNunca && !bNunca) {
          const dateA = a.ultimo_planejamento_em ? new Date(a.ultimo_planejamento_em).getTime() : 0;
          const dateB = b.ultimo_planejamento_em ? new Date(b.ultimo_planejamento_em).getTime() : 0;
          if (dateA !== dateB) return dateA - dateB;
        }
      } else if (sortTempoMode === 'recentes') {
        const aNunca = !a.ultimo_planejamento_em && !a.ultimo_periodo_nome;
        const bNunca = !b.ultimo_planejamento_em && !b.ultimo_periodo_nome;
        if (aNunca && !bNunca) return 1;
        if (!aNunca && bNunca) return -1;
        if (!aNunca && !bNunca) {
          const dateA = a.ultimo_planejamento_em ? new Date(a.ultimo_planejamento_em).getTime() : 0;
          const dateB = b.ultimo_planejamento_em ? new Date(b.ultimo_planejamento_em).getTime() : 0;
          if (dateA !== dateB) return dateB - dateA;
        }
      }
      return (a.nome_musica || '').localeCompare(b.nome_musica || '');
    });

    return lista;
  }, [todasMusicas, searchMusica, selectedCategorias, selectedTemas, selectedTags, sortTempoMode]);

  const toggleItemArray = (arr, setArr, val) => {
    if (arr.includes(val)) {
      setArr(arr.filter(i => i !== val));
    } else {
      setArr([...arr, val]);
    }
  };

  const limparFiltros = () => {
    setSelectedCategorias([]);
    setSelectedTemas([]);
    setSelectedTags([]);
    setTagFilterInput('');
    setSortTempoMode('mais_tempo');
  };

  const totalFiltrosAtivos = selectedCategorias.length + selectedTemas.length + selectedTags.length + (sortTempoMode === 'nunca_planejadas' ? 1 : 0);

  // Adiciona ou remove na lista local (em rascunho), exigindo clicar em "Salvar Planejamento" para efetivar no BD
  const handleToggleMusicaRascunho = (musicaObj) => {
    const jaExiste = musicasPeriodo.some(m => m.id === musicaObj.id);
    if (jaExiste) {
      setMusicasPeriodo(musicasPeriodo.filter(m => m.id !== musicaObj.id));
    } else {
      const novaEntrada = {
        ...musicaObj,
        categoria: (musicaObj.categorias || []).join(', '),
      };
      setMusicasPeriodo([...musicasPeriodo, novaEntrada]);
    }
  };

  const handleRemoverMusicaRascunho = (musicaId) => {
    setMusicasPeriodo(musicasPeriodo.filter(m => m.id !== musicaId));
  };

  const handleDescartarAlteracoesMusicas = () => {
    setMusicasPeriodo(savedMusicasPeriodo);
  };

  const handleEfetivarSalvarMusicas = async () => {
    setSavingPeriodo(true);
    try {
      const res = await apiFetch(`/planejamento/${selectedPeriod.id}/musicas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musica_ids: musicasPeriodo.map(m => m.id) })
      });
      if (res.ok) {
        await carregarMusicasDoPeriodo(selectedPeriod.id);
        mostrarFeedback('✅ Planejamento salvo com sucesso no banco de dados!');
      } else {
        alert('Erro ao salvar planejamento.');
      }
    } catch (e) {
      alert('Erro de conexão ao salvar.');
    }
    setSavingPeriodo(false);
  };

  // --- FUNÇÕES DE ESCALA DE DOMINGOS / MÊS (WHATSAPP) ---
  const handleAdicionarCulto = (e) => {
    e.preventDefault();
    const titulo = novoCultoTitulo.trim() || `Domingo ${cultos.length + 1}`;
    const novo = {
      id: `culto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      titulo,
      musica_ids: []
    };
    setCultos([...cultos, novo]);
    setNovoCultoTitulo('');
  };

  const handleGerarDomingosMes = () => {
    if (!mesGerador) return;
    const [anoStr, mesStr] = mesGerador.split('-');
    const domingosNomes = gerarDomingosDoMes(Number(anoStr), Number(mesStr));
    const existentesTitulos = new Set(cultos.map(c => c.titulo));
    const novos = domingosNomes
      .filter(t => !existentesTitulos.has(t))
      .map((t, i) => ({
        id: `culto-${Date.now()}-${i}`,
        titulo: t,
        musica_ids: []
      }));
    if (novos.length === 0) {
      alert('Todos os domingos deste mês já foram adicionados abaixo.');
      return;
    }
    setCultos([...cultos, ...novos]);
  };

  const handleRemoverCulto = (cultoId) => {
    setCultos(cultos.filter(c => c.id !== cultoId));
  };

  const handleRenomearCulto = (cultoId, novoTitulo) => {
    setCultos(cultos.map(c => c.id === cultoId ? { ...c, titulo: novoTitulo } : c));
  };

  const handleToggleMusicaNoCulto = (cultoId, musicaId) => {
    setCultos(cultos.map(c => {
      if (c.id !== cultoId) return c;
      const jaTem = (c.musica_ids || []).includes(musicaId);
      const novaLista = jaTem
        ? c.musica_ids.filter(id => id !== musicaId)
        : [...(c.musica_ids || []), musicaId];
      return { ...c, musica_ids: novaLista };
    }));
  };

  const handleSalvarCultosNoBanco = async () => {
    setSavingCultos(true);
    try {
      const res = await apiFetch(`/planejamento/${selectedPeriod.id}/cultos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cultos })
      });
      if (res.ok) {
        setSavedCultosStr(JSON.stringify(cultos));
        mostrarFeedback('✅ Escala de Domingos/Mês salva com sucesso!');
      } else {
        alert('Erro ao salvar escala de domingos.');
      }
    } catch (e) {
      alert('Erro de conexão.');
    }
    setSavingCultos(false);
  };

  // Conta quantas vezes cada música foi usada nos domingos planejados
  const contagemUsoNoMes = useMemo(() => {
    const mapa = {};
    cultos.forEach(c => {
      (c.musica_ids || []).forEach(id => {
        mapa[id] = (mapa[id] || 0) + 1;
      });
    });
    return mapa;
  }, [cultos]);

  // Formata um bloco de Culto/Domingo para texto do WhatsApp
  const formatarCultoWhatsApp = (culto) => {
    const musicasMap = new Map(musicasPeriodo.map(m => [m.id, m]));
    const musicasEscolhidas = (culto.musica_ids || []).map(id => musicasMap.get(id)).filter(Boolean);

    let linhas = [`📅 *${culto.titulo}*`];
    if (musicasEscolhidas.length === 0) {
      linhas.push(`_Nenhuma música selecionada_`);
      return linhas.join('\n');
    }

    musicasEscolhidas.forEach((m, idx) => {
      let linha = `${idx + 1}. *${m.nome_musica}*`;
      if (whatsOpts.artista && m.artista) linha += ` - ${m.artista}`;
      if (whatsOpts.tom && m.tom) linha += ` _(Tom: ${m.tom})_`;
      linhas.push(linha);
      if (whatsOpts.primeira_linha && m.primeira_linha) {
        linhas.push(`   💬 _"${m.primeira_linha}"_`);
      }
      if (whatsOpts.link && m.link) {
        linhas.push(`   🔗 ${m.link}`);
      }
    });

    return linhas.join('\n');
  };

  // Formata todos os domingos juntos para WhatsApp
  const textoCompletoWhatsApp = useMemo(() => {
    if (cultos.length === 0) return '';
    const cabecalho = `🎸 *PLANEJAMENTO DE LOUVOR — ${selectedPeriod?.nome || ''}*\n`;
    const blocos = cultos.map(c => formatarCultoWhatsApp(c));
    return `${cabecalho}\n${blocos.join('\n\n───────────────────\n\n')}`;
  }, [cultos, musicasPeriodo, whatsOpts, selectedPeriod]);

  const copiarTexto = (texto, idRef) => {
    navigator.clipboard.writeText(texto);
    setCopiedId(idRef);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const toggleCol = (key) => {
    if (visibleCols.includes(key)) {
      setVisibleCols(visibleCols.filter(c => c !== key));
    } else {
      setVisibleCols([...visibleCols, key]);
    }
  };

  if (selectedPeriod) {
    return (
      <div className="planejamento-container">
        <div className="planejamento-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <button className="back-btn" onClick={voltarParaLista}>
              <ArrowLeft size={18} /> Voltar
            </button>
            <h2 style={{ margin: 0 }}>🗓️ {selectedPeriod.nome}</h2>
          </div>
          
          {innerTab === 'repertorio' && (
            <div className="header-actions">
              <button className="secondary-btn" onClick={() => setShowColSettings(!showColSettings)}>
                {showColSettings ? <EyeOff size={16}/> : <Eye size={16}/>} Opções de Colunas
              </button>
              <button className="primary-btn" onClick={() => {setSearchMusica(''); setShowAddModal(true);}}>
                <Plus size={18} /> Adicionar Música
              </button>
              <button 
                className="save-periodo-btn" 
                onClick={handleEfetivarSalvarMusicas}
                disabled={savingPeriodo || !hasUnsavedMusicas}
                title={hasUnsavedMusicas ? "Clique para efetivar as alterações no banco de dados" : "Todas as alterações já estão salvas"}
              >
                <Save size={18} /> {savingPeriodo ? 'Salvando...' : hasUnsavedMusicas ? 'Salvar Planejamento *' : 'Salvo ✓'}
              </button>
            </div>
          )}
        </div>

        {/* Abas Internas: 1. Músicas do Planejamento | 2. Montar Louvor Domingo/Mês (WhatsApp) */}
        <div className="planejamento-subtabs">
          <button
            className={`subtab-btn ${innerTab === 'repertorio' ? 'active' : ''}`}
            onClick={() => setInnerTab('repertorio')}
          >
            🎵 Músicas deste Planejamento ({musicasPeriodo.length})
          </button>
          <button
            className={`subtab-btn ${innerTab === 'domingos' ? 'active' : ''}`}
            onClick={() => setInnerTab('domingos')}
          >
            📲 Escalar p/ Próximo Domingo ou Mês (WhatsApp) ({cultos.length})
          </button>
        </div>

        {feedbackMsg && (
          <div className="feedback-banner">
            {feedbackMsg}
          </div>
        )}

        {/* Barra de aviso quando há músicas adicionadas/removidas ainda não salvas */}
        {innerTab === 'repertorio' && hasUnsavedMusicas && (
          <div className="unsaved-bar">
            <div>
              <strong>⚠️ Alterações pendentes:</strong> Você adicionou ou removeu músicas na lista abaixo. Clique em <b>"Salvar Planejamento"</b> para efetivar no banco de dados!
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="cancel-btn" onClick={handleDescartarAlteracoesMusicas}>
                Descartar
              </button>
              <button type="button" className="save-periodo-btn" onClick={handleEfetivarSalvarMusicas} disabled={savingPeriodo}>
                <Save size={16} /> {savingPeriodo ? 'Salvando...' : 'Salvar Planejamento'}
              </button>
            </div>
          </div>
        )}

        {/* ABA 1: TABELA DE MÚSICAS DO PERÍODO */}
        {innerTab === 'repertorio' && (
          <>
            {showColSettings && (
              <div className="col-settings-panel glass-panel">
                <h4>⚙️ Escolha quais colunas deseja visualizar neste período:</h4>
                <div className="col-grid">
                  {colunasPossiveis.map(col => (
                    <label key={col.key} className="col-label">
                      <input 
                        type="checkbox" 
                        checked={visibleCols.includes(col.key)}
                        onChange={() => toggleCol(col.key)}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="input-area" style={{ padding: '20px' }}>
              <div className="table-responsive">
                {loadingMusicas ? <p style={{ padding: '20px' }}>Carregando repertório...</p> : (
                  <table className="repertorio-table">
                    <thead>
                      <tr>
                        <th>Música</th>
                        {colunasPossiveis.map(col => (
                          visibleCols.includes(col.key) && <th key={col.key}>{col.label}</th>
                        ))}
                        <th style={{ width: '80px', textAlign: 'center' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {musicasPeriodo.length === 0 ? (
                        <tr>
                          <td colSpan={visibleCols.length + 2} style={{ textAlign: 'center', padding: '32px 20px', color: '#9ab', fontStyle: 'italic' }}>
                            Nenhuma música adicionada a este planejamento ainda. Clique em "+ Adicionar Música" acima para escolher da sua biblioteca!
                          </td>
                        </tr>
                      ) : (
                        musicasPeriodo.map((m, idx) => {
                          const isNewlyStaged = !savedMusicasPeriodo.some(sm => sm.id === m.id);
                          return (
                            <tr key={`${m.id}-${idx}`} style={isNewlyStaged ? { backgroundColor: 'rgba(46, 204, 113, 0.08)' } : {}}>
                              <td style={{ fontWeight: 'bold', color: '#fff' }}>
                                {m.nome_musica}
                                {isNewlyStaged && (
                                  <span style={{ marginLeft: '8px', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(46, 204, 113, 0.2)', color: '#4ade80' }}>
                                    Nova (não salva)
                                  </span>
                                )}
                              </td>
                              {colunasPossiveis.map(col => {
                                if (!visibleCols.includes(col.key)) return null;
                                return (
                                  <td key={col.key}>
                                    {col.key === 'link' && m[col.key] ? (
                                      <a href={m[col.key]} target="_blank" rel="noreferrer" style={{ color: '#2ecc71', fontWeight: 'bold' }}>🔗 Abrir</a>
                                    ) : (m[col.key] || '-')}
                                  </td>
                                );
                              })}
                              <td style={{ textAlign: 'center' }}>
                                <button className="icon-btn delete-btn" onClick={() => handleRemoverMusicaRascunho(m.id)} title="Remover da lista">
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}

        {/* ABA 2: ESCALAR MÚSICAS PARA O PRÓXIMO DOMINGO OU MÊS INTEIRO + WHATSAPP */}
        {innerTab === 'domingos' && (
          <div className="domingos-wrapper">
            {musicasPeriodo.length === 0 ? (
              <div className="empty-state">
                <p>Adicione primeiro as músicas na aba <b>"🎵 Músicas deste Planejamento"</b> para poder escalá-las nos domingos ou no mês!</p>
              </div>
            ) : (
              <>
                {/* Barra de Criação de Domingo Avulso ou Mês Inteiro */}
                <div className="input-area domingos-controls">
                  <div className="domingos-controls-grid">
                    {/* Criar 1 Domingo / Culto */}
                    <form onSubmit={handleAdicionarCulto} className="domingo-box">
                      <label style={{ color: '#61dafb', fontWeight: 'bold' }}>➕ Planejar Próximo Domingo ou Culto Único:</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Ex: Próximo Domingo (25/10) ou Culto de Ceia"
                          value={novoCultoTitulo}
                          onChange={(e) => setNovoCultoTitulo(e.target.value)}
                        />
                        <button type="submit" className="primary-btn" style={{ whiteSpace: 'nowrap' }}>
                          <Plus size={16} /> Criar Dia
                        </button>
                      </div>
                    </form>

                    {/* Gerar Todos os Domingos do Mês */}
                    <div className="domingo-box">
                      <label style={{ color: '#f39c12', fontWeight: 'bold' }}>📅 Ou Gerar Todos os Domingos de um Mês Inteiro:</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="month"
                          value={mesGerador}
                          onChange={(e) => setMesGerador(e.target.value)}
                          style={{ background: 'rgba(0,0,0,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '10px 14px', flex: 1 }}
                        />
                        <button type="button" onClick={handleGerarDomingosMes} className="secondary-btn" style={{ whiteSpace: 'nowrap' }}>
                          <Calendar size={16} /> Gerar Domingos do Mês
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Opções de Formatação para WhatsApp + Botão Salvar Escala */}
                  <div className="whatsapp-options-bar">
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.88rem', color: '#cbd5e1', fontWeight: '600' }}>📲 Incluir ao copiar p/ WhatsApp:</span>
                      <label className="col-label">
                        <input type="checkbox" checked={whatsOpts.artista} onChange={() => setWhatsOpts({ ...whatsOpts, artista: !whatsOpts.artista })} />
                        Artista
                      </label>
                      <label className="col-label">
                        <input type="checkbox" checked={whatsOpts.tom} onChange={() => setWhatsOpts({ ...whatsOpts, tom: !whatsOpts.tom })} />
                        Tom
                      </label>
                      <label className="col-label">
                        <input type="checkbox" checked={whatsOpts.link} onChange={() => setWhatsOpts({ ...whatsOpts, link: !whatsOpts.link })} />
                        Link da Música
                      </label>
                      <label className="col-label">
                        <input type="checkbox" checked={whatsOpts.primeira_linha} onChange={() => setWhatsOpts({ ...whatsOpts, primeira_linha: !whatsOpts.primeira_linha })} />
                        Primeira Linha
                      </label>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {cultos.length > 0 && (
                        <button
                          type="button"
                          className="whatsapp-copy-btn"
                          onClick={() => copiarTexto(textoCompletoWhatsApp, 'all')}
                        >
                          {copiedId === 'all' ? <Check size={16} /> : <Copy size={16} />}
                          {copiedId === 'all' ? 'Copiado p/ WhatsApp!' : 'Copiar Todos os Domingos (WhatsApp)'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="save-periodo-btn"
                        onClick={handleSalvarCultosNoBanco}
                        disabled={savingCultos || !hasUnsavedCultos}
                      >
                        <Save size={16} /> {savingCultos ? 'Salvando...' : hasUnsavedCultos ? 'Salvar Escala de Domingos *' : 'Escala Salva ✓'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lista de Cartões de cada Domingo/Culto */}
                {cultos.length === 0 ? (
                  <div className="empty-state">
                    <p>Nenhum domingo ou culto adicionado ainda. Crie um <b>Próximo Domingo</b> ou clique em <b>"Gerar Domingos do Mês"</b> acima para escolher as músicas!</p>
                  </div>
                ) : (
                  <div className="cultos-grid">
                    {cultos.map((culto) => {
                      const textoDesteCulto = formatarCultoWhatsApp(culto);
                      return (
                        <div key={culto.id} className="culto-card">
                          <div className="culto-card-header">
                            <input
                              type="text"
                              value={culto.titulo}
                              onChange={(e) => handleRenomearCulto(culto.id, e.target.value)}
                              className="culto-title-input"
                            />
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                className="whatsapp-copy-btn sm"
                                onClick={() => copiarTexto(textoDesteCulto, culto.id)}
                                title="Copiar lista deste dia para o WhatsApp"
                              >
                                {copiedId === culto.id ? <Check size={14} /> : <Copy size={14} />}
                                {copiedId === culto.id ? 'Copiado!' : 'Copiar p/ Whats'}
                              </button>
                              <button
                                type="button"
                                className="icon-btn delete-btn"
                                onClick={() => handleRemoverCulto(culto.id)}
                                title="Excluir este dia"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                          <p style={{ fontSize: '0.82rem', color: '#9ab', margin: '8px 0' }}>
                            Marque abaixo as músicas deste planejamento que serão tocadas neste dia ({(culto.musica_ids || []).length} selecionadas):
                          </p>

                          <div className="culto-musicas-list">
                            {musicasPeriodo.map(m => {
                              const selecionada = (culto.musica_ids || []).includes(m.id);
                              const vezesNoMes = contagemUsoNoMes[m.id] || 0;
                              return (
                                <label
                                  key={m.id}
                                  className={`culto-musica-item ${selecionada ? 'selected' : ''}`}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                    <input
                                      type="checkbox"
                                      checked={selecionada}
                                      onChange={() => handleToggleMusicaNoCulto(culto.id, m.id)}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.92rem' }}>
                                        {m.nome_musica}
                                        {m.artista && <span style={{ color: '#f39c12', fontWeight: 'normal', fontSize: '0.82rem' }}> - {m.artista}</span>}
                                      </div>
                                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '3px' }}>
                                        {m.tom && <span className="badge-meta tema">Tom: {m.tom}</span>}
                                        {m.categoria && <span className="badge-meta cat">{m.categoria}</span>}
                                        {m.tema_central && <span className="badge-meta tema">🎯 {m.tema_central}</span>}
                                      </div>
                                    </div>
                                  </div>
                                  {vezesNoMes > 0 && (
                                    <span className="uso-mes-badge" title="Quantas vezes foi escalada neste planejamento">
                                      {vezesNoMes}x no período
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pré-visualização do texto completo do WhatsApp */}
                {cultos.length > 0 && (
                  <div className="input-area" style={{ marginTop: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                      <h4 style={{ margin: 0, color: '#2ecc71' }}>📲 Pré-visualização da Mensagem para o Grupo do WhatsApp:</h4>
                      <button
                        type="button"
                        className="whatsapp-copy-btn"
                        onClick={() => copiarTexto(textoCompletoWhatsApp, 'preview')}
                      >
                        {copiedId === 'preview' ? <Check size={16} /> : <Copy size={16} />}
                        {copiedId === 'preview' ? 'Copiado com Sucesso!' : 'Copiar Mensagem Completa'}
                      </button>
                    </div>
                    <pre style={{ margin: 0 }}>{textoCompletoWhatsApp}</pre>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {showAddModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '760px', width: '94%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #4a505c', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#61dafb' }}>➕ Selecionar Músicas da Biblioteca</h3>
                <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', color: '#9ab', fontSize: '1.5em', cursor: 'pointer' }}>&times;</button>
              </div>
              
              {/* Busca exclusiva por Nome da Música ou Artista */}
              <div className="search-box">
                <Search size={18} color="#9ab" />
                <input 
                  type="text" 
                  placeholder="Buscar por nome da música ou artista..." 
                  value={searchMusica}
                  onChange={(e) => setSearchMusica(e.target.value)}
                />
              </div>

              {/* Barra de Ordenação de Tempo + Toggle de Filtros */}
              <div className="filter-toolbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
                  <Clock size={16} color="#f39c12" />
                  <select 
                    value={sortTempoMode} 
                    onChange={(e) => setSortTempoMode(e.target.value)}
                    className="sort-select"
                  >
                    <option value="mais_tempo">⏳ Mais tempo sem planejar (Nunca planejadas 1º)</option>
                    <option value="nunca_planejadas">✨ Mostrar apenas músicas NUNCA planejadas</option>
                    <option value="alfabetica">🔤 Ordem Alfabética (A - Z)</option>
                    <option value="recentes">🕒 Planejadas mais recentemente</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {totalFiltrosAtivos > 0 && (
                    <button type="button" onClick={limparFiltros} className="clear-filters-btn">
                      Limpar ({totalFiltrosAtivos})
                    </button>
                  )}
                  <button 
                    type="button" 
                    onClick={() => setShowFiltersPanel(!showFiltersPanel)} 
                    className="toggle-filters-btn"
                  >
                    <Filter size={15} /> {showFiltersPanel ? 'Ocultar Filtros' : 'Filtros (Categorias / Temas / Tags)'}
                  </button>
                </div>
              </div>

              {/* Painel de Múltipla Seleção: Categorias, Temas Centrais e Tags */}
              {showFiltersPanel && (
                <div className="multi-filters-box">
                  <div className="filter-section">
                    <label className="filter-section-title">📁 Categorias (pode selecionar várias):</label>
                    {opcoesFiltros.categorias.length === 0 ? (
                      <span className="filter-empty-hint">Nenhuma categoria cadastrada</span>
                    ) : (
                      <div className="chips-container">
                        {opcoesFiltros.categorias.map(cat => {
                          const active = selectedCategorias.includes(cat);
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => toggleItemArray(selectedCategorias, setSelectedCategorias, cat)}
                              className={`filter-chip ${active ? 'active-cat' : ''}`}
                            >
                              {cat}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="filter-section">
                    <label className="filter-section-title">🎯 Temas Centrais (pode selecionar vários):</label>
                    {opcoesFiltros.temas.length === 0 ? (
                      <span className="filter-empty-hint">Nenhum tema central preenchido nas músicas ainda</span>
                    ) : (
                      <div className="chips-container">
                        {opcoesFiltros.temas.map(tema => {
                          const active = selectedTemas.includes(tema);
                          return (
                            <button
                              key={tema}
                              type="button"
                              onClick={() => toggleItemArray(selectedTemas, setSelectedTemas, tema)}
                              className={`filter-chip ${active ? 'active-tema' : ''}`}
                            >
                              {tema}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="filter-section" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <label className="filter-section-title" style={{ marginBottom: 0 }}>🏷️ Tags / Palavras-Chave (pode selecionar várias):</label>
                      {opcoesFiltros.tags.length > 8 && (
                        <input
                          type="text"
                          placeholder="Filtrar tags (ex: ceia, cruz)..."
                          value={tagFilterInput}
                          onChange={(e) => setTagFilterInput(e.target.value)}
                          className="tag-mini-search"
                        />
                      )}
                    </div>
                    {opcoesFiltros.tags.length === 0 ? (
                      <span className="filter-empty-hint">Nenhuma tag cadastrada</span>
                    ) : (
                      <div className="chips-container tags-scroll">
                        {opcoesFiltros.tags
                          .filter(t => !tagFilterInput.trim() || t.includes(tagFilterInput.trim().toLowerCase()) || selectedTags.includes(t))
                          .slice(0, 60)
                          .map(tag => {
                            const active = selectedTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => toggleItemArray(selectedTags, setSelectedTags, tag)}
                                className={`filter-chip ${active ? 'active-tag' : ''}`}
                              >
                                #{tag}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ fontSize: '0.82rem', color: '#9ab', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Mostrando <b>{searchResults.length}</b> de {todasMusicas.length} músicas</span>
                <span>Selecionadas neste período: <b>{musicasPeriodo.length}</b></span>
              </div>

              <div className="search-results">
                {searching && <p style={{ color: '#9ab', textAlign: 'center' }}>Buscando...</p>}
                {!searching && searchResults.length === 0 && (
                  <p style={{ color: '#9ab', textAlign: 'center', padding: '20px 0' }}>Nenhuma música encontrada com esses filtros.</p>
                )}
                {!searching && searchResults.map(res => {
                  const jaAdicionada = musicasPeriodo.some(mp => mp.id === res.id);
                  const tempoStr = formatarTempoSemPlanejar(res.ultimo_planejamento_em);
                  const nuncaPlanejada = !res.ultimo_planejamento_em && !res.ultimo_periodo_nome;

                  return (
                    <div key={res.id} className="search-item" style={jaAdicionada ? { borderLeftColor: '#2ecc71', background: 'rgba(46, 204, 113, 0.08)' } : {}}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ color: '#fff', fontSize: '1rem' }}>{res.nome_musica}</strong>
                          {res.artista && <span className="search-artista"> - {res.artista}</span>}
                        </div>

                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px', alignItems: 'center' }}>
                          {nuncaPlanejada ? (
                            <span className="badge-tempo nunca">✨ Nunca planejada</span>
                          ) : (
                            <span className="badge-tempo planejada" title={res.ultimo_periodo_nome ? `Último período: ${res.ultimo_periodo_nome}` : ''}>
                              ⏳ Última vez: {tempoStr || 'anteriormente'} {res.ultimo_periodo_nome ? `(${res.ultimo_periodo_nome})` : ''}
                            </span>
                          )}

                          {res.tema_central && (
                            <span className="badge-meta tema">🎯 {res.tema_central}</span>
                          )}

                          {(res.categorias || []).map((c, idx) => (
                            <span key={idx} className="badge-meta cat">📁 {c}</span>
                          ))}
                        </div>
                      </div>

                      <button 
                        className="primary-btn add-btn-sm" 
                        onClick={() => handleToggleMusicaRascunho(res)}
                        style={jaAdicionada ? { background: 'rgba(46, 204, 113, 0.2)', border: '1px solid #2ecc71', boxShadow: 'none', color: '#4ade80' } : {}}
                      >
                        {jaAdicionada ? '✓ Selecionada (Remover)' : '+ Selecionar'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="modal-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#9ab' }}>
                  💡 Após concluir a seleção, clique em <b>"Salvar Planejamento"</b> na tela principal para gravar no banco.
                </span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="primary-btn" onClick={() => setShowAddModal(false)}>
                    Concluir Seleção
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="planejamento-container">
      <div className="planejamento-header">
        <h2>🗓️ Planejador de Repertório</h2>
        <button className="primary-btn" onClick={abrirModalCriar}>
          <Plus size={18} /> Novo Planejamento
        </button>
      </div>

      {loading ? <p>Carregando...</p> : error ? <p className="error">{error}</p> : (
        periodos.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum período criado ainda. Comece criando um Planejamento Semestral, Mensal ou Personalizado!</p>
          </div>
        ) : (
          <div className="periodos-grid">
            {periodos.map(p => (
              <div key={p.id} className="periodo-card" onClick={() => abrirPeriodo(p)}>
                <h3>📅 {p.nome}</h3>
                <div className="card-actions">
                  <button className="icon-btn edit-btn" onClick={(e) => abrirModalEditar(p, e)} title="Renomear período">
                    <Edit2 size={16} />
                  </button>
                  <button className="icon-btn delete-btn" onClick={(e) => handleExcluirPeriodo(p.id, e)} title="Excluir período">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #4a505c', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: editingPeriodId ? '#f39c12' : '#61dafb' }}>
                {editingPeriodId ? '✏️ Renomear Planejamento' : '➕ Criar Planejamento'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: '#9ab', fontSize: '1.5em', cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handleSalvarPeriodo}>
              <div className="form-group">
                <label>Nome do Período</label>
                <input 
                  type="text" 
                  placeholder="Ex: 2º Semestre 2026" 
                  value={novoNome} 
                  onChange={(e) => setNovoNome(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="primary-btn">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
