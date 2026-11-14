import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { montarDadosExtrato } from "../jogo-do-bicho/extrato.mjs";
import { urlDaGravura } from "../jogo-do-bicho/gravuras.mjs";
import {
  BICHOS, bichoDaMilhar, conferirPalpite, explicarPalpite, extrairMilhares,
  numeroComZeros, palpiteValido,
} from "../jogo-do-bicho/regras.mjs";

test("a cartela cobre cada dezena exatamente uma vez, incluindo 00 na Vaca", () => {
  const dezenas = BICHOS.flatMap((bicho) => bicho.dezenas);
  assert.equal(BICHOS.length, 25);
  assert.equal(new Set(dezenas).size, 100);
  assert.deepEqual(BICHOS[0].dezenas, ["01", "02", "03", "04"]);
  assert.deepEqual(BICHOS.at(-1).dezenas, ["97", "98", "99", "00"]);
  for (const bicho of BICHOS) {
    for (const dezena of bicho.dezenas) {
      assert.equal(bichoDaMilhar(`12${dezena}`), bicho);
    }
  }
  assert.equal(bichoDaMilhar("0088").nome, "Tigre");
  assert.equal(bichoDaMilhar("0000").nome, "Vaca");
});

test("cada grupo tem uma gravura WebP individual com transparência", async () => {
  const urls = BICHOS.map(urlDaGravura);
  assert.equal(new Set(urls.map((url) => url.href)).size, 25);

  for (const url of urls) {
    const arquivo = await readFile(url);
    assert.equal(arquivo.toString("ascii", 0, 4), "RIFF");
    assert.equal(arquivo.toString("ascii", 8, 16), "WEBPVP8X");
    assert.ok(arquivo[20] & 0x10, `Gravura sem canal alfa: ${url.pathname}`);
  }
});

test("o palpite conserva zeros iniciais e valida a modalidade", () => {
  for (const [modalidade, valor] of [
    ["grupo", "25"], ["grupo", "01"], ["dezena", "00"],
    ["centena", "088"], ["milhar", "0000"],
  ]) {
    assert.equal(palpiteValido(modalidade, valor), true);
  }

  for (const [modalidade, valor] of [
    ["grupo", "00"], ["grupo", "26"], ["grupo", "1"],
    ["dezena", "1"], ["centena", "88"], ["milhar", "00000"],
    ["milhar", "12e3"], ["milhar", 1234], ["outra", "01"],
  ]) {
    assert.equal(palpiteValido(modalidade, valor), false);
  }
});

test("a extração gera cinco milhares e pode repetir resultados", () => {
  const valores = [0, 0.0001, 0.0078125, 0.0078125, 0.99999];
  assert.deepEqual(extrairMilhares(() => valores.shift()), [
    "0000", "0001", "0078", "0078", "9999",
  ]);
});

test("a conferência usa a posição e a quantidade correta de algarismos", () => {
  const milhares = ["0088", "3562", "4187", "1388", "9088"];
  for (const [modalidade, valor, acertos] of [
    ["grupo", "22", [1, 3, 4, 5]],
    ["dezena", "88", [1, 4, 5]],
    ["centena", "088", [1, 5]],
    ["milhar", "0088", [1]],
  ]) {
    assert.deepEqual(conferirPalpite({ modalidade, valor, alcance: "cercado" }, milhares), acertos);
    assert.deepEqual(conferirPalpite({ modalidade, valor, alcance: "cabeca" }, milhares), [1]);
  }
  assert.deepEqual(conferirPalpite({ modalidade: "dezena", valor: "62", alcance: "cabeca" }, milhares), []);
  assert.deepEqual(conferirPalpite({ modalidade: "dezena", valor: "62", alcance: "cercado" }, milhares), [2]);
  assert.equal(numeroComZeros(1, 3), "001");
});

