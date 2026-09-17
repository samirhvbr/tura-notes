---
n: 21
kind: DOC
sinal: relato
confianca: alta
ts: 2026-09-17T19:35:37-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "R5x — **bump do `reqwest` 0.13.4 → 0.13.5, revertido e parqueado até o MinGW.**"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- marcas de relato: 1

## Mensagem original

**Bloqueado nos dois itens restantes, os dois um comando seu:** `sudo apt install gcc-mingw-w64-x86-64` e o SVM na UEFI.

Desde o último relato, o trabalho do updater fechou com o passeio que faltava e mais um guard:

**C15 — o update que falha virou passeio** (1.6.74). O C14 percorria o que dá certo; nada percorria o que não dá, que é justamente o fluxo que você reportou e o que mudou quatro vezes hoje. É provocável, não hipotético: rodar do `.dmg` montado no macOS, ou dispensar o pedido de senha no Linux. Três coisas têm de valer, e a primeira é a mais velha — **o workspace de volta é o que você tinha**, porque o install fecha pelo fluxo normal e falhar depois disso não pode largar ninguém no Welcome. O `install()` trata isso desde o 1.3.7 e ninguém nunca olhou.

**Esse commit editou quatro arquivos para acrescentar uma linha** — a fila, dois ponteiros e o índice, nenhum deles contendo a linha. Virou o sexto guard: `tools/doc-ranges.py` (1.6.75) lê a maior linha `| X<n> |` de `docs/` e reprova quando um `X1–X<n>` citado discorda. É o erro do 1.6.41, onde a fila mandava percorrer `I1–I10` havendo dezesseis — e **subcontar é a direção cara**: o passeio para no dez, o item é marcado, e as seis linhas novas não são percorridas por ninguém.

Só checa intervalos que começam em 1. `I11–I13` é referência a um subconjunto, não afirmação de quantas linhas existem — e um checador que tratasse assim teria lista de exceção maior que os achados.

**Ele reprovou na própria história antes de passar:** a nota do `.loop/` que descreve essa mudança *cita* o intervalo velho, e o checador leu a citação como afirmação. O `CHANGELOG.md` e o `.loop/` ficaram de fora por um motivo só — registro de erro corrigido precisa poder conter o erro.

Gate em **32 passos**, CI verde, 251 versões com Release, `Latest` em 1.6.75.

