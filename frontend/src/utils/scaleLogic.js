//arquivo: frontend/src/utils/scaleLogic.js

export const gerarEscalas = (equipa, datasEscala, indisponibilidades, regras, vagasPorDia) => {
  const formatDataKey = (d) => {
    if (!d || !(d instanceof Date)) return "";
    return `${d.getDate()}-${d.getMonth()}-${d.getFullYear()}`;
  };
  let resultadosUnicos = new Set();
  let resultadosObj = [];

  const contarParticipacoes = (membroId, escalaAtual) => {
    let count = 0;
    for (let dia in escalaAtual) {
      if (escalaAtual[dia].some(a => a.membro && a.membro.id === membroId)) count++;
    }
    return count;
  };

  let tentativasTotais = 0;

  while (resultadosObj.length < 10 && tentativasTotais < 50) {
    tentativasTotais++;
    let encontrouNestaTentativa = false;
    let limitadorAntiTravamento = 0; // NOVO: Disjuntor de segurança

    const backtrack = (diaIndex, escalaAtual) => {
      if (encontrouNestaTentativa) return; 
      
      limitadorAntiTravamento++;
      if (limitadorAntiTravamento > 25000) {
        encontrouNestaTentativa = true; // Se testou 25.000 combinações e não achou, aborta para não travar o PC
        return;
      }
      
      if (diaIndex === datasEscala.length) {
        
        // Antes de salvar, verifica se a escala atendeu as metas mensais de frequência
        let todasAsFrequenciasCumpridas = true;
        
        for (let regra of regras) {
          if (regra.tipo === 'frequencia') {
            let contagemOficial = 0;
            for (let d in escalaAtual) {
              // Correção: Adicionado 'a.membro.id &&' para evitar erro quando a vaga estiver vazia ('---')
              if (escalaAtual[d].some(a => a.membro && a.membro.id && a.membro.id.toString() === regra.membro1 && a.vaga.label === regra.funcao)) {
                contagemOficial++;
              }
            }
            // Se a quantidade não for EXATAMENTE a que você pediu, essa escala inteira é descartada
            if (contagemOficial !== parseInt(regra.quantidade)) {
              todasAsFrequenciasCumpridas = false;
              break;
            }
          }
        }

        // Se passar por todas as provas, é salva!
        if (todasAsFrequenciasCumpridas) {
          const jsonStr = JSON.stringify(escalaAtual);
          if (!resultadosUnicos.has(jsonStr)) {
            resultadosUnicos.add(jsonStr);
            resultadosObj.push(JSON.parse(jsonStr));
            encontrouNestaTentativa = true;
          }
        }
        return;
      }

      const dataAtual = datasEscala[diaIndex];
      const dataKey = formatDataKey(dataAtual);
      
      // FORÇA A ORDEM: Resolve as funções normais PRIMEIRO, e as de Crianças POR ÚLTIMO.
      // Isso garante que a pessoa já esteja na função de Adulto quando a vaga de Criança for avaliada.
      const vagas = (vagasPorDia[dataKey] || []).slice().sort((a, b) => {
        if (a.label.includes('Crianças') && !b.label.includes('Crianças')) return 1;
        if (!a.label.includes('Crianças') && b.label.includes('Crianças')) return -1;
        return 0;
      });

      const tentarPreencherDia = (vagaIndex, alocadosNesteDia) => {
        if (encontrouNestaTentativa) return;

        if (vagaIndex === vagas.length) {
          if (!validarRegrasDoDia(alocadosNesteDia, dataKey, regras, equipa)) return;
          escalaAtual[dataKey] = [...alocadosNesteDia];
          backtrack(diaIndex + 1, escalaAtual);
          return;
        }

        const vaga = vagas[vagaIndex];
        
        const isCandidatoValido = (membro, vagaAtual, alocados) => {
          if (indisponibilidades[`${membro.id}_${dataKey}`]) return false;

          // NOVA BLINDAGEM: Verifica se o membro já bateu o limite de vezes definido na regra
          const regraFreq = regras.find(r => r.tipo === 'frequencia' && r.membro1 === membro.id.toString() && r.funcao === vagaAtual.label);
          if (regraFreq) {
            let vezesQueJaTocou = 0;
            // Conta quantas vezes ele já foi escalado nessa mesma função nos dias anteriores
            for (let d in escalaAtual) {
              if (escalaAtual[d].some(a => a.membro && a.membro.id === membro.id && a.vaga.label === vagaAtual.label)) {
                vezesQueJaTocou++;
              }
            }
            // Se já tocou o que foi pedido, ele está estritamente proibido de ser escolhido de novo pra essa função
            if (vezesQueJaTocou >= parseInt(regraFreq.quantidade)) return false; 
          }

          // 1. OBRIGATÓRIO: O membro tem que ter a função exata (ignorando maiúsculas/minúsculas para evitar bugs)
          const temFuncaoExata = membro.funcoes.some(f => vagaAtual.aceita.some(a => a.toLowerCase() === f.toLowerCase()));
          if (!temFuncaoExata) return false;

          // 2. Pega as funções que o membro já pegou NESTE dia
          const alocacoesDoMembro = alocados.filter(a => a.membro && a.membro.id === membro.id);
          
          if (alocacoesDoMembro.length >= 2) return false; // Ninguém faz 3 coisas

          // 3. Verifica configurações de acúmulo se já tem 1 função
          if (alocacoesDoMembro.length === 1) {
            const vagaExistente = alocacoesDoMembro[0].vaga;
            
            const permitidasAtual = vagaAtual.permitidas_acumular || [];
            const obrigatoriasAtual = vagaAtual.obrigatorias_acumular || [];
            const permitidasExistente = vagaExistente.permitidas_acumular || [];
            const obrigatoriasExistente = vagaExistente.obrigatorias_acumular || [];

            const ehObrigatorio = obrigatoriasAtual.includes(vagaExistente.label) || obrigatoriasExistente.includes(vagaAtual.label);
            const ehPermitido = permitidasAtual.includes(vagaExistente.label) || permitidasExistente.includes(vagaAtual.label);

            if (!ehObrigatorio && !ehPermitido) {
              return false; // Bloqueia se nenhuma das funções permitir ou obrigar a outra
            }
          }

          return true;
        };

        // AGORA VERIFICA AS FUNÇÕES E A PERMISSÃO DE DOBRA NAS CRIANÇAS
        let candidatos = equipa.filter(m => isCandidatoValido(m, vaga, alocadosNesteDia));

        candidatos.sort((a, b) => {
          // 1. PRIORIDADE MÁXIMA: Regras de Frequência
          // Se alguém precisa bater a cota desta função, passa na frente de todo mundo
          const precisaVaga = (membroId) => {
            const regra = regras.find(r => r.tipo === 'frequencia' && r.membro1 === membroId.toString() && r.funcao === vaga.label);
            if (!regra) return 0;
            let tocou = 0;
            for (let d in escalaAtual) {
              if (escalaAtual[d].some(aloc => aloc.membro && aloc.membro.id === membroId && aloc.vaga.label === vaga.label)) tocou++;
            }
            return parseInt(regra.quantidade) - tocou; // Quantas vezes ainda faltam
          };

          const aFalta = precisaVaga(a.id);
          const bFalta = precisaVaga(b.id);
          
          if (aFalta > 0 && bFalta <= 0) return -1; // A precisa da vaga pra bater a meta
          if (bFalta > 0 && aFalta <= 0) return 1;  // B precisa da vaga pra bater a meta
          if (aFalta > 0 && bFalta > 0) return bFalta - aFalta; // Quem precisa de mais vagas agora, ganha

          // 2. PRIORIDADE DE DOBRA OBRIGATÓRIA E DEPOIS PERMITIDA
          const aAlocacaoExistente = alocadosNesteDia.find(aloc => aloc.membro && aloc.membro.id === a.id);
          const bAlocacaoExistente = alocadosNesteDia.find(aloc => aloc.membro && aloc.membro.id === b.id);
          
          const aObrigatoria = aAlocacaoExistente && (
            (vaga.obrigatorias_acumular || []).includes(aAlocacaoExistente.vaga.label) || 
            (aAlocacaoExistente.vaga.obrigatorias_acumular || []).includes(vaga.label)
          );
          
          const bObrigatoria = bAlocacaoExistente && (
            (vaga.obrigatorias_acumular || []).includes(bAlocacaoExistente.vaga.label) || 
            (bAlocacaoExistente.vaga.obrigatorias_acumular || []).includes(vaga.label)
          );

          if (aObrigatoria && !bObrigatoria) return -1;
          if (!aObrigatoria && bObrigatoria) return 1;

          // Se não é obrigatória, quem já está no culto (permitido) tem prioridade leve
          const aFazDobra = !!aAlocacaoExistente;
          const bFazDobra = !!bAlocacaoExistente;
          
          if (aFazDobra && !bFazDobra) return -1; 
          if (!aFazDobra && bFazDobra) return 1;  

          // 3. EMPATE: Desempata por quem tocou menos no mês em geral
          const usoA = contarParticipacoes(a.id, escalaAtual);
          const usoB = contarParticipacoes(b.id, escalaAtual);
          if (usoA === usoB) return Math.random() - 0.5;
          return usoA - usoB; 
        });

        candidatos.push(null); // Opção de ficar vazio

        for (let candidato of candidatos) {
          if (candidato) {
            alocadosNesteDia.push({ vaga: vaga, membro: candidato });
            tentarPreencherDia(vagaIndex + 1, alocadosNesteDia);
            alocadosNesteDia.pop();
          } else {
            alocadosNesteDia.push({ vaga: vaga, membro: { nome: '---' } });
            tentarPreencherDia(vagaIndex + 1, alocadosNesteDia);
            alocadosNesteDia.pop();
          }
        }
      };

      tentarPreencherDia(0, []);
    };

    backtrack(0, {});
  }

  return resultadosObj;
};

