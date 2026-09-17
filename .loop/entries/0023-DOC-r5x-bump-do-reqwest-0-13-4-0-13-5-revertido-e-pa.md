---
n: 23
kind: DOC
sinal: relato
confianca: alta
ts: 2026-09-17T20:04:03-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "R5x — **bump do `reqwest` 0.13.4 → 0.13.5, revertido e parqueado até o MinGW.**"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- marcas de relato: 2

## Mensagem original

**Bloqueado nos dois itens que restam, e os dois são um comando seu:** `sudo apt install gcc-mingw-w64-x86-64` e o SVM na UEFI.

Duas coisas fecharam desde o último relato, e a segunda veio de uma medição que eu não tinha feito ainda.

**Uma linha de aceite mandava você confirmar um recurso que já entregou** (1.6.78). Medi o catálogo de i18n ao contrário — não *toda `t()` resolve*, que o gate já checa, mas *toda string chega a uma tela* — e seis não chegam. Cinco são os controles de vista do topo que o 0.1d substituiu. A sexta é pior que morta: `rail.graphSoon` diz *"Graph view arrives at 0.3"*, o 0.3 entregou, e o `Rail.tsx` mostra Graph como painel normal. **E o I1 do `ACCEPTANCE-0.1d.md` ainda mandava verificar que "Graph is visibly disabled and its tooltip says 0.3"** — linha que você só poderia reprovar: percorre hoje, o recurso funciona, e isso se lê como defeito contra o produto em vez de documento três marcos atrasado. Não criei checador para isso: chave alcançada por template ou por variável é normal aqui, então a medição erra nos dois sentidos e seis achados em 349 chaves é varredura para repetir à mão.

**Clonei o repositório do zero e rodei** (1.6.79) — nada testava a experiência de quem chega pela primeira vez. **Toolchain de Rust sozinho: 37 de 39 passos.** As duas falhas são o par de frontend, e falham *pelo nome* (`FAILED, not run — no node_modules in this checkout`), que é o guard do 1.6.18 fazendo exatamente o que foi escrito para fazer. `npm ci` é o remédio inteiro; depois dele o gate fecha **verde em 41s, 35 passos**.

E a medição achou o que procurava sem querer: o `runbook.md` §2, *From a clean machine to running*, ainda era o esqueleto — `cp .env.example .env`, contra um arquivo que **nunca existiu** porque este aplicativo não tem configuração para copiar, e embaixo uma nota em itálico perguntando ao *autor* qual é o caminho, deixada onde está o *leitor*. É o terceiro resquício de esqueleto achado hoje, depois do `SECURITY.md` e da tabela de concessões do `.claude/`. Reescrita com o que foi medido, não com o que eu lembrava.

CI verde, 255 versões com Release, `Latest` em 1.6.79.

