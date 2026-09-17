---
n: 17
kind: DOC
sinal: relato
confianca: alta
ts: 2026-09-17T18:14:31-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "R5x — **bump do `reqwest` 0.13.4 → 0.13.5, revertido e parqueado até o MinGW.**"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- marcas de relato: 2

## Mensagem original

**Bloqueado nos três itens restantes — os três esperam um ato seu, um comando cada:** `/dev/kvm` (SVM travado no firmware, UEFI), a chave do updater (`./signing.env` ou `TURA_BUILD_ENV`), e `sudo apt install gcc-mingw-w64-x86-64` (sem ele não dá para validar o bump do `reqwest`, que mexe no `windows-core`).

`1.6.31` a `1.6.61`, gate verde antes de cada push, 237 versões com Release, **CI verde**.

**O que mudou no meio e vale mais que qualquer achado isolado:** corrigi a mesma afirmação sobre o macOS três vezes — o status do README, a instalação quatro parágrafos abaixo, e a tabela do `runbook.md`. A terceira só apareceu porque parei de ler e comecei a **varrer o repositório inteiro atrás do fato**. Aplicado aos outros fatos corrigidos hoje, a varredura achou mais dois. Fato que aparece num documento aparece em três, e consertar a ocorrência que está na sua frente deixa as outras dizendo a coisa velha com a mesma autoridade.

**Uma decisão sua entrou no quadro** (`sync-retencao`): o `SYNC-0.6.md` dizia que retenção, dois-dispositivos e casos-limite do receptor estavam *"explicitly queued"* no `.continue/0.6-sync.md`. Conferi — aquele arquivo só tem o aceite, e o histórico está limpo: **as três categorias nunca foram escritas em lugar nenhum**, embora o `CLAUDE.md` e duas seções do próprio contrato digam que estão abertas. Pus a lacuna na fila como lacuna em vez de inventar a especificação. As três perguntas são de produto: por quanto tempo o servidor guarda revisão que todos os dispositivos já aplicaram; o que acontece com a fila quando o sistema mata o app móvel no meio de uma transferência; e o que conta como "dispositivo aceito" além do pareamento.

Quadro: **https://claude.ai/artifact/7PjQHdRBS4t2wSJZWA8ZLR**

