// Abre o painel do Guará num Chromium de verdade e falha se ele quebrar.
//
// Por que isso existe: em 27/08/2026 o painel ficou mais de um dia inutilizável
// devolvendo HTTP 200 o tempo todo. O servidor entregava a página inteira, e ela
// morria dentro do navegador — um hook do React chamado depois de um return, que
// derrubava o app na hora de montar. Nenhuma checagem de HTTP enxerga isso.
import { chromium } from 'playwright';

const SITE = process.env.SITE || 'https://168-138-141-214.sslip.io';
const MINIMO_DE_TEXTO = 40;
const ESPERA_CARGA_MS = 25000;
const ESPERA_RENDER_MS = 15000;

const navegador = await chromium.launch();
const pagina = await navegador.newPage();

// Duas distinções que a primeira versão errou, cada uma gerando alerta falso
// com o site perfeitamente no ar:
//
// 1. Esperar por "networkidle" nunca funciona aqui. Ele espera 500ms sem
//    nenhuma atividade de rede, e o app mantém conexão viva com o Supabase —
//    esse silêncio nunca chega. A página carregava e a espera estourava.
//    Agora espera o app RENDERIZAR, que é o que se quer saber de verdade.
//
// 2. pageerror é exceção não capturada: o app quebrou. É o sinal real, e é o
//    que o incidente produziu ("Uncaught Error: Minified React error #310").
//    console.error é só o que o app resolveu registrar, e página real emite
//    isso o tempo todo por motivo inofensivo. Reprovar por console.error
//    treina a pessoa a ignorar o alerta — pior do que não ter monitor.
const excecoes = [];
const ruidoDeConsole = [];
const requisicoesQueFalharam = [];

pagina.on('pageerror', (e) => excecoes.push(e.message));
pagina.on('console', (m) => {
  if (m.type() === 'error') ruidoDeConsole.push(m.text());
});
pagina.on('requestfailed', (r) => {
  requisicoesQueFalharam.push(`${r.url().slice(-70)} — ${r.failure()?.errorText || 'falhou'}`);
});

let problema = null;
let textoVisivel = '';

try {
  const resposta = await pagina.goto(SITE, {
    waitUntil: 'domcontentloaded',
    timeout: ESPERA_CARGA_MS,
  });

  if (!resposta || !resposta.ok()) {
    problema = `o servidor respondeu ${resposta ? resposta.status() : 'nada'}`;
  } else {
    // Espera até a tela ter conteúdo. Se estourar, a medição abaixo decide —
    // não é erro por si só, e o número de caracteres explica melhor.
    try {
      await pagina.waitForFunction(
        (min) => document.body && document.body.innerText.trim().length > min,
        MINIMO_DE_TEXTO,
        { timeout: ESPERA_RENDER_MS }
      );
    } catch {
      /* segue para a medição */
    }

    textoVisivel = (await pagina.locator('body').innerText()).trim();

    if (excecoes.length > 0) {
      problema = `o app quebrou: ${excecoes[0].slice(0, 200)}`;
    } else if (textoVisivel.length < MINIMO_DE_TEXTO) {
      problema = `a página carregou mas não renderizou (${textoVisivel.length} caracteres de texto)`;
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
