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
| **Atualização desktop** | **Metade rodou em 17/09, e esta linha dizia que tinha rodado inteira.** Medido de fora em 18/09: os dois feeds Linux estão publicados e legíveis — `linux-x86_64-deb.json` e `linux-x86_64-appimage.json`, ambos em `1.6.3`, assinaturas de 416 e 420 bytes, e o `.deb` do feed baixa (HTTP 200, 7.210.292 bytes). **Mas `samirhv.com.br/p/tura-notes` ainda diz "In preparation"**, porque a ingestão no serviço de download não publicou nada: `--version` era opção global do Symfony, imprimia a versão do framework e saía 0, então o script apagava o upload e anunciava release. Corrigido para `--file-version` em 1.6.28; falta rodar o publish de novo, e para isso falta a chave do updater nesta máquina (nem `./signing.env` nem `~/.config/tura-notes/build.env` existem). **O que resta é o aceite, que nenhum script infere:** validar a atualização entre duas versões instaladas em macOS, AppImage, deb e rpm; confirmar que o `.deb` 1.6.1 remove o pacote `notes` anterior a 1.0.0 na máquina que ainda o carrega ([ADR-082](../docs/decisions.md)); e publicar os feeds de macOS quando houver build assinado lá (ver [contrato e aceite](../docs/updater.md)) | Samir / ambiente de publicação |
| [0.6 — sync](0.6-sync.md) | Aceite do dono em duas máquinas com build instalada, passo a passo em [ACCEPTANCE-0.6.md](../docs/ACCEPTANCE-0.6.md). A metade móvel espera o 0.4 produzir aplicativo instalável — até lá as linhas de aparelho não têm onde rodar | Samir |
| **0.4 — mobile** | **O que saiu entre 1.6.11 e 1.6.17:** projeto Android gerado e commitado, ponto de entrada mobile, CI checando o core nos quatro ABIs e a casca em arm64, gaveta e editor em largura cheia abaixo de 720px, barra de Markdown para teclado virtual, contrato do adaptador SAF em [MOBILE-0.4.md](../docs/MOBILE-0.4.md), e o aviso de backend não atômico na abertura. **O que resta, e quase tudo precisa de aparelho:** implementar o adaptador SAF com autorização persistida e o comportamento de revogação, documento movido, provedor offline e reautorização; polling com orçamento; fluxos de container e flush em segundo plano; entrada real de teclado virtual (acento, tecla morta, IME, seleção, colar, desfazer); o projeto **Apple**, que precisa de macOS; e o aceite em dispositivo físico. Detalhe por linha em [ACCEPTANCE-0.4.md](../docs/ACCEPTANCE-0.4.md) | Mobile agent / Samir |
| [0.1d — interface acceptance](0.1d-interface.md) | Installed-release owner walk and repeat on the following release | Samir |
| [0.2 — index acceptance](0.2-indice.md) | Installed-release owner walk and repeat on the following release | Samir |
| **0.3 — knowledge and local agents acceptance** | Installed-release owner walk and repeat on the following release; see [ACCEPTANCE-0.3.md](../docs/ACCEPTANCE-0.3.md) | Samir |
| **0.7 — MCP remoto, aceite** | Passeio a partir de um cliente MCP de verdade, que é a única parte que `server/tests/mcp.py` não cobre; passo a passo em [ACCEPTANCE-0.7.md](../docs/ACCEPTANCE-0.7.md). A linha M2 é a que pode virar ADR: o contrato recusa abrir SSE, e o primeiro cliente que exigir um decide se isso se mantém | Samir |
| **0.5 — self-hosting acceptance** | Installed-release owner walk and repeat on the following release; see [ACCEPTANCE-0.5.md](../docs/ACCEPTANCE-0.5.md) | Samir |
| **Teste intermitente no gate** | `notes-sync-client --test recovery` falhou uma vez em `edits_during_transfer_are_recaptured_without_applying_the_older_publication` e `receiver_recapture_reserves_resolution_capacity_without_discarding_history`, ambos com `ApplicationBlocked` em `stage_receiver_edits`. **Não reproduzido em 12 execuções.** **O que mudou em 1.6.10:** `ApplicationBlocked` nascia de 29 `.map_err(|_| ...)` que jogavam fora o erro de baixo — o intermitente era indiagnosticável por construção, e é por isso que doze execuções não disseram nada. A variante agora carrega a causa e a mensagem a imprime. **Próximo passo não é investigar, é esperar:** na próxima ocorrência, a saída nomeia qual chamada recusou e por quê. Até lá não há o que perseguir | Implementation |
| **Windows intermitente no CI** | Resta **uma**: `received_bytes_remain_pending_until_explicit_application` (`control.rs`), o log do peer com 3 onde se espera 4, só no Windows e alternando entre commits que não o tocam (vermelho 1.4.3, verde 1.4.4, vermelho 1.4.5). Está `#[cfg_attr(windows, ignore)]` desde 1.5.0 — intacto em Linux e macOS — e precisa de uma máquina Windows para diagnóstico. Apagar o atributo ao fechar. A outra falha (`the_tree_appears_in_well_under_a_second`, teto de relógio de parede) foi resolvida pelo ADR-080: asserção no Linux, medição publicada no sumário do CI em todas as plataformas | Samir / Implementation |
| **Anexos minor perdidos no Build** | A causa está corrigida em 1.5.5. Resta recuperar o 1.4.0, que está com zero anexos enquanto 1.5.0 e 1.6.0 têm catorze — e enquanto estiver, `deploy-server.sh` deriva `X.Y.0` e baixaria um arquivo inexistente. **Comando e verificação em [OWNER-ACTS.md](../docs/OWNER-ACTS.md) §2** | Samir |
| **Assinatura do binário do servidor** | Código entregue em 1.6.0; falta **o ato que só o dono pode fazer**, e o deploy recusa instalar até ele acontecer. **Passo a passo conferido contra o script em [OWNER-ACTS.md](../docs/OWNER-ACTS.md) §1** — inclusive o detalhe que este item tinha errado: só `X.Y.0` é aceito, então a versão a assinar é **1.6.0**, não a corrente. Ver [ADR-081](../docs/decisions.md#adr-081--the-server-binary-is-signed-with-a-key-ci-never-holds-and-a-deploy-that-cannot-verify-changes-nothing) | Samir |
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
