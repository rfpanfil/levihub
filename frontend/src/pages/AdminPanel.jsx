// arquivo: frontend/src/pages/AdminPanel.jsx
import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import ExcelImportModal from '../components/ExcelImportModal';
import BulkEditModal from '../components/BulkEditModal';

const CATEGORIAS_GLOBAIS_PADRAO = [
  'agitadas1',
  'agitadas2',
  'lentas1',
  'lentas2',
  'ceia',
  'infantis',
  'casais',
  'junina',
  'natal',
  'pascoa',
  'missoes',
];

function AdminPanel() {
  const [abaAtiva, setAbaAtiva] = useState('usuarios'); // 'usuarios' | 'repertorio_global'

  // --- ESTADOS DE USUÁRIOS ---
  const [usuarios, setUsuarios] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });

  const [editandoUserId, setEditandoUserId] = useState(null);
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('user');
  const [editSenha, setEditSenha] = useState('');
  const [editVerified, setEditVerified] = useState(true);

  // --- ESTADOS DO REPERTÓRIO GLOBAL ---
  const [musicasGlobais, setMusicasGlobais] = useState([]);
  const [categoriasGlobais, setCategoriasGlobais] = useState([]);
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(false);

  // Pesquisa e Filtro do Repertório Global
  const [searchNome, setSearchNome] = useState('');
  const [searchTag, setSearchTag] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Controle de Modais do Repertório Global
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isCategoriasModalOpen, setIsCategoriasModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  // Campos do Modal de Música Global
  const [nomeMusica, setNomeMusica] = useState('');
  const [artista, setArtista] = useState('');
  const [tags, setTags] = useState('');
  const [link, setLink] = useState('');
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState([]);
  const [codigo, setCodigo] = useState('');
  const [primeiraLinha, setPrimeiraLinha] = useState('');
  const [tom, setTom] = useState('');
  const [primeiraNota, setPrimeiraNota] = useState('');
  const [versaoVocal, setVersaoVocal] = useState('');
  const [compasso, setCompasso] = useState('');
  const [bpm, setBpm] = useState('');
  const [cifra, setCifra] = useState('');
  const [versaoParecida, setVersaoParecida] = useState('');
  const [temaCentral, setTemaCentral] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Criação rápida inline de Categoria Global e Tema Central
  const [isNovaCategoriaInline, setIsNovaCategoriaInline] = useState(false);
  const [novaCategoriaNomeInline, setNovaCategoriaNomeInline] = useState('');
  const [isNovoTemaInline, setIsNovoTemaInline] = useState(false);
  const [novoTemaNomeInline, setNovoTemaNomeInline] = useState('');

  // CRUD do Modal de Categorias Globais
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [editandoCategoriaId, setEditandoCategoriaId] = useState(null);
  const [editandoCategoriaNome, setEditandoCategoriaNome] = useState('');

  const mostrarMensagem = (texto, tipo) => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem({ texto: '', tipo: '' }), 3500);
  };

  // --- CARREGAMENTO DE DADOS ---
  const carregarUsuarios = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await apiFetch('/admin/usuarios');
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data.usuarios || []);
      } else {
        mostrarMensagem('Acesso Negado ou Falha na API.', 'erro');
      }
    } catch (err) {
      mostrarMensagem('Erro de conexão.', 'erro');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const carregarRepertorioGlobal = async () => {
    setIsLoadingGlobal(true);
    try {
      const [resMusicas, resCats] = await Promise.all([
        apiFetch('/admin/musicas'),
        apiFetch('/admin/categorias'),
      ]);
      if (resMusicas.ok) {
        const dataM = await resMusicas.json();
        setMusicasGlobais(dataM.musicas || []);
      }
      if (resCats.ok) {
        const dataC = await resCats.json();
        setCategoriasGlobais(dataC.categorias || []);
      }
    } catch (err) {
      mostrarMensagem('Erro ao carregar o repertório global.', 'erro');
    } finally {
      setIsLoadingGlobal(false);
    }
  };

  useEffect(() => {
    carregarUsuarios();
    carregarRepertorioGlobal();
  }, []);

  // --- FUNÇÕES DE USUÁRIOS ---
  const iniciarEdicao = (usr) => {
    setEditandoUserId(usr.id);
    setEditEmail(usr.email);
    setEditRole(usr.role);
    setEditVerified(!!usr.is_verified);
    setEditSenha('');
  };

  const salvarEdicao = async (id) => {
    try {
      const bodyData = {
        email: editEmail,
        role: editRole,
        is_verified: editVerified,
      };
      if (editSenha.trim() !== '') bodyData.senha = editSenha;

      const res = await apiFetch(`/admin/usuarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });
      if (res.ok) {
        mostrarMensagem('Usuário atualizado!', 'sucesso');
        setEditandoUserId(null);
        carregarUsuarios();
      } else {
        mostrarMensagem('Erro ao atualizar usuário.', 'erro');
      }
    } catch (err) {
      mostrarMensagem('Erro de conexão.', 'erro');
    }
  };

  const aprovarUsuarioPendente = async (usr) => {
    try {
      const res = await apiFetch(`/admin/usuarios/${usr.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_verified: true }),
      });
      if (res.ok) {
        mostrarMensagem(`E-mail de ${usr.email} ativado com sucesso!`, 'sucesso');
        carregarUsuarios();
      } else {
        mostrarMensagem('Erro ao ativar usuário.', 'erro');
      }
    } catch (err) {
      mostrarMensagem('Erro de conexão.', 'erro');
    }
  };

  const excluirUsuario = async (id, email) => {
    if (!window.confirm(`ATENÇÃO: Excluir o usuário ${email} apagará todo o repertório e equipe dele. Continuar?`)) return;
    try {
      const res = await apiFetch(`/admin/usuarios/${id}`, { method: 'DELETE' });
      if (res.ok) {
        mostrarMensagem('Usuário excluído!', 'sucesso');
        carregarUsuarios();
      } else {
        mostrarMensagem('Erro ao excluir.', 'erro');
      }
    } catch (err) {
      mostrarMensagem('Erro de conexão.', 'erro');
    }
  };

  // --- FUNÇÕES DO REPERTÓRIO GLOBAL ---
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

  const toggleCategoriaSelecionada = (nomeCat) => {
    const limpo = nomeCat.trim();
    if (categoriasSelecionadas.some(c => c.toLowerCase() === limpo.toLowerCase())) {
      setCategoriasSelecionadas(categoriasSelecionadas.filter(c => c.toLowerCase() !== limpo.toLowerCase()));
    } else {
      setCategoriasSelecionadas([...categoriasSelecionadas, limpo]);
    }
  };

  const abrirModalNovaMusicaGlobal = () => {
    setIsEditing(false);
    setEditId(null);
    setNomeMusica('');
    setArtista('');
    setTags('');
    setLink('');
    setCategoriasSelecionadas([]);
    setCodigo('');
    setPrimeiraLinha('');
    setTom('');
    setPrimeiraNota('');
    setVersaoVocal('');
    setCompasso('');
    setBpm('');
    setCifra('');
    setVersaoParecida('');
    setTemaCentral('');
    setShowAdvanced(false);
    setIsNovaCategoriaInline(false);
    setNovaCategoriaNomeInline('');
    setIsNovoTemaInline(false);
    setNovoTemaNomeInline('');
    setIsModalOpen(true);
  };

  const iniciarEdicaoMusicaGlobal = (musica) => {
    setIsEditing(true);
    setEditId(musica.id);
    setNomeMusica(musica.nome_musica || '');
    setArtista(musica.artista || '');
    setTags(musica.tags || '');
    setLink(musica.link || '');
    setCategoriasSelecionadas(
      musica.categorias && musica.categorias.length > 0
        ? musica.categorias.map(c => c.trim()).filter(Boolean)
        : []
    );
    setCodigo(musica.codigo || '');
    setPrimeiraLinha(musica.primeira_linha || '');
    setTom(musica.tom || '');
    setPrimeiraNota(musica.primeira_nota || '');
    setVersaoVocal(musica.versao_vocal || '');
    setCompasso(musica.compasso || '');
    setBpm(musica.bpm || '');
    setCifra(musica.cifra || '');
    setVersaoParecida(musica.versao_parecida || '');
    setTemaCentral(musica.tema_central || '');
    setShowAdvanced(
      !!musica.codigo || !!musica.primeira_linha || !!musica.tom || !!musica.primeira_nota ||
      !!musica.versao_vocal || !!musica.compasso || !!musica.bpm || !!musica.cifra ||
      !!musica.versao_parecida
    );
    setIsNovaCategoriaInline(false);
    setNovaCategoriaNomeInline('');
    setIsNovoTemaInline(false);
    setNovoTemaNomeInline('');
    setIsModalOpen(true);
  };

  const handleSalvarMusicaGlobal = async (e) => {
    e.preventDefault();

    let listaCatsFinal = [...categoriasSelecionadas];
    if (isNovaCategoriaInline && novaCategoriaNomeInline.trim()) {
      const novaCat = novaCategoriaNomeInline.trim();
      if (!listaCatsFinal.some(c => c.toLowerCase() === novaCat.toLowerCase())) {
        listaCatsFinal.push(novaCat);
      }
    }

    if (listaCatsFinal.length === 0) {
      mostrarMensagem('Selecione pelo menos uma categoria.', 'erro');
      return;
    }

    const temaFinal = (isNovoTemaInline && novoTemaNomeInline.trim())
      ? novoTemaNomeInline.trim()
      : temaCentral.trim();

    if (!temaFinal) {
      mostrarMensagem('Selecione ou crie um Tema Central para a música.', 'erro');
      return;
    }

    if (!nomeMusica.trim() || !tags.trim()) {
      mostrarMensagem('Preencha o nome da música e as tags.', 'erro');
      return;
    }

    try {
      if (isNovaCategoriaInline && novaCategoriaNomeInline.trim()) {
        const novaCat = novaCategoriaNomeInline.trim();
        const catExiste = categoriasGlobais.some(c => c.nome.toLowerCase() === novaCat.toLowerCase());
        if (!catExiste) {
          await apiFetch('/admin/categorias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: novaCat }),
          });
        }
      }

      const linkLimpo = formatarLinkYouTube(link);
      const bodyData = {
        nome_musica: nomeMusica,
        artista,
        tags,
        categorias: listaCatsFinal,
        link: linkLimpo,
        codigo,
        primeira_linha: primeiraLinha,
        tom,
        primeira_nota: primeiraNota,
        versao_vocal: versaoVocal,
        compasso,
        bpm,
        cifra,
        versao_parecida: versaoParecida,
        tema_central: temaFinal,
      };

      const url = isEditing ? `/admin/musicas/${editId}` : '/admin/musicas';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) throw new Error();
      mostrarMensagem(
        isEditing ? 'Música global atualizada com sucesso!' : 'Música adicionada ao Banco Global com sucesso!',
        'sucesso'
      );
      setIsModalOpen(false);
      carregarRepertorioGlobal();
    } catch (error) {
      mostrarMensagem('Erro ao salvar a música global.', 'erro');
    }
  };

  const handleExcluirMusicaGlobal = async (id, nome) => {
    if (!window.confirm(`Tem certeza que deseja excluir "${nome}" do Repertório Global?`)) return;
    try {
      const res = await apiFetch(`/admin/musicas/${id}`, { method: 'DELETE' });
      if (res.ok) {
        mostrarMensagem('Música excluída do Repertório Global!', 'sucesso');
        carregarRepertorioGlobal();
      } else {
        mostrarMensagem('Erro ao excluir música global.', 'erro');
      }
    } catch (error) {
      mostrarMensagem('Erro de conexão.', 'erro');
    }
  };

  // --- CRUD DE CATEGORIAS GLOBAIS ---
  const handleSalvarNovaCategoriaGlobal = async () => {
    if (!novaCategoriaNome.trim()) return;
    try {
      const res = await apiFetch('/admin/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novaCategoriaNome.trim() }),
      });
      if (!res.ok) throw new Error();
      setNovaCategoriaNome('');
      mostrarMensagem('Categoria global criada!', 'sucesso');
      carregarRepertorioGlobal();
    } catch (error) {
      mostrarMensagem('Erro ao criar categoria global.', 'erro');
    }
  };

  const handleSalvarEdicaoCategoriaGlobal = async (id) => {
    if (!editandoCategoriaNome.trim()) return;
    try {
      const res = await apiFetch(`/admin/categorias/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: editandoCategoriaNome.trim() }),
      });
      if (!res.ok) throw new Error();
      setEditandoCategoriaId(null);
      mostrarMensagem('Categoria global atualizada!', 'sucesso');
      carregarRepertorioGlobal();
    } catch (error) {
      mostrarMensagem('Erro ao editar categoria global.', 'erro');
    }
  };

  const handleExcluirCategoriaGlobal = async (id) => {
    if (!window.confirm("Atenção! As músicas globais desta categoria perderão este vínculo. Continuar?")) return;
    try {
      const res = await apiFetch(`/admin/categorias/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      mostrarMensagem('Categoria global excluída!', 'sucesso');
      carregarRepertorioGlobal();
    } catch (error) {
      mostrarMensagem('Erro ao excluir categoria global.', 'erro');
    }
  };

  // Filtragem de músicas globais
  const musicasFiltradas = musicasGlobais.filter(m => {
    const nomeTerm = searchNome.toLowerCase();
    const tagTerm = searchTag.toLowerCase();

    const matchesNome =
      (m.nome_musica || '').toLowerCase().includes(nomeTerm) ||
      (m.artista && m.artista.toLowerCase().includes(nomeTerm));
    const matchesTag = tagTerm === '' || (m.tags || '').toLowerCase().includes(tagTerm);
    const matchesCat =
      filterCategory === '' ||
      (m.categorias && m.categorias.some(c => c.toLowerCase() === filterCategory.toLowerCase()));

    return matchesNome && matchesTag && matchesCat;
  });

  // Lista consolidada de nomes de categorias globais para filtro e chips
  const todasCategoriasGlobaisNomes = Array.from(
    new Set([
      ...CATEGORIAS_GLOBAIS_PADRAO,
      ...categoriasGlobais.map(c => c.nome.trim()),
      ...musicasGlobais.flatMap(m => (m.categorias || []).map(c => c.trim())),
      ...categoriasSelecionadas,
    ])
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const userInputStyle = {
    padding: '6px 8px',
    borderRadius: '4px',
    border: '1px solid #4a505c',
    backgroundColor: '#1e2229',
    color: 'white',
    marginRight: '5px',
    width: '100%',
    boxSizing: 'border-box',
  };

  const modalInputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px',
    borderRadius: '5px',
    backgroundColor: '#282c34',
    color: 'white',
    border: '1px solid #4a505c',
    marginTop: '5px',
  };

  return (
    <div className="gerador-escala-container">
      {/* Modais de Importação e Edição em Massa para o Escopo Global */}
      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onImportSuccess={carregarRepertorioGlobal}
        escopo="global"
      />
      <BulkEditModal
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        musicas={musicasGlobais}
        onSuccess={carregarRepertorioGlobal}
        escopo="global"
      />

      {/* Cabeçalho e Navegação entre Abas */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #e74c3c',
          paddingBottom: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <h2 style={{ color: '#e74c3c', margin: 0 }}>🛠️ Painel de Administração</h2>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setAbaAtiva('usuarios')}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              border: abaAtiva === 'usuarios' ? '2px solid #e74c3c' : '1px solid #4a505c',
              backgroundColor: abaAtiva === 'usuarios' ? '#e74c3c' : '#1e2229',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            👥 Usuários ({usuarios.length})
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('repertorio_global')}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              border: abaAtiva === 'repertorio_global' ? '2px solid #f39c12' : '1px solid #4a505c',
              backgroundColor: abaAtiva === 'repertorio_global' ? '#f39c12' : '#1e2229',
              color: abaAtiva === 'repertorio_global' ? '#151821' : 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            🌍 Repertório Global ({musicasGlobais.length})
          </button>
        </div>
      </div>

      {mensagem.texto && (
        <div
          style={{
            marginBottom: '20px',
            padding: '10px',
            textAlign: 'center',
            borderRadius: '5px',
            backgroundColor: mensagem.tipo === 'sucesso' ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.2)',
            color: mensagem.tipo === 'sucesso' ? '#2ecc71' : '#ff4b4b',
            fontWeight: 'bold',
          }}
        >
          {mensagem.texto}
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 1: GESTÃO DE USUÁRIOS                                             */}
      {/* ===================================================================== */}
      {abaAtiva === 'usuarios' && (
        <div>
          <p style={{ color: '#9ab', marginBottom: '20px' }}>
            Gerencie os usuários do sistema. Usuários com status <b>⏳ Pendente</b> podem se cadastrar novamente com o mesmo e-mail na tela de login para receber um novo código de ativação — ou você pode ativá-los diretamente clicando em <b>Ativar</b>.
          </p>

          {isLoadingUsers ? (
            <p>Carregando usuários...</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="escala-matrix" style={{ width: '100%', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>E-mail</th>
                    <th>Privilégio (Role)</th>
                    <th>Status Email</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(usr => (
                    <tr key={usr.id} style={{ backgroundColor: '#282c34' }}>
                      <td style={{ padding: '10px' }}>{usr.id}</td>
                      <td style={{ padding: '10px' }}>
                        {editandoUserId === usr.id ? (
                          <input
                            type="email"
                            value={editEmail}
                            onChange={e => setEditEmail(e.target.value)}
                            style={userInputStyle}
                          />
                        ) : (
                          <span
                            style={{
                              color: usr.role === 'admin' ? '#e74c3c' : 'white',
                              fontWeight: usr.role === 'admin' ? 'bold' : 'normal',
                            }}
                          >
                            {usr.email}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px' }}>
                        {editandoUserId === usr.id ? (
                          <select value={editRole} onChange={e => setEditRole(e.target.value)} style={userInputStyle}>
                            <option value="user">Usuário Padrão</option>
                            <option value="admin">Administrador</option>
                          </select>
                        ) : (
                          <span
                            style={{
                              backgroundColor: usr.role === 'admin' ? '#e74c3c' : '#4a505c',
                              padding: '3px 8px',
                              borderRadius: '10px',
                              fontSize: '0.8em',
                            }}
                          >
                            {usr.role.toUpperCase()}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        {editandoUserId === usr.id ? (
                          <select
                            value={editVerified ? 'true' : 'false'}
                            onChange={e => setEditVerified(e.target.value === 'true')}
                            style={userInputStyle}
                          >
                            <option value="true">✅ Verificado</option>
                            <option value="false">⏳ Pendente</option>
                          </select>
                        ) : usr.is_verified ? (
                          '✅'
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span>⏳ Pendente</span>
                            <button
                              type="button"
                              onClick={() => aprovarUsuarioPendente(usr)}
                              style={{
                                background: 'rgba(46, 204, 113, 0.15)',
                                border: '1px solid #2ecc71',
                                color: '#2ecc71',
                                cursor: 'pointer',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.78rem',
                                fontWeight: 'bold',
                              }}
                              title="Ativar conta manualmente sem precisar de código por e-mail"
                            >
                              ✓ Ativar
                            </button>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px' }}>
                        {editandoUserId === usr.id ? (
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                            <input
                              type="text"
                              placeholder="Nova Senha (Opcional)"
                              value={editSenha}
                              onChange={e => setEditSenha(e.target.value)}
                              style={{ ...userInputStyle, width: '140px' }}
                            />
                            <button
                              onClick={() => salvarEdicao(usr.id)}
                              style={{
                                padding: '5px 10px',
                                background: '#2ecc71',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer',
                              }}
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => setEditandoUserId(null)}
                              style={{
                                padding: '5px 10px',
                                background: '#7f8c8d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer',
                              }}
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => iniciarEdicao(usr)}
                              style={{
                                background: 'none',
                                border: '1px solid #61dafb',
                                color: '#61dafb',
                                cursor: 'pointer',
                                padding: '5px 10px',
                                borderRadius: '4px',
                              }}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => excluirUsuario(usr.id, usr.email)}
                              style={{
                                background: 'none',
                                border: '1px solid #ff4b4b',
                                color: '#ff4b4b',
                                cursor: 'pointer',
                                padding: '5px 10px',
                                borderRadius: '4px',
                              }}
                            >
                              Excluir
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 2: REPERTÓRIO GLOBAL (COMPLETO IGUAL AO REPERTÓRIO PESSOAL)       */}
      {/* ===================================================================== */}
      {abaAtiva === 'repertorio_global' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '15px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, color: '#f39c12' }}>🌍 Repertório Global (Banco Padrão)</h3>
              <small style={{ color: '#9ab' }}>
                Músicas disponíveis para todos os visitantes e usuários que utilizam o Banco Padrão.
              </small>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setIsCategoriasModalOpen(true)}
                style={{
                  padding: '12px 18px',
                  backgroundColor: 'transparent',
                  border: '2px solid #f39c12',
                  color: '#f39c12',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                ⚙️ Gerenciar Categorias
              </button>
              <button
                type="button"
                onClick={() => setIsBulkEditModalOpen(true)}
                style={{
                  padding: '12px 18px',
                  backgroundColor: 'transparent',
                  border: '2px solid #61dafb',
                  color: '#61dafb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                📝 Editar em Massa
              </button>
              <button
                type="button"
                onClick={() => setIsExcelModalOpen(true)}
                style={{
                  padding: '12px 18px',
                  backgroundColor: 'transparent',
                  border: '2px solid #2ecc71',
                  color: '#2ecc71',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                📥 Importar do Excel
              </button>
              <button
                type="button"
                onClick={abrirModalNovaMusicaGlobal}
                className="main-button"
                style={{ margin: 0, width: 'auto' }}
              >
                ➕ Adicionar Música Global
              </button>
            </div>
          </div>

          {/* Barra de Pesquisa e Filtro */}
          <div
            className="input-area"
            style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end', marginBottom: '20px' }}
          >
            <div style={{ flex: 2, minWidth: '180px' }}>
              <label>🔍 Buscar por Música / Artista</label>
              <input
                type="text"
                value={searchNome}
                onChange={e => setSearchNome(e.target.value)}
                placeholder="Ex: Jesus, Adoração..."
                style={modalInputStyle}
              />
            </div>
            <div style={{ flex: 2, minWidth: '150px' }}>
              <label>🏷️ Buscar por Tag</label>
              <input
                type="text"
                value={searchTag}
                onChange={e => setSearchTag(e.target.value)}
                placeholder="Ex: animada, ceia"
                style={modalInputStyle}
              />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label>📂 Filtrar por Categoria</label>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={modalInputStyle}>
                <option value="">Todas as Categorias</option>
                {todasCategoriasGlobaisNomes.map(nomeCat => (
                  <option key={nomeCat} value={nomeCat}>
                    {nomeCat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Lista de Músicas Globais */}
          <div className="input-area">
            <h3 style={{ marginTop: 0, borderBottom: '1px solid #4a505c', paddingBottom: '10px' }}>
              Músicas Globais Cadastradas ({musicasFiltradas.length})
            </h3>

            {isLoadingGlobal ? (
              <p>Carregando músicas globais...</p>
            ) : musicasFiltradas.length === 0 ? (
              <p style={{ color: '#9ab', fontStyle: 'italic' }}>Nenhuma música global encontrada.</p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '15px',
                  maxHeight: '520px',
                  overflowY: 'auto',
                  paddingRight: '5px',
                }}
              >
                {musicasFiltradas.map(musica => (
                  <div
                    key={musica.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: '#282c34',
                      padding: '15px',
                      borderRadius: '8px',
                      borderLeft: '4px solid #f39c12',
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <strong
                        style={{
                          color: 'white',
                          fontSize: '1.1em',
                          display: 'block',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        {musica.nome_musica}{' '}
                        {musica.artista && (
                          <span style={{ color: '#f39c12', fontSize: '0.85em', fontWeight: 'normal' }}>
                            {' '}- {musica.artista}
                          </span>
                        )}
                      </strong>

                      <div style={{ display: 'flex', gap: '5px', marginTop: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {musica.tema_central && (
                          <span
                            style={{
                              fontSize: '0.7em',
                              backgroundColor: 'rgba(46, 204, 113, 0.2)',
                              border: '1px solid rgba(46, 204, 113, 0.45)',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              color: '#86efac',
                              fontWeight: 'bold',
                            }}
                          >
                            🎯 {musica.tema_central}
                          </span>
                        )}
                        {musica.categorias &&
                          musica.categorias.map((cat, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: '0.7em',
                                backgroundColor: '#4a505c',
                                padding: '3px 8px',
                                borderRadius: '10px',
                                color: '#eafcff',
                              }}
                            >
                              {cat.trim()}
                            </span>
                          ))}
                      </div>

                      <div
                        style={{
                          fontSize: '0.85em',
                          color: '#61dafb',
                          marginTop: '8px',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        Tags: {musica.tags}
                      </div>

                      {musica.link && (
                        <a
                          href={musica.link}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '0.85em', color: '#2ecc71', display: 'inline-block', marginTop: '5px' }}
                        >
                          🔗 Acessar Link
                        </a>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '10px' }}>
                      <button
                        onClick={() => iniciarEdicaoMusicaGlobal(musica)}
                        style={{
                          background: '#3c414d',
                          border: '1px solid #61dafb',
                          color: '#61dafb',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          padding: '5px',
                        }}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleExcluirMusicaGlobal(musica.id, musica.nome_musica)}
                        style={{
                          background: '#3c414d',
                          border: '1px solid #ff4b4b',
                          color: '#ff4b4b',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          padding: '5px',
                        }}
                        title="Excluir"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE CRIAR / EDITAR MÚSICA GLOBAL                                 */}
      {/* ===================================================================== */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                borderBottom: '1px solid #4a505c',
                paddingBottom: '10px',
              }}
            >
              <h2 style={{ margin: 0, color: isEditing ? '#f39c12' : '#61dafb' }}>
                {isEditing ? '✏️ Editar Música Global' : '➕ Nova Música Global'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#9ab', fontSize: '1.5em', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSalvarMusicaGlobal} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ flex: 2, minWidth: '200px' }}>
                  <label>Nome da Música *</label>
                  <input
                    type="text"
                    value={nomeMusica}
                    onChange={e => setNomeMusica(e.target.value)}
                    placeholder="Ex: A Ele a Glória"
                    style={modalInputStyle}
                    required
                  />
                </div>
                <div style={{ flex: 2, minWidth: '200px' }}>
                  <label>Artista / Banda (Opcional)</label>
                  <input
                    type="text"
                    value={artista}
                    onChange={e => setArtista(e.target.value)}
                    placeholder="Ex: Diante do Trono"
                    style={modalInputStyle}
                  />
                </div>
              </div>

              {/* Categorias (múltipla seleção + criar nova inline) */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <label style={{ margin: 0 }}>
                    Categorias *{' '}
                    <span style={{ fontSize: '0.82em', color: '#9ab', fontWeight: 'normal' }}>
                      (clique para marcar uma ou várias)
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsNovaCategoriaInline(!isNovaCategoriaInline)}
                    style={{
                      background: 'transparent',
                      border: '1px dashed #f39c12',
                      color: '#f39c12',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                    }}
                  >
                    {isNovaCategoriaInline ? '✕ Cancelar Nova Categoria' : '✨ + Criar Nova Categoria'}
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    padding: '12px',
                    backgroundColor: '#282c34',
                    borderRadius: '8px',
                    border: '1px solid #4a505c',
                  }}
                >
                  {todasCategoriasGlobaisNomes.map(nomeCat => {
                    const ativa = categoriasSelecionadas.some(c => c.toLowerCase() === nomeCat.toLowerCase());
                    return (
                      <button
                        key={nomeCat}
                        type="button"
                        onClick={() => toggleCategoriaSelecionada(nomeCat)}
                        style={{
                          padding: '6px 13px',
                          borderRadius: '999px',
                          fontSize: '0.85rem',
                          fontWeight: ativa ? '700' : '500',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          backgroundColor: ativa ? 'rgba(243, 156, 18, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                          border: ativa ? '1px solid #f39c12' : '1px solid rgba(255, 255, 255, 0.18)',
                          color: ativa ? '#fcd34d' : '#cbd5e1',
                        }}
                      >
                        {ativa ? `✓ ${nomeCat}` : nomeCat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isNovaCategoriaInline && (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                  <label style={{ color: '#f39c12' }}>
                    Nome da Nova Categoria Global (será adicionada junto com as selecionadas acima)
                  </label>
                  <input
                    type="text"
                    value={novaCategoriaNomeInline}
                    onChange={e => setNovaCategoriaNomeInline(e.target.value)}
                    placeholder="Ex: pascoa, casais..."
                    style={{ ...modalInputStyle, borderColor: '#f39c12' }}
                    autoFocus
                  />
                </div>
              )}

              {/* Tema Central (obrigatório - seleção única + criar novo) */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <label style={{ margin: 0 }}>
                    🎯 Tema Central *{' '}
                    <span style={{ fontSize: '0.82em', color: '#9ab', fontWeight: 'normal' }}>
                      (Exclusivo p/ Planejamento — selecione 1 opção)
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const proximoEstado = !isNovoTemaInline;
                      setIsNovoTemaInline(proximoEstado);
                      if (!proximoEstado) setNovoTemaNomeInline('');
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px dashed #2ecc71',
                      color: '#2ecc71',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                    }}
                  >
                    {isNovoTemaInline ? '✕ Cancelar Novo Tema' : '✨ + Criar Novo Tema Central'}
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '7px',
                    padding: '12px',
                    maxHeight: '135px',
                    overflowY: 'auto',
                    backgroundColor: '#282c34',
                    borderRadius: '8px',
                    border: '1px solid #4a505c',
                  }}
                >
                  {Array.from(
                    new Set([
                      'Adoração', 'Alegria', 'Amor de Deus', 'Bondade', 'Casais', 'Celebração',
                      'Comunhão', 'Criação', 'Cruz', 'Entrega', 'Esperança', 'Espírito Santo',
                      'Família', 'Fidelidade', 'Força', 'Graça', 'Gratidão', 'Identidade',
                      'Igreja', 'Jesus', 'Louvor', 'Missões', 'Natal', 'Oração', 'Palavra',
                      'Perdão', 'Perseverança', 'Provisão', 'Ressurreição', 'Restauração',
                      'Salvação', 'Santidade', 'Segurança', 'Vitória',
                      ...musicasGlobais.map(m => (m.tema_central || '').trim()),
                      temaCentral.trim(),
                    ])
                  )
                    .filter(Boolean)
                    .sort((a, b) => a.localeCompare(b))
                    .map(nomeTema => {
                      const ativo = !isNovoTemaInline && temaCentral.trim().toLowerCase() === nomeTema.toLowerCase();
                      return (
                        <button
                          key={nomeTema}
                          type="button"
                          onClick={() => {
                            setTemaCentral(nomeTema);
                            setIsNovoTemaInline(false);
                            setNovoTemaNomeInline('');
                          }}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '999px',
                            fontSize: '0.82rem',
                            fontWeight: ativo ? '700' : '500',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            backgroundColor: ativo ? 'rgba(46, 204, 113, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                            border: ativo ? '1px solid #2ecc71' : '1px solid rgba(255, 255, 255, 0.18)',
                            color: ativo ? '#86efac' : '#cbd5e1',
                          }}
                        >
                          {ativo ? `✓ ${nomeTema}` : nomeTema}
                        </button>
                      );
                    })}
                </div>
              </div>

              {isNovoTemaInline && (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                  <label style={{ color: '#2ecc71' }}>Nome do Novo Tema Central *</label>
                  <input
                    type="text"
                    value={novoTemaNomeInline}
                    onChange={e => setNovoTemaNomeInline(e.target.value)}
                    placeholder="Ex: Santificação, Arrependimento..."
                    style={{ ...modalInputStyle, borderColor: '#2ecc71' }}
                    autoFocus
                  />
                </div>
              )}

              <div>
                <label>Palavras-Chave (Separadas por vírgula) *</label>
                <input
                  type="text"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="exaltação, animada, deus"
                  style={modalInputStyle}
                  required
                />
              </div>

              <div>
                <label>Link YouTube (Opcional - Encurtamos p/ você!)</label>
                <input
                  type="text"
                  value={link}
                  onChange={e => setLink(e.target.value)}
                  placeholder="Cole a URL do vídeo ou cifra aqui"
                  style={modalInputStyle}
                />
              </div>

              {/* Campos Avançados */}
              <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    color: '#61dafb',
                  }}
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <span>{showAdvanced ? '▼ Ocultar Campos Avançados' : '▶ Mostrar Campos Avançados'}</span>
                </div>

                {showAdvanced && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
                    <div>
                      <label>Código Interno</label>
                      <input
                        type="text"
                        value={codigo}
                        onChange={e => setCodigo(e.target.value)}
                        placeholder="Ex: A-01"
                        style={modalInputStyle}
                      />
                    </div>
                    <div>
                      <label>Primeira Linha</label>
                      <input
                        type="text"
                        value={primeiraLinha}
                        onChange={e => setPrimeiraLinha(e.target.value)}
                        placeholder="Como começa a música"
                        style={modalInputStyle}
                      />
                    </div>
                    <div>
                      <label>Tom</label>
                      <input
                        type="text"
                        value={tom}
                        onChange={e => setTom(e.target.value)}
                        placeholder="Ex: C, Am, D"
                        style={modalInputStyle}
                      />
                    </div>
                    <div>
                      <label>1ª Nota</label>
                      <input
                        type="text"
                        value={primeiraNota}
                        onChange={e => setPrimeiraNota(e.target.value)}
                        placeholder="Para a voz principal"
                        style={modalInputStyle}
                      />
                    </div>
                    <div>
                      <label>Versão p/ Vocal</label>
                      <input
                        type="text"
                        value={versaoVocal}
                        onChange={e => setVersaoVocal(e.target.value)}
                        placeholder="Referência pro vocal"
                        style={modalInputStyle}
                      />
                    </div>
                    <div>
                      <label>Compasso</label>
                      <input
                        type="text"
                        value={compasso}
                        onChange={e => setCompasso(e.target.value)}
                        placeholder="Ex: 4/4, 6/8"
                        style={modalInputStyle}
                      />
                    </div>
                    <div>
                      <label>BPM ≈</label>
                      <input
                        type="text"
                        value={bpm}
                        onChange={e => setBpm(e.target.value)}
                        placeholder="Ex: 120"
                        style={modalInputStyle}
                      />
                    </div>
                    <div>
                      <label>Cifra (Texto)</label>
                      <textarea
                        value={cifra}
                        onChange={e => setCifra(e.target.value)}
                        placeholder="Cole aqui ou use o link acima"
                        style={{ ...modalInputStyle, height: '60px', resize: 'vertical' }}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label>Versão Parecida</label>
                      <input
                        type="text"
                        value={versaoParecida}
                        onChange={e => setVersaoParecida(e.target.value)}
                        placeholder="Ex: Diante do Trono"
                        style={modalInputStyle}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'transparent',
                    border: '1px solid #ff4b4b',
                    color: '#ff4b4b',
                    borderRadius: '5px',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="main-button"
                  style={{ margin: 0, width: 'auto', backgroundColor: isEditing ? '#f39c12' : '#61dafb' }}
                >
                  {isEditing ? '💾 Guardar Alterações' : '➕ Salvar Música Global'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE GERENCIAR CATEGORIAS GLOBAIS                                 */}
      {/* ===================================================================== */}
      {isCategoriasModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                borderBottom: '1px solid #4a505c',
                paddingBottom: '10px',
              }}
            >
              <h2 style={{ margin: 0, color: '#f39c12' }}>⚙️ Gerenciar Categorias Globais</h2>
              <button
                onClick={() => setIsCategoriasModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#9ab', fontSize: '1.5em', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label>Adicionar Nova Categoria Global</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={novaCategoriaNome}
                  onChange={e => setNovaCategoriaNome(e.target.value)}
                  placeholder="Ex: pascoa, missoes..."
                  style={modalInputStyle}
                />
                <button
                  onClick={handleSalvarNovaCategoriaGlobal}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#f39c12',
                    color: '#1e2229',
                    border: 'none',
                    borderRadius: '5px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    marginTop: '5px',
                  }}
                >
                  Adicionar
                </button>
              </div>
            </div>

            <h3 style={{ borderBottom: '1px solid #4a505c', paddingBottom: '10px' }}>Categorias Globais Existentes</h3>
            <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' }}>
              {categoriasGlobais.length === 0 ? (
                <p style={{ color: '#9ab' }}>Nenhuma categoria global criada ainda.</p>
              ) : (
                categoriasGlobais.map(cat => (
                  <div
                    key={cat.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: '#282c34',
                      padding: '10px',
                      marginBottom: '8px',
                      borderRadius: '5px',
                      border: '1px solid #4a505c',
                    }}
                  >
                    {editandoCategoriaId === cat.id ? (
                      <div style={{ display: 'flex', gap: '5px', width: '100%' }}>
                        <input
                          type="text"
                          value={editandoCategoriaNome}
                          onChange={e => setEditandoCategoriaNome(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '5px',
                            borderRadius: '3px',
                            border: '1px solid #f39c12',
                            backgroundColor: '#1e2229',
                            color: 'white',
                          }}
                        />
                        <button
                          onClick={() => handleSalvarEdicaoCategoriaGlobal(cat.id)}
                          style={{
                            backgroundColor: '#2ecc71',
                            border: 'none',
                            borderRadius: '3px',
                            padding: '5px 10px',
                            cursor: 'pointer',
                            color: 'white',
                          }}
                        >
                          OK
                        </button>
                        <button
                          onClick={() => setEditandoCategoriaId(null)}
                          style={{
                            backgroundColor: '#e74c3c',
                            border: 'none',
                            borderRadius: '3px',
                            padding: '5px 10px',
                            cursor: 'pointer',
                            color: 'white',
                          }}
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <>
                        <span style={{ fontWeight: 'bold', color: 'white' }}>{cat.nome}</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              setEditandoCategoriaId(cat.id);
                              setEditandoCategoriaNome(cat.nome);
                            }}
                            style={{ background: 'none', border: 'none', color: '#61dafb', cursor: 'pointer', fontSize: '1.2em' }}
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleExcluirCategoriaGlobal(cat.id)}
                            style={{ background: 'none', border: 'none', color: '#ff4b4b', cursor: 'pointer', fontSize: '1.2em' }}
                            title="Excluir"
                          >
                            🗑️
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;