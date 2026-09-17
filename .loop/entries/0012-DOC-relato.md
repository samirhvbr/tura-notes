---
n: 12
kind: DOC
sinal: relato
confianca: alta
ts: 2026-09-17T15:01:29-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: ""
decisao: encerrou: fila zerada
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- marcas de relato: 1

## Mensagem original

**Rodada 3: fila zerada, 4 de 4.** `Latest` em 1.6.18, 194 versões com Release, nenhuma faltando, `Android core` verde no CI com a casca incluída.

Dois dos quatro itens só existiram porque **li antes de escrever**, e a leitura desmentiu o item:

**1.6.16 — ponto de entrada mobile.** Checar para Android expôs um aviso que o build desktop nunca veria: todo uso de `app` no `.setup` está atrás de `cfg(desktop)`, então no mobile a ligação fica sem uso e `-D warnings` derrubaria o build justamente na plataforma que a mudança serve. Renomear para `_app` leria como "sem uso" na plataforma onde ela mais é usada, então a closure começa com `let _ = &app;` e um comentário dizendo para qual plataforma. O CI ganhou `notes-app` em **um** ABI, não quatro — o core vai nos quatro porque o SQLite quebra por arquitetura; a casca é Rust sobre JNI e não quebra.

**1.6.17 — o item 0.4g estava errado.** Meu próprio contrato dizia que o `Caps` "ganha uma flag" de atomicidade. Não ganha: `Caps::atomic_replace` já existia, `LOCAL` responde `true` corretamente (`LocalFs` é atômico em toda plataforma — quem não será é o SAF), e o `sync.rs` já barra em três lugares. O que **não** existia era alguém contar ao usuário, que era exatamente o que o contrato prometia. Agora um workspace cujo backend responde `false` abre com aviso dizendo o que continua valendo e o que não. Corrigi o contrato em vez de deixá-lo descrevendo mudança que ninguém precisa fazer.

**1.6.18 — apareceu no caminho e virou item.** O gate morria com `sh: 1: vitest: not found` em worktree novo, três vezes nesta sessão. Agora diz `FAILED, not run — no node_modules in this checkout — run: (cd apps/notes-app && npm ci)`, pelo mesmo helper do cross-check de Windows. Continua falha e não aviso, e o gate **não** roda `npm ci` por você — gate que instala coisa altera a árvore que está conferindo, e esconderia justamente o lockfile que não resolve mais.

Também reescrevi o item `0.4 — mobile` do `.continue/`: ele ainda dizia que não existe projeto gerado nem layout, e as duas coisas saíram entre 1.6.11 e 1.6.17.

**Tudo o que resta do 0.4 precisa de emulador ou aparelho** — e essa é a primeira das seis perguntas no quadro: https://claude.ai/artifact/7PjQHdRBS4t2wSJZWA8ZLR

