# `.continue/` — the queue

> **Status:** `ACTIVE` · Last reviewed 12/09/2026, repository at `1.1.0`.

This folder contains only work that has not been completed. Implemented
contracts, measurements and delivery history live in [`../docs/`](../docs/) and
[`../CHANGELOG.md`](../CHANGELOG.md).

The queue rules live in the `QUEUE-RULE` block in
[`../CLAUDE.md`](../CLAUDE.md). This README is its English index; queue items
are in Portuguese.

## Work remaining

| Item | What remains | Who unblocks it |
|---|---|---|
| **Publicação de release** | Instalar a chave em `b3sys@100.64.100.125` (recusou `publickey` a partir do Mac) e rodar `./build-local.sh --publish`: o preflight de 1.1.14 diz qual é o caminho da aplicação Laravel se o padrão estiver errado | Samir |
| **Atualização desktop** | Validar a atualização entre duas versões instaladas em macOS, AppImage, deb e rpm; provisionar a mesma chave no builder Linux e publicar os feeds (ver [contrato e aceite](../docs/updater.md)) | Samir / ambiente de publicação |
| **Release gate repairs** | Resolve the macOS watcher startup/index-under-change test failures in `notes-core/tests/deep.rs`; rerun the full gate (see [build verification](../docs/runbook.md#linux-build-verification-103)). The cross-platform Clippy blocker was resolved in 1.1.1. | Implementation |
| [0.6 — sync](0.6-sync.md) | Installed-build and physical-device owner acceptance | Samir |
| **Cloud deployment** | Run `notes-server` on `100.64.100.125`, the host that serves samirhv.com.br, behind `tura.samirhv.com.br`: the unit and the nginx/Apache/Caddy templates are in [`server/cotenant/`](../server/cotenant/) and the contract in [SERVER-0.5.md § Co-tenant deployment](../docs/SERVER-0.5.md#co-tenant-deployment-behind-an-existing-site). The DNS record exists and still answers from the default vhost; the vhost, the certificate and the running process do not | Samir |
| **0.7 — remote MCP** | Expose the existing MCP capabilities through server authentication and workspace/subfolder scopes after sync is ready | Implementation |
| **0.4 — mobile** | Turn the merged foundation into usable iOS/Android applications: entry points, generated projects, UI, folder adapters, lifecycle handling and physical-device validation | Mobile agent / Samir |
| [0.1d — interface acceptance](0.1d-interface.md) | Installed-release owner walk and repeat on the following release | Samir |
| [0.2 — index acceptance](0.2-indice.md) | Installed-release owner walk and repeat on the following release | Samir |
| **0.3 — knowledge and local agents acceptance** | Installed-release owner walk and repeat on the following release; see [ACCEPTANCE-0.3.md](../docs/ACCEPTANCE-0.3.md) | Samir |
| **0.5 — self-hosting acceptance** | Installed-release owner walk and repeat on the following release; see [ACCEPTANCE-0.5.md](../docs/ACCEPTANCE-0.5.md) | Samir |
| **0.0 — platform spike** | Physical checks on Arch/Wayland/NVIDIA, iPhone and Android; see [SPIKE-0.0.md](../docs/SPIKE-0.0.md) | Samir |

## Current implementation order

1. Finish sync 0.6 according to [0.6-sync.md](0.6-sync.md), which now starts
   with the cloud deployment: there is nothing to accept until a server is
   running somewhere the devices can reach.
2. Build remote MCP 0.7.
3. Continue the mobile 0.4 track.
4. Perform owner acceptance and platform checks when the required installed
   builds and devices are available.

## Where the delivered record lives

| Subject | Record |
|---|---|
| Product specification | [SCOPE.md](../docs/SCOPE.md) |
| Implemented architecture | [ARCHITECTURE.md](../docs/ARCHITECTURE.md) |
| Milestone delivery order | [roadmap.md](../docs/roadmap.md) |
| Sync contract and implementation history | [SYNC-0.6.md](../docs/SYNC-0.6.md) |
| Older planning drafts | [docs/history/](../docs/history/) |
| Version-by-version history | [CHANGELOG.md](../CHANGELOG.md) |

No manual acceptance is inferred from CI, unit tests or command-line checks.
