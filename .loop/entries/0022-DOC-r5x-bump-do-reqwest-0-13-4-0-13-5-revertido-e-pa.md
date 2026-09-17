---
n: 22
kind: DOC
sinal: relato
confianca: media
ts: 2026-09-17T19:48:05-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "R5x — **bump do `reqwest` 0.13.4 → 0.13.5, revertido e parqueado até o MinGW.**"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- nenhum sinal de pergunta ou de espera

## Mensagem original

**Bloqueado nos dois itens que restam, e os dois são um comando seu:** `sudo apt install gcc-mingw-w64-x86-64`, e o SVM na UEFI para o `/dev/kvm`.

Desde o último relato, três coisas fecharam:

**O gate passou a medir a si mesmo** (1.6.76). O `build-clock.sh` media o build passo a passo há tempos; o gate não media nada e cresceu de 26 para 32 passos hoje. Primeira leitura: **38 segundos para 35 passos, dos quais o `cargo test` são 17** — os seis checadores novos estão todos na soma dos vinte e quatro que ficam abaixo de um segundo. Ou seja: o gate não é o que otimizar, e agora isso é medição, não impressão. Importa porque o `CLAUDE.md` é explícito de que controle caro vira `--no-verify` na semana seguinte.

**E o `ci-parity.py` se pegou no comentário que explica por que o gate não reusa o `build-clock.sh`** — lia caminhos `tools/…` dentro de comentário e exigiu workflow para um arquivo que o gate nunca executa. Consertei o checador em vez de dar exceção a ele: guard que precisa de isenção para a própria imprecisão parou de medir o que diz medir.

**As duas decisões que tomei sem você estão no `.loop/ASSUMPTIONS.md`** (1.6.77), com alternativa descartada e como reverter — promover o `product.md` de `PROPOSED` para `ACTIVE`, e normalizar 26 status de ADR. As duas já tinham raciocínio completo no CHANGELOG, mas o changelog é lido por quem pergunta *o que aconteceu*, e aquele arquivo por quem pergunta *o que foi decidido por mim*. Decisão que só está no primeiro só é achada por quem já desconfia que existe.

`1.6.31` a `1.6.77` no total, 252 versões com Release, CI verde, `Latest` em 1.6.77.

Quadro: **https://claude.ai/artifact/7PjQHdRBS4t2wSJZWA8ZLR**

