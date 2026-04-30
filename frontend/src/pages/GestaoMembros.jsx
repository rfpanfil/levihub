// arquivo: frontend/src/pages/GestaoMembros.jsx
import React, { useState, useEffect } from 'react';

import { API_BASE_URL } from '../services/config';


function GestaoMembros() {
  const [membros, setMembros] = useState([]);
  const [funcoesObjetos, setFuncoesObjetos] = useState([]);
  const [funcoesDisponiveis, setFuncoesDisponiveis] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados do Formulário de Membros
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('ativo');
  const [funcoesSelecionadas, setFuncoesSelecionadas] = useState([]);
  
  // Estado para Criação Rápida de Função no Modal de Membro
  const [novaFuncaoInline, setNovaFuncaoInline] = useState('');

  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });

  // Estados do Modal de Funções (CRUD)
  const [isFuncoesModalOpen, setIsFuncoesModalOpen] = useState(false);
  const [novaFuncaoNome, setNovaFuncaoNome] = useState('');
  const [novaFuncaoMembrosSelecionados, setNovaFuncaoMembrosSelecionados] = useState([]);
  const [editandoFuncaoId, setEditandoFuncaoId] = useState(null);
  const [editandoFuncaoNome, setEditandoFuncaoNome] = useState('');
  const [isSavingFuncao, setIsSavingFuncao] = useState(false); // NOVO: LOADING DE SALVAR

  // --- NOVOS ESTADOS: ORDENAÇÃO E FUNÇÕES PADRÃO ---
  const [funcoesPadrao, setFuncoesPadrao] = useState([]);
  const [isReordering, setIsReordering] = useState(() => JSON.parse(localStorage.getItem('isReordering')) || false);
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);

  useEffect(() => {
    localStorage.setItem('isReordering', JSON.stringify(isReordering));
  }, [isReordering]);

  const handleDragStart = (index) => setDraggedItemIndex(index);
  
  const handleDragEnter = (index) => {
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    const newOrder = [...funcoesPadrao];
    const item = newOrder.splice(draggedItemIndex, 1)[0];
    newOrder.splice(index, 0, item);
    setDraggedItemIndex(index);
    setFuncoesPadrao(newOrder);
  };
  
  const handleDragEnd = async () => {
    setDraggedItemIndex(null);
    const token = localStorage.getItem('token');
    const stringPadrao = funcoesPadrao.join(',');
    try {
      await fetch(`${API_BASE_URL}/usuario/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ funcoes_padrao: stringPadrao })
      });
    } catch (error) {}
  };

  const handleToggleFuncaoPadrao = async (funcaoNome) => {
    const token = localStorage.getItem('token');
    const novoArray = funcoesPadrao.includes(funcaoNome)
      ? funcoesPadrao.filter(f => f !== funcaoNome)
      : [...funcoesPadrao, funcaoNome];
      
    const stringPadrao = novoArray.join(',');

    try {
      const res = await fetch(`${API_BASE_URL}/usuario/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ funcoes_padrao: stringPadrao })
      });
      if (res.ok) setFuncoesPadrao(novoArray);
    } catch (error) { mostrarMensagem("Erro ao salvar padrão.", "erro"); }
  };

  const carregarDados = async () => {
    const token = localStorage.getItem('token');
    if (!token) return; 

    setIsLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [resEquipe, resFuncoes, resPerfil] = await Promise.all([
        fetch(`${API_BASE_URL}/equipe?apenas_ativos=false`, { headers }), 
        fetch(`${API_BASE_URL}/funcoes`, { headers }),
        fetch(`${API_BASE_URL}/usuario/me`, { headers })
      ]);
      
      const dataEquipe = await resEquipe.json();
      const dataFuncoes = await resFuncoes.json();

      if (dataEquipe.equipe) setMembros(dataEquipe.equipe);
      if (dataFuncoes.funcoes) {
        setFuncoesObjetos(dataFuncoes.funcoes);
        setFuncoesDisponiveis(dataFuncoes.funcoes.map(f => f.nome));
      }
      if (resPerfil.ok) {
        const dataPerfil = await resPerfil.json();
        setFuncoesPadrao(dataPerfil.funcoes_padrao ? dataPerfil.funcoes_padrao.split(',') : []);
      }
      
    } catch (error) {
      mostrarMensagem("Erro ao carregar dados.", "erro");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const mostrarMensagem = (texto, tipo) => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem({ texto: '', tipo: '' }), 4000);
  };

  // --- LÓGICA DE MEMBROS ---
  const abrirModalNovo = () => {
    setNome(''); setTelefone(''); setEmail(''); setStatus('ativo'); 
    setFuncoesSelecionadas([]); setNovaFuncaoInline('');
    setIsEditing(false); setEditId(null); setIsModalOpen(true);
  };

  const handleToggleFuncao = (funcaoNome) => {
    setFuncoesSelecionadas(prev => prev.includes(funcaoNome) ? prev.filter(f => f !== funcaoNome) : [...prev, funcaoNome]);
  };

  // Lógica BLINDADA e OTIMISTA de Adicionar Função
  const handleAdicionarFuncaoInline = async () => {
    const nomeFuncao = novaFuncaoInline.trim();
    if (!nomeFuncao) return;
    
    const token = localStorage.getItem('token');
    
    // 1. Verifica se já existe para evitar duplicidade
    if (funcoesDisponiveis.some(f => f.toLowerCase() === nomeFuncao.toLowerCase())) {
        if (!funcoesSelecionadas.includes(nomeFuncao)) {
             setFuncoesSelecionadas(prev => [...prev, nomeFuncao]);
        }
        setNovaFuncaoInline('');
        return;
    }

    // 2. ATUALIZAÇÃO OTIMISTA: Coloca na tela instantaneamente para o utilizador!
    setFuncoesSelecionadas(prev => [...prev, nomeFuncao]);
    setFuncoesDisponiveis(prev => [...prev, nomeFuncao]);
    setNovaFuncaoInline('');

    try {
      // 3. Salva no banco de dados em segundo plano
      const res = await fetch(`${API_BASE_URL}/funcoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ nome: nomeFuncao, membros_ids: [] })
      });
      const data = await res.json();
      
      // Se houver um erro real (diferente do falso positivo "'result'" do Turso), nós avisamos.
      if (!res.ok || (data.error && data.error !== "'result'")) {
        mostrarMensagem(`Aviso: Falha ao sincronizar na nuvem.`, "erro");
      }
    } catch (error) {
      console.error("Erro de conexão silencioso:", error);
    }
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!nome.trim()) { mostrarMensagem("O nome é obrigatório!", "erro"); return; }

    const payload = { nome, telefone, email, status, funcoes: funcoesSelecionadas };

    try {
      const url = isEditing ? `${API_BASE_URL}/equipe/${editId}` : `${API_BASE_URL}/equipe`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method, 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && !data.error) {
        mostrarMensagem(isEditing ? "Membro atualizado!" : "Membro adicionado!", "sucesso");
        setIsModalOpen(false);
        carregarDados(); 
      } else {
        mostrarMensagem(`Erro: ${data.error || 'Falha ao salvar membro'}`, "erro");
      }
    } catch (error) { mostrarMensagem("Erro de conexão ao salvar membro.", "erro"); }
  };

  const handleEditar = (membro) => {
    setNome(membro.nome); setTelefone(membro.telefone || ''); setEmail(membro.email || '');
    setStatus(membro.status || 'ativo'); setFuncoesSelecionadas(membro.funcoes || []);
    setNovaFuncaoInline('');
    setEditId(membro.id); setIsEditing(true); setIsModalOpen(true);
  };

  const handleExcluir = async (id) => {
    if (!window.confirm("Tem a certeza que deseja excluir este membro permanentemente?")) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/equipe/${id}`, { 
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        mostrarMensagem("Membro excluído com sucesso!", "sucesso");
        carregarDados();
      } else {
        mostrarMensagem(`Erro: ${data.error}`, "erro");
      }
    } catch (error) { mostrarMensagem("Erro ao excluir membro.", "erro"); }
  };

  // --- LÓGICA DE FUNÇÕES (CRUD) ---
  const handleToggleMembroNovaFuncao = (membroId) => {
    setNovaFuncaoMembrosSelecionados(prev => prev.includes(membroId) ? prev.filter(id => id !== membroId) : [...prev, membroId]);
  };

  const handleSalvarNovaFuncao = async () => {
    const token = localStorage.getItem('token');
    if (!novaFuncaoNome.trim()) { mostrarMensagem("O nome da função não pode estar vazio.", "erro"); return; }
    
    setIsSavingFuncao(true); // LIGA O LOADING
    try {
      const res = await fetch(`${API_BASE_URL}/funcoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ nome: novaFuncaoNome.trim(), membros_ids: novaFuncaoMembrosSelecionados })
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        setNovaFuncaoNome('');
        setNovaFuncaoMembrosSelecionados([]);
        mostrarMensagem("Função criada com sucesso!", "sucesso");
        carregarDados();
      } else {
        mostrarMensagem(`Erro: ${data.error}`, "erro");
      }
    } catch (error) { 
      mostrarMensagem("Erro ao criar função.", "erro"); 
    } finally {
      setIsSavingFuncao(false); // DESLIGA O LOADING
    }
  };

  const handleExcluirFuncao = async (id) => {
    if (!window.confirm("Excluir esta função vai removê-la de todos os membros. Continuar?")) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/funcoes/${id}`, { 
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        mostrarMensagem("Função excluída!", "sucesso");
        carregarDados();
      }
    } catch (error) { mostrarMensagem("Erro ao excluir função.", "erro"); }
  };

  const handleSalvarEdicaoFuncao = async (id) => {
    const token = localStorage.getItem('token');
    if (!editandoFuncaoNome.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/funcoes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ nome: editandoFuncaoNome.trim() })
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        setEditandoFuncaoId(null);
        carregarDados();
      }
    } catch (error) { mostrarMensagem("Erro ao editar função.", "erro"); }
  };

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '5px', backgroundColor: '#282c34', color: 'white', border: '1px solid #4a505c', marginTop: '5px' };

  // ESTILO DO AVISO FLUTUANTE (Para você sempre ver se deu erro ou sucesso!)
  const toastStyle = {
    position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 99999,
    padding: '12px 25px', borderRadius: '8px', color: 'white', fontWeight: 'bold',
    boxShadow: '0 4px 15px rgba(0,0,0,0.4)', transition: 'all 0.3s ease',
    backgroundColor: mensagem.tipo === 'sucesso' ? '#2ecc71' : '#e74c3c',
    display: mensagem.texto ? 'block' : 'none'
  };

  return (
    <div className="gerador-escala-container">
      
      {/* NOTIFICAÇÃO FLUTUANTE (Mágica que aparece por cima de todos os modais) */}
      <div style={toastStyle}>
        {mensagem.tipo === 'sucesso' ? '✅' : '⚠️'} {mensagem.texto}
      </div>

      {/* --- CABEÇALHO COM BOTÕES --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <h2>👥 Gestão de Membros</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setIsFuncoesModalOpen(true)} style={{ padding: '12px 20px', backgroundColor: 'transparent', border: '2px solid #61dafb', color: '#61dafb', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            ⚙️ Gerenciar Funções
          </button>
          <button onClick={abrirModalNovo} className="main-button" style={{ margin: 0, width: 'auto' }}>
            ➕ Adicionar Membro
          </button>
        </div>
      </div>

      {/* --- BLOCO DE ORDENAÇÃO DE FUNÇÕES PADRÃO --- */}
      {!isLoading && (
        <div className="input-area" style={{ backgroundColor: '#1e2229', border: '1px solid #f39c12', marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ color: '#f39c12', margin: 0 }}>📅 Funções Padrão da Escala</h3>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#61dafb', fontSize: '0.95em', fontWeight: 'bold' }}>
                <input type="checkbox" checked={isReordering} onChange={() => setIsReordering(!isReordering)} style={{ marginRight: '8px' }} />
                Mudar Ordem (Arrastar)
            </label>
          </div>
          <p style={{ marginTop: '10px' }}>{isReordering ? "Arraste as funções abaixo para definir a ordem no Gerador de Escalas." : "Selecione as funções que devem aparecer automaticamente ao gerar uma nova escala."}</p>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '15px', padding: '15px', backgroundColor: '#282c34', borderRadius: '8px', border: '1px solid #4a505c' }}>
            {funcoesDisponiveis.length === 0 ? (
              <p style={{ color: '#9ab', fontStyle: 'italic', margin: 0 }}>Nenhuma função cadastrada. Clique em "Gerenciar Funções" acima!</p>
            ) : isReordering ? (
              <>
                {funcoesPadrao.map((f, idx) => (
                  <label 
                      key={`drag-${idx}`} 
                      draggable
                      onDragStart={(e) => { handleDragStart(idx); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnter={() => handleDragEnter(idx)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      style={{ 
                          display: 'flex', alignItems: 'center', cursor: 'grab', 
                          backgroundColor: 'rgba(243, 156, 18, 0.2)', 
                          border: '1px dashed #f39c12', color: '#f39c12',
                          padding: '8px 12px', borderRadius: '15px', fontSize: '0.95em', fontWeight: 'bold', transition: 'all 0.2s ease'
                      }}>
                      <span style={{ marginRight: '10px', cursor: 'grab', color: '#9ab', fontSize: '1.2em' }}>☰</span>
                      <input type="checkbox" checked={true} onChange={() => handleToggleFuncaoPadrao(f)} style={{ marginRight: '8px', cursor: 'pointer' }} />
                      {f}
                  </label>
                ))}
                {funcoesDisponiveis.filter(f => !funcoesPadrao.includes(f)).map((f, idx) => (
                  <label key={`inactive-${idx}`} style={{ 
                    display: 'flex', alignItems: 'center', cursor: 'pointer', backgroundColor: '#3c414d', 
                    border: '1px solid transparent', color: 'white', opacity: 0.6,
                    padding: '8px 12px', borderRadius: '15px', fontSize: '0.95em', fontWeight: 'normal', transition: 'all 0.2s ease'
                  }}>
                    <input type="checkbox" checked={false} onChange={() => handleToggleFuncaoPadrao(f)} style={{ marginRight: '8px', cursor: 'pointer' }} />
                    {f}
                  </label>
                ))}
              </>
            ) : (
              funcoesDisponiveis.map((f, idx) => {
                const isActive = funcoesPadrao.includes(f);
                return (
                  <label key={idx} style={{ 
                    display: 'flex', alignItems: 'center', cursor: 'pointer', 
                    backgroundColor: isActive ? 'rgba(243, 156, 18, 0.2)' : '#3c414d', 
                    border: isActive ? '1px solid #f39c12' : '1px solid transparent',
                    color: isActive ? '#f39c12' : 'white',
                    padding: '8px 12px', borderRadius: '15px', fontSize: '0.95em', fontWeight: isActive ? 'bold' : 'normal', transition: 'all 0.2s ease'
                  }}>
                    <input type="checkbox" checked={isActive} onChange={() => handleToggleFuncaoPadrao(f)} style={{ marginRight: '8px', cursor: 'pointer' }} />
                    {f}
                  </label>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* --- LISTA DE MEMBROS (MANTIDA IGUAL) --- */}
      <div className="input-area">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '1.1em', fontWeight: 'bold' }}>Total: {membros.length} cadastrados</span>
          <span style={{ fontSize: '0.9em', color: '#9ab' }}>{membros.filter(m => m.status === 'ativo').length} Ativos | {membros.filter(m => m.status === 'inativo').length} Inativos</span>
        </div>

        {isLoading ? ( <p>A carregar base de dados...</p> ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
            {membros.map(membro => (
              <div key={membro.id} style={{ backgroundColor: '#282c34', padding: '15px', borderRadius: '8px', borderLeft: `4px solid ${membro.status === 'ativo' ? '#2ecc71' : '#ff4b4b'}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <strong style={{ fontSize: '1.2em', color: 'white' }}>{membro.nome}</strong>
                    <span style={{ fontSize: '0.7em', padding: '3px 8px', borderRadius: '10px', backgroundColor: membro.status === 'ativo' ? 'rgba(46,204,113,0.1)' : 'rgba(231,76,60,0.1)', color: membro.status === 'ativo' ? '#2ecc71' : '#ff4b4b' }}>
                      {membro.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85em', color: '#9ab', marginTop: '10px' }}>
                    <div>📞 {membro.telefone || 'Sem contacto'}</div>
                    <div>✉️ {membro.email || 'Sem e-mail'}</div>
                  </div>
                  <div style={{ fontSize: '0.8em', color: '#61dafb', marginTop: '10px', fontStyle: 'italic' }}>
                    {membro.funcoes.length > 0 ? membro.funcoes.join(' • ') : 'Nenhuma função atribuída'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #4a505c' }}>
                  <button onClick={() => handleEditar(membro)} style={{ flex: 1, padding: '5px', backgroundColor: 'transparent', border: '1px solid #61dafb', color: '#61dafb', borderRadius: '4px', cursor: 'pointer' }}>✏️ Editar</button>
                  <button onClick={() => handleExcluir(membro.id)} style={{ flex: 1, padding: '5px', backgroundColor: 'transparent', border: '1px solid #ff4b4b', color: '#ff4b4b', borderRadius: '4px', cursor: 'pointer' }}>🗑️ Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- MODAL (POP-UP) DE MEMBROS --- */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #4a505c', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0 }}>{isEditing ? '✏️ Editar Membro' : '➕ Adicionar Novo Membro'}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ab', fontSize: '1.5em', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <form onSubmit={handleSalvar}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                <div><label>Nome Completo *</label><input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Lucas Silva" style={inputStyle} required /></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                  <div><label>Telefone / WhatsApp</label><input type="text" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(DD) 99999-9999" style={inputStyle} /></div>
                  <div><label>E-mail</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" style={inputStyle} /></div>
                </div>
                <div>
                  <label>Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, backgroundColor: status === 'ativo' ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)', color: status === 'ativo' ? '#2ecc71' : '#e74c3c', fontWeight: 'bold' }}>
                    <option value="ativo">✅ Ativo na Escala</option>
                    <option value="inativo">⏸️ Inativo (Pausa)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <label>Funções / Instrumentos na Banda</label>
                
                {/* --- INPUT DE CRIAÇÃO RÁPIDA DE FUNÇÃO --- */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '5px', marginBottom: '10px' }}>
                    <input 
                      type="text" 
                      value={novaFuncaoInline} 
                      onChange={e => setNovaFuncaoInline(e.target.value)} 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault(); // Impede o modal de fechar acidentalmente
                          handleAdicionarFuncaoInline();
                        }
                      }}
                      placeholder="Criar nova função (Ex: Violão, Bateria...)" 
                      style={{ flex: 1, padding: '10px', borderRadius: '5px', backgroundColor: '#1e2229', color: 'white', border: '1px solid #f39c12' }} 
                    />
                    <button type="button" onClick={handleAdicionarFuncaoInline} style={{ padding: '0 20px', backgroundColor: '#f39c12', color: '#1e2229', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
                      Adicionar
                    </button>
                </div>

                {funcoesDisponiveis.length === 0 ? (
                    <p style={{ color: '#9ab', fontSize: '0.9em', fontStyle: 'italic' }}>Nenhuma função cadastrada. Crie uma acima!</p>
                ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '15px', backgroundColor: '#282c34', borderRadius: '8px', border: '1px solid #4a505c' }}>
                    {funcoesDisponiveis.map((f, idx) => (
                        <label key={idx} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', backgroundColor: '#3c414d', padding: '5px 10px', borderRadius: '15px', fontSize: '0.9em' }}>
                        <input type="checkbox" checked={funcoesSelecionadas.includes(f)} onChange={() => handleToggleFuncao(f)} style={{ marginRight: '8px' }} />
                        {f}
                        </label>
                    ))}
                    </div>
                )}
              </div>

              <div style={{ marginTop: '25px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 20px', backgroundColor: 'transparent', border: '1px solid #ff4b4b', color: '#ff4b4b', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" className="main-button" style={{ margin: 0, width: 'auto' }}>{isEditing ? '💾 Guardar Alterações' : '➕ Salvar Membro'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- NOVO MODAL: GERENCIAR FUNÇÕES --- */}
      {isFuncoesModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #4a505c', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0 }}>⚙️ Gerenciar Funções / Instrumentos</h2>
              <button onClick={() => setIsFuncoesModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ab', fontSize: '1.5em', cursor: 'pointer' }}>&times;</button>
            </div>

            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
              {/* Coluna 1: Lista de Funções */}
              <div style={{ flex: 1, minWidth: '300px' }}>
                <h3>Funções Existentes</h3>
                <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                  {funcoesObjetos.map(f => (
                    <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#282c34', padding: '10px', marginBottom: '8px', borderRadius: '5px', border: '1px solid #4a505c' }}>
                      {editandoFuncaoId === f.id ? (
                        <div style={{ display: 'flex', gap: '5px', width: '100%' }}>
                          <input type="text" value={editandoFuncaoNome} onChange={e => setEditandoFuncaoNome(e.target.value)} style={{ flex: 1, padding: '5px', borderRadius: '3px', border: '1px solid #61dafb', backgroundColor: '#1e2229', color: 'white' }} />
                          <button onClick={() => handleSalvarEdicaoFuncao(f.id)} style={{ backgroundColor: '#2ecc71', border: 'none', borderRadius: '3px', padding: '5px 10px', cursor: 'pointer', color: 'white' }}>OK</button>
                          <button onClick={() => setEditandoFuncaoId(null)} style={{ backgroundColor: '#e74c3c', border: 'none', borderRadius: '3px', padding: '5px 10px', cursor: 'pointer', color: 'white' }}>X</button>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontWeight: 'bold' }}>{f.nome}</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => { setEditandoFuncaoId(f.id); setEditandoFuncaoNome(f.nome); }} style={{ background: 'none', border: 'none', color: '#61dafb', cursor: 'pointer', fontSize: '1.2em' }} title="Editar">✏️</button>
                            <button onClick={() => handleExcluirFuncao(f.id)} style={{ background: 'none', border: 'none', color: '#ff4b4b', cursor: 'pointer', fontSize: '1.2em' }} title="Excluir">🗑️</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Coluna 2: Criar Nova Função */}
              <div style={{ flex: 1, minWidth: '300px', backgroundColor: '#282c34', padding: '20px', borderRadius: '8px', border: '1px solid #4a505c' }}>
                <h3>Criar Nova Função</h3>
                <label>Nome do Instrumento/Voz</label>
                <input type="text" value={novaFuncaoNome} onChange={e => setNovaFuncaoNome(e.target.value)} placeholder="Ex: Violino, Voz 1..." style={inputStyle} />
                
                <div style={{ marginTop: '20px' }}>
                  <label>Atrelar Membros a esta Função (Opcional)</label>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', backgroundColor: '#1e2229', padding: '10px', borderRadius: '5px', border: '1px solid #4a505c', marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {membros.map(m => (
                      <label key={m.id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.9em' }}>
                        <input type="checkbox" checked={novaFuncaoMembrosSelecionados.includes(m.id)} onChange={() => handleToggleMembroNovaFuncao(m.id)} style={{ marginRight: '10px' }} />
                        {m.nome}
                      </label>
                    ))}
                  </div>
                </div>

                <button onClick={handleSalvarNovaFuncao} className="main-button" style={{ marginTop: '20px', opacity: isSavingFuncao ? 0.7 : 1 }} disabled={isSavingFuncao}>
                  {isSavingFuncao ? '⏳ Salvando...' : '➕ Salvar Nova Função'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default GestaoMembros;