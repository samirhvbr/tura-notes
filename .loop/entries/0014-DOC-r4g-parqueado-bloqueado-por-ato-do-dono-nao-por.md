---
n: 14
kind: DOC
sinal: relato
confianca: alta
ts: 2026-09-17T16:46:50-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "R4g — **parqueado: bloqueado por ato do dono, não por sudo.** O emulador x86_64 exige KVM e o `kvm_amd` é recusado pelo firmware (`SVMDIS` em `MSR_VM_CR`), que só sai com **Advanced ▸ CPU Configuration ▸ SVM Mode ▸ Enabled** na UEFI e um reinício — ASUSTeK TUF GAMING X570-PLUS_BR, BIOS 5043. Conferido em 18/09: `/dev/kvm` ainda não existe e o boot corrente é o de 16/09 11:23, então o reset ainda não aconteceu. Não fico esperando por isto. Quando existir: com o emulador de pé, instalar o app gerado e registrar o que de fato acontece — abrir, escolher pasta, listar, editar. É a primeira evidência de execução do 0.4; até aqui só existe evidência de compilação"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- marcas de relato: 1

## Mensagem original

Registro corrigido e a rodada 5 andando. Quadro: **https://claude.ai/artifact/7PjQHdRBS4t2wSJZWA8ZLR**

**A correção do KVM — e você estava certo, era pior do que "não era sudo".** Medi antes de escrever: a flag `svm` **não** está em `/proc/cpuinfo` num Ryzen 9 5900X. Eu tinha afirmado o contrário, e foi daí que saiu a conclusão errada. As duas linhas do kernel estão no journal do boot corrente, literais:

```
set 16 11:23:21 samirb3 kernel: SVM disabled (by BIOS) in MSR_VM_CR
set 17 16:06:12 samirb3 kernel: kvm_amd: SVM not supported by CPU 1
```

A segunda é o próprio `modprobe` que eu mandei rodar, sendo recusado. Corrigido em `.loop/STATUS.md`, na entrada `0013` e na fila — por **correção datada anexada**, não reescrita, porque o erro é a parte que ensina. O runbook **não** repetia a causa errada (não mencionava KVM); virou `OWNER-ACTS.md` §3, com as linhas do kernel como prova, o caminho na UEFI da TUF X570-PLUS e o `usermod -aG kvm` depois — que é a única parte que sempre foi `sudo`. `ACCEPTANCE-0.4.md` agora diz por que nada ali nunca foi visto rodando.

**`/dev/kvm` ainda não existe** (boot corrente é o de 16/09), então parquei o R4g junto com o publish, no fim da fila — o hook entrega sempre o primeiro `- [ ]`, e item esperando outra pessoa no topo gasta um turno por parada dizendo que nada aconteceu.

**Reabasteci por medição, e ela achou sete coisas — `1.6.31` a `1.6.38`:**

- **`updater.md` e a fila estavam erradas sobre a publicação, em direções opostas.** Medi de fora: os dois feeds Linux estão vivos em 1.6.3 (assinaturas de 416 e 420 bytes, o `.deb` baixa com 200), não há feed de macOS, e `/p/tura-notes` **ainda diz "In preparation"**. Nenhuma das duas páginas separava os dois passos de publicação — é por isso que cada uma errou para um lado.
- **`security.md` — que é normativo, o que ganha em conflito — não mencionava MCP uma vez sequer.** Tinha linha para o agente *lendo* e nenhuma para o agente *agindo*. Virou **ADR-084** no caminho: se `HTTP 200` não prova nada, saída zero também não — passo que publica, instala ou apaga se confere relendo o que diz ter mudado.
- **`origin/HEAD` não estava definido neste clone.** É exatamente a armadilha do badge: em `master` o script acerta por acidente, num worktree em branch própria ele lê um `version.md` que nunca foi empurrado. Consertei com `git remote set-head origin -a` e provei — `release.sh --dry-run` rodado do worktree parado em 1.6.29 passou a ler 1.6.35. Registrado no `ASSUMPTIONS.md` com como reverter.
- **`ARCHITECTURE.md`** não tinha `notes-sync`, `notes-sync-client` nem `server/`, e ainda descrevia `packages/ui/`, que nunca existiu.
- **`product.md`** ainda listava `sync` entre as coisas que o produto não faz — o marco que ganhou 26 passos de aceite anteontem.
- **`ACCEPTANCE-0.1c`** ganhou o C14: desde o 1.3.7 o botão *Install and restart* é um segundo caminho para o reinício que o §2 mede. É o reinício que ninguém percorre.

Gate verde antes de cada push, 212 versões com Release, nenhuma faltando, `Latest` em 1.6.38.

