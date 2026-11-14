import {
  ALGARISMOS, BICHOS, MODALIDADES, bichoDaMilhar, conferirPalpite,
  extrairMilhares, numeroComZeros, palpiteValido,
} from "./regras.mjs";

const elementos = Object.fromEntries([
  "formulario", "bichos", "seletor-bichos", "seletor-numero", "numero",
  "rotulo-numero", "dica-numero", "dica-registro", "registrar", "numero-rodada",
  "total-bilhetes", "sem-bilhetes", "bilhetes", "resultado", "premios",
  "resumo-resultado", "sortear", "nova-rodada", "mais-palpite", "status",
  "titulo-palpite", "titulo-rodada", "abrir-ajuda", "ajuda",
].map((id) => [id, document.getElementById(id)]));

const formulario = elementos.formulario;
const modalidades = formulario.elements.namedItem("modalidade");
const alcances = formulario.elements.namedItem("alcance");
const grupos = [];
let numeroRodada = 1;
let bilhetes = [];
let milhares = null;

/** Cria texto por meio do DOM, inclusive para os valores do bilhete. */
function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);
  elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

/** Usa o número tradicional de grupo para localizar a gravura na cartela. */
function criarGravura(bicho) {
  const gravura = criarElemento("span", "gravura");
  const indice = bicho.grupo - 1;
  gravura.setAttribute("aria-hidden", "true");
  gravura.style.backgroundPosition = `${(indice % 5) * 25}% ${Math.floor(indice / 5) * 25}%`;
  return gravura;
}

/** Oferece seleção nativa de grupo para toque e teclado. */
function montarCartela() {
  for (const bicho of BICHOS) {
    const cartao = criarElemento("label", "bicho");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "grupo";
    radio.value = numeroComZeros(bicho.grupo);
    grupos.push(radio);

    cartao.append(
      radio,
      criarElemento("span", "bicho-grupo", radio.value),
      criarGravura(bicho),
      criarElemento("span", "bicho-nome", bicho.nome),
      criarElemento("span", "bicho-dezenas", bicho.dezenas.join(" ")),
    );
    elementos.bichos.append(cartao);
  }
}

/** Lê os campos relevantes da modalidade ativa. */
function palpiteAtual() {
  const modalidade = modalidades.value;
  const valor = modalidade === "grupo"
    ? formulario.elements.namedItem("grupo").value
    : elementos.numero.value;
  return { modalidade, valor, alcance: alcances.value };
}

/** Libera o registro somente quando a rodada e o palpite permitem. */
function atualizarCartela() {
  const { modalidade, valor } = palpiteAtual();
  const porGrupo = modalidade === "grupo";
  const encerrada = milhares !== null;
  elementos["seletor-bichos"].hidden = !porGrupo;
  elementos["seletor-numero"].hidden = porGrupo;
  for (const grupo of grupos) grupo.disabled = encerrada || !porGrupo;
  for (const radio of [...modalidades, ...alcances]) radio.disabled = encerrada;
  elementos.numero.disabled = encerrada || porGrupo;
  elementos.registrar.disabled = encerrada || !palpiteValido(modalidade, valor);
  elementos["dica-registro"].textContent = encerrada
    ? "Abra uma nova rodada para registrar palpites."
    : porGrupo ? "Toque em um dos 25 bichos da cartela." : "Os zeros à esquerda também contam.";

  if (!porGrupo) {
    const tamanho = ALGARISMOS[modalidade];
    elementos.numero.maxLength = tamanho;
    elementos.numero.pattern = `[0-9]{${tamanho}}`;
    elementos.numero.placeholder = "0".repeat(tamanho);
    elementos["rotulo-numero"].textContent = MODALIDADES[modalidade];
    elementos["dica-numero"].textContent = `Digite ${tamanho} algarismos.`;
  }
}

/** Registra o bilhete antes que a extração seja conhecida. */
function registrarPalpite(evento) {
  evento.preventDefault();
  const palpite = palpiteAtual();
  if (milhares || !palpiteValido(palpite.modalidade, palpite.valor)) return;

  bilhetes.push(palpite);
  for (const grupo of grupos) grupo.checked = false;
  elementos.numero.value = "";
  atualizarCartela();
  atualizarRodada();
  elementos["titulo-rodada"].focus();
  elementos.status.textContent = `Bilhete ${numeroComZeros(bilhetes.length)} registrado.`;
}

