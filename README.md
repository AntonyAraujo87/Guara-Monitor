# Monitor do Guará

Vigia se o [Guará](https://guarapp.duckdns.org) está no ar, **de fora da VM**.

## Por que existe

O monitor antigo rodava dentro da própria máquina que ele vigiava. Se a VM parasse,
o monitor parava junto e nenhum alerta era enviado — o vigia morria com o vigiado,
justamente no cenário em que ele era necessário.

Este roda na infraestrutura do GitHub, então sobrevive à queda da VM.

## Como funciona

- A cada **15 minutos**, faz uma requisição ao site
- Só considera queda depois de **3 tentativas** falharem (evita alarme por soluço de rede)
- Abre uma **issue** quando cai — e o GitHub te manda e-mail
- **Fecha a issue sozinho** quando o site volta
- Não abre issue nova se já existe uma aberta

## Batimento semanal

O GitHub desativa agendamentos em repositórios sem commit há 60 dias. O workflow
grava um carimbo de data em `ultima-verificacao.txt` uma vez por semana só pra
manter o agendamento vivo. Sem isso, o monitor seria desligado em silêncio.

## Se cair

A causa mais provável é a Oracle ter parado a VM por ociosidade. Ela é **parada**,
não destruída — os dados continuam lá.

1. Entre em https://cloud.oracle.com
2. Compute → Instances → selecione a instância
3. **Start**
4. Uns 2 minutos e os containers sobem sozinhos (`restart: always`)
