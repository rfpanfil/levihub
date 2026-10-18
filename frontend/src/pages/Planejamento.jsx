import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../services/api';
import { Plus, Trash2, Edit2, ArrowLeft, Search, Eye, EyeOff, Filter, Clock } from 'lucide-react';
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

export default function Planejamento() {
  const [periodos, setPeriodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  
  const [showModal, setShowModal] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState(null);
  const [novoNome, setNovoNome] = useState('');

  // Estados da tela de detalhes
  const [musicasPeriodo, setMusicasPeriodo] = useState([]);
  const [loadingMusicas, setLoadingMusicas] = useState(false);
  
  // Modal de Adicionar Música e Filtros Avançados
  const [showAddModal, setShowAddModal] = useState(false);
  const [todasMusicas, setTodasMusicas] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchMusica, setSearchMusica] = useState('');
  const [showFiltersPanel, setShowFiltersPanel] = useState(true);
  const [sortTempoMode, setSortTempoMode] = useState('mais_tempo'); // 'alfabetica' | 'mais_tempo' | 'nunca_planejadas' | 'recentes'
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
    return ['artista', 'categoria', 'primeira_linha', 'tom', 'bpm']; // Padrão
  });

  const [showColSettings, setShowColSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem('planejamento_visible_cols', JSON.stringify(visibleCols));
  }, [visibleCols]);

  useEffect(() => {
    carregarPeriodos();
  }, []);

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
    carregarMusicasDoPeriodo(periodo.id);
  };

  const carregarMusicasDoPeriodo = async (id) => {
    setLoadingMusicas(true);
    try {
      const res = await apiFetch(`/planejamento/${id}/musicas`);
      if (res.ok) {
        const data = await res.json();
        setMusicasPeriodo(data.musicas || []);
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

  // Carrega toda a biblioteca ao abrir o modal
  useEffect(() => {
    if (showAddModal) {
      carregarBibliotecaUsuario();
    }
  }, [showAddModal]);

  // Extrai todas as opções únicas de Categorias, Temas Centrais e Tags da biblioteca do usuário
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

  // Aplica busca por Nome/Artista + Múltiplos Filtros (Categorias, Temas Centrais, Tags) + Ordenação de Tempo
  const searchResults = useMemo(() => {
    const termo = searchMusica.trim().toLowerCase();

    let lista = todasMusicas.filter(m => {
      // 1. Busca exclusivamente por Nome da Música ou Artista
      if (termo) {
        const matchNome = (m.nome_musica || '').toLowerCase().includes(termo);
        const matchArtista = (m.artista || '').toLowerCase().includes(termo);
        if (!matchNome && !matchArtista) return false;
      }

      // 2. Filtro de Categorias (múltipla seleção: se alguma selecionada estiver nas categorias da música)
      if (selectedCategorias.length > 0) {
        const catsMusica = (m.categorias || []).map(c => c.trim().toLowerCase());
        const temCat = selectedCategorias.some(sel => catsMusica.includes(sel.toLowerCase()));
        if (!temCat) return false;
      }

      // 3. Filtro de Temas Centrais (múltipla seleção)
      if (selectedTemas.length > 0) {
        const temaMusica = (m.tema_central || '').trim().toLowerCase();
        const temTema = selectedTemas.some(sel => sel.toLowerCase() === temaMusica);
        if (!temTema) return false;
      }

      // 4. Filtro de Tags (múltipla seleção)
      if (selectedTags.length > 0) {
        const tagsMusica = (m.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        const temTag = selectedTags.some(sel => tagsMusica.includes(sel.toLowerCase()));
        if (!temTag) return false;
      }

      // 5. Filtro exclusivo de "Nunca planejadas"
      if (sortTempoMode === 'nunca_planejadas') {
        if (m.ultimo_planejamento_em || m.ultimo_periodo_nome) return false;
      }

      return true;
    });

    // Ordenação
    lista = [...lista].sort((a, b) => {
      if (sortTempoMode === 'mais_tempo') {
        const aNunca = !a.ultimo_planejamento_em && !a.ultimo_periodo_nome;
        const bNunca = !b.ultimo_planejamento_em && !b.ultimo_periodo_nome;
        if (aNunca && !bNunca) return -1;
        if (!aNunca && bNunca) return 1;
        if (!aNunca && !bNunca) {
          const dateA = a.ultimo_planejamento_em ? new Date(a.ultimo_planejamento_em).getTime() : 0;
          const dateB = b.ultimo_planejamento_em ? new Date(b.ultimo_planejamento_em).getTime() : 0;
          if (dateA !== dateB) return dateA - dateB; // Mais antigas primeiro
        }
      } else if (sortTempoMode === 'recentes') {
        const aNunca = !a.ultimo_planejamento_em && !a.ultimo_periodo_nome;
        const bNunca = !b.ultimo_planejamento_em && !b.ultimo_periodo_nome;
        if (aNunca && !bNunca) return 1;
        if (!aNunca && bNunca) return -1;
        if (!aNunca && !bNunca) {
          const dateA = a.ultimo_planejamento_em ? new Date(a.ultimo_planejamento_em).getTime() : 0;
          const dateB = b.ultimo_planejamento_em ? new Date(b.ultimo_planejamento_em).getTime() : 0;
          if (dateA !== dateB) return dateB - dateA; // Mais recentes primeiro
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

  const handleAdicionarMusica = async (musicaId) => {
    try {
      const res = await apiFetch(`/planejamento/${selectedPeriod.id}/musicas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musica_id: musicaId, ordem: musicasPeriodo.length })
      });
      if (res.ok) {
        carregarMusicasDoPeriodo(selectedPeriod.id);
        carregarBibliotecaUsuario();
      } else {
        const d = await res.json();
        alert(d.error || 'Erro ao adicionar.');
      }
    } catch (e) {
      alert('Erro de conexão.');
    }
  };

  const handleRemoverMusica = async (musicaId) => {
    try {
      const res = await apiFetch(`/planejamento/${selectedPeriod.id}/musicas/${musicaId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        carregarMusicasDoPeriodo(selectedPeriod.id);
      }
    } catch (e) {
      alert('Erro ao remover.');
    }
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
            <button className="back-btn" onClick={() => setSelectedPeriod(null)}>
              <ArrowLeft size={18} /> Voltar
            </button>
            <h2 style={{ margin: 0 }}>🗓️ {selectedPeriod.nome}</h2>
          </div>
          
          <div className="header-actions">
            <button className="secondary-btn" onClick={() => setShowColSettings(!showColSettings)}>
              {showColSettings ? <EyeOff size={16}/> : <Eye size={16}/>} Opções de Colunas
            </button>
            <button className="primary-btn" onClick={() => {setSearchMusica(''); setShowAddModal(true);}}>
              <Plus size={18} /> Adicionar Música
            </button>
          </div>
        </div>

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
                    musicasPeriodo.map((m, idx) => (
                      <tr key={`${m.id}-${idx}`}>
                        <td style={{ fontWeight: 'bold', color: '#fff' }}>{m.nome_musica}</td>
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
                          <button className="icon-btn delete-btn" onClick={() => handleRemoverMusica(m.id)} title="Remover do período">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {showAddModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '760px', width: '94%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #4a505c', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#61dafb' }}>➕ Adicionar Música da Biblioteca</h3>
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
                  {/* Categorias */}
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

                  {/* Temas Centrais */}
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

                  {/* Tags / Palavras-Chave */}
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
                    <div key={res.id} className="search-item">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ color: '#fff', fontSize: '1rem' }}>{res.nome_musica}</strong>
                          {res.artista && <span className="search-artista"> - {res.artista}</span>}
                        </div>

                        {/* Selos informativos: Tempo sem planejar + Categorias + Tema Central */}
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
                        onClick={() => handleAdicionarMusica(res.id)}
                        disabled={jaAdicionada}
                        style={jaAdicionada ? { background: '#3c414d', boxShadow: 'none', color: '#9ab', cursor: 'default' } : {}}
                      >
                        {jaAdicionada ? 'Já adicionada' : '+ Adicionar'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="modal-actions">
                <button className="cancel-btn" onClick={() => setShowAddModal(false)}>Fechar</button>
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
