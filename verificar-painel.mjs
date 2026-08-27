// Abre o painel do Guará num Chromium de verdade e falha se ele quebrar.
//
// Por que isso existe: em 27/08/2026 o painel ficou mais de um dia inutilizável
// devolvendo HTTP 200 o tempo todo. O servidor entregava a página inteira, e ela
// morria dentro do navegador — um hook do React chamado depois de um return, que
// derrubava o app na hora de montar. Nenhuma checagem de HTTP enxerga isso.
//
// O que se verifica aqui é o que a pessoa realmente vê: a página carregou, o
// JavaScript rodou, e a tela tem conteúdo.
import { chromium } from 'playwright';

const SITE = process.env.SITE || 'https://168-138-141-214.sslip.io';
const ESPERA_MS = 25000;

const navegador = await chromium.launch();
const pagina = await navegador.newPage();

const errosDeConsole = [];
const errosDeRede = [];

pagina.on('pageerror', (e) => errosDeConsole.push(e.message));
pagina.on('console', (m) => {
  if (m.type() === 'error') errosDeConsole.push(m.text());
});
pagina.on('requestfailed', (r) => {
  errosDeRede.push(`${r.url().slice(-60)} — ${r.failure()?.errorText || 'falhou'}`);
});

let problema = null;

try {
  const resposta = await pagina.goto(SITE, { waitUntil: 'networkidle', timeout: ESPERA_MS });

  if (!resposta || !resposta.ok()) {
    problema = `o servidor respondeu ${resposta ? resposta.status() : 'nada'}`;
  } else {
    // Um app que quebrou ao montar deixa a página praticamente vazia, mesmo
    // tendo baixado tudo. Medir o texto visível é o que separa os dois casos.
    const texto = (await pagina.locator('body').innerText()).trim();

    if (texto.length < 40) {
      problema = `a página carregou mas ficou vazia (${texto.length} caracteres de texto)`;
    } else if (errosDeConsole.length > 0) {
      problema = `o painel acusou erro no navegador: ${errosDeConsole[0].slice(0, 160)}`;
    }
  }
} catch (e) {
  problema = `não foi possível abrir a página: ${e.message.split('\n')[0].slice(0, 160)}`;
}

await navegador.close();

if (problema) {
  console.error('PAINEL COM PROBLEMA: ' + problema);
  if (errosDeConsole.length) {
    console.error('\nErros no navegador:');
    errosDeConsole.slice(0, 5).forEach((e) => console.error('  ' + e.slice(0, 200)));
  }
  if (errosDeRede.length) {
    console.error('\nRequisições que falharam:');
    errosDeRede.slice(0, 5).forEach((e) => console.error('  ' + e));
  }
  process.exit(1);
}

console.log('Painel abriu e renderizou normalmente.');
