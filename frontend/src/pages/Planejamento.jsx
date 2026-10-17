import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { Plus, Trash2, ArrowLeft, Search, Eye, EyeOff } from 'lucide-react';
import './Planejamento.css';

export default function Planejamento() {
  const [periodos, setPeriodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  
  const [showModal, setShowModal] = useState(false);
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

  const handleCriarPeriodo = async (e) => {
    e.preventDefault();
    if (!novoNome.trim()) return;
    try {
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
    } catch (err) {
      alert('Erro ao criar período.');
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
      <div className="planejamento-container glass-panel">
        <div className="planejamento-header">
          <button className="back-btn" onClick={() => setSelectedPeriod(null)}>
            <ArrowLeft size={20} /> Voltar
          </button>
          <h2>{selectedPeriod.nome}</h2>
          
          <div className="header-actions">
            <button className="secondary-btn" onClick={() => setShowColSettings(!showColSettings)}>
              {showColSettings ? <EyeOff size={16}/> : <Eye size={16}/>} Colunas
            </button>
            <button className="primary-btn" onClick={() => {setSearchMusica(''); setShowAddModal(true);}}>
              <Plus size={16} /> Adicionar Música
            </button>
          </div>
        </div>

        {showColSettings && (
          <div className="col-settings-panel glass-panel">
            <h4>Visibilidade de Colunas</h4>
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

        <div className="table-responsive">
          {loadingMusicas ? <p>Carregando repertório...</p> : (
            <table className="repertorio-table">
              <thead>
                <tr>
                  <th>Música</th>
                  {colunasPossiveis.map(col => (
                    visibleCols.includes(col.key) && <th key={col.key}>{col.label}</th>
                  ))}
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {musicasPeriodo.length === 0 ? (
                  <tr>
                    <td colSpan={visibleCols.length + 2} style={{textAlign:'center', padding: '20px'}}>
                      Nenhuma música neste planejamento.
                    </td>
                  </tr>
                ) : (
                  musicasPeriodo.map((m, idx) => (
                    <tr key={`${m.id}-${idx}`}>
                      <td style={{fontWeight: 'bold'}}>{m.nome_musica}</td>
                      {colunasPossiveis.map(col => {
                        if (!visibleCols.includes(col.key)) return null;
                        return (
                          <td key={col.key}>
                            {col.key === 'link' && m[col.key] ? (
                              <a href={m[col.key]} target="_blank" rel="noreferrer">Ver Link</a>
                            ) : m[col.key]}
                          </td>
                        );
                      })}
                      <td>
                        <button className="icon-btn delete-btn" onClick={() => handleRemoverMusica(m.id)}>
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

        {showAddModal && (
          <div className="modal-overlay">
            <div className="modal-content glass-panel">
              <h3>Adicionar Música da Biblioteca</h3>
              
              <div className="search-box">
                <Search size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar por nome ou artista..." 
                  value={searchMusica}
                  onChange={(e) => setSearchMusica(e.target.value)}
                />
              </div>

              <div className="search-results">
                {searching && <p>Buscando...</p>}
                {!searching && searchResults.length === 0 && <p>Nenhuma música encontrada.</p>}
                {!searching && searchResults.map(res => (
                  <div key={res.id} className="search-item">
                    <div>
                      <strong>{res.nome_musica}</strong>
                      {res.artista && <span className="search-artista"> - {res.artista}</span>}
                    </div>
                    <button className="primary-btn add-btn-sm" onClick={() => handleAdicionarMusica(res.id)}>
                      Adicionar
                    </button>
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                <button className="secondary-btn" onClick={() => setShowAddModal(false)}>Fechar</button>
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
        <button className="primary-btn" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Novo Planejamento
        </button>
      </div>

      {loading ? <p>Carregando...</p> : error ? <p className="error">{error}</p> : (
        <div className="periodos-grid">
          {periodos.length === 0 ? (
            <div className="glass-panel empty-state">
              <p>Nenhum período criado ainda. Comece criando um Planejamento Semestral, Mensal ou Personalizado!</p>
            </div>
          ) : (
            periodos.map(p => (
              <div key={p.id} className="periodo-card glass-panel" onClick={() => abrirPeriodo(p)}>
                <h3>{p.nome}</h3>
                <div className="card-actions">
                  <button className="icon-btn delete-btn" onClick={(e) => handleExcluirPeriodo(p.id, e)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <h3>Criar Planejamento</h3>
            <form onSubmit={handleCriarPeriodo}>
              <div className="form-group">
                <label>Nome do Período</label>
                <input 
                  type="text" 
                  placeholder="Ex: 2º Semestre 2026" 
                  value={novoNome} 
                  onChange={(e) => setNovoNome(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="primary-btn">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
