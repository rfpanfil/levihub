import React, { useState } from 'react';
import { apiFetch } from '../services/api';

const ExcelImportModal = ({ isOpen, onClose, onImportSuccess }) => {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [fonteVerdade, setFonteVerdade] = useState('banco');
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  
  // Seleção de linhas (todas marcadas por padrão)
  const [selectedItems, setSelectedItems] = useState([]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handlePreview = async () => {
    if (!file) {
      alert("Por favor, selecione um arquivo.");
      return;
    }
    
    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await apiFetch("/excel/preview", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Erro ao processar arquivo");
      }
      
      const data = await res.json();
      setPreviewData(data.items);
      
      // Pré-seleciona todos que não tem erro
      const validIndexes = data.items
        .map((item, idx) => item.status !== 'error' ? idx : -1)
        .filter(idx => idx !== -1);
      setSelectedItems(validIndexes);
      setStep(2);
      
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelection = (idx) => {
    if (selectedItems.includes(idx)) {
      setSelectedItems(selectedItems.filter(i => i !== idx));
    } else {
      setSelectedItems([...selectedItems, idx]);
    }
  };

  const handleCommit = async () => {
    if (selectedItems.length === 0) {
      alert("Selecione pelo menos uma música para importar.");
      return;
    }

    setIsLoading(true);
    
    const itemsToCommit = selectedItems.map(idx => previewData[idx]);
    
    try {
      const res = await apiFetch("/excel/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          items: itemsToCommit,
          fonte_verdade: fonteVerdade
        })
      });
      
      if (!res.ok) throw new Error("Erro ao salvar dados");
      
      const result = await res.json();
      alert(result.message);
      
      setStep(1);
      setFile(null);
      setPreviewData([]);
      onImportSuccess();
      
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCols = (item) => {
    return Object.entries(item)
      .filter(([k, v]) => v && v !== "" && k !== "categorias")
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");
  };

  const cancelAndClose = () => {
    setStep(1);
    setFile(null);
    setPreviewData([]);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="modal-content" style={{ backgroundColor: '#1e222d', padding: '20px', borderRadius: '10px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#f39c12' }}>Importar Repertório via Excel</h2>
          <button onClick={cancelAndClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
        </div>

        {step === 1 && (
          <div className="step-1">
            {/* Caixa do Arquivo Modelo */}
            <div style={{ marginBottom: '18px', padding: '14px 16px', backgroundColor: 'rgba(46, 204, 113, 0.08)', border: '1px solid #2ecc71', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <strong style={{ color: '#2ecc71', display: 'block', marginBottom: '4px' }}>📄 Precisa do arquivo modelo padrão?</strong>
                <span style={{ fontSize: '0.85rem', color: '#ccc' }}>
                  Baixe a planilha modelo já configurada com todas as colunas do sistema. <br/>
                  • <b>CATEGORIAS:</b> aceita <u>múltiplas categorias separadas por vírgula</u> (ex: <i>Alegria, Agitada 1, Ceia</i>).<br/>
                  • <b>TEMA CENTRAL:</b> destinado a uma única palavra descritiva (ex: <i>Comunhão</i>).
                </span>
              </div>
              <a 
                href="/modelo_importacao_levihub.xlsx" 
                download="Modelo_Importacao_LeviHub.xlsx"
                style={{ padding: '10px 16px', backgroundColor: '#2ecc71', color: '#151821', fontWeight: 'bold', borderRadius: '6px', textDecoration: 'none', whiteSpace: 'nowrap', fontSize: '0.9rem' }}
              >
                📥 Baixar Planilha Modelo (.xlsx)
              </a>
            </div>

            <p style={{ marginTop: 0 }}>Selecione a sua planilha preenchida (<b>.xlsx</b> ou <b>.xls</b>):</p>
            
            <div style={{ padding: '20px', border: '2px dashed #4a505c', borderRadius: '10px', textAlign: 'center', marginBottom: '20px' }}>
              <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
            </div>

            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#2a2f3a', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Conflito de Dados (Fonte da Verdade)</h4>
              <p style={{ fontSize: '0.9rem', color: '#9ab', margin: '0 0 12px 0' }}>Caso a música já exista no seu banco de dados e a planilha possua dados diferentes, o que o sistema deve fazer?</p>
              
              <label style={{ display: 'block', marginBottom: '12px', cursor: 'pointer', padding: '10px', borderRadius: '6px', backgroundColor: fonteVerdade === 'banco' ? 'rgba(46, 204, 113, 0.12)' : 'transparent', border: fonteVerdade === 'banco' ? '1px solid #2ecc71' : '1px solid transparent' }}>
                <input 
                  type="radio" 
                  name="fonteVerdade" 
                  value="banco" 
                  checked={fonteVerdade === 'banco'}
                  onChange={() => setFonteVerdade('banco')}
                  style={{ marginRight: '10px' }}
                />
                <b style={{ color: '#2ecc71' }}>Manter dados atuais do Banco (Recomendado / Seguro)</b> — Não apaga nada do que já existe no seu banco; apenas preenche os campos novos que estiverem totalmente vazios (ex: Tom, Primeira Linha, BPM).
              </label>

              <label style={{ display: 'block', cursor: 'pointer', padding: '10px', borderRadius: '6px', backgroundColor: fonteVerdade === 'excel' ? 'rgba(255, 75, 75, 0.12)' : 'transparent', border: fonteVerdade === 'excel' ? '1px solid #ff4b4b' : '1px solid transparent' }}>
                <input 
                  type="radio" 
                  name="fonteVerdade" 
                  value="excel" 
                  checked={fonteVerdade === 'excel'}
                  onChange={() => setFonteVerdade('excel')}
                  style={{ marginRight: '10px' }}
                />
                <b style={{ color: '#ff6b6b' }}>Substituir pelos dados da Planilha (Sobrescrever)</b> — A planilha passa a ser a fonte da verdade e substitui os dados existentes.
              </label>

              {fonteVerdade === 'excel' && (
                <div style={{ marginTop: '12px', padding: '12px 14px', backgroundColor: 'rgba(255, 75, 75, 0.18)', border: '2px solid #ff4b4b', borderRadius: '6px', color: '#ffb3b3', fontSize: '0.9rem', lineHeight: '1.4' }}>
                  <strong style={{ color: '#ff4b4b', display: 'block', fontSize: '0.95rem', marginBottom: '4px' }}>
                    ⚠️ ATENÇÃO: OS DADOS ATUAIS DO BANCO SERÃO SOBRESCRITOS E APAGADOS!
                  </strong>
                  Ao continuar com esta opção selecionada, para todas as músicas já cadastradas que derem match, <b>qualquer informação ou categoria que já exista hoje no seu banco de dados será apagada e substituída</b> pelo conteúdo que estiver preenchido na planilha. Se não quiser perder seus dados atuais, selecione a opção <b>"Manter dados atuais do Banco"</b> acima.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={cancelAndClose} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #ff4b4b', color: '#ff4b4b', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handlePreview} disabled={!file || isLoading} className="main-button" style={{ width: 'auto', margin: 0 }}>
                {isLoading ? "Processando..." : "Analisar Arquivo"}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="step-2">
            <p>Foram encontradas <b>{previewData.length}</b> músicas na planilha. Revise abaixo as ações que serão tomadas.</p>
            
            <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '20px', backgroundColor: '#151821', borderRadius: '5px', border: '1px solid #4a505c' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#2a2f3a' }}>
                  <tr>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #4a505c' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedItems.length > 0 && selectedItems.length === previewData.filter(i => i.status !== 'error').length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItems(previewData.map((item, idx) => item.status !== 'error' ? idx : -1).filter(idx => idx !== -1));
                          } else {
                            setSelectedItems([]);
                          }
                        }}
                      />
                    </th>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #4a505c' }}>Música (Excel)</th>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #4a505c' }}>Ação</th>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #4a505c' }}>Detalhes do Excel</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((item, idx) => {
                    const isError = item.status === 'error';
                    const isUpdate = item.status === 'update';
                    const isNew = item.status === 'new';
                    
                    let rowColor = 'transparent';
                    if (isError) rowColor = 'rgba(255, 75, 75, 0.1)';
                    else if (isUpdate) rowColor = 'rgba(243, 156, 18, 0.1)';
                    else rowColor = 'rgba(97, 218, 251, 0.1)';
                    
                    let badgeColor = '';
                    let badgeText = '';
                    if (isError) { badgeColor = '#ff4b4b'; badgeText = 'Erro / Inválido'; }
                    else if (isUpdate) { badgeColor = '#f39c12'; badgeText = 'Atualizar Mús. Existente'; }
                    else { badgeColor = '#61dafb'; badgeText = 'Nova Inserção'; }

                    return (
                      <tr key={idx} style={{ backgroundColor: rowColor, borderBottom: '1px solid #2a2f3a' }}>
                        <td style={{ padding: '10px' }}>
                          <input 
                            type="checkbox" 
                            disabled={isError}
                            checked={selectedItems.includes(idx)}
                            onChange={() => toggleSelection(idx)}
                          />
                        </td>
                        <td style={{ padding: '10px' }}>
                          <b>{item.excel_data.nome_musica}</b> <br/>
                          <small style={{ color: '#9ab' }}>{item.excel_data.artista}</small>
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span style={{ backgroundColor: badgeColor, color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {badgeText}
                          </span>
                          {isError && <div style={{ color: '#ff4b4b', fontSize: '0.8rem', marginTop: '5px' }}>{item.errors.join(", ")}</div>}
                        </td>
                        <td style={{ padding: '10px', fontSize: '0.8rem', color: '#ccc' }}>
                          {item.excel_data.categorias?.length > 0 && <div><b>Cats:</b> {item.excel_data.categorias.join(", ")}</div>}
                          <div>{formatCols(item.excel_data)}</div>
                        </td>
                      </tr>
                    );
                  })}
                  {previewData.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#9ab' }}>Nenhuma música encontrada no Excel.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#9ab' }}>{selectedItems.length} selecionadas</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setStep(1)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #4a505c', color: '#fff', borderRadius: '5px', cursor: 'pointer' }}>Voltar</button>
                <button onClick={handleCommit} disabled={isLoading || selectedItems.length === 0} className="main-button" style={{ width: 'auto', margin: 0, backgroundColor: '#2ecc71' }}>
                  {isLoading ? "Salvando..." : "Confirmar Importação"}
                </button>
              </div>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
};

export default ExcelImportModal;
