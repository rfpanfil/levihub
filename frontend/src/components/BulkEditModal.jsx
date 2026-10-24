import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Clock, Filter, Download, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../services/api';
import '../pages/Planejamento.css';

const BULK_EDIT_FIELDS = [
  { key: 'tema_central', label: '🎯 Tema Central', desc: 'TEMA CENTRAL ATUAL ➔ TEMA CENTRAL NOVO' },
  { key: 'categorias', label: '📁 Categorias', desc: 'CATEGORIAS ATUAL ➔ CATEGORIAS NOVO' },
  { key: 'tags', label: '🏷️ Tags / Palavras-Chave', desc: 'TAGS ATUAL ➔ TAGS NOVO' },
  { key: 'tom', label: '🎵 Tom', desc: 'TOM ATUAL ➔ TOM NOVO' },
  { key: 'primeira_nota', label: '🎹 1ª Nota', desc: '1ª NOTA ATUAL ➔ 1ª NOTA NOVO' },
  { key: 'primeira_linha', label: '💬 Primeira Linha', desc: 'PRIMEIRA LINHA ATUAL ➔ PRIMEIRA LINHA NOVO' },
  { key: 'nome_musica', label: '🎼 Nome da Música', desc: 'NOME DA MÚSICA ATUAL ➔ NOME DA MÚSICA NOVO' },
  { key: 'artista', label: '🎤 Artista / Banda', desc: 'ARTISTA ATUAL ➔ ARTISTA NOVO' },
  { key: 'link', label: '🔗 Link YouTube', desc: 'LINK YOUTUBE ATUAL ➔ LINK YOUTUBE NOVO' },
  { key: 'codigo', label: '🔢 Código Interno', desc: 'CÓDIGO ATUAL ➔ CÓDIGO NOVO' },
  { key: 'versao_vocal', label: '🎙️ Versão p/ Vocal', desc: 'VERSÃO P/ VOCAL ATUAL ➔ VERSÃO P/ VOCAL NOVO' },
  { key: 'compasso', label: '⏱️ Compasso', desc: 'COMPASSO ATUAL ➔ COMPASSO NOVO' },
  { key: 'bpm', label: '🥁 BPM ≈', desc: 'BPM ATUAL ➔ BPM NOVO' },
  { key: 'versao_parecida', label: '🔁 Versão Parecida', desc: 'VERSÃO PARECIDA ATUAL ➔ VERSÃO PARECIDA NOVO' },
  { key: 'cifra', label: '📄 Cifra', desc: 'CIFRA ATUAL ➔ CIFRA NOVO' },
];

function formatarTempoSemPlanejar(isoStr) {
  if (!isoStr) return null;
  const data = new Date(isoStr);
  if (isNaN(data.getTime())) return null;

  const agora = new Date();
  const diffMs = agora - data;
  const diffDias = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffDias === 0) return 'Hoje';
  if (diffDias === 1) return 'Há 1 dia';
  if (diffDias < 30) return `Há ${diffDias} dias`;

  const meses = Math.floor(diffDias / 30);
  if (meses < 12) {
    return meses === 1 ? 'Há 1 mês' : `Há ${meses} meses`;
  }

  const anos = Math.floor(meses / 12);
  const mesesResto = meses % 12;
  if (mesesResto === 0) {
    return anos === 1 ? 'Há 1 ano' : `Há ${anos} anos`;
  }
  return `Há ${anos}a e ${mesesResto}m`;
}

