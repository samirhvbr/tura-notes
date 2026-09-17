---
n: 24
kind: DOC
sinal: relato
confianca: alta
ts: 2026-09-17T20:20:33-03:00
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

Mudei de método e foi o mais produtivo do dia: **executar literalmente o caminho que cada página documenta, em vez de ler.** Quatro paths, dois defeitos.

**O achado que vale seu olho** (1.6.80): rodei a configuração de MCP exatamente como o `KNOWLEDGE-0.3.md` imprime. O exemplo funciona literal — mas cinco permissões devolveram **sete** ferramentas. São **oito ferramentas atrás de seis permissões**: `Read` admite `notes_list` além de `notes_read`, e `Update` admite `notes_append` além de `notes_update`. O `MCP-0.7.md`, o `roadmap.md` §0.7 e o `security.md` — **o normativo, na linha que eu mesmo escrevi hoje no 1.6.34** — diziam *"each behind its own permission"*.

Não é preciosismo de contagem: quem escreve credencial de menor privilégio a partir dessas frases acredita que dá para conceder leitura de nota sem conceder listagem da subárvore, ou edição sem append. Não dá, e a página que consultaria diz que sim. É o formato de defeito de documentação que vira de segurança — não deixa o código errado, deixa errado o modelo que o operador tem dele. Corrigido nos três.

**Duas verificações voltaram limpas e registrei assim mesmo**, porque verificação que não acha nada é evidência: a prévia de sync (1.6.81) cumpre as quatro promessas da página dela — inclusive nunca vazar texto de nota, que conferi plantando marcadores nos corpos — e a CLI de operador (1.6.82) faz o que o `SERVER-0.5.md` imprime, **com todas as recusas saindo com código 1**. Conferi isso de propósito: a ADR-084 nasceu hoje porque um passo de release devolvia zero sem publicar nada, e recusa que sai zero é o mesmo defeito uma camada abaixo.

As duas viraram checagem datada de máquina nos documentos de aceite, **não** caixa marcada — a regra de que o passeio é seu não dobra porque uma máquina concordou com a página.

CI verde, 258 versões com Release, `Latest` em 1.6.82.

