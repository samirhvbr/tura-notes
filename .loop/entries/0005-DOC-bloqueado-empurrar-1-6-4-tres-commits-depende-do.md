---
n: 5
kind: DOC
sinal: relato
confianca: media
ts: 2026-09-17T12:42:49-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "**BLOQUEADO** — empurrar 1.6.4 (três commits) depende do `gcc-mingw-w64-x86-64`: a mudança toca Rust, e `notes-mcp` puxa SQLite via `notes-index`, então o cross-check do Windows não roda nem isolado. Todo o resto do gate está `all green`. Um `sudo apt install gcc-mingw-w64-x86-64` destrava"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- nenhum sinal de pergunta ou de espera

## Mensagem original

**Bloqueado, terceira vez, mesma linha:** `sudo apt install gcc-mingw-w64-x86-64`.

Desta vez tentei destravar sozinho antes de parar. `apt-get download` funciona sem privilégio, então baixei os quatro pacotes e extraí com `dpkg-deb -x` num prefixo do scratchpad. O compilador roda, reporta `GCC 14-posix` e o `-E -v` lista o diretório de headers **correto** — mas um `#include <stdio.h>` falha dizendo que o arquivo não existe, com o arquivo existindo exatamente naquele caminho.

**Abandonei em vez de forçar, e é decisão, não desistência.** Dava para insistir com `-I`, mexer em sysroot, caçar por que o driver não enxerga o próprio caminho. Mas o passo existe para *provar* que o código compila para Windows, e um verde arrancado de uma toolchain que precisei convencer a funcionar não prova isso — seria um verde em que eu mesmo não confiaria. Nada foi instalado no sistema e o `PATH` nunca saiu de um comando.

**Também considerei empurrar assim mesmo, e o argumento é bom:** 28 dos 29 passos verdes, nenhum `cfg(windows)` no que mudei, e o CI roda um job de Windows de verdade no push — mais forte que o type-check cruzado local. Descartei porque a regra "gate verde antes de cada push" é sua, dita a mim diretamente, e eu já usei a escotilha uma vez para commits só de documento. Decidir sozinho que ela é negociável em mudança de código não é premissa reversível; é rebaixar seu critério sem perguntar. As duas alternativas estão em `.loop/ASSUMPTIONS.md` com o porquê.

Estado: fila 16/17, seis commits prontos (`1.6.4` ×3, `1.6.5`, `1.6.6`), gate `all green` menos esse passo.

O loop segue armado e retoma sozinho quando o MinGW existir. Se preferir parar a rodada: `touch /home/samir/x/tura-notes/.loop/STOP`.

