const NOMES = [
  "Avestruz", "Águia", "Burro", "Borboleta", "Cachorro",
  "Cabra", "Carneiro", "Camelo", "Cobra", "Coelho",
  "Cavalo", "Elefante", "Galo", "Gato", "Jacaré",
  "Leão", "Macaco", "Porco", "Pavão", "Peru",
  "Touro", "Tigre", "Urso", "Veado", "Vaca",
];

export const ALGARISMOS = Object.freeze({ dezena: 2, centena: 3, milhar: 4 });
export const MODALIDADES = Object.freeze({
  grupo: "Grupo",
  dezena: "Dezena",
  centena: "Centena",
  milhar: "Milhar",
});

/** Mantém os zeros à esquerda que fazem parte da identificação no bilhete. */
export function numeroComZeros(valor, tamanho = 2) {
  return String(valor).padStart(tamanho, "0");
}

export const BICHOS = NOMES.map((nome, indice) => {
  const grupo = indice + 1;
  const dezenas = Array.from({ length: 4 }, (_, offset) =>
    numeroComZeros((indice * 4 + offset + 1) % 100),
  );
  return { nome, grupo, dezenas };
});

/** Usa os mesmos rótulos na tela e na imagem do extrato. */
export function descreverPalpite({ modalidade, valor, alcance }) {
  const bicho = modalidade === "grupo" ? BICHOS[Number(valor) - 1] : null;
  return {
    escolha: bicho ? `${bicho.nome} · ${valor}` : valor,
    detalhe: `${MODALIDADES[modalidade]} · ${alcance === "cabeca" ? "Na cabeça" : "Do 1º ao 5º"}`,
  };
}

/** Identifica o bicho pela dezena final e reserva o 00 para a Vaca. */
export function bichoDaMilhar(milhar) {
  const dezena = Number(milhar.slice(-2)) || 100;
  return BICHOS[Math.ceil(dezena / 4) - 1];
}

/** Valida o grupo ou o comprimento exato da modalidade numérica. */
export function palpiteValido(modalidade, valor) {
  if (typeof valor !== "string" || !/^\d+$/.test(valor)) return false;
  if (modalidade === "grupo") {
    return valor.length === 2 && Number(valor) >= 1 && Number(valor) <= 25;
  }
  return valor.length === ALGARISMOS[modalidade];
}

/** Gera cinco milhares fictícias e independentes, incluindo 0000. */
export function extrairMilhares(aleatorio = Math.random) {
  return Array.from({ length: 5 }, () =>
    numeroComZeros(Math.floor(aleatorio() * 10_000), 4),
  );
}

/** Retorna as posições premiadas em que o palpite bateu, em ordem de extração. */
export function conferirPalpite(bilhete, milhares) {
  const concorrentes = bilhete.alcance === "cabeca" ? milhares.slice(0, 1) : milhares;
  return concorrentes.flatMap((milhar, indice) => {
    const valorSorteado = bilhete.modalidade === "grupo"
      ? numeroComZeros(bichoDaMilhar(milhar).grupo)
      : milhar.slice(-ALGARISMOS[bilhete.modalidade]);
    return valorSorteado === bilhete.valor ? [indice + 1] : [];
  });
}

/** Exibe as posições exatas que cada bilhete acertou. */
export function descreverAcertos(acertos) {
  return acertos.length
    ? `Acertou · ${acertos.map((posicao) => `${posicao}º`).join(", ")}`
    : "Sem acerto";
}
