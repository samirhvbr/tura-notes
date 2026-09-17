---
n: 15
kind: DOC
sinal: relato
confianca: alta
ts: 2026-09-17T17:16:36-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "R4g — **parqueado: bloqueado por ato do dono, não por sudo.** O emulador x86_64 exige KVM e o `kvm_amd` é recusado pelo firmware (`SVMDIS` em `MSR_VM_CR`), que só sai com **Advanced ▸ CPU Configuration ▸ SVM Mode ▸ Enabled** na UEFI e um reinício — ASUSTeK TUF GAMING X570-PLUS_BR, BIOS 5043. Conferido em 18/09: `/dev/kvm` ainda não existe e o boot corrente é o de 16/09 11:23, então o reset ainda não aconteceu. Não fico esperando por isto. Quando existir: com o emulador de pé, instalar o app gerado e registrar o que de fato acontece — abrir, escolher pasta, listar, editar. É a primeira evidência de execução do 0.4; até aqui só existe evidência de compilação"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- marcas de relato: 1

## Mensagem original

**Bloqueado nos dois únicos itens restantes, e os dois são atos seus:**

- **`/dev/kvm` não existe** — `SVMDIS` travado no firmware (`SVM disabled (by BIOS) in MSR_VM_CR`, boot de 16/09). Advanced ▸ CPU Configuration ▸ SVM Mode ▸ Enabled na UEFI e reiniciar. Passo a passo em `docs/OWNER-ACTS.md` §3.
- **A chave do updater não está nesta máquina** — nem `./signing.env` nem `~/.config/tura-notes/build.env`. Sem ela o publish morre na assinatura antes de chegar na ingestão corrigida.

Rodada 5 produziu `1.6.31` a `1.6.50`, todos empurrados, gate verde antes de cada push, 226 versões com Release e `Latest` em 1.6.50. O registro do KVM está corrigido nos três lugares (`STATUS.md`, a entrada `0013` e a fila), por correção datada anexada em vez de reescrita — o runbook não repetia a causa errada, e ganhou a seção §3 com as linhas do kernel como prova.

**Quatro classes de erro deixaram de depender de mim** — o gate foi de 26 para 30 passos: links de documentação (arquivo **e** âncora), citação de ADR sem âncora, vocabulário de status de ADR, e página de `docs/` fora do índice. Cada guard foi quebrado de propósito antes de subir, visto falhar com arquivo e linha, e restaurado.

Achados que valem seu olho: o `product.md` estava `PROPOSED` dizendo *"nothing described here has been built yet"* — pela regra de ouro 2, a página que o `CLAUDE.md` manda ler antes de mudar comportamento de produto era a que cede numa contradição. O `security.md`, que é normativo, não mencionava MCP nenhuma vez. E o `origin/HEAD` não estava definido neste clone, que é exatamente a armadilha que pôs o badge no 1.6.6 — consertado e provado.

Quadro atualizado: **https://claude.ai/artifact/7PjQHdRBS4t2wSJZWA8ZLR**

