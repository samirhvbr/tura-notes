---
n: 8
kind: DOC
sinal: relato
confianca: alta
ts: 2026-09-17T13:18:25-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "0.4d — layout mobile na aplicação React existente: editor em tela cheia, navegação em gaveta e barra de Markdown. A ADR-042 é explícita em que isso é layout na mesma aplicação, não um segundo app"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- marcas de relato: 2

## Mensagem original

Rodada 2: **12 feitos, 1 na fila.** Seis versões empurradas, `Latest` em 1.6.13.

Desde o último relato:

**1.6.11 — projeto Android no repositório.** A máquina já estava provisionada; faltava exportar duas variáveis. 40 arquivos, 388 KB, sem build output nem material de assinatura — conferido com `--untracked-files=all`, não assumido.

**1.6.12 — `android-core` no CI, e passou.** O `ACCEPTANCE-0.4.md` dizia que havia cross-check de compilação para iOS e nenhum para Android — assimetria ao contrário, já que iOS é a metade que precisa de hardware Apple e Android roda em qualquer runner Linux. Os quatro ABIs, não um, porque o `notes-index` embute SQLite e cross-compile de C é justamente o que passa numa arquitetura e quebra na outra. Verifiquei localmente antes de escrever o job: os 6 s pareceram rápidos demais, então fui ver o `sqlite3.o` — `ELF ARM aarch64`, real. **Não** pus no `check.sh`: o gate local trata pré-requisito ausente como falha dura, e um passo Android pintaria de vermelho toda máquina sem NDK, igual ao MinGW hoje.

**1.6.13 — contrato do adaptador SAF, `PROPOSED`.** Não implementei, e isso foi decisão: sem AVD e sem dispositivo, código Android/JNI não testável é pior que nenhum. O achado que justifica a página é que **`write_atomic` não mapeia** — SAF não tem rename atômico, então `Caps` precisa de uma flag de atomicidade por backend e o usuário é avisado uma vez na abertura, em vez de nunca. A regra mais afiada é a de revogação: árvore sem permissão tem que ler como `Unavailable` com motivo, **nunca como workspace vazio** — que é indistinguível de um que o usuário esvaziou.

Duas vezes nesta rodada não escrevi documento que o item pedia, e pelo mesmo motivo nas duas: o conteúdo já existia em `ACCEPTANCE-0.4.md`. Na terceira escrevi, porque aí era conteúdo novo — contrato, não checklist.

Novo na sua coluna: **emulador ou aparelho Android**. Sem ele o SAF fica em contrato e o app gerado nunca roda; um AVD pelo `sdkmanager` já destrava.

Resta na minha fila o layout mobile — esse eu consigo fazer daqui, é React em largura de telefone.

