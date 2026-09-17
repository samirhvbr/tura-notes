---
n: 18
kind: DOC
sinal: relato
confianca: alta
ts: 2026-09-17T18:55:59-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "R5x — **bump do `reqwest` 0.13.4 → 0.13.5, revertido e parqueado até o MinGW.**"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- marcas de relato: 2

## Mensagem original

Parei o que estava fazendo para olhar isso. Dois achados, e o primeiro é uma correção minha.

**Eu te disse hoje, três vezes, que o macOS não estava publicado. Estava errado.** Medi agora: `darwin-aarch64-app.json` está em **1.6.63** e o `TuraNotes.app.tar.gz` responde 200; os feeds Linux estão em 1.6.53; a página mostra as duas versões e o `.dmg`. A publicação rodou enquanto eu trabalhava. Pior: eu tinha dito que o publish estava bloqueado por falta da chave do updater — conferi `./signing.env` e `~/.config/tura-notes/build.env`, que guardam as **credenciais de notarização**, não a chave. O `updater-release.py` usa `~/.config/tura-notes/updater.key`, que existe desde 16/09. A chave nunca faltou; eu conferi dois caminhos que não eram o dela. Corrigido no README, no runbook e na fila (1.6.66).

**Sobre o update falhar.** O feed está inocente pelo próprio sintoma: se ele mostra a versão nova, o endpoint resolveu, o JSON foi lido e a comparação rodou. Fui ler o `tauri-plugin-updater 2.11.0` em vez de chutar. No macOS a troca é em três passos — extrair o `.app.tar.gz`, **`rename` do `.app` que está rodando**, e mover o novo no lugar. O segundo passo decide tudo:

- Se der `PermissionDenied`, ele escala e **o macOS pede sua senha**. Falhando depois disso, a mensagem é *"Failed to move the new app into place"*.
- **Qualquer outro erro volta na hora e sem prompt nenhum** — e o comum é `EXDEV`, um `rename` entre sistemas de arquivos, que o `rename(2)` não faz.

Então uma pergunta separa os dois: **apareceu o prompt de senha?**

Se **não apareceu**, o app está rodando de um lugar de onde não dá para movê-lo — o `.dmg` montado, ou `~/Downloads` ainda com a quarentena, onde o Gatekeeper faz App Translocation e executa de um caminho somente-leitura em `/private/var/folders/…`. No seu Mac:

```
osascript -e 'POSIX path of (path to application "Tura Notes")'
```

Se sair qualquer coisa com `AppTranslocation` ou `/Volumes/`, é isso: fechar, arrastar para `/Applications`, e `xattr -dr com.apple.quarantine "/Applications/Tura Notes.app"`.

**E isso explica o que parecia coincidência:** todo app Tauri 2 troca o bundle do mesmo jeito, então um hábito de instalação que quebra um quebra o shvia e o sshvterm junto. Se os três falham igual, o problema é onde eles estão instalados, não o que cada um publica.

Tudo isso virou seção no `docs/updater.md` (1.6.67), com o caminho Linux junto — inclusive a medição de que o `.deb` sobre o `notes` pré-1.0.0 **funciona** hoje (`dpkg --dry-run -i` diz *"yes, will remove notes in favour of tura-notes"*), e que não funcionava antes do 1.6.1: o `/var/log/dpkg.log` desta máquina ainda tem o `half-installed` → `not-installed` de uma tentativa em 16/09.

**Um achado de CI no caminho** (1.6.68): dois vermelhos hoje em `rate_limit_bounds_authenticated_requests`, só no Windows, **em dois commits só de documentação**. O primeiro mecanismo que imaginei — balde de IP compartilhado entre os 41 testes — está errado: cada `Fixture::new` levanta o próprio servidor. É a **janela fixa de um minuto**: 61 requisições só esgotam um orçamento de 60/min se couberem numa janela, e num runner que leva 110s elas atravessam a virada. O limitador agiu certo; o teste é que é frágil. Enfileirado, porque o conserto toca Rust e o cross-check de Windows espera o MinGW.

