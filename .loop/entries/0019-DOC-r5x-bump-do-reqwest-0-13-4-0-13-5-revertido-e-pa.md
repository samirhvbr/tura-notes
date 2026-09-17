---
n: 19
kind: DOC
sinal: relato
confianca: alta
ts: 2026-09-17T19:08:31-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "R5x — **bump do `reqwest` 0.13.4 → 0.13.5, revertido e parqueado até o MinGW.**"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- marcas de relato: 1

## Mensagem original

**Sobre o seu update — achei a causa e o app parou de escondê-la.**

O feed está inocente pelo próprio sintoma: se ele mostra a versão nova, o endpoint resolveu e o JSON foi lido. Medi mesmo assim — `darwin-aarch64-app` em 1.6.63, payload 200.

Fui ler o `tauri-plugin-updater 2.11.0`. No macOS o passo que decide é o **`rename` do `.app` que está rodando**: `PermissionDenied` escala e **o macOS pede sua senha**; qualquer outro erro volta na hora e **sem prompt nenhum** — tipicamente `EXDEV`, um `rename` entre sistemas de arquivos. É o que acontece com app rodando do `.dmg` montado ou de `~/Downloads` ainda com quarentena, onde o Gatekeeper executa de um caminho somente-leitura.

**Uma pergunta separa os dois: apareceu o prompt de senha?** Se não apareceu:

```
osascript -e 'POSIX path of (path to application "Tura Notes")'
```

Saindo `AppTranslocation` ou `/Volumes/` — fechar, arrastar para `/Applications`, `xattr -dr com.apple.quarantine "/Applications/Tura Notes.app"`.

**E isso explica os três apps:** todo Tauri 2 troca o bundle do mesmo jeito, então o hábito de instalação que quebra um quebra o shvia e o sshvterm junto.

**Consertei o que estava do nosso lado** (1.6.69): o `stores/updater.ts` fazia `catch { set({ phase: "error" }) }` — jogava fora a mensagem que o Rust já entregava pelo IPC. Mesmo defeito que o 1.6.10 consertou no cliente de sync, com 29 `.map_err(|_| …)`. A causa real agora aparece literal embaixo da frase, e a frase genérica parou de dizer "verifique a conexão", que era ativamente enganoso. Três testes, provados não-vácuos. CI verde.

**Uma correção minha:** eu te disse hoje, três vezes, que o macOS não estava publicado. Estava errado — publicou enquanto eu trabalhava. E o motivo que dei para o bloqueio também estava errado: conferi `./signing.env` e `~/.config/tura-notes/build.env`, que são as credenciais de notarização, não a chave do updater. Ela está em `~/.config/tura-notes/updater.key` desde 16/09. Corrigido no README, no runbook e na fila (1.6.66).

**Uma coisa que vale um comando seu:** `sudo apt install gcc-mingw-w64-x86-64`. Já segurou três trabalhos hoje — o bump do `reqwest`, o conserto do segundo intermitente de Windows no CI, e fazer o updater **recusar antes de falhar** quando o app roda de onde não consegue se substituir. Esse terceiro é o que resolveria de vez o que você reportou.

Quadro: **https://claude.ai/artifact/7PjQHdRBS4t2wSJZWA8ZLR**

