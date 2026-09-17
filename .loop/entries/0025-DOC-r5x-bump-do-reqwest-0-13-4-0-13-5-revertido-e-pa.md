---
n: 25
kind: DOC
sinal: relato
confianca: alta
ts: 2026-09-17T20:30:09-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "R5x — **bump do `reqwest` 0.13.4 → 0.13.5, revertido e parqueado até o MinGW.**"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- marcas de relato: 1

## Mensagem original

**Bloqueado nos dois itens que restam — os dois um comando seu:** `sudo apt install gcc-mingw-w64-x86-64`, e o SVM na UEFI para o `/dev/kvm`.

Fechei o método de executar caminhos documentados com o mais forte deles (1.6.83): **grepei o audit atrás das três coisas que ele promete nunca guardar.** Subi o servidor, criei nota pelo `POST` documentado, li e busquei — com três marcadores plantados em três lugares diferentes: um no texto da nota, um no caminho dela, um na query de busca. Depois procurei os três no audit, mais o segredo da credencial e a palavra `Authorization`. **Os cinco: zero.**

O que ele guarda é exatamente a lista da página — UUID da credencial, operação de uma allowlist, peer, UUID de requisição, resultado, hash curto do alvo, tempo. E o **`X-Request-Id` devolvido ao cliente aparece no audit**, que é o que torna uma pergunta de suporte respondível sem perguntar à pessoa o que ela estava editando.

Três recusas caíram na mesma sessão, cada uma uma afirmação documentada: `PUT` sem `If-Match` é `428 if_match_required`, sem credencial é `401`, e o listener está em `127.0.0.1:8787` e em mais lugar nenhum — conferido com `ss -ltn`, não confiado.

**O passo de audit do seu passeio continua de pé.** Máquina confirmando que três marcadores não estão lá não é uma pessoa lendo o audit de uma sessão real e reconhecendo que nada ali descreve as notas dela. A checagem estreita o que o passeio precisa desconfiar; não substitui a desconfiança.

Cinco caminhos documentados executados no total — clone limpo, configuração de MCP, prévia de sync, CLI de operador, audit. **Dois acharam defeito, três voltaram limpos**, e os limpos viraram checagem datada de máquina nos documentos de aceite.

CI verde, 259 versões com Release, gate em 32 passos, `Latest` em 1.6.83.

