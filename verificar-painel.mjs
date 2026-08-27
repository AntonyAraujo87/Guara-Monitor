// Abre o painel do Guará num Chromium de verdade e falha se ele quebrar.
//
// Por que isso existe: em 27/08/2026 o painel ficou mais de um dia inutilizável
// devolvendo HTTP 200 o tempo todo. O servidor entregava a página inteira, e ela
// morria dentro do navegador — um hook do React chamado depois de um return, que
// derrubava o app na hora de montar. Nenhuma checagem de HTTP enxerga isso.
import { chromium } from 'playwright';

const SITE = process.env.SITE || 'https://168-138-141-214.sslip.io';
const ESPERA_MS = 25000;
const MINIMO_DE_TEXTO = 40;

const navegador = await chromium.launch();
const pagina = await navegador.newPage();

// Distinção que importa, e que eu errei na primeira versão:
//
//   pageerror     = exceção não capturada. O app quebrou. É o sinal de verdade,
//                   e é exatamente o que o incidente produziu ("Uncaught Error:
//                   Minified React error #310").
//
//   console.error = qualquer coisa que o app resolveu registrar. Página real
//                   emite isso o tempo todo por motivo benigno — recurso que
//                   não carregou, aviso de biblioteca, ruído de autenticação.
//
// Reprovar por console.error abriu alerta com o site perfeitamente no ar. Um
// monitor que grita sem motivo treina a pessoa a ignorá-lo, o que é pior do que
// não ter monitor. Então console.error entra no relatório, mas não reprova.
const excecoes = [];
const ruidoDeConsole = [];
const requisicoesQueFalharam = [];

pagina.on('pageerror', (e) => excecoes.push(e.message));
pagina.on('console', (m) => {
  if (m.type() === 'error') ruidoDeConsole.push(m.text());
});
pagina.on('requestfailed', (r) => {
  requisicoesQueFalharam.push(`${r.url().slice(-60)} — ${r.failure()?.errorText || 'falhou'}`);
});

let problema = null;
let textoVisivel = '';

try {
  const resposta = await pagina.goto(SITE, { waitUntil: 'networkidle', timeout: ESPERA_MS });

  if (!resposta || !resposta.ok()) {
    problema = `o servidor respondeu ${resposta ? resposta.status() : 'nada'}`;
  } else {
    textoVisivel = (await pagina.locator('body').innerText()).trim();

    if (excecoes.length > 0) {
      // Uma exceção não capturada derruba o app mesmo que sobre algo na tela.
      problema = `o app quebrou: ${excecoes[0].slice(0, 200)}`;
    } else if (textoVisivel.length < MINIMO_DE_TEXTO) {
      problema = `a página carregou mas ficou vazia (${textoVisivel.length} caracteres de texto)`;
    }
  }
} catch (e) {
  problema = `não foi possível abrir a página: ${e.message.split('\n')[0].slice(0, 200)}`;
}

await navegador.close();

// Relatório sempre, tenha passado ou não — é o que se lê quando algo dá errado.
console.log(`Texto renderizado: ${textoVisivel.length} caracteres (mínimo ${MINIMO_DE_TEXTO})`);
console.log(`Exceções não capturadas: ${excecoes.length}`);
console.log(`Mensagens de erro no console: ${ruidoDeConsole.length} (não reprovam)`);
console.log(`Requisições que falharam: ${requisicoesQueFalharam.length} (não reprovam)`);

const listar = (titulo, itens) => {
  if (!itens.length) return;
  console.log(`\n${titulo}:`);
  itens.slice(0, 5).forEach((i) => console.log('  ' + String(i).slice(0, 200)));
};

listar('Exceções', excecoes);
listar('Console', ruidoDeConsole);
listar('Requisições', requisicoesQueFalharam);

if (problema) {
  console.error('\nPAINEL COM PROBLEMA: ' + problema);
  process.exit(1);
}

console.log('\nPainel abriu e renderizou normalmente.');
