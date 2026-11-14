import {
  bichoDaMilhar, conferirPalpite, descreverAcertos, descreverPalpite, explicarPalpite, numeroComZeros,
} from "./regras.mjs";

const LARGURA = 640;
const MARGEM = 38;
const DIREITA = LARGURA - MARGEM;
const ESQUERDA_PALPITE = 100;
const ALTURA_BILHETE = 64;
const ALTURA_LINHA = 25;
const FONTE_CONFERENCIA = "19px system-ui";
const INICIO_BILHETES = 438;
const MONO = "ui-monospace, Menlo, monospace";
const TINTA = "#2c211b";
const SUAVE = "#624a39";
const VINHO = "#782920";
const VERDE = "#21533d";

/** Mantém o extrato completo, inclusive os bilhetes fora da área visível na tela. */
export function montarDadosExtrato(rodada, milhares, bilhetes, resumo) {
  return {
    rodada: numeroComZeros(rodada, 3),
    resumo,
    premios: milhares.map((milhar) => ({ milhar, bicho: bichoDaMilhar(milhar) })),
    bilhetes: bilhetes.map((bilhete, indice) => {
      const acertos = conferirPalpite(bilhete, milhares);
      return {
        numero: numeroComZeros(indice + 1),
        ...descreverPalpite(bilhete),
        situacao: descreverAcertos(acertos),
        acertou: acertos.length > 0,
        conferencia: explicarPalpite(bilhete, milhares, acertos),
      };
    }).reverse(),
  };
}

/** Mede cada frase com a fonte do PNG para quebrar o texto sem cortar palavras. */
function quebrarConferencia(ctx, conferencia) {
  ctx.font = FONTE_CONFERENCIA;
  const larguraDisponivel = DIREITA - ESQUERDA_PALPITE;
  const linhas = [];
  let linha = "";

  for (const palavra of conferencia.split(" ")) {
    const proposta = linha ? `${linha} ${palavra}` : palavra;
    if (linha && ctx.measureText(proposta).width > larguraDisponivel) {
      linhas.push(linha);
      linha = palavra;
    } else {
      linha = proposta;
    }
  }

  linhas.push(linha);
  return linhas;
}

/** Desenha o papel térmico com serrilha e linhas perfuradas. */
function desenharPapel(ctx, altura) {
  ctx.fillStyle = "#ead6b8";
  ctx.fillRect(0, 0, LARGURA, altura);
  ctx.fillStyle = "#fff2d7";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(LARGURA, 0);
  ctx.lineTo(LARGURA, altura - 10);
  for (let x = LARGURA; x > 0; x -= 16) {
    ctx.lineTo(x - 8, altura);
    ctx.lineTo(x - 16, altura - 10);
  }
  ctx.closePath();
  ctx.fill();
}

/** Desenha um único recibo com cabeçalho, cinco resultados e todos os palpites. */
function desenharExtrato(ctx, dados, altura) {
  desenharPapel(ctx, altura);
  ctx.textBaseline = "middle";

  /** Alinha valores à direita sem perder os zeros da milhar e do grupo. */
  function texto(valor, x, y, fonte, cor = TINTA, alinhamento = "left") {
    ctx.font = fonte;
    ctx.fillStyle = cor;
    ctx.textAlign = alinhamento;
    ctx.fillText(valor, x, y);
  }

  /** Imita a linha perfurada de um extrato impresso. */
  function separar(y) {
    ctx.beginPath();
    ctx.strokeStyle = "#aa8d70";
    ctx.setLineDash([4, 5]);
    ctx.moveTo(MARGEM, y);
    ctx.lineTo(DIREITA, y);
    ctx.stroke();
  }

  const rotulo = `700 18px ${MONO}`;
  texto("JOGO DO BICHO", MARGEM, 43, `700 30px ${MONO}`);
  texto("FUBANGAS & BICHEIROS", MARGEM, 76, rotulo, SUAVE);
  texto(`RODADA ${dados.rodada}`, DIREITA, 76, rotulo, SUAVE, "right");
  separar(102);
  texto("DEU NO POSTE!", MARGEM, 134, `700 33px ${MONO}`, VINHO);
  texto(dados.resumo, MARGEM, 166, "20px system-ui", SUAVE);

  dados.premios.forEach(({ milhar, bicho }, indice) => {
    const y = 204 + indice * 39;
    texto(`${indice + 1}º`, MARGEM, y, rotulo, SUAVE);
    texto(milhar, 92, y, `700 25px ${MONO}`, indice === 0 ? VINHO : TINTA);
    texto(bicho.nome, 184, y, "700 21px system-ui");
    texto(numeroComZeros(bicho.grupo), DIREITA, y, rotulo, SUAVE, "right");
    separar(y + 19);
  });

  texto("EXTRATO DE PALPITES", MARGEM, 407, rotulo);
  texto(String(dados.bilhetes.length), DIREITA, 407, rotulo, SUAVE, "right");
  separar(427);

  for (const bilhete of dados.bilhetes) {
    const { y, altura, linhas } = bilhete;
    texto(bilhete.numero, MARGEM, y + 15, rotulo, SUAVE);
    texto(bilhete.escolha, ESQUERDA_PALPITE, y + 15, "700 22px system-ui");
    texto(bilhete.detalhe, ESQUERDA_PALPITE, y + 42, "18px system-ui", SUAVE);
    texto(bilhete.situacao, DIREITA, y + 15, "700 17px system-ui", bilhete.acertou ? VERDE : SUAVE, "right");
    linhas.forEach((linha, indice) => {
      texto(linha, ESQUERDA_PALPITE, y + 68 + indice * ALTURA_LINHA, FONTE_CONFERENCIA);
    });
    separar(y + altura - 8);
  }

  texto("SIMULAÇÃO · SEM DINHEIRO REAL", LARGURA / 2, altura - 33, rotulo, SUAVE, "center");
}

/** Codifica o recibo localmente. Limita a dimensão para caber no canvas móvel. */
export async function criarExtrato(rodada, milhares, bilhetes, resumo) {
  const dados = montarDadosExtrato(rodada, milhares, bilhetes, resumo);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível");

  let inicioBilhete = INICIO_BILHETES;
  dados.bilhetes = dados.bilhetes.map((bilhete) => {
    const linhas = quebrarConferencia(ctx, bilhete.conferencia);
    const altura = ALTURA_BILHETE + linhas.length * ALTURA_LINHA;
    const y = inicioBilhete;
    inicioBilhete += altura;
    return { ...bilhete, linhas, y, altura };
  });

  const altura = inicioBilhete + 69;
  const escala = Math.min(1, 4096 / altura);
  canvas.width = Math.max(1, Math.round(LARGURA * escala));
  canvas.height = Math.round(altura * escala);
  ctx.scale(canvas.width / LARGURA, canvas.height / altura);
  desenharExtrato(ctx, dados, altura);
  const blob = await new Promise((resolver) => canvas.toBlob(resolver, "image/png"));
  if (!blob) throw new Error("Falha ao codificar o canvas em PNG");

  return new File([blob], `jogo-do-bicho-rodada-${dados.rodada}.png`, { type: "image/png" });
}
