// src/GerenciarPerfil.jsx

import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

function GerenciarPerfil() {
  const [perfil, setPerfil] = useState({ email: '', funcoes_padrao: [] });
  const [funcoesDisponiveis, setFuncoesDisponiveis] = useState([]);
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
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [resPerfil, resFuncoes] = await Promise.all([
        fetch(`${API_BASE_URL}/usuario/me`, { headers }),
        fetch(`${API_BASE_URL}/funcoes`, { headers })
      ]);

      if (resPerfil.ok && resFuncoes.ok) {
        const dataPerfil = await resPerfil.json();
        const dataFuncoes = await resFuncoes.json();
        
        // As funções padrão vêm como uma string separada por vírgula. Vamos transformar em array.
        const funcoesPadraoArray = dataPerfil.funcoes_padrao ? dataPerfil.funcoes_padrao.split(',') : [];
        
        setPerfil({ ...dataPerfil, funcoes_padrao: funcoesPadraoArray });
        setFuncoesDisponiveis(dataFuncoes.funcoes.map(f => f.nome));
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

  const handleToggleFuncaoPadrao = async (funcaoNome) => {
    const token = localStorage.getItem('token');
    
    // Adiciona se não existe, remove se já existe
    const novoArray = perfil.funcoes_padrao.includes(funcaoNome)
      ? perfil.funcoes_padrao.filter(f => f !== funcaoNome)
      : [...perfil.funcoes_padrao, funcaoNome];
      
    // Transforma o array numa string para enviar ao backend
    const stringPadrao = novoArray.join(',');

    try {
      const res = await fetch(`${API_BASE_URL}/usuario/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ funcoes_padrao: stringPadrao })
      });

      if (res.ok) {
        setPerfil(prev => ({ ...prev, funcoes_padrao: novoArray }));
      }
    } catch (error) { mostrarMensagem("Erro ao salvar padrão de escala.", "erro"); }
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

          {/* O BLOCO DO CÉREBRO FOI REMOVIDO DAQUI E MOVIDO PARA O LEVIROBOTO */}

          <div className="input-area" style={{ backgroundColor: '#1e2229', border: '1px solid #f39c12' }}>
            <h3 style={{ color: '#f39c12', marginTop: 0 }}>📅 Funções Padrão da Escala</h3>
            <p>Selecione as funções/instrumentos que devem aparecer automaticamente em todos os dias quando você gerar uma nova escala.</p>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '15px', padding: '15px', backgroundColor: '#282c34', borderRadius: '8px', border: '1px solid #4a505c' }}>
              {funcoesDisponiveis.length === 0 ? (
                <p style={{ color: '#9ab', fontStyle: 'italic', margin: 0 }}>Nenhuma função cadastrada. Vá em Gestão de Membros para criar!</p>
              ) : (
                funcoesDisponiveis.map((f, idx) => {
                  const isActive = perfil.funcoes_padrao.includes(f);
                  return (
                    <label key={idx} style={{ 
                      display: 'flex', alignItems: 'center', cursor: 'pointer', 
                      backgroundColor: isActive ? 'rgba(243, 156, 18, 0.2)' : '#3c414d', 
                      border: isActive ? '1px solid #f39c12' : '1px solid transparent',
                      color: isActive ? '#f39c12' : 'white',
                      padding: '8px 12px', borderRadius: '15px', fontSize: '0.95em', fontWeight: isActive ? 'bold' : 'normal', transition: 'all 0.2s ease'
                    }}>
                      <input 
                        type="checkbox" 
                        checked={isActive} 
                        onChange={() => handleToggleFuncaoPadrao(f)} 
                        style={{ marginRight: '8px', cursor: 'pointer' }} 
                      />
                      {f}
                    </label>
                  )
                })
              )}
            </div>
            <p style={{ fontSize: '0.85em', color: '#9ab', marginTop: '10px', fontStyle: 'italic' }}>
              Nota: Alterações aqui serão refletidas na próxima vez que abrir o Gerador de Escalas. (Salvo automaticamente ao clicar).
            </p>
          </div>

        </div>
      )}
    </div>
  );
}

export default GerenciarPerfil;