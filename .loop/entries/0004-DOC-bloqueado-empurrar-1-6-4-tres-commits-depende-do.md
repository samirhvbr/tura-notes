---
n: 4
kind: DOC
sinal: relato
confianca: media
ts: 2026-09-17T12:40:28-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "**BLOQUEADO** — empurrar 1.6.4 (três commits) depende do `gcc-mingw-w64-x86-64`: a mudança toca Rust, e `notes-mcp` puxa SQLite via `notes-index`, então o cross-check do Windows não roda nem isolado. Todo o resto do gate está `all green`. Um `sudo apt install gcc-mingw-w64-x86-64` destrava"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- nenhum sinal de pergunta ou de espera

## Mensagem original

**Bloqueado, e é a mesma linha:** `sudo apt install gcc-mingw-w64-x86-64`.

A fila está esgotada — 16 de 17 feitos, e o único pendente é esse push. Cinco commits prontos em `master` local (`1.6.4` ×3, `1.6.5`, `1.6.6`), gate `all green`. Não empurro porque tocam Rust, a escotilha `NOTES_NO_WINDOWS_CHECK=1` só vale para commit de documento, e o cross-check não roda nem isolado: `notes-mcp` puxa SQLite via `notes-index`.

Nesta iteração fechei o item que estava aberto — e ele me deu uma lição contra mim mesmo:

**O `©` reescrito não era escrita concorrente.** Era o próprio `tools/stamp-version.sh`: `json.dump(conf, f, indent=2)` sem `ensure_ascii=False` reescreve todo não-ASCII a cada carimbo. Eu tinha registrado a hipótese de dois escritores em `ASSUMPTIONS.md` — estava errada, e o `grep` de quem escreve o arquivo derrubou em dois minutos o que eu ia perseguir como intermitente.

Medido: o carimbo mexia em **4 linhas**, agora mexe em **2** (a linha da versão). `test_stamping_changes_only_the_version_line` falha contra o script antigo nomeando as duas linhas. Nada jamais foi publicado errado — JSON lê as duas grafias como o mesmo caractere; o custo foi só de legibilidade, e foi caro: um carimbo deixado para trás parecia dois editores em vez de um.

**A outra metade não fechou e não fingi que fechou.** Por que um carimbo ficou para trás continua sem repro — os dois scripts restauram o placeholder na saída, inclusive em falha, e nem a suíte de packaging sozinha nem o gate inteiro sujam a árvore. Virou item em `.continue/README.md` com a instrução de reproduzir antes de mexer.

O quadro está atualizado: https://claude.ai/artifact/7PjQHdRBS4t2wSJZWA8ZLR

