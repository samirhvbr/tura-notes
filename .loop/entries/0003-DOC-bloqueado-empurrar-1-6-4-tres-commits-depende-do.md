---
n: 3
kind: DOC
sinal: relato
confianca: media
ts: 2026-09-17T12:37:42-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "**BLOQUEADO** — empurrar 1.6.4 (três commits) depende do `gcc-mingw-w64-x86-64`: a mudança toca Rust, e `notes-mcp` puxa SQLite via `notes-index`, então o cross-check do Windows não roda nem isolado. Todo o resto do gate está `all green`. Um `sudo apt install gcc-mingw-w64-x86-64` destrava"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- nenhum sinal de pergunta ou de espera

## Mensagem original

**Bloqueado, uma linha:** falta `sudo apt install gcc-mingw-w64-x86-64` — sem ele o cross-check de Windows não roda, e as quatro entregas abaixo tocam Rust, então não empurro.

Produzido nesta iteração, tudo commitado e verde localmente (`all green`, árvore limpa):

**0.7 — MCP remoto, construído inteiro.** `POST /v1/mcp` responde. Catálogo filtrado por permissão, escopo respeitado, notificação sem `id` devolve `202` vazio, `Mcp-Session-Id` ecoado e nunca exigido. Três testes em `http.rs` e um `server/tests/mcp.py` com processo e credenciais reais, já como passo do gate. Contrato promovido a `ACTIVE` e o item saiu de `.continue/`.

Duas coisas que os testes acharam, e que valem mais que o código:

- **`Session::stateless()` estava errado na primeira versão.** Marcar `initialized: true` para abrir o portão desligava o próprio ramo do `initialize` — o servidor respondia `Method not found` a um handshake. `Session` agora carrega se o transporte guarda alguma coisa, e o `Default` é escrito à mão em vez de derivado, porque um `false` derivado transformaria stdio no outro transporte sem ninguém notar.
- **Preservação de bytes atravessa o MCP.** Nota criada com CRLF volta como `\n` e continua CRLF no disco. Minha asserção inicial é que estava errada; o teste agora afirma a coisa certa.

**Um achado que não fecha.** No meio da rodada o `tauri.conf.json` apareceu com `version: 1.6.4` **e** o `©` reescrito como `\u00a9` — assinatura de `json.dump` sem `ensure_ascii=False`, ou seja, alguém reescreveu o arquivo inteiro, não só a versão. Quebrou o `version placeholder` da execução seguinte do gate. Não reproduzi: o teste sozinho não suja, o gate inteiro rodado de novo também não. A suspeita é escrita concorrente com tree principal e worktree rodando cargo juntos — exatamente o risco que a regra de um-worktree-por-sessão descreve. Está na fila para reproduzir antes de consertar, e a premissa está em `.loop/ASSUMPTIONS.md`.

Esperando push: `1.6.4` (três commits) e `1.6.5` (um). O quadro está atualizado.

