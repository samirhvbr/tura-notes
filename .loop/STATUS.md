# Status do loop

- **Encerrado em:** 2026-09-17T16:02:02-03:00
- **Motivo:** o único item que resta está fora do meu alcance — o R4g precisa do
  emulador de pé, e o emulador precisa de `/dev/kvm`, que precisa de `sudo`.
- **Iterações:** 1 de 25
- **Fila:** 10 feito(s), 1 pendente(s)
- **Objetivo:** Rodada 4: executar o que as seis respostas autorizaram - emulador Android, ADR do .loop, runbook dos atos do dono, roteiros de aceite 0.1d/0.6/0.5, e a primeira evidencia de execucao do app Android

Retomar: `/loop-work retomar`

## O que a rodada produziu

`1.6.19` a `1.6.29`, todos empurrados, gate verde antes de cada push e Release
publicado para cada versão. Onze itens: os sete da fila original, menos o do
emulador, mais quatro que a medição encontrou depois de a fila ter esvaziado.

**O reabastecimento achou um marco entregue sem página de aceite.** O 0.7 (MCP
remoto) entrou em `1.6.5`, saiu do `.continue/`, e era o único assim — o
`MCP-0.7.md` nem estava listado no `docs/README.md`. E medir as páginas antigas
contra o que entrou depois delas achou mais três: o import de PDF sem caixa
nenhuma, o Help ▸ About e a regra da chrome não selecionável, e uma frase no
`ACCEPTANCE-0.1a.md` que tinha virado o contrário da verdade.

**Um push foi recusado**, por outra sessão ter empurrado `1.6.28` no meio. O
pre-push é exatamente o portão para isso: rebasei, mantive as duas entradas do
CHANGELOG, renumerei para `1.6.29`, rodei o gate de novo e empurrei. Nada
forçado, nada reescrito.

## O que espera o dono

- **`/dev/kvm`** — `sudo modprobe kvm_amd` e `sudo usermod -aG kvm $USER`. É o
  R4g inteiro, e a primeira evidência de *execução* do 0.4.
- **A chave do updater** — nem `./signing.env` nem
  `~/.config/tura-notes/build.env` existem nesta máquina, então o publish morre
  na assinatura. Com o `--file-version` corrigido em `1.6.28`, é o que falta
  para `/p/tura-notes` sair de *In preparation*.

Tudo no quadro: https://claude.ai/artifact/7PjQHdRBS4t2wSJZWA8ZLR