const BulkEditModal = ({ isOpen, onClose, musicas = [], onSuccess, escopo = 'pessoal' }) => {
  const [activeTab, setActiveTab] = useState('export'); // 'export' | 'import'

  // Seleção de campos para editar em massa (Tema Central marcado por padrão)
  const [selectedFields, setSelectedFields] = useState(['tema_central']);

  // Filtros idênticos ao Planejamento
  const [searchMusica, setSearchMusica] = useState('');
  const [sortTempoMode, setSortTempoMode] = useState('alfabetica');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [selectedCategorias, setSelectedCategorias] = useState([]);
  const [selectedTemas, setSelectedTemas] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagFilterInput, setTagFilterInput] = useState('');

  // IDs das músicas selecionadas para irem na planilha
  const [selectedMusicaIds, setSelectedMusicaIds] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  // Etapa 2: Upload, Preview de diferenças e Commit
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [previewReport, setPreviewReport] = useState(null); // { items, total_linhas_analisadas, campos_detectados }
  const [approvedIndexes, setApprovedIndexes] = useState([]);
  const [exportDoneNotice, setExportDoneNotice] = useState(false);
  const fileInputRef = useRef(null);

  // Quando abrir o modal, seleciona todas as músicas do banco por padrão
  useEffect(() => {
    if (isOpen && musicas.length > 0) {
      setSelectedMusicaIds(musicas.map(m => m.id));
    }
  }, [isOpen, musicas]);

  const opcoesFiltros = useMemo(() => {
    const catsSet = new Set();
    const temasSet = new Set();
    const tagsSet = new Set();

    musicas.forEach(m => {
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
  }, [musicas]);

  const searchResults = useMemo(() => {
    const termo = searchMusica.trim().toLowerCase();

    let lista = musicas.filter(m => {
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
  }, [musicas, searchMusica, selectedCategorias, selectedTemas, selectedTags, sortTempoMode]);

  if (!isOpen) return null;

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
    setSortTempoMode('alfabetica');
  };

  const totalFiltrosAtivos =
    selectedCategorias.length +
    selectedTemas.length +
    selectedTags.length +
    (sortTempoMode === 'nunca_planejadas' ? 1 : 0);

  const toggleField = (fieldKey) => {
    if (selectedFields.includes(fieldKey)) {
      setSelectedFields(selectedFields.filter(f => f !== fieldKey));
    } else {
      setSelectedFields([...selectedFields, fieldKey]);
    }
  };

  const toggleMusicaId = (id) => {
    if (selectedMusicaIds.includes(id)) {
      setSelectedMusicaIds(selectedMusicaIds.filter(item => item !== id));
    } else {
      setSelectedMusicaIds([...selectedMusicaIds, id]);
    }
  };

  const handleSelecionarApenasFiltradas = () => {
    setSelectedMusicaIds(searchResults.map(m => m.id));
  };

  const handleSelecionarTodasBanco = () => {
    setSelectedMusicaIds(musicas.map(m => m.id));
  };

  const handleDesmarcarTodas = () => {
    setSelectedMusicaIds([]);
  };

  const handleDownloadBulkExcel = async () => {
    if (selectedFields.length === 0) {
      alert('Selecione pelo menos 1 campo/opção para editar em massa (ex: Tema Central).');
      return;
    }
    if (selectedMusicaIds.length === 0) {
      alert('Selecione pelo menos 1 música para gerar a planilha.');
      return;
    }

    // Ordena os IDs selecionados conforme a ordem atual da lista filtrada (e demais músicas do banco depois)
    const filteredOrderIds = searchResults.filter(m => selectedMusicaIds.includes(m.id)).map(m => m.id);
    const remainingIds = selectedMusicaIds.filter(id => !filteredOrderIds.includes(id));
    const orderedIds = [...filteredOrderIds, ...remainingIds];

    setIsExporting(true);
    try {
      const res = await apiFetch(`/excel/bulk-export?escopo=${encodeURIComponent(escopo)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          musica_ids: orderedIds,
          campos: selectedFields,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Erro ao gerar planilha para edição em massa.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = escopo === 'global' ? 'Edicao_Em_Massa_Global_LeviHub.xlsx' : 'Edicao_Em_Massa_LeviHub.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setExportDoneNotice(true);
      setActiveTab('import');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const validateAndSetFile = (selected) => {
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith('.xlsx') && !selected.name.toLowerCase().endsWith('.xls')) {
      alert('Formato inválido! Envie apenas arquivos Excel (.xlsx ou .xls).');
      return;
    }
    setFile(selected);
    setPreviewReport(null);
  };

  const handleAnalyzeExcel = async () => {
    if (!file) {
      alert('Selecione ou arraste a planilha editada primeiro.');
      return;
    }

    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch(`/excel/bulk-preview?escopo=${encodeURIComponent(escopo)}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Erro ao analisar planilha de edição em massa.');
      }

      const data = await res.json();
      setPreviewReport(data);
      setApprovedIndexes((data.items || []).map((_, idx) => idx));
    } catch (err) {
      alert(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleApproveIndex = (idx) => {
    if (approvedIndexes.includes(idx)) {
      setApprovedIndexes(approvedIndexes.filter(i => i !== idx));
    } else {
      setApprovedIndexes([...approvedIndexes, idx]);
    }
  };

  const handleCommitBulkChanges = async () => {
    if (!previewReport || approvedIndexes.length === 0) {
      alert('Marque pelo menos uma música com alteração para aprovar.');
      return;
    }

    const itemsToCommit = approvedIndexes.map(idx => previewReport.items[idx]);
    setIsCommitting(true);

    try {
      const res = await apiFetch(`/excel/bulk-commit?escopo=${encodeURIComponent(escopo)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToCommit }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Erro ao aplicar alterações em massa.');
      }

      const result = await res.json();
      alert(result.message);

      setFile(null);
      setPreviewReport(null);
      setExportDoneNotice(false);
      setActiveTab('export');
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleCloseModal = () => {
    setExportDoneNotice(false);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 1050,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.78)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '12px',
      }}
    >
      <div
        className="modal-content add-musica-modal"
        style={{
          backgroundColor: '#1e222d',
          padding: '20px',
          borderRadius: '12px',
          width: '96%',
          maxWidth: '940px',
          maxHeight: '94vh',
          overflowY: 'auto',
          border: '1px solid #353b48',
        }}
      >
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h2 style={{ margin: 0, color: '#61dafb', fontSize: '1.3rem' }}>📝 Editar Repertório em Massa (via Excel)</h2>
            <small style={{ color: '#9ab' }}>
              Escolha as músicas e os campos que deseja atualizar, baixe a planilha protegida (<b>ATUAL</b> bloqueado / <b>NOVO</b> liberado) e aprove cada mudança antes de salvar.
            </small>
          </div>
          <button
            onClick={handleCloseModal}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.6rem', cursor: 'pointer', lineHeight: 1 }}
          >
            &times;
          </button>
        </div>

        {/* Abas de Navegação: Etapa 1 (Gerar Planilha) e Etapa 2 (Enviar e Aprovar) */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #2f3640', paddingBottom: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            style={{
              flex: 1,
              minWidth: '240px',
              padding: '10px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              border: activeTab === 'export' ? '1px solid #61dafb' : '1px solid #353b48',
              backgroundColor: activeTab === 'export' ? 'rgba(97, 218, 251, 0.16)' : '#151821',
              color: activeTab === 'export' ? '#61dafb' : '#9ab',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <Download size={16} /> 1️⃣ Filtrar Músicas, Escolher Campos e Baixar Excel
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            style={{
              flex: 1,
              minWidth: '240px',
              padding: '10px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              border: activeTab === 'import' ? '1px solid #2ecc71' : '1px solid #353b48',
              backgroundColor: activeTab === 'import' ? 'rgba(46, 204, 113, 0.16)' : '#151821',
              color: activeTab === 'import' ? '#2ecc71' : '#9ab',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <Upload size={16} /> 2️⃣ Enviar Excel Editado e Aprovar Mudanças
          </button>
        </div>

        {/* ===================================================================== */}
        {/* ABA 1: SELECIONAR CAMPOS + FILTRAR MÚSICAS + BAIXAR PLANILHA          */}
        {/* ===================================================================== */}
        {activeTab === 'export' && (
          <div>
            {/* 1. Escolha de quais opções/campos serão editados */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#151821',
                border: '1px solid #2f3640',
                borderRadius: '10px',
                marginBottom: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <label style={{ color: '#f39c12', fontWeight: 'bold', fontSize: '0.92rem' }}>
                  🛠️ 1. Escolha quais opções deseja editar no banco ({selectedFields.length} selecionada{selectedFields.length !== 1 ? 's' : ''}):
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedFields(['tema_central'])}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.76rem',
                      borderRadius: '6px',
                      border: '1px solid #f39c12',
                      backgroundColor: 'rgba(243, 156, 18, 0.12)',
                      color: '#f39c12',
                      cursor: 'pointer',
                    }}
                  >
                    Apenas Tema Central
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFields(BULK_EDIT_FIELDS.map(f => f.key))}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.76rem',
                      borderRadius: '6px',
                      border: '1px solid #61dafb',
                      backgroundColor: 'rgba(97, 218, 251, 0.12)',
                      color: '#61dafb',
                      cursor: 'pointer',
                    }}
                  >
                    Marcar Todas Opções
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFields([])}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.76rem',
                      borderRadius: '6px',
                      border: '1px solid #4a505c',
                      backgroundColor: 'transparent',
                      color: '#9ab',
                      cursor: 'pointer',
                    }}
                  >
                    Limpar
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {BULK_EDIT_FIELDS.map(field => {
                  const active = selectedFields.includes(field.key);
                  return (
                    <button
                      key={field.key}
                      type="button"
                      onClick={() => toggleField(field.key)}
                      title={field.desc}
                      style={{
                        padding: '5px 11px',
                        borderRadius: '16px',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        fontWeight: active ? 'bold' : 'normal',
                        border: active ? '1px solid #2ecc71' : '1px solid #353b48',
                        backgroundColor: active ? 'rgba(46, 204, 113, 0.2)' : '#1e222d',
                        color: active ? '#4ade80' : '#ccc',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {active ? '✓ ' : ''}{field.label}
                    </button>
                  );
                })}
              </div>

              {selectedFields.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#9ab' }}>
                  🔒 <b>Colunas geradas no Excel:</b>{' '}
                  <span style={{ color: '#cbd5e1' }}>ID (Bloqueado) | MÚSICA (Bloqueado) | ARTISTA (Bloqueado)</span>
                  {selectedFields.map(fk => {
                    const meta = BULK_EDIT_FIELDS.find(f => f.key === fk);
                    const cleanName = meta ? meta.label.replace(/^[^\s]+\s/, '').toUpperCase() : fk.toUpperCase();
                    return (
                      <span key={fk}>
                        {' '}| <span style={{ color: '#94a3b8' }}>{cleanName} ATUAL (Bloqueado)</span> |{' '}
                        <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{cleanName} NOVO (Editável ✏️)</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Filtros idênticos ao Planejamento */}
            <div style={{ marginBottom: '6px' }}>
              <label style={{ color: '#61dafb', fontWeight: 'bold', fontSize: '0.92rem', display: 'block', marginBottom: '6px' }}>
                🎵 2. Filtre ou selecione as músicas que irão para a planilha:
              </label>

              {/* Busca por Nome da Música ou Artista */}
              <div className="search-box">
                <Search size={17} color="#9ab" style={{ flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Buscar por nome da música ou artista..."
                  value={searchMusica}
                  onChange={e => setSearchMusica(e.target.value)}
                />
              </div>

              {/* Barra de Ordenação de Tempo + Toggle de Filtros */}
              <div className="filter-toolbar">
                <div className="sort-select-group">
                  <Clock size={16} color="#f39c12" style={{ flexShrink: 0 }} />
                  <select
                    value={sortTempoMode}
                    onChange={e => setSortTempoMode(e.target.value)}
                    className="sort-select"
                  >
                    <option value="alfabetica">🔤 Ordem Alfabética (A - Z)</option>
                    <option value="mais_tempo">⏳ Mais tempo sem planejar (Nunca planejadas 1º)</option>
                    <option value="nunca_planejadas">✨ Mostrar apenas músicas NUNCA planejadas</option>
                    <option value="recentes">🕒 Planejadas mais recentemente</option>
                  </select>
                </div>

                <div className="filter-actions-group">
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
                      <label className="filter-section-title" style={{ marginBottom: 0 }}>
                        🏷️ Tags / Palavras-Chave (pode selecionar várias):
                      </label>
                      {opcoesFiltros.tags.length > 8 && (
                        <input
                          type="text"
                          placeholder="Filtrar tags (ex: ceia, cruz)..."
                          value={tagFilterInput}
                          onChange={e => setTagFilterInput(e.target.value)}
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
            </div>

            {/* Barra de Seleção Rápida de Músicas */}
            <div
              className="search-summary-bar"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '6px 10px',
                backgroundColor: '#151821',
                borderRadius: '8px',
                marginBottom: '8px',
              }}
            >
              <div>
                <span>
                  Mostrando <b>{searchResults.length}</b> de {musicas.length} músicas
                </span>
                {' · '}
                <span style={{ color: '#4ade80' }}>
                  Marcadas p/ Excel: <b>{selectedMusicaIds.length}</b>
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleSelecionarApenasFiltradas}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    borderRadius: '6px',
                    border: '1px solid #61dafb',
                    backgroundColor: 'rgba(97, 218, 251, 0.14)',
                    color: '#61dafb',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  ☑️ Selecionar Filtradas ({searchResults.length})
                </button>
                <button
                  type="button"
                  onClick={handleSelecionarTodasBanco}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    borderRadius: '6px',
                    border: '1px solid #2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.14)',
                    color: '#4ade80',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  🌐 Todas do Banco ({musicas.length})
                </button>
                <button
                  type="button"
                  onClick={handleDesmarcarTodas}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    borderRadius: '6px',
                    border: '1px solid #4a505c',
                    backgroundColor: 'transparent',
                    color: '#9ab',
                    cursor: 'pointer',
                  }}
                >
                  ☐ Desmarcar Todas
                </button>
              </div>
            </div>

            {/* Lista de Músicas Filtradas */}
            <div className="search-results" style={{ maxHeight: '320px' }}>
              {searchResults.length === 0 && (
                <p style={{ color: '#9ab', textAlign: 'center', padding: '20px 0' }}>
                  Nenhuma música encontrada com esses filtros.
                </p>
              )}
              {searchResults.map(res => {
                const selecionada = selectedMusicaIds.includes(res.id);
                const tempoStr = formatarTempoSemPlanejar(res.ultimo_planejamento_em);
                const nuncaPlanejada = !res.ultimo_planejamento_em && !res.ultimo_periodo_nome;

                return (
                  <div
                    key={res.id}
                    className="search-item"
                    onClick={() => toggleMusicaId(res.id)}
                    style={{
                      cursor: 'pointer',
                      ...(selecionada ? { borderLeftColor: '#2ecc71', background: 'rgba(46, 204, 113, 0.08)' } : {}),
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <input
                        type="checkbox"
                        checked={selecionada}
                        onChange={() => {}}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2ecc71' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="search-item-title-row">
                          <strong className="search-item-title">{res.nome_musica}</strong>
                          {res.artista && <span className="search-artista"> - {res.artista}</span>}
                        </div>

                        <div className="search-item-badges">
                          {nuncaPlanejada ? (
                            <span className="badge-tempo nunca">✨ Nunca planejada</span>
                          ) : (
                            <span
                              className="badge-tempo planejada"
                              title={res.ultimo_periodo_nome ? `Último período: ${res.ultimo_periodo_nome}` : ''}
                            >
                              ⏳ Última vez: {tempoStr || 'anteriormente'} {res.ultimo_periodo_nome ? `(${res.ultimo_periodo_nome})` : ''}
                            </span>
                          )}

                          {res.tema_central && <span className="badge-meta tema">🎯 {res.tema_central}</span>}

                          {(res.categorias || []).map((c, idx) => (
                            <span key={idx} className="badge-meta cat">
                              📁 {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rodapé da Aba 1 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: '#9ab' }}>
                <b>{selectedMusicaIds.length}</b> música(s) e <b>{selectedFields.length}</b> opção(ões) selecionadas
              </span>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    padding: '10px 18px',
                    background: 'transparent',
                    border: '1px solid #4a505c',
                    color: '#ccc',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleDownloadBulkExcel}
                  disabled={isExporting || selectedMusicaIds.length === 0 || selectedFields.length === 0}
                  className="main-button"
                  style={{
                    width: 'auto',
                    margin: 0,
                    backgroundColor: '#2ecc71',
                    color: '#151821',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Download size={17} />
                  {isExporting
                    ? 'Gerando Planilha...'
                    : `Baixar Planilha Protegida (${selectedMusicaIds.length} músicas)`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* ABA 2: ENVIAR PLANILHA EDITADA + RELATÓRIO E APROVAÇÃO POR MÚSICA      */}
        {/* ===================================================================== */}
        {activeTab === 'import' && (
          <div>
            {exportDoneNotice && (
              <div
                style={{
                  marginBottom: '14px',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(46, 204, 113, 0.12)',
                  border: '1px solid #2ecc71',
                  borderRadius: '8px',
                  color: '#d1fae5',
                  fontSize: '0.88rem',
                }}
              >
                ✅ <b>Planilha baixada com sucesso!</b> Abra o arquivo <code>Edicao_Em_Massa_LeviHub.xlsx</code>, preencha a(s) coluna(s) verde(s) <b>"... NOVO"</b> nas músicas que deseja alterar, salve e envie o arquivo abaixo para revisar e aprovar as mudanças!
              </div>
            )}

            {/* Área de Upload Drag & Drop */}
            <div
              onDragOver={e => {
                e.preventDefault();
                e.stopPropagation();
                if (!isDragging) setIsDragging(true);
              }}
              onDragLeave={e => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={e => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  validateAndSetFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              style={{
                padding: '22px 18px',
                border: isDragging ? '2px dashed #2ecc71' : file ? '2px solid #61dafb' : '2px dashed #4a505c',
                backgroundColor: isDragging
                  ? 'rgba(46, 204, 113, 0.12)'
                  : file
                  ? 'rgba(97, 218, 251, 0.08)'
                  : 'rgba(255, 255, 255, 0.02)',
                borderRadius: '10px',
                textAlign: 'center',
                marginBottom: '14px',
                cursor: 'pointer',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={e => e.target.files && e.target.files[0] && validateAndSetFile(e.target.files[0])}
                style={{ display: 'none' }}
              />
              {file ? (
                <div>
                  <div style={{ fontSize: '1.6rem', marginBottom: '4px' }}>📊</div>
                  <strong style={{ color: '#61dafb', fontSize: '0.98rem' }}>{file.name}</strong>
                  <div style={{ fontSize: '0.8rem', color: '#9ab', marginTop: '4px' }}>
                    Clique aqui ou arraste outro arquivo caso queira trocar
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>📂</div>
                  <strong style={{ color: '#fff', fontSize: '0.96rem' }}>
                    Arraste e solte aqui a planilha <code>Edicao_Em_Massa_LeviHub.xlsx</code> atualizada
                  </strong>
                  <div style={{ fontSize: '0.82rem', color: '#9ab', marginTop: '4px' }}>
                    ou <span style={{ color: '#61dafb', textDecoration: 'underline' }}>clique para procurar no computador</span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={handleAnalyzeExcel}
                disabled={!file || isAnalyzing}
                className="main-button"
                style={{ width: 'auto', margin: 0 }}
              >
                {isAnalyzing ? 'Analisando Mudanças...' : '🔍 Analisar Mudanças da Planilha'}
              </button>
            </div>

            {/* Relatório de Mudanças p/ Aprovação Individual */}
            {previewReport && (
              <div
                style={{
                  backgroundColor: '#151821',
                  border: '1px solid #353b48',
                  borderRadius: '10px',
                  padding: '14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                    marginBottom: '12px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid #2a2f3a',
                  }}
                >
                  <div>
                    <h4 style={{ margin: 0, color: '#f39c12' }}>
                      📋 Relatório de Alterações Detectadas ({previewReport.items.length} música{previewReport.items.length !== 1 ? 's' : ''} com mudança)
                    </h4>
                    <small style={{ color: '#9ab' }}>
                      Foram lidas {previewReport.total_linhas_analisadas} linhas · Campos verificados:{' '}
                      <b>{(previewReport.campos_detectados || []).join(', ')}</b>
                    </small>
                  </div>

                  {previewReport.items.length > 0 && (
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        color: '#61dafb',
                        fontWeight: 'bold',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={approvedIndexes.length === previewReport.items.length && previewReport.items.length > 0}
                        onChange={e => {
                          if (e.target.checked) {
                            setApprovedIndexes(previewReport.items.map((_, idx) => idx));
                          } else {
                            setApprovedIndexes([]);
                          }
                        }}
                        style={{ width: '16px', height: '16px', accentColor: '#2ecc71' }}
                      />
                      Aprovar / Desmarcar Todas ({approvedIndexes.length}/{previewReport.items.length})
                    </label>
                  )}
                </div>

                {previewReport.items.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#9ab' }}>
                    <AlertCircle size={28} color="#f39c12" style={{ marginBottom: '8px' }} />
                    <div>
                      Nenhuma alteração foi encontrada nas colunas <b>"... NOVO"</b> da planilha enviada.
                    </div>
                    <small>Certifique-se de preencher a coluna verde "... NOVO" com um valor diferente do atual e salvar o Excel antes de enviar.</small>
                  </div>
                ) : (
                  <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {previewReport.items.map((item, idx) => {
                      const isApproved = approvedIndexes.includes(idx);
                      return (
                        <div
                          key={item.musica_id || idx}
                          onClick={() => toggleApproveIndex(idx)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            border: isApproved ? '1px solid rgba(46, 204, 113, 0.5)' : '1px solid #2a2f3a',
                            backgroundColor: isApproved ? 'rgba(46, 204, 113, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isApproved}
                            onChange={() => {}}
                            style={{ marginTop: '4px', width: '17px', height: '17px', accentColor: '#2ecc71', cursor: 'pointer' }}
                          />

                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.94rem', marginBottom: '4px' }}>
                              🎵 {item.nome_musica}{' '}
                              {item.artista && <span style={{ color: '#9ab', fontWeight: 'normal', fontSize: '0.84rem' }}>— {item.artista}</span>}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              {item.changes.map((ch, cIdx) => (
                                <div
                                  key={cIdx}
                                  style={{
                                    fontSize: '0.86rem',
                                    color: '#e2e8f0',
                                    backgroundColor: 'rgba(0,0,0,0.25)',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    borderLeft: '3px solid #f39c12',
                                  }}
                                >
                                  Música <b>"{item.nome_musica}"</b> mudará de <b>{ch.label}</b> de{' '}
                                  <span
                                    style={{
                                      backgroundColor: 'rgba(231, 76, 60, 0.2)',
                                      color: '#fca5a5',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      fontWeight: 'bold',
                                    }}
                                  >
                                    {ch.old_value}
                                  </span>{' '}
                                  para{' '}
                                  <span
                                    style={{
                                      backgroundColor: 'rgba(46, 204, 113, 0.22)',
                                      color: '#4ade80',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      fontWeight: 'bold',
                                    }}
                                  >
                                    {ch.new_value || 'Vazio'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {previewReport.items.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <span style={{ color: '#9ab', fontSize: '0.86rem' }}>
                      <b>{approvedIndexes.length}</b> de <b>{previewReport.items.length}</b> música(s) aprovada(s) para atualização
                    </span>
                    <button
                      type="button"
                      onClick={handleCommitBulkChanges}
                      disabled={isCommitting || approvedIndexes.length === 0}
                      className="main-button"
                      style={{
                        width: 'auto',
                        margin: 0,
                        backgroundColor: '#2ecc71',
                        color: '#151821',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <CheckCircle2 size={17} />
                      {isCommitting ? 'Aplicando Mudanças...' : `Aprovar e Aplicar ${approvedIndexes.length} Mudança(s)`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkEditModal;
