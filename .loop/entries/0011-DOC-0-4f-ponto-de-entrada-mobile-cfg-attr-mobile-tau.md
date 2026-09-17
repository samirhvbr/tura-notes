---
n: 11
kind: DOC
sinal: relato
confianca: media
ts: 2026-09-17T14:48:03-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "0.4f — ponto de entrada mobile: `#[cfg_attr(mobile, tauri::mobile_entry_point)]` em `pub fn run()` de `apps/notes-app/src-tauri/src/lib.rs`. O `crate-type` já é `[\"staticlib\", \"cdylib\", \"rlib\"]`, então falta só o atributo. Provar que compila para Android (`cargo check --target aarch64-linux-android -p notes-app`); se compilar barato, acrescentar `notes-app` ao job `android-core`, que hoje checa só os cinco crates do core"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- nenhum sinal de pergunta ou de espera

## Mensagem original

**https://claude.ai/artifact/7PjQHdRBS4t2wSJZWA8ZLR**

Seis perguntas montadas na página, respondíveis lá mesmo. As duas primeiras destravam trabalho meu:

1. **Emulador Android** — `sdkmanager` e `avdmanager` já existem aqui, mas falta o pacote `emulator` e uma system image: ~1 GB de download e de disco na sua máquina. Não preciso de sudo, preciso da sua autorização. Com emulador eu implemento o adaptador SAF e rodo o app gerado; sem ele os dois ficam em contrato.
2. **MinGW** — se entra, se sigo com a escotilha em commits de documento, ou se você prefere que eu segure tudo até instalar.

As outras quatro: `.loop/` no repositório e em que idioma, se a outra sessão ainda está ativa, qual aceite você quer primeiro, e se quer os comandos da assinatura do servidor e do anexo do 1.4.0 num runbook.

**Loop rearmado, rodada 3, três itens** — o que resta do 0.4 que não precisa de aparelho:

- Ponto de entrada mobile (`#[cfg_attr(mobile, tauri::mobile_entry_point)]`); o `crate-type` já está certo, falta o atributo.
- A flag de atomicidade no `Caps` que o contrato SAF do 1.6.13 especificou — sem ela o contrato descreve algo que o tipo não expressa.
- O item `0.4 — mobile` do `.continue/`, que meu próprio trabalho envelheceu de novo: ainda diz que não existe projeto gerado nem layout, e as duas coisas saíram entre 1.6.11 e 1.6.15.

Deixei **fora** da fila, com o porquê escrito nela: o intermitente do gate (não há o que perseguir até a próxima ocorrência, que agora se nomeia), o do Windows (precisa de máquina Windows), os seis aceites (nenhum se infere de CI — regra do próprio `.continue/`), os atos de publicação, e o 0.4 em aparelho.

Parar de qualquer lugar: `touch /home/samir/x/tura-notes/.loop/STOP`.

