//GerenciarRepertorio.jsx

import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

function GerenciarRepertorio() {
  const [musicasCustom, setMusicasCustom] = useState([]);
  const [categoriasObjetos, setCategoriasObjetos] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });

  // Estados de Pesquisa e Filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Estados do Modal de Música
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  
  const [nomeMusica, setNomeMusica] = useState('');
  const [artista, setArtista] = useState(''); // NOVO ESTADO
  const [tags, setTags] = useState('');
  const [link, setLink] = useState('');
  const [categoria, setCategoria] = useState('');
  
  // Estados para Criação Rápida de Categoria no Dropdown
  const [isNovaCategoriaInline, setIsNovaCategoriaInline] = useState(false);
  const [novaCategoriaNomeInline, setNovaCategoriaNomeInline] = useState('');

  // Estados do Modal de Categorias (CRUD)
  const [isCategoriasModalOpen, setIsCategoriasModalOpen] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [editandoCategoriaId, setEditandoCategoriaId] = useState(null);
  const [editandoCategoriaNome, setEditandoCategoriaNome] = useState('');

  const carregarDados = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setIsLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [resMusicas, resCats] = await Promise.all([
        fetch(`${API_BASE_URL}/musicas/custom`, { headers }),
        fetch(`${API_BASE_URL}/categorias`, { headers })
      ]);

      if (resMusicas.ok) {
        const dataM = await resMusicas.json();
        setMusicasCustom(dataM.musicas);
      }
      if (resCats.ok) {
        const dataC = await resCats.json();
        setCategoriasObjetos(dataC.categorias);
      }
    } catch (error) { mostrarMensagem("Erro ao carregar dados.", "erro"); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { carregarDados(); }, []);

  const mostrarMensagem = (texto, tipo) => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem({ texto: '', tipo: '' }), 3000);
  };

  const formatarLinkYouTube = (urlBruta) => {
    if (!urlBruta) return '';
    let limpo = urlBruta.trim();
    try {
      const urlObj = new URL(limpo);
      if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.has('v')) {
        limpo = `https://youtu.be/${urlObj.searchParams.get('v')}`;
      } else if (urlObj.hostname.includes('youtu.be')) {
        limpo = `https://youtu.be${urlObj.pathname}`;
      }
    } catch (e) {}
    return limpo;
  };

  // --- LÓGICA DE MÚSICAS ---
  const abrirModalNovo = () => {
    setIsEditing(false); setEditId(null); 
    setNomeMusica(''); setArtista(''); setTags(''); setLink(''); 
    setCategoria(categoriasObjetos.length > 0 ? categoriasObjetos[0].nome : '');
    setIsNovaCategoriaInline(false); setNovaCategoriaNomeInline('');
    setIsModalOpen(true);
  };

  const iniciarEdicao = (musica) => {
    setIsEditing(true); setEditId(musica.id);
    setNomeMusica(musica.nome_musica);
    setArtista(musica.artista || ''); // CARREGA O ARTISTA
    setTags(musica.tags); setLink(musica.link || '');
    setCategoria(musica.categoria);
    setIsNovaCategoriaInline(false); setNovaCategoriaNomeInline('');
    setIsModalOpen(true);
  };

  const handleSalvarMusica = async (e) => {
    e.preventDefault();
    
    let catFinal = categoria;

    // Se o usuário escolheu criar uma categoria na hora
    if (isNovaCategoriaInline) {
      catFinal = novaCategoriaNomeInline.trim();
      if (!catFinal) {
        mostrarMensagem("Digite o nome da nova categoria.", "erro"); return;
      }
    } else if (!categoria.trim()) {
      mostrarMensagem("Selecione uma categoria.", "erro"); return;
    }

    if (!nomeMusica.trim() || !tags.trim()) {
      mostrarMensagem("Preencha o nome e as tags.", "erro"); return;
    }

    const token = localStorage.getItem('token');
    
    try {
      // 1. Salva a categoria no banco de dados PRIMEIRO (se for nova inline)
      if (isNovaCategoriaInline) {
        const catExiste = categoriasObjetos.some(c => c.nome.toLowerCase() === catFinal.toLowerCase());
        if (!catExiste) {
          await fetch(`${API_BASE_URL}/categorias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ nome: catFinal })
          });
        }
      }

      // 2. Salva a Música
      const linkLimpo = formatarLinkYouTube(link);
      // INCLUI O ARTISTA NO ENVIO
      const bodyData = { nome_musica: nomeMusica, artista, tags, categoria: catFinal, link: linkLimpo };

      const url = isEditing ? `${API_BASE_URL}/musicas/custom/${editId}` : `${API_BASE_URL}/musicas/custom`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(bodyData)
      });

      if (!res.ok) throw new Error();
      mostrarMensagem(isEditing ? "Música atualizada!" : "Música adicionada!", "sucesso");
      setIsModalOpen(false);
      carregarDados();
    } catch (error) { mostrarMensagem("Erro ao salvar a música.", "erro"); }
  };

  const handleExcluirMusica = async (id, nome) => {
    if (!window.confirm(`Tem a certeza que deseja excluir "${nome}"?`)) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/musicas/custom/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { mostrarMensagem("Música excluída!", "sucesso"); carregarDados(); }
    } catch (error) { mostrarMensagem("Erro ao excluir.", "erro"); }
  };

  // --- LÓGICA DE CATEGORIAS DO MODAL GERENCIADOR ---
  const handleSalvarNovaCategoria = async () => {
    const token = localStorage.getItem('token');
    if (!novaCategoriaNome.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/categorias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ nome: novaCategoriaNome.trim() })
      });
      if (!res.ok) throw new Error();
      setNovaCategoriaNome('');
      mostrarMensagem("Categoria criada!", "sucesso");
      carregarDados();
    } catch (error) { mostrarMensagem("Erro ao criar categoria.", "erro"); }
  };

  const handleExcluirCategoria = async (id) => {
    if (!window.confirm("Atenção! As músicas desta categoria ficarão 'Sem Categoria'. Continuar?")) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/categorias/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      mostrarMensagem("Categoria excluída!", "sucesso");
      carregarDados();
    } catch (error) { mostrarMensagem("Erro ao excluir categoria.", "erro"); }
  };

  const handleSalvarEdicaoCategoria = async (id) => {
    const token = localStorage.getItem('token');
    if (!editandoCategoriaNome.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/categorias/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ nome: editandoCategoriaNome.trim() })
      });
      if (!res.ok) throw new Error();
      setEditandoCategoriaId(null);
      mostrarMensagem("Categoria atualizada!", "sucesso");
      carregarDados();
    } catch (error) { mostrarMensagem("Erro ao editar.", "erro"); }
  };

  // Lógica de Filtragem
  const musicasFiltradas = musicasCustom.filter(m => {
    const termo = searchTerm.toLowerCase();
    const matchesSearch = m.nome_musica.toLowerCase().includes(termo) || m.tags.toLowerCase().includes(termo) || (m.categoria && m.categoria.toLowerCase().includes(termo));
    // Nova lógica: verifica se a categoria selecionada está CONTIDA na string de categorias da música
    const matchesCat = filterCategory === '' || (m.categoria && m.categoria.includes(filterCategory));
    return matchesSearch && matchesCat;
  });

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '5px', backgroundColor: '#282c34', color: 'white', border: '1px solid #4a505c', marginTop: '5px' };

  return (
    <div className="gerador-escala-container">
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <h2>🎸 O Meu Repertório Pessoal</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setIsCategoriasModalOpen(true)} style={{ padding: '12px 20px', backgroundColor: 'transparent', border: '2px solid #f39c12', color: '#f39c12', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            ⚙️ Gerenciar Categorias
          </button>
          <button onClick={abrirModalNovo} className="main-button" style={{ margin: 0, width: 'auto' }}>
            ➕ Adicionar Música
          </button>
        </div>
      </div>

      {mensagem.texto && !isModalOpen && !isCategoriasModalOpen && (
        <div style={{ marginBottom: '20px', padding: '10px', textAlign: 'center', borderRadius: '5px', backgroundColor: mensagem.tipo === 'sucesso' ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.2)', color: mensagem.tipo === 'sucesso' ? '#2ecc71' : '#ff4b4b', fontWeight: 'bold' }}>
          {mensagem.texto}
        </div>
      )}

      {/* --- BARRA DE PESQUISA E FILTRO --- */}
      <div className="input-area" style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end', marginBottom: '20px' }}>
        <div style={{ flex: 2, minWidth: '200px' }}>
          <label>🔍 Buscar Música ou Tag</label>
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Ex: Jesus, adoração..." style={inputStyle} />
        </div>
        <div style={{ flex: 1, minWidth: '150px' }}>
          <label>📂 Filtrar por Categoria</label>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={inputStyle}>
            <option value="">Todas as Categorias</option>
            {categoriasObjetos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
        </div>
      </div>

      {/* --- LISTA DE MÚSICAS --- */}
      <div className="input-area">
        <h3 style={{ marginTop: 0, borderBottom: '1px solid #4a505c', paddingBottom: '10px' }}>
          Músicas Cadastradas ({musicasFiltradas.length})
        </h3>
        
        {isLoading ? <p>A carregar músicas...</p> : musicasFiltradas.length === 0 ? (
          <p style={{ color: '#9ab', fontStyle: 'italic' }}>Nenhuma música encontrada.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px', maxHeight: '500px', overflowY: 'auto', paddingRight: '5px' }}>
            {musicasFiltradas.map(musica => (
              <div key={musica.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#282c34', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #f39c12' }}>
                <div style={{ overflow: 'hidden' }}>
                  <strong style={{ color: 'white', fontSize: '1.1em', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {musica.nome_musica} {musica.artista && <span style={{ color: '#f39c12', fontSize: '0.85em', fontWeight: 'normal' }}> - {musica.artista}</span>}
                  </strong>
                  <div style={{ display: 'flex', gap: '5px', marginTop: '5px', flexWrap: 'wrap' }}>
                    {musica.categoria && musica.categoria.split(',').map((cat, i) => (
                      <span key={i} style={{ fontSize: '0.7em', backgroundColor: '#4a505c', padding: '3px 8px', borderRadius: '10px', color: '#eafcff' }}>
                        {cat.trim()}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.85em', color: '#61dafb', marginTop: '8px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    Tags: {musica.tags}
                  </div>
                  {musica.link && (
                    <a href={musica.link} target="_blank" rel="noreferrer" style={{ fontSize: '0.85em', color: '#2ecc71', display: 'inline-block', marginTop: '5px' }}>
                      🔗 Acessar Link
                    </a>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '10px' }}>
                  <button onClick={() => iniciarEdicao(musica)} style={{ background: '#3c414d', border: '1px solid #61dafb', color: '#61dafb', cursor: 'pointer', borderRadius: '4px', padding: '5px' }} title="Editar">✏️</button>
                  <button onClick={() => handleExcluirMusica(musica.id, musica.nome_musica)} style={{ background: '#3c414d', border: '1px solid #ff4b4b', color: '#ff4b4b', cursor: 'pointer', borderRadius: '4px', padding: '5px' }} title="Excluir">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- MODAL DE MÚSICAS --- */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #4a505c', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, color: isEditing ? '#f39c12' : '#61dafb' }}>{isEditing ? '✏️ Editar Música' : '➕ Nova Música'}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ab', fontSize: '1.5em', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <form onSubmit={handleSalvarMusica} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ flex: 2, minWidth: '200px' }}>
                  <label>Nome da Música *</label>
                  <input type="text" value={nomeMusica} onChange={e => setNomeMusica(e.target.value)} placeholder="Ex: A Ele a Glória" style={inputStyle} required />
                </div>
                <div style={{ flex: 2, minWidth: '200px' }}>
                  <label>Artista / Banda (Opcional)</label>
                  <input type="text" value={artista} onChange={e => setArtista(e.target.value)} placeholder="Ex: Diante do Trono" style={inputStyle} />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label>Categoria *</label>
                  <select 
                    value={isNovaCategoriaInline ? 'nova' : categoria} 
                    onChange={e => {
                      if(e.target.value === 'nova') { setIsNovaCategoriaInline(true); setCategoria(''); }
                      else { setIsNovaCategoriaInline(false); setCategoria(e.target.value); }
                    }} 
                    style={inputStyle} 
                    required={!isNovaCategoriaInline}
                  >
                    <option value="" disabled>Selecione...</option>
                    {categoriasObjetos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                    <option value="nova">✨ + Criar Nova Categoria...</option>
                  </select>
                </div>
              </div>

              {/* CAMPO EXTRA: Aparece se o usuário escolher "Criar Nova Categoria..." */}
              {isNovaCategoriaInline && (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                  <label style={{ color: '#f39c12' }}>Nome da Nova Categoria *</label>
                  <input 
                    type="text" 
                    value={novaCategoriaNomeInline} 
                    onChange={e => setNovaCategoriaNomeInline(e.target.value)} 
                    placeholder="Ex: Adoração, Entrada..." 
                    style={{...inputStyle, borderColor: '#f39c12'}} 
                    required 
                    autoFocus 
                  />
                </div>
              )}

              <div>
                <label>Palavras-Chave (Separadas por vírgula) *</label>
                <input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="exaltação, animada, deus" style={inputStyle} required />
              </div>
              
              <div>
                <label>Link YouTube (Opcional - Encurtamos p/ você!)</label>
                <input type="text" value={link} onChange={e => setLink(e.target.value)} placeholder="Cole a URL do vídeo ou cifra aqui" style={inputStyle} />
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 20px', backgroundColor: 'transparent', border: '1px solid #ff4b4b', color: '#ff4b4b', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" className="main-button" style={{ margin: 0, width: 'auto', backgroundColor: isEditing ? '#f39c12' : '#61dafb' }}>
                  {isEditing ? '💾 Guardar Alterações' : '➕ Salvar Música'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DE GERENCIAR CATEGORIAS --- */}
      {isCategoriasModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #4a505c', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, color: '#f39c12' }}>⚙️ Gerenciar Categorias</h2>
              <button onClick={() => setIsCategoriasModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ab', fontSize: '1.5em', cursor: 'pointer' }}>&times;</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label>Adicionar Nova Categoria</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" value={novaCategoriaNome} onChange={e => setNovaCategoriaNome(e.target.value)} placeholder="Ex: Entrada, Oferta..." style={inputStyle} />
                <button onClick={handleSalvarNovaCategoria} style={{ padding: '10px 20px', backgroundColor: '#f39c12', color: '#1e2229', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px' }}>Adicionar</button>
              </div>
            </div>

            <h3 style={{ borderBottom: '1px solid #4a505c', paddingBottom: '10px' }}>Categorias Existentes</h3>
            <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' }}>
              {categoriasObjetos.length === 0 ? <p style={{ color: '#9ab' }}>Nenhuma categoria criada ainda.</p> : categoriasObjetos.map(cat => (
                <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#282c34', padding: '10px', marginBottom: '8px', borderRadius: '5px', border: '1px solid #4a505c' }}>
                  {editandoCategoriaId === cat.id ? (
                    <div style={{ display: 'flex', gap: '5px', width: '100%' }}>
                      <input type="text" value={editandoCategoriaNome} onChange={e => setEditandoCategoriaNome(e.target.value)} style={{ flex: 1, padding: '5px', borderRadius: '3px', border: '1px solid #f39c12', backgroundColor: '#1e2229', color: 'white' }} />
                      <button onClick={() => handleSalvarEdicaoCategoria(cat.id)} style={{ backgroundColor: '#2ecc71', border: 'none', borderRadius: '3px', padding: '5px 10px', cursor: 'pointer', color: 'white' }}>OK</button>
                      <button onClick={() => setEditandoCategoriaId(null)} style={{ backgroundColor: '#e74c3c', border: 'none', borderRadius: '3px', padding: '5px 10px', cursor: 'pointer', color: 'white' }}>X</button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontWeight: 'bold', color: 'white' }}>{cat.nome}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => { setEditandoCategoriaId(cat.id); setEditandoCategoriaNome(cat.nome); }} style={{ background: 'none', border: 'none', color: '#61dafb', cursor: 'pointer', fontSize: '1.2em' }} title="Editar">✏️</button>
                        <button onClick={() => handleExcluirCategoria(cat.id)} style={{ background: 'none', border: 'none', color: '#ff4b4b', cursor: 'pointer', fontSize: '1.2em' }} title="Excluir">🗑️</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}

export default GerenciarRepertorio;