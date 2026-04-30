// arquivo: frontend/src/pages/GerenciarPerfil.jsx

import React, { useState, useEffect } from 'react';

import { API_BASE_URL } from '../services/config';


function GerenciarPerfil() {
  const [perfil, setPerfil] = useState({ email: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });

  // Estados para alteração de credenciais
  const [isEditingCredentials, setIsEditingCredentials] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');

  const carregarDados = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setIsLoading(true);
    try {
      const resPerfil = await fetch(`${API_BASE_URL}/usuario/me`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (resPerfil.ok) {
        const dataPerfil = await resPerfil.json();
        setPerfil(dataPerfil);
      }
    } catch (error) {
      mostrarMensagem("Erro ao carregar o perfil.", "erro");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const mostrarMensagem = (texto, tipo) => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem({ texto: '', tipo: '' }), 3000);
  };

  const handleSalvarCredenciais = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    
    if (!novoEmail.trim() && !novaSenha.trim()) {
      mostrarMensagem("Preencha pelo menos um campo para atualizar.", "erro");
      return;
    }

    const payload = {};
    if (novoEmail.trim()) payload.novo_email = novoEmail.trim();
    if (novaSenha.trim()) payload.nova_senha = novaSenha.trim();

    try {
      const res = await fetch(`${API_BASE_URL}/usuario/credenciais`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (res.ok) {
        mostrarMensagem("Credenciais atualizadas com sucesso!", "sucesso");
        if (payload.novo_email) setPerfil(prev => ({ ...prev, email: payload.novo_email }));
        setIsEditingCredentials(false);
        setNovoEmail('');
        setNovaSenha('');
      } else {
        mostrarMensagem(`Erro: ${data.detail || 'Falha ao atualizar'}`, "erro");
      }
    } catch (error) { mostrarMensagem("Erro de conexão.", "erro"); }
  };

  return (
    <div className="gerador-escala-container">
      <h2>⚙️ Configurações da Conta</h2>

      {mensagem.texto && (
        <div style={{ marginBottom: '20px', padding: '10px', textAlign: 'center', borderRadius: '5px', backgroundColor: mensagem.tipo === 'sucesso' ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.2)', color: mensagem.tipo === 'sucesso' ? '#2ecc71' : '#ff4b4b', fontWeight: 'bold' }}>
          {mensagem.texto}
        </div>
      )}

      {isLoading ? <p>A carregar o perfil...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          <div className="input-area" style={{ backgroundColor: '#1e2229', border: '1px solid #4a505c' }}>
            <h3 style={{ color: '#61dafb', marginTop: 0 }}>👤 Os Seus Dados</h3>
            
            {!isEditingCredentials ? (
              <>
                <p><strong>E-mail de Acesso:</strong> {perfil.email}</p>
                <button onClick={() => setIsEditingCredentials(true)} style={{ padding: '8px 15px', backgroundColor: 'transparent', border: '1px solid #61dafb', color: '#61dafb', borderRadius: '5px', cursor: 'pointer', marginTop: '10px' }}>
                  ✏️ Alterar E-mail ou Senha
                </button>
              </>
            ) : (
              <form onSubmit={handleSalvarCredenciais} style={{ marginTop: '15px', padding: '15px', backgroundColor: '#282c34', borderRadius: '8px', border: '1px dashed #61dafb' }}>
                <p style={{ color: '#9ab', fontSize: '0.9em', marginTop: 0 }}>Preencha apenas o que deseja alterar.</p>
                
                <div style={{ marginBottom: '10px' }}>
                  <label>Novo E-mail</label>
                  <input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} placeholder={perfil.email} style={{ width: '100%', padding: '10px', borderRadius: '5px', backgroundColor: '#1e2229', color: 'white', border: '1px solid #4a505c', marginTop: '5px' }} />
                </div>
                
                <div style={{ marginBottom: '15px' }}>
                  <label>Nova Senha</label>
                  <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Deixe em branco para não alterar" minLength="6" style={{ width: '100%', padding: '10px', borderRadius: '5px', backgroundColor: '#1e2229', color: 'white', border: '1px solid #4a505c', marginTop: '5px' }} />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="main-button" style={{ margin: 0 }}>💾 Salvar Alterações</button>
                  <button type="button" onClick={() => { setIsEditingCredentials(false); setNovoEmail(''); setNovaSenha(''); }} style={{ padding: '10px 20px', backgroundColor: 'transparent', border: '1px solid #ff4b4b', color: '#ff4b4b', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>
                </div>
              </form>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

export default GerenciarPerfil;