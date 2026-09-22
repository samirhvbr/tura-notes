---
n: 29
kind: DOC
sinal: relato
confianca: alta
ts: 2026-09-22T15:09:51-03:00
sessao: cf91c092-dbd4-4bbf-a3af-6fba8e51f594
item_da_fila: "R6-02 — **save() desiste em silêncio enquanto há outro save em voo, e o flush de troca de aba perde teclas** (`apps/notes-app/src/stores/editor.ts:125`, severidade alto, conserto pequeno). O `inFlight` é de módulo, não por documento, e o comentário dele afirma cumprir a §5 de ARCHITECTURE — mas a §5 coloca essa fila NO CORE (mutex assíncrono por documento). O flag do front-end descarta o save que o core enfileiraria. Duas consequências com alcances diferentes: (a) `leaveCurrent()` faz `await save(true)` e deixa `open()` substituir o documento mesmo se o flush foi engolido — sem draft, sem erro; (b) o debounce do autosave é one-shot: se o timer dispara durante um save em voo, `save()` retorna e ninguém reagenda, então o buffer fica `status: \"pending\"` indefinidamente. A (b) não precisa de corrida nenhuma, só de `note_save` demorar mais que os 750 ms, e contradiz ARCHITECTURE.md:378-380 direto. Três call sites têm a mesma forma: `activate` (tabs.ts:126), `openPath` (tabs.ts:82) e `close` (tabs.ts:142) — o Ctrl+W é o mais provável na prática. **Cenário:** Workspace em mount de rede ou nota grande, `note_save` leva ~150 ms. O usuário digita, pausa 750 ms (autosave #1 sai com `sending = 5`), digita mais uma frase (`bufferVersion = 6`) e troca de aba dentro da janela. `leaveCurrent()` chama `save(true)`, que retorna na linha 125; `open()` limpa o debounce e substitui `doc`. O autosave #1 aterrissa, vê `d.noteId !== doc.noteId` e não faz nada. A versão 6 existiu só no objeto substituído: a última frase se foi, sem draft e sem banner. **Conserto:** Guardar a promessa do save em voo e fazer `save(true)` aguardá-la e reexecutar; no mínimo, `leaveCurrent()` reler `useEditor.getState().doc` depois do flush e recusar enquanto `bufferVersion !== savedVersion` (é a guarda que `reviewedMove` já usa em ReferenceReview.tsx:36-39), caindo para `keepDraft(\"exit\")`. E rearmar o debounce quando `save()` recusa por `inFlight`. *(tema: O que o usuário escreveu está menos protegido no front-end do que no core)*"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- marcas de relato: 2

## Mensagem original

**R6-01 fechado em 1.7.7, empurrado.** O loop está armado e segue sozinho — daqui em diante o registro vai para o commit, para a fila e para o quadro, não para o chat.

O que ficou montado:

| | |
|---|---|
| **Fila** | `.loop/QUEUE.md` rodada 6 — 34 ativos, 7 `🔒` esperando você, ordenados por impacto × probabilidade × barateza |
| **Quadro** | [o artefato](https://claude.ai/artifact/Vr8WJEfiinAfji3H7Et4Md) — seção **Produção**, ao vivo: 1 feito, 33 pendentes, 7 bloqueados |
| **Teto** | 10 itens (R6-01 a R6-10), sessão amarrada |
| **Parar** | `touch .loop/STOP` — funciona de qualquer lugar, sem terminal |
| **Acompanhar** | `loop-watch` de outro terminal |

Três coisas que valem sua atenção, e nenhuma é relato de progresso:

**O achado subestimou o R6-01.** A revisão disse que `resolveConflict` e `convertEol` escapavam por acidente; com o Editor montado e `readOnly` sem mudar, os três quebram igual. O teste novo falha nos cinco casos antes do conserto. Corrigi o texto da fila para dizer isso.

**`version.md` foi truncado por um erro meu** no meio do 1.7.5 — abri o arquivo para escrita antes de ler. Reparei dentro do próprio commit, nada foi empurrado quebrado, mas está aqui porque você merece saber que aconteceu.

**O gate fecha vermelho no `clippy (windows)` por falta do MinGW.** Usei `NOTES_NO_WINDOWS_CHECK=1` nos três commits, que é legítimo porque nenhum tocou Rust — mas **o R6-03 em diante toca**, e aí a escotilha não vale. `sudo apt install gcc-mingw-w64-x86-64` é ato seu e destrava tanto isso quanto o PR #19 do Dependabot.

As 10 decisões continuam sem resposta e 7 itens estão parados nelas. Quando responder — no artefato ou aqui em texto — eles voltam para a fila.

