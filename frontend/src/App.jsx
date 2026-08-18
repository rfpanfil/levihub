// arquivo: frontend/src/App.jsx

import React, { useState, useRef, useEffect } from 'react';
import mammoth from 'mammoth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import NumberInput from './components/NumberInput';
import ToggleSwitch from './components/ToggleSwitch';
import DragDropOverlay from './components/DragDropOverlay';
import GeradorEscala from './pages/GeradorEscala';
import LeviRoboto from './pages/LeviRoboto';
import Login from './pages/Login';
import GestaoMembros from './pages/GestaoMembros';
import GerenciarPerfil from './pages/GerenciarPerfil';
import GerenciarRepertorio from './pages/GerenciarRepertorio';
import AdminPanel from './pages/AdminPanel';
// Importamos a lógica local para usar APENAS se a API falhar
import { calcularSequenciaLocal, processarCifraCompleta } from './utils/musicLogic';
import { Music, Calendar, Users, Bot, Guitar, UserCircle, Settings, LogOut, Menu, KeyRound } from 'lucide-react';
import './App.css';


import { apiFetch } from './services/api';


function App() {
  const [activeTab, setActiveTab] = useState('sequence');
  const [interval, setInterval] = useState(1.0);
  const [action, setAction] = useState('Aumentar');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Estados da Sequência
  const [sequenceText, setSequenceText] = useState('');
  const [sequenceResult, setSequenceResult] = useState(null);

  // Estados da Cifra
  const [cifraText, setCifraText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [transposedCifra, setTransposedCifra] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Indicador visual se estamos usando o modo offline (backup)
  const [usingOfflineMode, setUsingOfflineMode] = useState(false);

  const dragCounter = useRef(0);
  const fileStatusRef = useRef(null);

  // Memória da última aba acessada
  const [appMode, setAppMode] = useState(() => localStorage.getItem('lastAppMode') || 'transpositor');
  
  useEffect(() => {
    localStorage.setItem('lastAppMode', appMode);
  }, [appMode]);

  const queryClient = useQueryClient();
  const [isVisitor, setIsVisitor] = useState(false);

  // --- BUSCA DO USUÁRIO VIA REACT QUERY ---
  const { data: user, isLoading: isAuthLoading } = useQuery({
    queryKey: ['usuario'],
    queryFn: async () => {
      const res = await apiFetch('/usuario/me');
      if (!res.ok) throw new Error('Não autenticado');
      return res.json();
    },
    retry: false,
    staleTime: 1000 * 60 * 60, // 1 hora
  });

  const handleLoginAction = (userData) => {
    if (userData === null) {
      setIsVisitor(true);
    } else {
      queryClient.invalidateQueries(['usuario']); // Força recarregamento da query
      setIsVisitor(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error("Erro no logout remoto", e);
    }
    queryClient.setQueryData(['usuario'], null); // Limpa o cache
    setIsVisitor(false);
  };

  useEffect(() => {
    if (selectedFile && fileStatusRef.current) {
      fileStatusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedFile]);

  // Função auxiliar para ler arquivos localmente (usada no Fallback)
  const lerArquivoLocal = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          if (file.name.endsWith('.docx')) {
            const arrayBuffer = e.target.result;
            const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            resolve(result.value);
          } else {
            resolve(e.target.result);
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      if (file.name.endsWith('.docx')) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  // --- 1. SEQUÊNCIA (HÍBRIDO) ---
  const handleSequenceTranspose = async () => {
    setIsLoading(true);
    setError('');
    setSequenceResult(null);
    setUsingOfflineMode(false); // Reseta o aviso

    const chords = sequenceText.trim().split(/\s+/).filter(c => c);
    if (chords.length === 0) {
      setError('Por favor, insira uma sequência de acordes.');
      setIsLoading(false);
      return;
    }

    try {
      // TENTA A API (PLAN A)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos max

      const response = await apiFetch('/transpose-sequence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chords, action, interval }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Falha na API');

      const data = await response.json();
      setSequenceResult(data);

    } catch (err) {
      // SE FALHAR, USA LOCAL (PLAN B)
      console.log("API indisponível ou lenta. Usando modo offline.", err);
      setUsingOfflineMode(true);

      const data = calcularSequenciaLocal(chords, action, interval);
      setSequenceResult(data);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 2. CIFRA COMPLETA E ARQUIVOS (HÍBRIDO) ---
  const handleCifraTranspose = async () => {
    setIsLoading(true);
    setError('');
    setTransposedCifra('');
    setUsingOfflineMode(false);

    // Validação básica
    if (!cifraText && !selectedFile) {
      setError('O texto ou arquivo está vazio.');
      setIsLoading(false);
      return;
    }

    try {
      // TENTA A API (PLAN A)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s para arquivos (pode demorar mais)

      let response;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('action', action);
        formData.append('interval', interval);

        response = await apiFetch('/transpose-file', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
      } else {
        response = await apiFetch('/transpose-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cifra_text: cifraText, action, interval }),
          signal: controller.signal
        });
      }

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Falha na API');
      
      // Verifica se a resposta é um arquivo (DOCX)
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/vnd.openxmlformats")) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        let actionText = action === 'Aumentar' ? 'Acima' : 'Abaixo';
        let intervalText = interval.toString().replace('.', ',');
        let prefix = `Transposto_${intervalText}_Tom_${actionText}_`;
        if (interval > 1) {
            prefix = `Transposto_${intervalText}_Tons_${actionText}_`;
        }
        
        a.download = `${prefix}${selectedFile.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        setTransposedCifra("🎉 Arquivo DOCX transposto e baixado com sucesso! Verifique a sua pasta de downloads.");
        setIsLoading(false);
        return;
      }

      // Se for JSON normal (texto)
      const data = await response.json();
      setTransposedCifra(data.transposed_cifra);

    } catch (err) {
      // SE FALHAR, USA LOCAL (PLAN B)
      console.log("API falhou. Ativando processamento local de arquivo/texto.", err);
      setUsingOfflineMode(true);

      try {
        let textToProcess = cifraText;

        // Se for arquivo, precisamos ler ele localmente agora
        if (selectedFile) {
          textToProcess = await lerArquivoLocal(selectedFile);
        }

        if (!textToProcess || !textToProcess.trim()) {
          throw new Error("Conteúdo vazio para processamento offline.");
        }

        const resultado = processarCifraCompleta(textToProcess, action, interval);
        setTransposedCifra(resultado);

      } catch (localErr) {
        console.error(localErr);
        setError("Erro fatal: API indisponível e falha ao processar localmente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(transposedCifra);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([transposedCifra], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cifra_transposta.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearCifra = () => {
    setCifraText('');
    setSelectedFile(null);
    setTransposedCifra('');
    setError('');
    setUsingOfflineMode(false);
    if (document.getElementById('file-upload')) {
      document.getElementById('file-upload').value = null;
    }
  };

  // Drag and Drop Logic
  const handleDragEnter = (e) => {
    e.preventDefault(); e.stopPropagation(); dragCounter.current++;
    if (activeTab === 'cifra') setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault(); e.stopPropagation(); dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false); dragCounter.current = 0;
    if (activeTab === 'cifra') {
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.txt') || file.name.endsWith('.docx'))) {
        setSelectedFile(file);
        setCifraText('');
      } else {
        setError('Por favor, solte apenas arquivos .txt ou .docx');
      }
    }
  };

  const actionOptions = [
    { label: 'Aumentar', value: 'Aumentar' },
    { label: 'Diminuir', value: 'Diminuir' }
  ];

  // --- LÓGICA DE BLOQUEIO E LOADING ---
  if (isAuthLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#282c34', color: '#61dafb', flexDirection: 'column' }}>
        <h2>⏳ Carregando sistema...</h2>
      </div>
    );
  }

  if (!user && !isVisitor) {
    return <Login onLogin={handleLoginAction} />;
  }

  return (
    <div className="AppLayout" onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>
      {isDragging && <DragDropOverlay />}

      {/* --- TOP BAR (Desktop e Mobile) --- */}
      <header className="top-bar glass-panel">
        <div className="logo-area">
          <Music className="logo-icon" size={24} />
          <span className="logo-text">LeviHub</span>
        </div>
        <div className="top-actions">
          {!isVisitor && (
            <button onClick={handleLogout} className="top-btn-logout">
              <LogOut size={18} /> <span className="hide-on-mobile">Sair</span>
            </button>
          )}
          {isVisitor && (
            <button onClick={() => setAppMode('login')} className="top-btn-login">
              <KeyRound size={18} /> <span className="hide-on-mobile">Entrar</span>
            </button>
          )}
        </div>
      </header>
      

      {/* --- NAVEGAÇÃO PRINCIPAL (Bottom Nav no Mobile / Sidebar no Desktop) --- */}
      <nav className="app-navigation glass-panel">
        <button
          className={`nav-item ${appMode === 'transpositor' ? 'active' : ''}`}
          onClick={() => { setAppMode('transpositor'); }}
        >
          <Music size={22} />
          <span>Transpositor</span>
        </button>
        
        <button
          className={`nav-item ${appMode === 'escala' ? 'active' : ''}`}
          onClick={() => { setAppMode('escala'); }}
        >
          <Calendar size={22} />
          <span>Escalas</span>
        </button>

        {isVisitor && (
          <button
            className={`nav-item ${appMode === 'repertorio' ? 'active' : ''}`}
            onClick={() => { setAppMode('repertorio'); }}
          >
            <Bot size={22} />
            <span>Levi Roboto</span>
          </button>
        )}

        {!isVisitor && (
          <button
            className={`nav-item ${appMode === 'meu_repertorio' ? 'active' : ''}`}
            onClick={() => { setAppMode('meu_repertorio'); }}
          >
            <Guitar size={22} />
            <span>Repertório</span>
          </button>
        )}

        {!isVisitor && (
          <button className={`nav-item ${appMode === 'repertorio' ? 'active' : ''}`} onClick={() => { setAppMode('repertorio'); }}>
            <Bot size={22} />
            <span>Levi Roboto</span>
          </button>
        )}
        
        <button className={`nav-item ${appMode === 'membros' ? 'active' : ''}`} onClick={() => { setAppMode('membros'); }}>
          <Users size={22} />
          <span>Membros</span>
        </button>
        
        {!isVisitor && (
          <button className={`nav-item ${appMode === 'perfil' ? 'active' : ''}`} onClick={() => { setAppMode('perfil'); }}>
            <UserCircle size={22} />
            <span>Perfil</span>
          </button>
        )}
        
        {!isVisitor && user?.role === 'admin' && (
          <button className={`nav-item ${appMode === 'admin' ? 'active' : ''}`} onClick={() => { setAppMode('admin'); }}>
            <Settings size={22} />
            <span>Admin</span>
          </button>
        )}
      </nav>

      {/* --- ÁREA PRINCIPAL DE CONTEÚDO --- */}
      <main className="AppMain">

      {/* Banner de aviso para visitantes */}
      {isVisitor && (
        <div className="visitor-banner">
          ⚠️ Você está no modo <b>Visitante</b>. Faça login para acessar as escalas da sua igreja.
        </div>
      )}


      {/* --- LÓGICA DE ALTERNÂNCIA DE TELAS --- */}
      {appMode === 'transpositor' && (
        <>
          <h2 style={{ textAlign: 'center', color: '#61dafb', marginBottom: '20px', borderBottom: 'none' }}>
            🎵 Transpositor Universal de Acordes
          </h2>

          <div className="controls">
            <h2>1. Escolha a Transposição</h2>
            <div className="controls-grid">
              <div className="action-control">
                <label>Ação</label>
                <ToggleSwitch options={actionOptions} selectedValue={action} onChange={setAction} />
              </div>
              <div className="interval-control">
                <label>Intervalo (em tons)</label>
                <NumberInput value={interval} onChange={setInterval} step={0.5} min={0.5} />
              </div>
            </div>
          </div>

          <div className="tabs">
            <button className={`tab-button ${activeTab === 'sequence' ? 'active' : ''}`} onClick={() => setActiveTab('sequence')}>
              Transpor Sequência
            </button>
            <button className={`tab-button ${activeTab === 'cifra' ? 'active' : ''}`} onClick={() => setActiveTab('cifra')}>
              Transpor Cifra Completa
            </button>
          </div>

          {activeTab === 'sequence' && (
            <div className="input-area">
              <h2>2. Insira a Sequência de Acordes</h2>
              <p className="tab-description">Use esta aba para transpor uma lista simples de acordes separados por espaço.</p>
              <input
                type="text"
                className="sequence-input"
                placeholder="Ex: G D/F# Em C"
                value={sequenceText}
                onChange={(e) => setSequenceText(e.target.value)}
              />
              <button className="main-button" style={{ marginTop: '15px' }} onClick={handleSequenceTranspose} disabled={isLoading}>
                {isLoading ? 'Processando...' : 'Transpor Sequência!'}
              </button>

              {/* AVISO DE MODO OFFLINE */}
              {usingOfflineMode && sequenceResult && (
                <p style={{ fontSize: '0.9em', color: '#ffd700', textAlign: 'center', marginTop: '10px', backgroundColor: 'rgba(255, 215, 0, 0.1)', padding: '5px', borderRadius: '4px', border: '1px solid #ffd700' }}>
                  ⚠️ API Render indisponível. Cálculo realizado offline.
                </p>
              )}

              {sequenceResult && (
                <div className="result-area">
                  <h2>🎸 Resultado da Sequência</h2>
                  <div className="sequence-results-grid">
                    {sequenceResult.original_chords.map((original, index) => (
                      <div key={index} className="chord-card">
                        <div className="original">{original}</div>
                        <div className="transposed">{sequenceResult.transposed_chords[index]}</div>
                      </div>
                    ))}
                  </div>
                  <div className="copy-block">
                    Originais:   {sequenceResult.original_chords.join(' ')}<br />
                    Transpostos: {sequenceResult.transposed_chords.join(' ')}
                  </div>
                  {sequenceResult.explanations.length > 0 && (
                    <div style={{ marginTop: '15px' }}>
                      <h4>ℹ️ Informações Adicionais</h4>
                      {sequenceResult.explanations.map((exp, i) => <p key={i} className="explanation-text">{exp}</p>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'cifra' && (
            <>
              <div className="input-area">
                <h2>2. Insira a Cifra</h2>
                <p className="tab-description">Cole o texto abaixo OU arraste e solte um arquivo em qualquer lugar da tela.</p>
                <textarea
                  className="cifra-textarea"
                  placeholder="Ex:&#10;D G A&#10;Minha canção..."
                  value={cifraText}
                  onChange={(e) => {
                    setCifraText(e.target.value);
                    if (selectedFile) {
                      setSelectedFile(null);
                      if (document.getElementById('file-upload')) document.getElementById('file-upload').value = null;
                    }
                  }}
                />
                <div className="file-input-wrapper">
                  <label htmlFor="file-upload" className="file-input-label">
                    Ou Selecione um Arquivo (.txt, .docx)
                  </label>
                  <input id="file-upload" type="file" onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      if (file.name.endsWith('.txt') || file.name.endsWith('.docx')) {
                        setSelectedFile(file);
                        setCifraText('');
                        setError('');
                      } else {
                        setError('Formato inválido. Use .txt ou .docx');
                      }
                    }
                  }} accept=".txt,.docx" />
                  {selectedFile &&
                    <p ref={fileStatusRef} className="file-selected-feedback">
                      Arquivo selecionado: {selectedFile.name}
                    </p>
                  }
                </div>
              </div>

              <button className="main-button" onClick={handleCifraTranspose} disabled={isLoading || (!cifraText && !selectedFile)}>
                {isLoading ? 'Processando...' : 'Transpor Cifra!'}
              </button>

              {/* AVISO DE MODO OFFLINE NA CIFRA */}
              {usingOfflineMode && transposedCifra && (
                <p style={{ fontSize: '0.9em', color: '#ffd700', textAlign: 'center', marginTop: '10px', backgroundColor: 'rgba(255, 215, 0, 0.1)', padding: '5px', borderRadius: '4px', border: '1px solid #ffd700' }}>
                  ⚠️ API Render indisponível. Arquivo processado localmente.
                </p>
              )}

              {transposedCifra && (
                <div className="result-area">
                  <h2>🎸 Cifra Transposta</h2>
                  <pre>{transposedCifra}</pre>
                  <div className="result-actions">
                    <button onClick={handleCopy}>{isCopied ? 'Copiado!' : 'Copiar'}</button>
                    <button onClick={handleDownload}>Baixar (.txt)</button>
                    <button onClick={handleClearCifra}>Limpar</button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* --- LÓGICA DAS OUTRAS TELAS --- */}
      {appMode === 'escala' && (
        <GeradorEscala />
      )}

      {appMode === 'membros' && (
        <GestaoMembros />
      )}

      {appMode === 'repertorio' && (
        <LeviRoboto />
      )}

      {/* AS NOVAS TELAS ENTRAM AQUI */}
      {appMode === 'meu_repertorio' && (
        <GerenciarRepertorio />
      )}

      {appMode === 'perfil' && (
        <GerenciarPerfil />
      )}

      {appMode === 'admin' && user?.role === 'admin' && (
        <AdminPanel />
      )}

      {error && <p style={{ color: '#ff4b4b', textAlign: 'center', marginTop: '15px' }}>{error}</p>}

      </main>
      
      <footer className="app-footer">
        <p>Desenvolvido para a Glória de Deus.<br />Copyright &copy; {new Date().getFullYear()} <a href="https://about.me/panfil" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>Rafael Panfil</a></p>
      </footer>
    </div>
  );
}

export default App;