---
n: 2
kind: DOC
sinal: relato
confianca: alta
ts: 2026-09-17T12:29:19-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "0.7c — `POST /v1/mcp` no `notes-server`: uma mensagem JSON-RPC por requisição, resposta JSON, sem SSE; `initialize`/`ping`/`tools/list`/`tools/call` atendidos sem depender de estado de sessão; `Mcp-Session-Id` aceito e ecoado quando vier, nunca exigido"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- marcas de relato: 2

## Mensagem original

**Bloqueado, e é uma linha:** `sudo apt install gcc-mingw-w64-x86-64` — precisa do seu sudo.

Os três commits `1.6.4` tocam Rust, então a escotilha `NOTES_NO_WINDOWS_CHECK=1` que usei nos commits de documento não serve aqui. Tentei type-checar só o `notes-mcp` para Windows: não dá — ele puxa SQLite via `notes-index`, e o build script do `libsqlite3-sys` morre sem o compilador. Todo o resto do gate está `all green`.

Produzido na rodada, tudo já em `origin/master` exceto o último bloco:

- **1.6.2 / 1.6.3** empurrados, Releases publicados, `Latest` em 1.6.3. O 1.6.2 precisou de `release.sh --backfill` — dois bumps num push só dão Release a um.
- **Release 1.1.11** reeditado e conferido: a correção datada aparece, a frase original continua lá, e o corpo publicado é idêntico ao trecho do CHANGELOG.
- **`--publish` rodou** — `TuraNotes_1.6.3_amd64.deb` e `.AppImage` ingeridos, os dois feeds do updater publicados e conferidos duas vezes (pelo script e por mim, por fora). `samirhv.com.br/p/tura-notes` deixou de dizer "Em preparação".
- **0.7 destilado e começado.** Lendo as fontes achei o que encolhe o milestone: o servidor **já** monta o mesmo `AgentConfig` a partir da credencial (`api.rs:417`) e chama o mesmo `AgentService` do MCP stdio — falta o envelope, não o comportamento. Contrato em `docs/MCP-0.7.md` como `PROPOSED`, `tools()` e o envelope movidos para `lib.rs` (os 6 testes de stdio passam intactos), e o roadmap corrigido: listava seis ferramentas, o código tem oito desde 0.3.

Esperando em `1.6.4`: os três commits acima. Faltam `0.7c`–`0.7f` na fila (endpoint, filtro por permissão com teste, smoke de ponta a ponta, promover o contrato para `ACTIVE`).

O quadro está com tudo isso: https://claude.ai/artifact/7PjQHdRBS4t2wSJZWA8ZLR

Duas decisões que tomei sozinho estão em `.loop/ASSUMPTIONS.md` e valem sua revisão — a escotilha do Windows para commits de documento, e deixar `.loop/` rastreado mas commitado só no fecho da rodada.

