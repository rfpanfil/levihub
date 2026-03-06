//Arquivo: src/Login.jsx
import React, { useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

function Login({ onLogin }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // --- NOVOS ESTADOS PARA RECUPERAÇÃO ---
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1: Solicitar Código, 2: Código e Nova Senha

  // --- NOVOS ESTADOS DA VERIFICAÇÃO ---
  const [verifyingEmail, setVerifyingEmail] = useState('');

  // Função para limpar todos os campos ao trocar de tela
  const resetAllStates = () => {
    setIsRegistering(false);
    setIsResettingPassword(false);
    setResetStep(1);
    setError('');
    setMensagemSucesso('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setVerificationCode('');
    setVerifyingEmail('');
  };
  const [verificationCode, setVerificationCode] = useState('');
  const [mensagemSucesso, setMensagemSucesso] = useState('');

  // Função para Entrar (Login)
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Usamos URLSearchParams em vez de FormData para evitar que o servidor do Render trave (Timeout 500)
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params,
      });

      const data = await response.json();

      if (response.ok) {
        // Salva o token e avisa o App.jsx que estamos logados
        localStorage.setItem('token', data.access_token);
        onLogin(data); 
      } else {
        setError(data.detail || 'E-mail ou senha incorretos.');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Função para Criar Conta (Register)
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMensagemSucesso('');

    // --- NOVA TRAVA DE SEGURANÇA ---
    if (password !== confirmPassword) {
      setError('As senhas não coincidem. Tente novamente.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Agora, em vez de voltar para o login, ele abre a tela de verificação
        setVerifyingEmail(email);
        setMensagemSucesso('Enviamos um código de 6 dígitos para o seu e-mail!');
      } else {
        setError(data.detail || 'Erro ao criar conta.');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  // --- NOVA FUNÇÃO: VERIFICAR CÓDIGO ---
  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMensagemSucesso('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifyingEmail, codigo: verificationCode }),
      });
      const data = await response.json();
      
      if (response.ok) {
        setMensagemSucesso('Conta verificada com sucesso! Você já pode entrar.');
        setVerifyingEmail('');
        setVerificationCode('');
        setIsRegistering(false); // Volta para a tela de login
      } else {
        setError(data.detail || 'Código inválido ou expirado.');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Solicitar código de recuperação
  const handleRequestReset = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (response.ok) {
        setMensagemSucesso('Se o e-mail existir, você receberá um código!');
        setVerifyingEmail(email); 
        setResetStep(2);
      } else {
        const data = await response.json();
        setError(data.detail || 'Erro ao solicitar recuperação.');
      }
    } catch (err) { setError('Erro de conexão.'); } 
    finally { setLoading(false); }
  };

  // Definir nova senha após validar código
  const handleFinalReset = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError('As senhas não coincidem!'); return; }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifyingEmail, codigo: verificationCode, nova_senha: password }),
      });
      if (response.ok) {
        resetAllStates();
        setMensagemSucesso('Senha alterada com sucesso! Já pode entrar.');
      } else {
        const data = await response.json();
        setError(data.detail || 'Código inválido ou expirado.');
      }
    } catch (err) { setError('Erro de conexão.'); } 
    finally { setLoading(false); }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>🎸 LeviHub</h1>
        <p>{verifyingEmail ? 'Verificação de Segurança' : isRegistering ? 'Crie sua conta para gerenciar seu louvor' : 'Sua escala e repertório em um só lugar'}</p>

        {/* Avisos */}
        {mensagemSucesso && <div style={{ color: '#2ecc71', marginBottom: '15px', textAlign: 'center', fontWeight: 'bold', padding: '10px', backgroundColor: 'rgba(46, 204, 113, 0.1)', borderRadius: '5px' }}>✅ {mensagemSucesso}</div>}
        {error && <div className="login-error">{error}</div>}

        {/* MODO RECUPERAÇÃO DE SENHA */}
        {isResettingPassword ? (
          <form onSubmit={resetStep === 1 ? handleRequestReset : handleFinalReset}>
            <p style={{ textAlign: 'center', color: '#9ab', marginBottom: '15px' }}>
              {resetStep === 1 ? 'Digite seu e-mail para receber um código de recuperação' : 'Digite o código enviado e sua nova senha'}
            </p>

            <div className="input-group">
              <label>E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={resetStep === 2} />
            </div>

            {resetStep === 2 && (
              <>
                <div className="input-group">
                  <label>Código de 6 dígitos</label>
                  <input type="text" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} required maxLength="6" style={{ textAlign: 'center', letterSpacing: '5px', fontSize: '1.5em', fontWeight: 'bold' }} />
                </div>
                <div className="input-group">
                  <label>Nova Senha</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" />
                </div>
                <div className="input-group">
                  <label>Confirmar Nova Senha</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>
              </>
            )}

            <button type="submit" className="login-btn-main" disabled={loading} style={{ backgroundColor: resetStep === 2 ? '#2ecc71' : '#61dafb' }}>
              {loading ? 'Processando...' : resetStep === 1 ? 'Enviar Código' : 'Redefinir Senha'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '15px' }}>
              <button type="button" onClick={resetAllStates} style={{ background: 'none', border: 'none', color: '#9ab', cursor: 'pointer', textDecoration: 'underline' }}>
                Voltar para o Login
              </button>
            </div>
          </form>
        ) : verifyingEmail ? (
          /* MODO 1: VERIFICAÇÃO DE CÓDIGO (Cadastro) */
          <form onSubmit={handleVerify}>
            <p style={{ textAlign: 'center', color: '#9ab', marginBottom: '15px', fontSize: '0.9em' }}>
              Por favor, insira o código que acabamos de enviar para <br/><strong>{verifyingEmail}</strong>
            </p>
            
            <div className="input-group">
              <label>Código de 6 dígitos</label>
              <input 
                type="text" 
                value={verificationCode} 
                onChange={(e) => setVerificationCode(e.target.value)} 
                required 
                maxLength="6"
                placeholder="Ex: 123456"
                style={{ textAlign: 'center', fontSize: '1.5em', letterSpacing: '5px', fontWeight: 'bold' }}
              />
            </div>

            <button type="submit" className="login-btn-main" disabled={loading} style={{ backgroundColor: '#2ecc71' }}>
              {loading ? 'Validando...' : 'Confirmar Conta'}
            </button>
            
            <div style={{ textAlign: 'center', marginTop: '15px' }}>
              <button type="button" onClick={() => { setVerifyingEmail(''); setMensagemSucesso(''); setError(''); setConfirmPassword(''); setPassword(''); }} style={{ background: 'none', border: 'none', color: '#9ab', cursor: 'pointer', textDecoration: 'underline' }}>
                Cancelar / Voltar
              </button>
            </div>
          </form>

        ) : (
          
          /* MODO 2 E 3: LOGIN OU REGISTRO NORMAL */
          <>
            <form onSubmit={isRegistering ? handleRegister : handleLogin}>
              <div className="input-group">
                <label>E-mail</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  placeholder="exemplo@email.com"
                />
              </div>

              <div className="input-group">
                <label>Senha</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  placeholder={isRegistering ? "Mínimo de 6 caracteres" : "Sua senha"}
                  minLength={isRegistering ? "6" : undefined}
                />
              </div>

              {/* Link de Esqueci Senha */}
              {!isRegistering && !isResettingPassword && (
                <p 
                  onClick={() => { resetAllStates(); setIsResettingPassword(true); }} 
                  style={{ textAlign: 'right', fontSize: '0.85em', color: '#61dafb', cursor: 'pointer', marginTop: '-10px', marginBottom: '15px' }}
                >
                  Esqueci minha senha
                </p>
              )}

              {/* --- NOVO CAMPO: CONFIRMAR SENHA (Só aparece ao Criar Conta) --- */}
              {isRegistering && (
                <div className="input-group">
                  <label>Confirmar Senha</label>
                  <input 
                    type="password" 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    required 
                    placeholder="Digite a senha novamente"
                    minLength="6"
                  />
                </div>
              )}

              <button type="submit" className="login-btn-main" disabled={loading}>
                {loading ? 'Processando...' : (isRegistering ? 'Cadastrar e Receber Código' : 'Entrar')}
              </button>
            </form>

            <div className="login-divider">ou</div>

            <button 
              className="login-btn-visitor" 
              onClick={() => onLogin(null)} 
              disabled={loading}
            >
              Entrar como Visitante
            </button>

            <div className="login-footer">
              {isRegistering ? (
                <p>Já tem uma conta? <span onClick={() => { setIsRegistering(false); setError(''); setMensagemSucesso(''); setConfirmPassword(''); setPassword(''); }}>Faça Login</span></p>
              ) : (
                <p>Ainda não tem conta? <span onClick={() => { setIsRegistering(true); setError(''); setMensagemSucesso(''); setConfirmPassword(''); setPassword(''); }}>Criar Conta</span></p>
              )}
            </div>
          </>
        )}
      </div>
      {/* Rodapé adicionado abaixo do card de login */}
      <footer className="app-footer" style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.8em', color: '#9ab', borderTop: 'none', paddingTop: '0' }}>
        <p>Desenvolvido para a Glória de Deus.<br />Copyright &copy; {new Date().getFullYear()} <a href="https://about.me/panfil" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>Rafael Panfil</a></p>
      </footer>
    </div>
  );
}

export default Login;