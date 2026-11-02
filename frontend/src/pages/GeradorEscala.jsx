// arquivo: frontend/src/pages/GeradorEscala.jsx
import React from 'react';

import { ScaleProvider, useScale } from '../context/ScaleContext';

import ConfiguracaoDatas from '../components/GeradorEscala/ConfiguracaoDatas';
import GestaoVagas from '../components/GeradorEscala/GestaoVagas';
import TabelaDisponibilidade from '../components/GeradorEscala/TabelaDisponibilidade';
import PainelRegras from '../components/GeradorEscala/PainelRegras';
import ResultadoEscala from '../components/GeradorEscala/ResultadoEscala';

function GeradorEscalaContent() {
  const {
    isLoading, isGerando, swapMessage, escalasGeradas, handleGerarEscala
  } = useScale();

  const isSuccessMsg = swapMessage && swapMessage.startsWith('✅');

  const confirmarGerarEscala = () => {
    if (escalasGeradas && escalasGeradas.length > 0) {
      const ok = window.confirm(
        'Você já possui uma escala gerada neste mês. Gerar novamente irá recalcular tudo do zero e substituir os ajustes manuais feitos.\n\n(Dica: se você só esqueceu de incluir ou remover um instrumento, basta adicioná-lo em "Vagas e Funções por Dia" acima — ele entra automaticamente sem mexer na sua escala!)\n\nDeseja realmente gerar uma nova escala do zero?'
      );
      if (!ok) return;
    }
    handleGerarEscala();
  };

  return (
    <div className="gerador-escala-container" style={{ position: 'relative' }}>
      {swapMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: isSuccessMsg ? '#15803d' : '#e74c3c',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.55)',
            maxWidth: '92vw',
            textAlign: 'center',
          }}
        >
          {isSuccessMsg ? swapMessage : `⚠️ ${swapMessage}`}
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
            <button className="main-button" onClick={confirmarGerarEscala} disabled={isGerando} style={{ padding: '15px 40px', fontSize: '1.2em' }}>
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