---
n: 20
kind: DOC
sinal: relato
confianca: alta
ts: 2026-09-17T19:22:49-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "R5x — **bump do `reqwest` 0.13.4 → 0.13.5, revertido e parqueado até o MinGW.**"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- marcas de relato: 1

## Mensagem original

**Bloqueado nos dois itens restantes, e os dois são um comando seu:** `sudo apt install gcc-mingw-w64-x86-64` (o MinGW já segurou quatro trabalhos hoje) e o SVM na UEFI para o `/dev/kvm`.

O seu bug de atualização está fechado do lado que eu alcanço, em quatro commits:

- **1.6.69** — o app parou de esconder a causa. O `catch { set({ phase: "error" }) }` jogava fora a mensagem que o Rust já entregava pelo IPC; agora ela aparece literal embaixo da frase.
- **1.6.71** — a seção de diagnóstico do `updater.md` envelheceu *um commit* depois de escrita: ensinava a inferir onde agora dá para ler. Regra do mesmo passe quebrada por mim.
- **1.6.72** — **erro meu, corrigido**: a frase que subi no 1.6.69 mandava "mover para Applications" também no Linux, onde essa pasta não existe e a falha é outra. A dica agora segue a plataforma pelo `env_report`, sem Rust novo. Errada justamente na máquina onde foi escrita — o tipo de erro que passa por revisão porque o autor nunca o vê.
- **1.6.73** — três testes do galho, provados não-vácuos. O que protege o usuário de Linux é o `queryByText(...).toBeNull()` na dica **errada**: teste que só confere se a frase certa apareceu passa igualmente feliz quando as duas aparecem.

CI verde, 249 versões com Release, `Latest` em 1.6.73.

**O que resolveria de vez o que você viu** é o updater **recusar antes de falhar** — o `supported()` já recusa no Arch e não pergunta se o app está num lugar de onde consegue se substituir. Toca Rust, então está enfileirado com o mecanismo escrito, esperando o MinGW.

E lembrando que o build que você está rodando (1.6.63) ainda tem a mensagem antiga — a correção só chega por instalação manual, já que o que está quebrado é justamente o caminho de atualização.

