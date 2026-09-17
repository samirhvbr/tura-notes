---
n: 16
kind: DOC
sinal: relato
confianca: media
ts: 2026-09-17T17:59:08-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "R5x — **bump do `reqwest` 0.13.4 → 0.13.5, revertido e parqueado até o MinGW.**"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- nenhum sinal de pergunta ou de espera

## Mensagem original

**Bloqueado nos três itens restantes, todos atos seus:** `/dev/kvm` (SVM travado no firmware), a chave do updater (nem `./signing.env` nem `~/.config/tura-notes/build.env` existem), e o MinGW (`sudo apt install gcc-mingw-w64-x86-64`) — sem ele não dá para validar o bump do `reqwest`, que mexe no `windows-core`.

**O achado que vale acordar para:** o CI estava **vermelho há 47 execuções seguidas**, desde o 1.6.0, e o gate local ficou verde o tempo todo. Duas causas empilhadas — o runner não tem `minisign`, e o `cotenant.py` rodava um script bash com `sh`, onde o dash se comporta diferente por versão (aqui seguia até a asserção, no runner morria antes). Verde aqui e vermelho lá é a pior combinação: o gate local passa a atestar exatamente o que o CI reprova. **Agora verde, os onze jobs.** E não achei olhando o CI — achei porque pus um passo meu naquele job e fui conferir se o *meu* passava.

`1.6.31` a `1.6.57`, gate verde antes de cada push, 233 versões com Release, `Latest` em 1.6.57.

**Cinco guards novos no gate (26 → 31 passos)**, cada um quebrado de propósito antes de subir e visto falhar com arquivo e linha: links de documentação (arquivo **e** âncora), citação de ADR sem âncora, vocabulário de status de ADR, página fora do índice, e **paridade entre o gate e o CI** — esse último achou que o smoke do MCP remoto, única prova ponta a ponta do 0.7, nunca tinha rodado em workflow nenhum desde o 1.6.5.

Outros achados medindo documento contra código: o `product.md` estava `PROPOSED` dizendo *"nothing described here has been built yet"* — pela regra de ouro 2, a página que o `CLAUDE.md` manda ler antes de mudar comportamento de produto era a que cede numa contradição. O `security.md`, normativo, não mencionava MCP nenhuma vez. O `README.md` parava em *"milestones 0.1, 0.2 and 0.3"* e dizia **macOS is published** — nenhuma Release carrega `.dmg`, não há feed de macOS, e a página ainda diz *In preparation*. E o `origin/HEAD` não estava definido neste clone, que é a armadilha que pôs o badge no 1.6.6 — consertado e provado.

Uma coisa que **desfiz**: o bump do `reqwest` arrastava `getrandom 0.3→0.4` e `windows-core 0.61→0.62`, o gate fechou vermelho no `clippy (windows)`, e usar o job Windows do CI para passar por cima da regra local seria esvaziar a regra. Revertido, com o comando que destrava na fila.

Quadro: **https://claude.ai/artifact/7PjQHdRBS4t2wSJZWA8ZLR**