test("a explicação distingue um acerto fora da cabeça de um palpite ausente", () => {
  const milhares = ["3152", "0088", "0000", "0123", "1388"];
  const tigre = { modalidade: "grupo", valor: "22", alcance: "cabeca" };
  const centena = { modalidade: "centena", valor: "088", alcance: "cercado" };
  assert.match(explicarPalpite(tigre, milhares), /1º prêmio deu Galo.*fora da cabeça \(2º, 5º\)/);
  assert.equal(
    explicarPalpite({ ...tigre, alcance: "cercado" }, milhares),
    "O final 88 da milhar 0088 é do Tigre.",
  );
  assert.equal(explicarPalpite(centena, milhares), "A milhar 0088 termina em 088.");
  assert.match(
    explicarPalpite({ ...centena, valor: "089" }, milhares),
    /152 · 088 · 000 · 123 · 388.*ficou de fora/,
  );
  assert.match(
    explicarPalpite({ modalidade: "milhar", valor: "0000", alcance: "cercado" }, milhares),
    /quatro algarismos de 0000 bateram/,
  );
  assert.equal(
    explicarPalpite({ modalidade: "dezena", valor: "39", alcance: "cabeca" }, milhares),
    "No 1º prêmio deu 52. Seu bilhete só vale no 1º prêmio.",
  );
});

test("a rota da festa tem uma página em português com URL canônica própria", async () => {
  const html = await readFile(new URL("../jogo-do-bicho/index.html", import.meta.url), "utf8");
  assert.match(html, /<html lang="pt-BR">/);
  assert.match(html, /rel="canonical" href="https:\/\/gabes-machado\.github\.io\/jogo-do-bicho\/"/);
  assert.match(html, /rel="stylesheet" href="\.\/jogo\.css"/);
  assert.match(html, /type="module" src="\.\/jogo\.mjs"/);
  assert.doesNotMatch(html, /class="(?:marca|faixa)"/);
  assert.match(html, />Por que ninguém ganhou\?</);
  assert.match(html, /<table class="regras-tabela">/);
});

test("a ajuda tem um botão com ícone e nome acessível fora do letreiro", async () => {
  const html = await readFile(new URL("../jogo-do-bicho/index.html", import.meta.url), "utf8");
  assert.match(html, /<body>\s*<button class="ajuda" id="abrir-ajuda"[^>]*aria-label="Como jogar"[^>]*aria-controls="ajuda"[^>]*>\?<\/button>/);
  assert.doesNotMatch(html, /class="(?:topo|sobretitulo)"|Desde 1892/);
});

test("o extrato inclui os cinco resultados e todos os bilhetes com seus acertos", () => {
  const milhares = ["0088", "0000", "4187", "1388", "9088"];
  const palpiteTigre = { modalidade: "grupo", valor: "22", alcance: "cercado" };
  const milhar = { modalidade: "milhar", valor: "0000", alcance: "cabeca" };
  const resumo = "29 bilhetes acertaram!";
  const dados = montarDadosExtrato(2, milhares, [...Array(29).fill(palpiteTigre), milhar], resumo);

  assert.equal(dados.rodada, "002");
  assert.equal(dados.resumo, resumo);
  assert.deepEqual(dados.premios.map((premio) => premio.milhar), milhares);
  assert.equal(dados.premios[1].bicho.nome, "Vaca");
  assert.equal(dados.bilhetes.length, 30);
  assert.deepEqual(dados.bilhetes[0], {
    numero: "30",
    escolha: "0000",
    detalhe: "Milhar · Na cabeça",
    situacao: "Sem acerto",
    acertou: false,
    conferencia: "No 1º prêmio deu 0088. Seu palpite bateu fora da cabeça (2º), mas só o 1º conta.",
  });
  assert.deepEqual(dados.bilhetes.at(-1), {
    numero: "01",
    escolha: "Tigre · 22",
    detalhe: "Grupo · Do 1º ao 5º",
    situacao: "Acertou · 1º, 3º, 4º, 5º",
    acertou: true,
    conferencia: "O final 88 da milhar 0088 é do Tigre.",
  });
});
