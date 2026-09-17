---
n: 9
kind: DOC
sinal: relato
confianca: media
ts: 2026-09-17T13:23:30-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "0.4e — barra de Markdown para teclado virtual: negrito, itálico, link, lista, cabeçalho e código, acima do teclado e só onde a gaveta sobrepõe. É a última linha do bullet de interface do `ACCEPTANCE-0.4.md`"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- nenhum sinal de pergunta ou de espera

## Mensagem original

**1.6.14 — a gaveta mobile**, empurrada, gate `all green`.

A aplicação não tinha **nenhuma** media query de largura em 933 linhas de CSS — é assim que "desktop-first" parece quando a metade mobile nunca foi escrita. Abaixo de 720px a barra lateral sai do fluxo e sobrepõe com scrim, o editor toma a janela, o split empilha, e os safe-area insets entram na gaveta, no rail e na barra de status. O rail fica visível de propósito: é o único caminho de volta, e gaveta sem puxador é gaveta que ninguém abre duas vezes.

**Abrir nota fecha a gaveta, e só onde ela sobrepõe.** No telefone, abrir sem fechar deixa a nota pedida atrás da coisa que pediu; no desktop a barra é coluna e fechar a cada abertura seria o app brigando com o usuário. A chamada vive em `tabs.activate`, por onde toda rota que mostra nota passa — árvore, paleta, busca, link — então está escrita uma vez, não em cada uma.

**O breakpoint é um número em dois arquivos**, porque CSS não lê constante de TypeScript. O `ui.ts` exporta, o `matchMedia` pergunta por aquela string exata, e um passo novo do gate lê a query do store e falha se o CSS divergir. Conferi movendo o CSS para 700px — o passo falha, que é a razão inteira de ele existir. Um layout que sobrepõe numa largura enquanto o store fecha a barra em outra é o tipo de bug que o usuário nota e ninguém reproduz.

Quatro testes, incluindo o que importa para o próprio runner: ambiente sem `window` ou sem `matchMedia` não é tela estreita e não pode ter a barra fechada por baixo.

Rodada 2: **13 feitos, 1 na fila** — a barra de Markdown do teclado virtual, que separei como item próprio em vez de empurrar junto. Sete versões nesta rodada, `Latest` em 1.6.14.

Na sua coluna continuam: emulador ou aparelho Android (sem ele o SAF fica em contrato e o app gerado nunca roda), MinGW, assinatura do binário do servidor, anexo do 1.4.0, validação da atualização nos quatro formatos, máquina Windows, aceites em release instalado, iOS precisando de um Mac — e a pergunta sobre a outra sessão.

