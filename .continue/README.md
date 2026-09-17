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
| **Publicação de release** | Rodar `./build-local.sh --publish` uma vez. Host, caminho e chave estão confirmados (`test -f /srv/www/samirhv.com.br/samirhv/artisan` passa em `b3sys@100.64.100.125`); falta o ato — build assinado e notarizado, ingestão e feed. Enquanto não rodar, `samirhv.com.br/p/tura-notes` mostra "Em preparação", porque o link de download é dado e não código | Samir |
| **Atualização desktop** | Validar a atualização entre duas versões instaladas em macOS, AppImage, deb e rpm; provisionar a mesma chave no builder Linux e publicar os feeds (ver [contrato e aceite](../docs/updater.md)) | Samir / ambiente de publicação |
| [0.6 — sync](0.6-sync.md) | Installed-build and physical-device owner acceptance | Samir |
| **0.7 — remote MCP** | Expose the existing MCP capabilities through server authentication and workspace/subfolder scopes after sync is ready | Implementation |
| **0.4 — mobile** | Turn the merged foundation into usable iOS/Android applications: entry points, generated projects, UI, folder adapters, lifecycle handling and physical-device validation | Mobile agent / Samir |
| [0.1d — interface acceptance](0.1d-interface.md) | Installed-release owner walk and repeat on the following release | Samir |
| [0.2 — index acceptance](0.2-indice.md) | Installed-release owner walk and repeat on the following release | Samir |
| **0.3 — knowledge and local agents acceptance** | Installed-release owner walk and repeat on the following release; see [ACCEPTANCE-0.3.md](../docs/ACCEPTANCE-0.3.md) | Samir |
| **0.5 — self-hosting acceptance** | Installed-release owner walk and repeat on the following release; see [ACCEPTANCE-0.5.md](../docs/ACCEPTANCE-0.5.md) | Samir |
| **Teste intermitente no gate** | `notes-sync-client --test recovery` falhou uma vez em `edits_during_transfer_are_recaptured_without_applying_the_older_publication` e `receiver_recapture_reserves_resolution_capacity_without_discarding_history`, ambos com `ApplicationBlocked` em `stage_receiver_edits`. **Não reproduzido em 12 execuções** — 3 de `cargo test --workspace`, 8 do binário isolado em paralelo e 1 serial. A falha ocorreu enquanto outra sessão compilava na mesma máquina. Já se sabe que **não é contenção de lock**: os locks mapeiam para `Busy`, e `ApplicationBlocked` ali vem de `notes_core::sync::capture` recusando — o caminho que dispara quando o hash relido difere do inventariado. Falta descobrir como esse guard dispara num tempdir sem escritor externo | Implementation |
| **0.0 — platform spike** | Physical checks on Arch/Wayland/NVIDIA, iPhone and Android; see [SPIKE-0.0.md](../docs/SPIKE-0.0.md) | Samir |

## Current implementation order

1. Finish sync 0.6 according to [0.6-sync.md](0.6-sync.md). The cloud
   deployment it was waiting on is done — `tura.samirhv.com.br` answers as the
   `notes-server` behind its proxy — so what is left there is owner acceptance
   on installed builds and physical devices.
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
