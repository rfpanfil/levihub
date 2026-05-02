// arquivo: frontend/src/pages/GeradorEscala.jsx
import React from 'react';
import html2canvas from 'html2canvas';

import { ScaleProvider, useScale } from '../context/ScaleContext';

import ConfiguracaoDatas from '../components/GeradorEscala/ConfiguracaoDatas';
import GestaoVagas from '../components/GeradorEscala/GestaoVagas';
import TabelaDisponibilidade from '../components/GeradorEscala/TabelaDisponibilidade';
import PainelRegras from '../components/GeradorEscala/PainelRegras';
import ResultadoEscala from '../components/GeradorEscala/ResultadoEscala';

function GeradorEscalaContent() {
  const {
    mesesNomes, equipa, catalogoVagas,
    isLoading, mes, ano, datasEscala, vagasPorDia,
    indisponibilidades, regras, escalasGeradas, escalaAtualIndex, isGerando,
    ordemMatriz, draggedRow, swapMessage,
    setEscalaAtualIndex, toggleIndisponibilidade, marcarTodosIndisponiveis,
    marcarMembroIndisponivel, desmarcarMembroIndisponivel, marcarTodosDisponiveis,
    handleAdicionarRegra, removerRegra, getDiasDisponiveisMembro,
    handleDragStartRow, handleDragEnterRow, handleDragEndRow,
    handleGerarEscala, handleTrocarMembro
  } = useScale();

  const handleImprimir = async () => {
    const elemento = document.getElementById('escala-resultado-matriz');
    if (!elemento) return;
    const canvas = await html2canvas(elemento, { backgroundColor: '#282c34', scale: 2 });
    const link = document.createElement('a');
    link.download = `escala_${mesesNomes[mes]}_${ano}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleWhatsApp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Escala do mês ${mesesNomes[mes]}`)}`, '_blank');
  };

  return (
    <div className="gerador-escala-container" style={{ position: 'relative' }}>
      {swapMessage && (
        <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#e74c3c', color: 'white', padding: '10px 20px', borderRadius: '8px', zIndex: 1000, boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
          ⚠️ {swapMessage}
        </div>
      )}

      {/* Na Etapa 1, ConfiguracaoDatas e GestaoVagas já consomem o Context diretamente! */}
      <ConfiguracaoDatas />

      {isLoading ? (
        <p>A carregar base de dados...</p>
      ) : (
        <>
          <GestaoVagas />

          {/* COMPONENTES AGORA CONSOMEM O CONTEXTO (Sem Props Drilling!) */}
          <TabelaDisponibilidade />

          <PainelRegras />

          <div style={{ textAlign: 'center', marginTop: '30px' }}>
            <button className="main-button" onClick={handleGerarEscala} disabled={isGerando} style={{ padding: '15px 40px', fontSize: '1.2em' }}>
              {isGerando ? 'Calculando rotas...' : '🎲 Gerar Escala Automática'}
            </button>
          </div>

          <ResultadoEscala />
        </>
      )}
    </div>
  );
}

export default function GeradorEscala() {
  return (
    <ScaleProvider>
      <GeradorEscalaContent />
    </ScaleProvider>
  );
}