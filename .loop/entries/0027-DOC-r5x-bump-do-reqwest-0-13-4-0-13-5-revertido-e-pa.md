---
n: 27
kind: DOC
sinal: relato
confianca: media
ts: 2026-09-17T21:07:20-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "R5x — **bump do `reqwest` 0.13.4 → 0.13.5, revertido e parqueado até o MinGW.**"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- nenhum sinal de pergunta ou de espera

## Mensagem original

**Bloqueado — e agora o MinGW segura cinco trabalhos:** `sudo apt install gcc-mingw-w64-x86-64`.

Desde o último relato, três coisas — e duas delas são erros meus que o próprio trabalho expôs.

**Uma versão existia como heading e em nenhum commit** (1.6.89). O `1.6.87` tinha entrada no CHANGELOG, bump no `version.md` e gate verde — e eu comecei o item seguinte sem commitar. O bump seguinte sobrescreveu, o trabalho saiu dentro do 1.6.88, e ficou um `##` para uma versão que o `release.sh` nunca poderia publicar, porque ele caminha o `version.md` pelo histórico e aquele número nunca esteve lá. Dobrei a entrada na versão que de fato levou o trabalho, e virou o sétimo guard: **o gate agora recusa heading de versão que nenhum commit carregou** (1.6.90).

**Esse guard nasceu errado duas vezes e as duas viraram conserto.** A primeira versão dele lia as *tags* — e reprovou na primeira execução por causa da versão que ela mesma acabara de publicar, porque a tag só nasce depois do push. Passou a ler o histórico do `version.md`, que é local e é a mesma fonte do `release.sh`. Aí o CI respondeu com **264 falsos negativos**: o `actions/checkout` é raso, e `git log` num checkout de um commit responde "nunca" para tudo. O job `contracts` passou a clonar com `fetch-depth: 0`, **e o caso raso passou a ser detectado em vez de mal-respondido** — checagem que não pode rodar tem de dizer isso, que é a regra que o 1.6.18 já pagou para aprender (1.6.91).

**E um terceiro intermitente só de Windows** (1.6.92), que passou na execução seguinte do mesmo conteúdo. Os três têm a mesma forma: cada um supõe que um trabalho cabe numa janela que aquele runner não garante. Enfileirei como **um** achado, não três — o conserto é o mesmo movimento nos três, parar de medir tempo e medir o evento. Três itens separados de "teste instável" convidam a três asserções afrouxadas, que tira a evidência junto com o vermelho.

CI verde, 265 versões com Release, gate em 33 passos.