const validarRegrasDoDia = (alocadosNesteDia, dataKey, regras, equipa) => {
  const idsNesteDia = alocadosNesteDia.map(a => a.membro && a.membro.id?.toString());
  for (let regra of regras) {
    if (regra.tipo === 'tocar_com') {
      const temMembro1 = idsNesteDia.includes(regra.membro1);
      const temAlvo = idsNesteDia.includes(regra.alvo);
      if ((temMembro1 && !temAlvo) || (!temMembro1 && temAlvo)) return false;
    }
    if (regra.tipo === 'dia_especifico' && regra.alvo === dataKey) {
      if (!idsNesteDia.includes(regra.membro1)) return false;
    }
    if (regra.tipo === 'tocar_com_no_dia' && regra.alvoData === dataKey) {
      const temMembro1 = idsNesteDia.includes(regra.membro1);
      const temAlvo = idsNesteDia.includes(regra.alvo);
      if ((temMembro1 && !temAlvo) || (!temMembro1 && temAlvo)) return false;
    }
  }
  return true;
};

/**
 * Escolhe o melhor membro elegível para preencher APENAS uma nova vaga (diaKey + vaga)
 * sem alterar nenhuma alocação já existente na escala otimizada do usuário.
 */
export const escolherMelhorCandidatoParaSlot = (
  vaga,
  diaKey,
  escalaDoMes = {},
  equipa = [],
  indisponibilidades = {},
  regras = []
) => {
  const alocadosNesteDia = escalaDoMes[diaKey] || [];
  const idsAlocadosHoje = new Set(
    alocadosNesteDia
      .filter((a) => a.membro && a.membro.id !== null && a.membro.id !== undefined)
      .map((a) => String(a.membro.id))
  );

  const contarParticipacoesNoMes = (membroId) => {
    let count = 0;
    for (const d of Object.keys(escalaDoMes)) {
      if ((escalaDoMes[d] || []).some((a) => a.membro && a.membro.id === membroId)) {
        count++;
      }
    }
    return count;
  };

  const contarVezesNaFuncao = (membroId, funcaoLabel) => {
    let count = 0;
    for (const d of Object.keys(escalaDoMes)) {
      if (
        (escalaDoMes[d] || []).some(
          (a) => a.membro && a.membro.id === membroId && a.vaga?.label === funcaoLabel
        )
      ) {
        count++;
      }
    }
    return count;
  };

  const ehCandidatoElegivel = (membro) => {
    if (!membro || !membro.funcoes) return false;
    if (indisponibilidades[`${membro.id}_${diaKey}`]) return false;

    const funcoesMembro = (
      Array.isArray(membro.funcoes) ? membro.funcoes : String(membro.funcoes).split(',')
    )
      .map((f) => f.trim().toLowerCase())
      .filter(Boolean);

    const aceitaLista = Array.isArray(vaga.aceita) && vaga.aceita.length > 0 ? vaga.aceita : [vaga.label];
    const temFuncao = aceitaLista.some((f) => funcoesMembro.includes(String(f).trim().toLowerCase()));
    if (!temFuncao) return false;

    // Respeita teto de regra de frequência para esta função, se houver
    const regraFreq = regras.find(
      (r) =>
        r.tipo === 'frequencia' &&
        String(r.membro1) === String(membro.id) &&
        r.funcao === vaga.label
    );
    if (regraFreq) {
      const jaTocou = contarVezesNaFuncao(membro.id, vaga.label);
      if (jaTocou >= parseInt(regraFreq.quantidade, 10)) return false;
    }

    // Limite máximo de 2 funções por dia e permissão de acúmulo (dobra)
    const alocacoesHoje = alocadosNesteDia.filter((a) => a.membro && a.membro.id === membro.id);
    if (alocacoesHoje.length >= 2) return false;

    if (alocacoesHoje.length === 1) {
      const vagaExistente = alocacoesHoje[0].vaga || {};
      const permitidasAtual = vaga.permitidas_acumular || [];
      const obrigatoriasAtual = vaga.obrigatorias_acumular || [];
      const permitidasExistente = vagaExistente.permitidas_acumular || [];
      const obrigatoriasExistente = vagaExistente.obrigatorias_acumular || [];

      const ehObrigatorio =
        obrigatoriasAtual.includes(vagaExistente.label) ||
        obrigatoriasExistente.includes(vaga.label);
      const ehPermitido =
        permitidasAtual.includes(vagaExistente.label) ||
        permitidasExistente.includes(vaga.label);

      if (!ehObrigatorio && !ehPermitido) return false;
    }

    return true;
  };

  const candidatos = equipa.filter(ehCandidatoElegivel);
  if (candidatos.length === 0) {
    return { id: null, nome: '---' };
  }

  const pontuarAfinidadeRegras = (membro) => {
    const mStr = String(membro.id);
    let score = 0;
    for (const regra of regras) {
      if (regra.tipo === 'dia_especifico' && regra.alvo === diaKey && String(regra.membro1) === mStr) {
        score += 2;
      }
      if (regra.tipo === 'tocar_com' || (regra.tipo === 'tocar_com_no_dia' && regra.alvoData === diaKey)) {
        if (String(regra.membro1) === mStr) {
          score += idsAlocadosHoje.has(String(regra.alvo)) ? 2 : -2;
        } else if (String(regra.alvo) === mStr) {
          score += idsAlocadosHoje.has(String(regra.membro1)) ? 2 : -2;
        }
      }
    }
    return score;
  };

  candidatos.sort((a, b) => {
    // 1. Quem ainda precisa cumprir meta de frequência nesta função
    const faltaFreq = (m) => {
      const regra = regras.find(
        (r) => r.tipo === 'frequencia' && String(r.membro1) === String(m.id) && r.funcao === vaga.label
      );
      if (!regra) return 0;
      return Math.max(0, parseInt(regra.quantidade, 10) - contarVezesNaFuncao(m.id, vaga.label));
    };
    const faltaA = faltaFreq(a);
    const faltaB = faltaFreq(b);
    if (faltaA !== faltaB) return faltaB - faltaA;

    // 2. Dobra obrigatória com função que já está fazendo hoje
    const alocA = alocadosNesteDia.find((aloc) => aloc.membro && aloc.membro.id === a.id);
    const alocB = alocadosNesteDia.find((aloc) => aloc.membro && aloc.membro.id === b.id);
    const obrigA = Boolean(
      alocA &&
        ((vaga.obrigatorias_acumular || []).includes(alocA.vaga?.label) ||
          (alocA.vaga?.obrigatorias_acumular || []).includes(vaga.label))
    );
    const obrigB = Boolean(
      alocB &&
        ((vaga.obrigatorias_acumular || []).includes(alocB.vaga?.label) ||
          (alocB.vaga?.obrigatorias_acumular || []).includes(vaga.label))
    );
    if (obrigA !== obrigB) return obrigA ? -1 : 1;

    // 3. Regras de parceria / dia específico
    const regraScoreA = pontuarAfinidadeRegras(a);
    const regraScoreB = pontuarAfinidadeRegras(b);
    if (regraScoreA !== regraScoreB) return regraScoreB - regraScoreA;

    // 4. Dobra permitida no mesmo dia
    const dobraA = Boolean(alocA);
    const dobraB = Boolean(alocB);
    if (dobraA !== dobraB) return dobraA ? -1 : 1;

    // 5. Equilíbrio mensal: quem tocou menos vezes no mês ganha preferência
    const usoA = contarParticipacoesNoMes(a.id);
    const usoB = contarParticipacoesNoMes(b.id);
    if (usoA !== usoB) return usoA - usoB;

    return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
  });

  return candidatos[0];
};