# Status do loop

- **Encerrado em:** 2026-09-17T16:02:02-03:00
- **Motivo:** o único item que resta está fora do meu alcance — o R4g precisa do
  emulador de pé, e o emulador precisa de `/dev/kvm`.
- **Corrigido em 18/09:** eu escrevi aqui que isso *"precisa de `sudo`"*. Não
  precisa — `sudo` não alcança. Ver a seção de correção no fim.
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

- **`/dev/kvm`** — **um reinício na UEFI**, não dois comandos. É o R4g inteiro, e
  a primeira evidência de *execução* do 0.4. Passo a passo em
  `docs/OWNER-ACTS.md` §3.
- **A chave do updater** — nem `./signing.env` nem
  `~/.config/tura-notes/build.env` existem nesta máquina, então o publish morre
  na assinatura. Com o `--file-version` corrigido em `1.6.28`, é o que falta
  para `/p/tura-notes` sair de *In preparation*.

Tudo no quadro: https://claude.ai/artifact/7PjQHdRBS4t2wSJZWA8ZLR

## ⚠️ Correção — 18/09/2026

**Escrevi que o R4g esperava `sudo`. Está errado, e o kernel já tinha dito o
contrário antes de eu escrever.** Os dois comandos que deixei aqui —
`sudo modprobe kvm_amd` e `sudo usermod -aG kvm $USER` — não destravam nada: o
primeiro é justamente o que já falhou.

Medido em 18/09, no journal do boot corrente:

```
set 16 11:23:21 samirb3 kernel: SVM disabled (by BIOS) in MSR_VM_CR
set 17 16:06:12 samirb3 kernel: kvm_amd: SVM not supported by CPU 1
```

E a medição que eu tinha invertido: a flag `svm` **não** está em
`/proc/cpuinfo`. Eu afirmei o oposto, e foi daí que saiu a conclusão errada de
que a virtualização já estava ligada na BIOS.

`MSR_VM_CR.SVMDIS` é travado pelo firmware até o próximo reset, então nenhum
privilégio no sistema em execução o alcança. O destravamento é **Advanced ▸ CPU
Configuration ▸ SVM Mode ▸ Enabled** na UEFI da ASUSTeK TUF GAMING X570-PLUS_BR
(BIOS 5043) e reiniciar; só depois o `usermod -aG kvm` faz sentido.

Virou [`docs/OWNER-ACTS.md`](../docs/OWNER-ACTS.md) §3 no `1.6.31`, porque é um
ato do dono como os outros dois daquela página — e porque o `.loop/` é estado de
rodada, e não é onde um bloqueio de meses deve morar.

## Rodadas 5 e 6 — 18/09, `1.6.31` a `1.6.84`

Cinquenta e quatro versões, gate verde antes de cada push, 260 versões com
Release e CI verde. A fila se reabasteceu por medição doze vezes; nenhum item
veio de lista — cada um apareceu conferindo documento contra código, ou veio do
que o dono reportou em uso.

**O que mudou de método, duas vezes.** Primeiro: corrigi a mesma afirmação sobre
o macOS três vezes até parar de ler e começar a **varrer o repositório inteiro
atrás do fato** — fato que aparece num documento aparece em três, e consertar o
que está na sua frente deixa os outros dizendo a coisa velha com a mesma
autoridade. Depois: parei de ler os caminhos documentados e passei a **executá-los**
— clone limpo, configuração de MCP, prévia de sync, CLI de operador, audit, e a
filtragem de permissões pelo transporte remoto. Dois acharam defeito, quatro
confirmaram, e o último confirmou uma **correção** minha, que é o caso onde estar
errado sairia mais caro.

**Seis classes de erro viraram passo do gate**, que foi de 26 para 32 passos e
agora mede a si mesmo: 38s, dos quais o `cargo test` são 17. Cada guard foi
quebrado de propósito antes de subir; um deles reprovou na própria história.

**O CI estava vermelho há 47 execuções** desde o 1.6.0 e o gate local escondia.
Duas causas empilhadas, achadas porque fui conferir se um passo *meu* passava.

**O bug do dono** — *the update could not be completed* — foi diagnosticado lendo
o plugin, consertado do lado do app em quatro commits, documentado por
plataforma e ganhou passeio de aceite (C15). O que resolveria de vez, recusar
antes de falhar, toca Rust e espera o MinGW.

## O que continua esperando o dono

- **`sudo apt install gcc-mingw-w64-x86-64`** — já segurou quatro trabalhos: o
  bump do `reqwest`, o intermitente de Windows no CI, o `supported()` do updater
  e qualquer conserto em Rust daqui em diante.
- **SVM na UEFI** (Advanced ▸ CPU Configuration ▸ SVM Mode ▸ Enabled) — é o R4g
  inteiro, e a primeira evidência de *execução* do 0.4.
- **Três perguntas de produto** sobre retenção, ciclo de vida no celular e
  aceitação de dispositivo, escritas como lacuna em `.continue/0.6-sync.md`.
