import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { montarDadosExtrato } from "../jogo-do-bicho/extrato.mjs";
import {
  BICHOS, bichoDaMilhar, conferirPalpite, extrairMilhares,
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

test("a rota da festa tem uma página em português com URL canônica própria", async () => {
  const html = await readFile(new URL("../jogo-do-bicho/index.html", import.meta.url), "utf8");
  assert.match(html, /<html lang="pt-BR">/);
  assert.match(html, /rel="canonical" href="https:\/\/gabes-machado\.github\.io\/jogo-do-bicho\/"/);
  assert.match(html, /rel="stylesheet" href="\.\/jogo\.css"/);
  assert.match(html, /type="module" src="\.\/jogo\.mjs"/);
  assert.doesNotMatch(html, /class="(?:marca|faixa)"/);
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
  });
  assert.deepEqual(dados.bilhetes.at(-1), {
    numero: "01",
    escolha: "Tigre · 22",
    detalhe: "Grupo · Do 1º ao 5º",
    situacao: "Acertou · 1º, 3º, 4º, 5º",
    acertou: true,
  });
});
