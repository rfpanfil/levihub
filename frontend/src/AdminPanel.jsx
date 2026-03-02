// src/AdminPanel.jsx
import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

function AdminPanel() {
  const [usuarios, setUsuarios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });

  // Estados de Edição de Utilizadores
  const [editandoUserId, setEditandoUserId] = useState(null);
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('user');
  const [editSenha, setEditSenha] = useState(''); 

  // Estados do Modal de Adicionar Música Global (AGORA COM ARRAY PARA CATEGORIAS)
  const [isModalMusicaOpen, setIsModalMusicaOpen] = useState(false);
  const [musicaGlobal, setMusicaGlobal] = useState({ nome_musica: '', tags: '', categorias: [], link: '' });

  // Lista fixa das categorias que o Bot Global lê
  const categoriasGlobaisPermitidas = [
    { id: 'agitadas1', label: 'Agitadas 1' },
    { id: 'agitadas2', label: 'Agitadas 2' },
    { id: 'lentas1', label: 'Lentas 1' },
    { id: 'lentas2', label: 'Lentas 2' },
    { id: 'ceia', label: 'Ceia' },
    { id: 'infantis', label: 'Infantis' }
  ];

  const carregarUsuarios = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/usuarios`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data.usuarios);
      } else mostrarMensagem("Acesso Negado ou Falha na API.", "erro");
    } catch (err) { mostrarMensagem("Erro de conexão.", "erro"); } 
    finally { setIsLoading(false); }
  };

  useEffect(() => { carregarUsuarios(); }, []);

  const mostrarMensagem = (texto, tipo) => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem({ texto: '', tipo: '' }), 3000);
  };

  const iniciarEdicao = (usr) => {
    setEditandoUserId(usr.id); setEditEmail(usr.email); setEditRole(usr.role); setEditSenha('');
  };

  const salvarEdicao = async (id) => {
    const token = localStorage.getItem('token');
    try {
      const bodyData = { email: editEmail, role: editRole };
      if (editSenha.trim() !== '') bodyData.senha = editSenha;

      const res = await fetch(`${API_BASE_URL}/admin/usuarios/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(bodyData)
      });
      if (res.ok) {
        mostrarMensagem("Usuário atualizado!", "sucesso");
        setEditandoUserId(null); carregarUsuarios();
      } else mostrarMensagem("Erro ao atualizar usuário.", "erro");
    } catch (err) { mostrarMensagem("Erro de conexão.", "erro"); }
  };

  const excluirUsuario = async (id, email) => {
    if (!window.confirm(`ATENÇÃO: Excluir o usuário ${email} apagará todo o repertório e equipe dele. Continuar?`)) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/admin/usuarios/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { mostrarMensagem("Usuário excluído!", "sucesso"); carregarUsuarios(); } 
      else mostrarMensagem("Erro ao excluir.", "erro");
    } catch (err) { mostrarMensagem("Erro de conexão.", "erro"); }
  };

  // Função para marcar/desmarcar categorias
  const handleToggleCategoria = (catId) => {
    setMusicaGlobal(prev => {
      const novasCategorias = prev.categorias.includes(catId)
        ? prev.categorias.filter(c => c !== catId)
        : [...prev.categorias, catId];
      return { ...prev, categorias: novasCategorias };
    });
  };

  const handleSalvarMusicaGlobal = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    
    if (musicaGlobal.categorias.length === 0) {
      mostrarMensagem("Selecione pelo menos uma categoria.", "erro");
      return;
    }

    let linkLimpo = musicaGlobal.link.trim();
    if (linkLimpo) {
      try {
        const urlObj = new URL(linkLimpo);
        if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.has('v')) linkLimpo = `https://youtu.be/${urlObj.searchParams.get('v')}`;
        else if (urlObj.hostname.includes('youtu.be')) linkLimpo = `https://youtu.be${urlObj.pathname}`;
      } catch(e) {}
    }

    // Transforma o array ["ceia", "lentas1"] numa string separada por vírgulas para a API
    const categoriasStr = musicaGlobal.categorias.join(', ');

    try {
      const res = await fetch(`${API_BASE_URL}/admin/musicas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          nome_musica: musicaGlobal.nome_musica, 
          tags: musicaGlobal.tags, 
          categoria: categoriasStr, 
          link: linkLimpo 
        })
      });
      if (res.ok) {
        mostrarMensagem("Música adicionada ao Banco Global com sucesso!", "sucesso");
        setMusicaGlobal({ nome_musica: '', tags: '', categorias: [], link: '' });
        setIsModalMusicaOpen(false);
      } else mostrarMensagem("Erro ao adicionar música global.", "erro");
    } catch(e) { mostrarMensagem("Erro de conexão.", "erro"); }
  };

  const inputStyle = { padding: '5px', borderRadius: '3px', border: '1px solid #4a505c', backgroundColor: '#1e2229', color: 'white', marginRight: '5px', width: '100%', boxSizing: 'border-box' };

  return (
    <div className="gerador-escala-container">
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e74c3c', paddingBottom: '10px', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <h2 style={{ color: '#e74c3c', margin: 0 }}>🛠️ Painel de Administração</h2>
        <button onClick={() => setIsModalMusicaOpen(true)} style={{ padding: '10px 20px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🌍 Abastecer Repertório Global
        </button>
      </div>

      <p style={{ color: '#9ab', marginBottom: '20px' }}>Zona de perigo. Aqui você pode gerenciar todos os usuários do sistema.</p>

      {mensagem.texto && (
        <div style={{ marginBottom: '20px', padding: '10px', textAlign: 'center', borderRadius: '5px', backgroundColor: mensagem.tipo === 'sucesso' ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.2)', color: mensagem.tipo === 'sucesso' ? '#2ecc71' : '#ff4b4b', fontWeight: 'bold' }}>
          {mensagem.texto}
        </div>
      )}

      {isLoading ? <p>Carregando usuários...</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="escala-matrix" style={{ width: '100%', textAlign: 'left' }}>
            <thead>
              <tr><th>ID</th><th>E-mail</th><th>Privilégio (Role)</th><th>Status Email</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {usuarios.map(usr => (
                <tr key={usr.id} style={{ backgroundColor: '#282c34' }}>
                  <td style={{ padding: '10px' }}>{usr.id}</td>
                  <td style={{ padding: '10px' }}>
                    {editandoUserId === usr.id ? <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} style={inputStyle} /> : <span style={{ color: usr.role === 'admin' ? '#e74c3c' : 'white', fontWeight: usr.role === 'admin' ? 'bold' : 'normal' }}>{usr.email}</span>}
                  </td>
                  <td style={{ padding: '10px' }}>
                    {editandoUserId === usr.id ? (
                      <select value={editRole} onChange={e => setEditRole(e.target.value)} style={inputStyle}>
                        <option value="user">Usuário Padrão</option><option value="admin">Administrador</option>
                      </select>
                    ) : (
                      <span style={{ backgroundColor: usr.role === 'admin' ? '#e74c3c' : '#4a505c', padding: '3px 8px', borderRadius: '10px', fontSize: '0.8em' }}>{usr.role.toUpperCase()}</span>
                    )}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{usr.is_verified ? '✅' : '⏳ Pendente'}</td>
                  <td style={{ padding: '10px' }}>
                    {editandoUserId === usr.id ? (
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        <input type="text" placeholder="Nova Senha (Opcional)" value={editSenha} onChange={e => setEditSenha(e.target.value)} style={{...inputStyle, width: '130px'}} />
                        <button onClick={() => salvarEdicao(usr.id)} style={{ padding: '5px 10px', background: '#2ecc71', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Salvar</button>
                        <button onClick={() => setEditandoUserId(null)} style={{ padding: '5px 10px', background: '#7f8c8d', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>X</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => iniciarEdicao(usr)} style={{ background: 'none', border: '1px solid #61dafb', color: '#61dafb', cursor: 'pointer', padding: '5px 10px', borderRadius: '4px' }}>Editar</button>
                        <button onClick={() => excluirUsuario(usr.id, usr.email)} style={{ background: 'none', border: '1px solid #ff4b4b', color: '#ff4b4b', cursor: 'pointer', padding: '5px 10px', borderRadius: '4px' }}>Excluir</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- MODAL PARA ADICIONAR MÚSICA AO BANCO GLOBAL --- */}
      {isModalMusicaOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', border: '2px solid #e74c3c' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #4a505c', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, color: '#e74c3c' }}>🌍 Nova Música Global</h2>
              <button onClick={() => setIsModalMusicaOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ab', fontSize: '1.5em', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <p style={{ fontSize: '0.85em', color: '#9ab', marginBottom: '20px', fontStyle: 'italic' }}>
              As músicas adicionadas aqui ficarão disponíveis para o robô sortear para <b>todos os visitantes e usuários</b> que usarem o Banco Padrão.
            </p>

            <form onSubmit={handleSalvarMusicaGlobal} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label>Nome da Música *</label>
                <input type="text" value={musicaGlobal.nome_musica} onChange={e => setMusicaGlobal({...musicaGlobal, nome_musica: e.target.value})} placeholder="Ex: Grandioso És Tu" style={{...inputStyle, padding: '10px'}} required />
              </div>
              
              {/* MUDANÇA: CHECKBOXES PARA MÚLTIPLAS CATEGORIAS GLOBAIS */}
              <div>
                <label>Categorias para Sorteio (Pode escolher várias) *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px', padding: '15px', backgroundColor: '#1e2229', borderRadius: '8px', border: '1px solid #4a505c' }}>
                  {categoriasGlobaisPermitidas.map(cat => {
                    const isChecked = musicaGlobal.categorias.includes(cat.id);
                    return (
                      <label key={cat.id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', backgroundColor: isChecked ? 'rgba(231, 76, 60, 0.2)' : '#3c414d', border: isChecked ? '1px solid #e74c3c' : '1px solid transparent', color: isChecked ? '#e74c3c' : 'white', padding: '8px 12px', borderRadius: '15px', fontSize: '0.9em', fontWeight: isChecked ? 'bold' : 'normal', transition: 'all 0.2s ease' }}>
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={() => handleToggleCategoria(cat.id)} 
                          style={{ marginRight: '8px', cursor: 'pointer' }} 
                        />
                        {cat.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label>Palavras-Chave (Separadas por vírgula) *</label>
                <input type="text" value={musicaGlobal.tags} onChange={e => setMusicaGlobal({...musicaGlobal, tags: e.target.value})} placeholder="exaltação, hino, clássico" style={{...inputStyle, padding: '10px'}} required />
              </div>
              
              <div>
                <label>Link YouTube (Opcional)</label>
                <input type="text" value={musicaGlobal.link} onChange={e => setMusicaGlobal({...musicaGlobal, link: e.target.value})} placeholder="Cole a URL do vídeo aqui" style={{...inputStyle, padding: '10px'}} />
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setIsModalMusicaOpen(false)} style={{ padding: '10px 20px', backgroundColor: 'transparent', border: '1px solid #ff4b4b', color: '#ff4b4b', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" className="main-button" style={{ margin: 0, width: 'auto', backgroundColor: '#e74c3c' }}>
                  🌍 Adicionar à Nuvem
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default AdminPanel;