/** Monta a linha de cada bilhete e marca em quais posições ele acertou. */
function montarBilhete(bilhete, indice) {
  const { modalidade, valor, alcance } = bilhete;
  const bicho = modalidade === "grupo" ? BICHOS[Number(valor) - 1] : null;
  const texto = bicho ? `${bicho.nome} · ${valor}` : valor;
  const linha = criarElemento("li", "bilhete");
  const dados = criarElemento("div", "bilhete-dados");
  dados.append(
    criarElemento("strong", "", texto),
    criarElemento("small", "", `${MODALIDADES[modalidade]} · ${alcance === "cabeca" ? "Na cabeça" : "Do 1º ao 5º"}`),
  );
  linha.append(criarElemento("span", "bilhete-numero", numeroComZeros(indice + 1)), dados);

  if (milhares) {
    const acertos = conferirPalpite(bilhete, milhares);
    linha.classList.toggle("acertou", acertos.length > 0);
    linha.append(criarElemento("span", "bilhete-situacao", acertos.length
      ? `Acertou · ${acertos.map((posicao) => `${posicao}º`).join(", ")}`
      : "Sem acerto"));
  }

  return linha;
}

/** Exibe a milhar e o grupo correspondente em cada posição do poste. */
function montarPremio(milhar, indice) {
  const bicho = bichoDaMilhar(milhar);
  const linha = criarElemento("li", "premio");
  linha.append(
    criarElemento("span", "premio-posicao", `${indice + 1}º`),
    criarElemento("strong", "milhar", milhar),
    criarGravura(bicho),
    criarElemento("span", "premio-bicho", bicho.nome),
    criarElemento("span", "premio-grupo", numeroComZeros(bicho.grupo)),
  );
  return linha;
}

/** Mantém o extrato e as ações visíveis em sincronia com a rodada. */
function atualizarRodada() {
  const total = bilhetes.length;
  elementos["numero-rodada"].textContent = numeroComZeros(numeroRodada, 3);
  elementos["total-bilhetes"].textContent = `${total} ${total === 1 ? "bilhete" : "bilhetes"}`;
  elementos["sem-bilhetes"].hidden = total > 0;
  elementos.bilhetes.replaceChildren(...bilhetes.map(montarBilhete).reverse());
  elementos.sortear.disabled = total === 0 || milhares !== null;
  elementos.sortear.hidden = milhares !== null;
  elementos["nova-rodada"].hidden = milhares === null;
  elementos["mais-palpite"].hidden = total === 0 || milhares !== null;
  elementos.resultado.hidden = milhares === null;

  if (milhares) {
    elementos.premios.replaceChildren(...milhares.map(montarPremio));
    const acertos = bilhetes.filter((bilhete) => conferirPalpite(bilhete, milhares).length).length;
    elementos["resumo-resultado"].textContent = acertos === 0
      ? "Deu zebra! Nenhum bilhete acertou."
      : `${acertos} ${acertos === 1 ? "bilhete acertou" : "bilhetes acertaram"}!`;
  }
}

/** Sorteia uma única extração para todos os bilhetes desta rodada. */
function fazerExtracao() {
  if (!bilhetes.length || milhares) return;
  milhares = extrairMilhares();
  atualizarCartela();
  atualizarRodada();
  elementos["titulo-rodada"].focus();
  elementos.status.textContent = elementos["resumo-resultado"].textContent;
}

/** Abre uma rodada vazia e devolve o foco à cartela. */
function abrirRodada() {
  numeroRodada += 1;
  bilhetes = [];
  milhares = null;
  formulario.reset();
  atualizarCartela();
  atualizarRodada();
  elementos["titulo-palpite"].focus();
  elementos.status.textContent = `Rodada ${numeroComZeros(numeroRodada, 3)} aberta.`;
}

/** Limpa o campo ao trocar de modalidade para preservar a quantidade de dígitos. */
function alterarPalpite(evento) {
  if (evento.target.name === "modalidade") elementos.numero.value = "";
  atualizarCartela();
}

/** Conserva somente os algarismos e permite colar palpites com zeros iniciais. */
function digitarPalpite() {
  const numero = elementos.numero;
  numero.value = numero.value.replace(/[^0-9]/g, "").slice(0, numero.maxLength);
  atualizarCartela();
}

montarCartela();
atualizarCartela();
atualizarRodada();
formulario.addEventListener("change", alterarPalpite);
formulario.addEventListener("submit", registrarPalpite);
elementos.numero.addEventListener("input", digitarPalpite);
elementos.sortear.addEventListener("click", fazerExtracao);
elementos["nova-rodada"].addEventListener("click", abrirRodada);
elementos["mais-palpite"].addEventListener("click", () => elementos["titulo-palpite"].focus());
elementos["abrir-ajuda"].addEventListener("click", () => elementos.ajuda.showModal());
