# Fila — rodada 4, montada das suas respostas

Todas as seis perguntas do quadro foram respondidas em 17/09. Esta fila é o que
elas autorizaram, na ordem em que uma destrava a outra.

O que as respostas mudam:

- **Emulador: "pode baixar".** Autorizado — ~1 GB de download e de disco, sem
  sudo. É o que destrava o adaptador SAF e rodar o app gerado.
- **MinGW: "instalo agora".** Ato seu, ainda não aconteceu. Enquanto não, sigo
  com `NOTES_NO_WINDOWS_CHECK=1` **só** em commit que não toca Rust.
- **`.loop/`: "tudo, com uma ADR".** Escrever a ADR e commitar.
- **A outra sessão: "já encerrou".** Posso voltar ao tree principal quando for
  mais barato — mas worktree continua certo enquanto o download longo roda.
- **Aceites: 0.1d, depois 0.6, depois 0.5, "prepare tudo".**
- **Runbook: "sim".** Assinatura do servidor e anexo do 1.4.0.

⚠️ Reler `version.md` e `git log` imediatamente antes de escrever qualquer
commit, e nunca `git add -A` num tree que não seja meu.

## Pendente

- [ ] R4a — baixar `emulator` e uma system image x86_64 pelo `sdkmanager` (aceitando as licenças), criar um AVD com o `avdmanager` e provar que ele **sobe**: `adb devices` listando o emulador. Download longo: rodar em background e seguir para os itens de documento enquanto baixa
- [ ] R4b — ADR em `docs/decisions.md` decidindo que `.loop/` é memória versionada e **em que idioma**, e commitar o diretório. O argumento a defender: `.loop/` é a mesma classe de artefato que `.continue/` — pensamento em curso, escrito na língua de quem pensa — e por isso entra na mesma ressalva, em vez de virar uma quarta exceção sem critério. Se a conclusão for outra, escrever a que for
- [ ] R4c — runbook com os dois atos do dono: `tools/sign-server-release.sh init`, commit do `.pub`, assinatura da versão corrente; e o `workflow_dispatch` do Build para recuperar o anexo do 1.4.0. Conferir cada comando contra a ADR-081 e contra o que os scripts realmente fazem, não contra o que a fila diz que fazem
- [x] R4d — `ACCEPTANCE-0.1d.md` estendido (1.6.21). Parou no I10 onde o 0.13.0 deixou; I11–I14 cobrem o drawer (1.6.14), a barra de Markdown (1.6.15) e o banner de backend não-atômico (1.6.17), mais as linhas automatizadas que fazem par. **Os três primeiros não precisam de aparelho:** o drawer é decidido por largura, não por plataforma, então estreitar a janela do desktop abaixo de 720px e voltar exercita a fronteira nos dois sentidos — coisa que um telefone, que está sempre de um lado só dela, não faz. O I14 ficou `n/a` com o motivo escrito: `LocalFs` responde `atomic_replace = true` em toda plataforma, então o banner não aparece em pasta local e nenhum passeio o produz
- [x] R4e — `docs/ACCEPTANCE-0.6.md` criado (1.6.22). S1–S25, com cada controle nomeado pela palavra que aparece nele — lida do catálogo de i18n, não de memória. **Duas máquinas ou nada:** pasta sincronizada com ela mesma não prova coisa alguma, e o passeio do 0.5 vem antes. As falhas são percorridas de propósito: o S1 roda o teste de conexão errado quatro vezes antes de acertar, porque quatro frases mandando o dono para quatro máquinas diferentes é o recurso. S20 e S21 são as duas caixas em que o marco se apoia — byte a byte com `cmp`, e nada apareceu sem ser pedido. A metade de aparelho ficou declarada como não percorrível (o 0.4 ainda não produz aplicativo instalável) em vez de virar caixa que ninguém pode marcar
- [ ] R4f — roteiro de aceite do **0.5** (self-hosting), mesmo formato. Combina com o runbook do R4c, que é o que precede o aceite
- [ ] R4g — com o emulador de pé: instalar o app gerado e registrar o que de fato acontece — abrir, escolher pasta, listar, editar. É a primeira evidência de **execução** do 0.4; até aqui só existe evidência de compilação
