import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { Plus, Trash2, Edit2, ArrowLeft, Search, Eye, EyeOff } from 'lucide-react';
import './Planejamento.css';

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
  
  // Modal de Adicionar Música
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchMusica, setSearchMusica] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

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

  const handleBuscarMusica = async () => {
    setSearching(true);
    try {
      const res2 = await apiFetch('/musicas/custom');
      if (res2.ok) {
        const dados = await res2.json();
        let filtradas = dados.musicas.filter(m => 
          m.nome_musica.toLowerCase().includes(searchMusica.toLowerCase()) || 
          (m.artista && m.artista.toLowerCase().includes(searchMusica.toLowerCase()))
        );
        setSearchResults(filtradas);
      }
    } catch (e) {
      console.error(e);
    }
    setSearching(false);
  };

  // Carregar toda a biblioteca ao abrir modal pra facilitar
  useEffect(() => {
    if (showAddModal) {
      handleBuscarMusica();
    }
  }, [showAddModal, searchMusica]);

  const handleAdicionarMusica = async (musicaId) => {
    try {
      const res = await apiFetch(`/planejamento/${selectedPeriod.id}/musicas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musica_id: musicaId, ordem: musicasPeriodo.length })
      });
      if (res.ok) {
        carregarMusicasDoPeriodo(selectedPeriod.id);
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
            <div className="modal-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #4a505c', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#61dafb' }}>➕ Adicionar Música da Biblioteca</h3>
                <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', color: '#9ab', fontSize: '1.5em', cursor: 'pointer' }}>&times;</button>
              </div>
              
              <div className="search-box">
                <Search size={18} color="#9ab" />
                <input 
                  type="text" 
                  placeholder="Buscar por nome da música ou artista..." 
                  value={searchMusica}
                  onChange={(e) => setSearchMusica(e.target.value)}
                />
              </div>

              <div className="search-results">
                {searching && <p style={{ color: '#9ab', textAlign: 'center' }}>Buscando...</p>}
                {!searching && searchResults.length === 0 && (
                  <p style={{ color: '#9ab', textAlign: 'center', padding: '20px 0' }}>Nenhuma música encontrada na sua biblioteca.</p>
                )}
                {!searching && searchResults.map(res => {
                  const jaAdicionada = musicasPeriodo.some(mp => mp.id === res.id);
                  return (
                    <div key={res.id} className="search-item">
                      <div>
                        <strong style={{ color: '#fff' }}>{res.nome_musica}</strong>
                        {res.artista && <span className="search-artista"> - {res.artista}</span>}
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
