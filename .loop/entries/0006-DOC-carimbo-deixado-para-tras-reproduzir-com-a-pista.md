---
n: 6
kind: DOC
sinal: relato
confianca: alta
ts: 2026-09-17T12:57:13-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "**Carimbo deixado para trás** — reproduzir com a pista nova: há outra sessão escrevendo neste tree agora, e havia quando o vazamento apareceu. Testar diretamente se `stamp-version.sh` ou um build rodando em paralelo com outro escritor deixa o `tauri.conf.json` carimbado. Se reproduzir, consertar; se não, escrever no item do `.continue/` o que foi descartado e com que medição"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- marcas de relato: 1

## Mensagem original

Loop rearmado (rodada 2), fila puxada do `.continue/`: **6 feitos, 3 pendentes**. Trabalhando em `../tura-notes-fila`, isolado.

**O que você precisa decidir está no quadro** — https://claude.ai/artifact/7PjQHdRBS4t2wSJZWA8ZLR — sete linhas suas: outra sessão escrevendo no tree principal, assinatura do binário do servidor, anexo do 1.4.0, validação da atualização nos quatro formatos, máquina Windows, aceites em release instalado, e o MinGW.

Duas coisas aconteceram enquanto eu montava isso, e as duas mudam o quadro:

**Meus seis commits foram para o `origin` sem mim.** A outra sessão commitou `1.6.7` sobre eles no tree compartilhado e empurrou o lote. Estão lá — mas saíram **sem o cross-check de Windows** que eu estava segurando por três iterações. O bloqueio não se resolveu; foi contornado por acidente. É exatamente o primeiro incidente que a regra de um-worktree-por-sessão descreve, e agora tem um caso novo no registro.

**Três Releases não existiam.** `1.6.4`, `1.6.5` e `1.6.6` — vários bumps num push só dão Release a um. Criei com `--backfill`, e no caminho achei um pé-de-banana: rodar `release.sh` de dentro de um worktree em branch própria faz ele usar o HEAD local em vez do remoto, e ele moveu o badge `Latest` para 1.6.6. Com `--ref origin/master` voltou para 1.6.7, que é o que o `version.md` do GitHub manda.

Já produzido nesta rodada: **1.6.8**, empurrado — o item *Publicação de release* saiu do `.continue/`. O ato que ele descrevia aconteceu, e pela regra da fila um item sai quando a coisa existe, em vez de virar nota dizendo que já foi. O que restava (validar atualização entre versões instaladas) foi dobrado no item *Atualização desktop*, que é quem carrega.

Restam três, todos meus: reproduzir o carimbo deixado para trás — agora com pista forte, já que há mesmo outra sessão escrevendo —, o `ApplicationBlocked` intermitente, e destilar o 0.4 mobile.

Parar de qualquer lugar: `touch /home/samir/x/tura-notes/.loop/STOP`.

