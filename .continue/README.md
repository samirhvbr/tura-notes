# `.continue/` — the queue

> **Status:** `ACTIVE` · Last reviewed 08/10/2026, repository at `1.10.27` —
> every row below checked against what it names. `tools/queue-stamp.sh` fails
> the gate when this file changes and this line still names an older version.
>
> It said *"last reviewed 12/09/2026, repository at `1.1.0`"* until then, on
> the page `CLAUDE.md` tells every session to read **first**. A stamp fifty
> versions behind invites a reader to distrust the rows — or, worse, to trust
> the ones that changed underneath it.

This folder contains only work that has not been completed. Implemented
contracts, measurements and delivery history live in [`../docs/`](../docs/) and
[`../CHANGELOG.md`](../CHANGELOG.md).

The queue rules live in the `QUEUE-RULE` block in
[`../CLAUDE.md`](../CLAUDE.md). This README is its English index; queue items
are in Portuguese.

## Work remaining

| Item | What remains | Who unblocks it |
|---|---|---|
| **Atualização desktop** | **Measured from outside on 08/10**: all three feeds (`linux-x86_64-deb`, `linux-x86_64-appimage`, `darwin-aarch64-app`) at `1.10.25`, every signature naming its version (ADR-101, observed in production), and `/p/tura-notes` lists up to `1.10.25`. Publishing and the key are no longer missing (the key is `~/.config/tura-notes/updater.key`). **What remains is the acceptance, which no script infers:** an installed upgrade between two versions on macOS, AppImage, deb and rpm, and checking that the `1.6.1` `.deb` removes the pre-`1.0.0` `notes` package on the machine that still has it (ADR-082). Answered on 24/09: installation stays explicit (R8-02), and the loop publishes the Linux feed at each minor from a clean worktree (R8-03). **An installed 1.6.x cannot install any update** (its editor barrier, fixed in 1.7.0), so the machine still on `1.6.100` leaves it by hand once — [OWNER-ACTS.md §5](../docs/OWNER-ACTS.md#5-leave-16x-by-hand-once). Full state in [updater.md](../docs/updater.md#what-is-published-measured-from-outside--08102026) | Samir |
| [0.6 — sync](0.6-sync.md) | Aceite do dono em duas máquinas com build instalada, passo a passo em [ACCEPTANCE-0.6.md](../docs/ACCEPTANCE-0.6.md). A metade móvel espera o 0.4 produzir aplicativo instalável — até lá as linhas de aparelho não têm onde rodar. **E o `0.6-sync.md` carrega uma lacuna além do aceite:** retenção mais ampla, ciclo de vida no celular e aceitação de dispositivo são nomeados como abertos no `CLAUDE.md` e em duas seções do `SYNC-0.6.md`, e não estão especificados em lugar nenhum — as três perguntas que decidiam isso foram **respondidas em 23/09** (ADR-086, 087, 088) e viraram trabalho da rodada 7: R7-05 (retencao) feito em 1.8.42; R7-04 (ADR-096, accepted 24/09) is built: server routes in 1.8.66, the app's device list and revocation in 1.9.0; R7-08 waits for a device | Samir |
| **0.4 — mobile** | **O que saiu entre 1.6.11 e 1.6.17:** projeto Android gerado e commitado, ponto de entrada mobile, CI checando o core nos quatro ABIs e a casca em arm64, gaveta e editor em largura cheia abaixo de 720px, barra de Markdown para teclado virtual, contrato do adaptador SAF em [MOBILE-0.4.md](../docs/MOBILE-0.4.md), e o aviso de backend não atômico na abertura. **O que resta, e quase tudo precisa de aparelho:** implementar o adaptador SAF com autorização persistida e o comportamento de revogação, documento movido, provedor offline e reautorização; polling com orçamento; fluxos de container e flush em segundo plano; entrada real de teclado virtual (acento, tecla morta, IME, seleção, colar, desfazer); o projeto **Apple**, que precisa de macOS; e o aceite em dispositivo físico. **None of it has been seen running.** The firmware bit that kept the x86_64 emulator off this machine (`SVMDIS`, [OWNER-ACTS.md §3](../docs/OWNER-ACTS.md)) no longer decides anything: since ADR-092 (23/09) the emulator and the Simulator run on the owner's MacBook, where the Android emulator needs no KVM, and the physical device is an Android over USB — [OWNER-ACTS.md §4](../docs/OWNER-ACTS.md#4-run-milestone-04-on-the-macbook). Polling with a budget waits for the SAF adapter, the only one that would declare a budget other than today's 5 s (R8-01). Line-by-line detail in [ACCEPTANCE-0.4.md](../docs/ACCEPTANCE-0.4.md) | Samir (MacBook) / Mobile agent |
| [0.1d — interface acceptance](0.1d-interface.md) | Installed-release owner walk and repeat on the next minor release (`X.Y.0`) | Samir |
| [0.2 — index acceptance](0.2-indice.md) | Installed-release owner walk and repeat on the next minor release (`X.Y.0`) | Samir |
| **0.3 — knowledge and local agents acceptance** | Installed-release owner walk and repeat on the next minor release (`X.Y.0`); see [ACCEPTANCE-0.3.md](../docs/ACCEPTANCE-0.3.md) | Samir |
| **0.7 — MCP remoto, aceite** | Passeio a partir de um cliente MCP de verdade, que é a única parte que `server/tests/mcp.py` não cobre; passo a passo em [ACCEPTANCE-0.7.md](../docs/ACCEPTANCE-0.7.md). A linha M2 é a que pode virar ADR: o contrato recusa abrir SSE, e o primeiro cliente que exigir um decide se isso se mantém | Samir |
| **0.5 — self-hosting acceptance** | Installed-release owner walk and repeat on the next minor release (`X.Y.0`); see [ACCEPTANCE-0.5.md](../docs/ACCEPTANCE-0.5.md) | Samir |
| **Windows intermitente no CI** | One left: `received_bytes_remain_pending_until_explicit_application` (`control.rs`), the peer's log at 3 where 4 is expected, Windows only and not every time (red 1.4.3, green 1.4.4, red 1.4.5). `#[cfg_attr(windows, ignore)]` since 1.5.0, intact on Linux and macOS. **Since 1.8.65 the failing assertion names the guard**: it prints every reason the new-note capture can have for taking nothing, with each inventory file and the note it matched. The owner chose to run it on a Windows machine (24/09); the steps are [OWNER-ACTS.md §6](../docs/OWNER-ACTS.md#6-run-the-windows-intermittent-on-a-windows-machine). Remove the attribute when the cause is fixed | Samir (Windows machine) |
| **Anexos minor perdidos no Build** | A causa está corrigida em 1.5.5. Resta recuperar o 1.4.0, que está com zero anexos enquanto 1.5.0 e 1.6.0 têm catorze — e enquanto estiver, `deploy-server.sh` deriva `X.Y.0` e baixaria um arquivo inexistente. **Comando e verificação em [OWNER-ACTS.md](../docs/OWNER-ACTS.md) §2** | Samir |
| [AI assistant](assistente-ia.md) | **Built in 1.10.0 to 1.10.5** (the `notes-ai` crate, both providers, keys in the system keychain, the chat, edits with a single undo, `docs/AI.md`). What remains is the owner's walk with a real key and a real model, [ACCEPTANCE-AI.md](../docs/ACCEPTANCE-AI.md): no test has spoken to a provider. The spec leaves this folder when that walk passes ([ADR-100](../docs/decisions.md#adr-100--an-opt-in-ai-assistant-calls-the-provider-from-rust-keeps-the-key-in-the-system-keychain-and-edits-the-open-note-through-the-editor)) | Samir |
| **Remote folder and sign-in with the site** | **Built in 1.9.8 to 1.10.24** (ADR-099, 102, 104, 105): editing the server's notes in place, following the server every ten seconds, rename and folders in the tree, and the desktop half of signing in to the owner's site. What remains is the owner's walk against the deployed server, [ACCEPTANCE-remote.md](../docs/ACCEPTANCE-remote.md) (22 rows, none ticked); the `tura://` handler and the Device sync entry (R10-03b); the site's three routes ([PAIRING.md](../docs/PAIRING.md), `PROPOSED`); the mobile glue waits for 0.4 | Implementation, Samir |
| **0.0 — platform spike** | Physical checks on Arch/Wayland/NVIDIA, iPhone and Android; see [SPIKE-0.0.md](../docs/SPIKE-0.0.md) | Samir |

## Current implementation order

1. Finish sync 0.6 according to [0.6-sync.md](0.6-sync.md). The cloud
   deployment it was waiting on is done — `tura.samirhv.com.br` answers as the
   `notes-server` behind its proxy — so what is left there is owner acceptance
   on installed builds and physical devices.
2. Continue the mobile 0.4 track.
3. Perform owner acceptance and platform checks when the required installed
   builds and devices are available.

Remote MCP 0.7 left this list in 1.6.5: `POST /v1/mcp` answers from the same
catalogue, credential and scopes the REST API uses, and the contract is
[MCP-0.7.md](../docs/MCP-0.7.md), now `ACTIVE`.

## Where the delivered record lives

| Subject | Record |
|---|---|
| Product specification | [SCOPE.md](../docs/SCOPE.md) |
| Implemented architecture | [ARCHITECTURE.md](../docs/ARCHITECTURE.md) |
| Milestone delivery order | [roadmap.md](../docs/roadmap.md) |
| Sync contract and implementation history | [SYNC-0.6.md](../docs/SYNC-0.6.md) |
| Remote MCP contract | [MCP-0.7.md](../docs/MCP-0.7.md) |
| Older planning drafts | [docs/history/](../docs/history/) |
| Version-by-version history | [CHANGELOG.md](../CHANGELOG.md) |

No manual acceptance is inferred from CI, unit tests or command-line checks.
