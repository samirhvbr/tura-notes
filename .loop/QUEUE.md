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

- [x] R4a — **metade feita, metade é sudo.** `emulator`, `platform-tools` e a system image `android-35;google_apis;x86_64` baixados, licenças aceitas, AVD `tura` criado (Pixel 6, API 35). O que falta não é download: o emulador x86_64 exige KVM, e `/dev/kvm` não existe. Diagnóstico exato: a CPU é AMD e expõe `svm`, então a virtualização **está ligada na BIOS**; o que falta é o módulo carregado e o usuário no grupo. Virou item no quadro com os dois comandos
- [x] R4b — ADR-083 escrita e `.loop/` commitado (1.6.19, empurrado). Decide que é memória versionada e entra na mesma ressalva de idioma do `.continue/`, com a linha desenhada estreita: *diretório cujo conteúdo é trabalho em curso, não produto do trabalho*. E diz que é local — o bloco de idioma é eco regenerado do repodocs, então generalizar passa por lá, como ADR-009 e ADR-010 passaram
- [x] R4c — `docs/OWNER-ACTS.md` (1.6.20, empurrado). Ler o script achou a fila errada sobre o próprio procedimento: ela mandava assinar "a versão corrente", e o script recusa o que não for `X.Y.0` — a versão a assinar é **1.6.0**, cujos anexos conferi na Release. A página registra a ordem do script, porque a ordem é a substância: checksum antes de assinar, e verificação contra a metade pública **commitada**, não contra a chave que acabou de assinar
- [x] R4d — `ACCEPTANCE-0.1d.md` estendido (1.6.21). Parou no I10 onde o 0.13.0 deixou; I11–I14 cobrem o drawer (1.6.14), a barra de Markdown (1.6.15) e o banner de backend não-atômico (1.6.17), mais as linhas automatizadas que fazem par. **Os três primeiros não precisam de aparelho:** o drawer é decidido por largura, não por plataforma, então estreitar a janela do desktop abaixo de 720px e voltar exercita a fronteira nos dois sentidos — coisa que um telefone, que está sempre de um lado só dela, não faz. O I14 ficou `n/a` com o motivo escrito: `LocalFs` responde `atomic_replace = true` em toda plataforma, então o banner não aparece em pasta local e nenhum passeio o produz
- [x] R4e — `docs/ACCEPTANCE-0.6.md` criado (1.6.22). S1–S25, com cada controle nomeado pela palavra que aparece nele — lida do catálogo de i18n, não de memória. **Duas máquinas ou nada:** pasta sincronizada com ela mesma não prova coisa alguma, e o passeio do 0.5 vem antes. As falhas são percorridas de propósito: o S1 roda o teste de conexão errado quatro vezes antes de acertar, porque quatro frases mandando o dono para quatro máquinas diferentes é o recurso. S20 e S21 são as duas caixas em que o marco se apoia — byte a byte com `cmp`, e nada apareceu sem ser pedido. A metade de aparelho ficou declarada como não percorrível (o 0.4 ainda não produz aplicativo instalável) em vez de virar caixa que ninguém pode marcar
- [x] R4f — `ACCEPTANCE-0.5.md` estendido (1.6.23). Estava escrito contra o 0.18.0, quando o 0.5 era um servidor; o que chegou depois é o que faz dele uma **implantação** — nome público, CDN na frente, script que atualiza, assinatura que trava a atualização, e jeito de emitir credencial sem ssh. A página ainda dizia *no public deployment is claimed by this milestone*, que deixou de ser verdade em 16/09. **Duas caixas o servidor não consegue checar sobre si mesmo:** Cloudflare em Flexible mente o `X-Forwarded-Proto`, e `NOTES_SERVER_TRUSTED_HOPS` precisa valer o número de proxies que existe de fato. A assinatura é percorrida como **recusa**, não como sucesso — e está bloqueada até o OWNER-ACTS §1, o que a página diz em vez de listar passo que não roda
- [ ] R4g — **bloqueado pelo KVM.** Com o emulador de pé: instalar o app gerado e registrar o que de fato acontece — abrir, escolher pasta, listar, editar. É a primeira evidência de execução do 0.4; até aqui só existe evidência de compilação

## Reabastecimento — 17/09, medido

A rodada 4 ficou com um item só, e ele é `sudo`. Antes de encerrar, medi o que
ainda dá para produzir sem sudo e sem aparelho, e achou-se um buraco de verdade:

- **`docs/ACCEPTANCE-0.7.md` não existe.** O 0.7 (MCP remoto) foi entregue em
  1.6.5, o item saiu do `.continue/`, e `docs/MCP-0.7.md` é o contrato — mas
  todo marco entregue neste repositório tem página de aceite e este não tem.
  Medido: `ls docs/ACCEPTANCE-*` traz 0.1a, 0.1b, 0.1c, 0.1d, 0.2, 0.3, 0.4,
  0.5 e agora 0.6. Falta o 0.7.
- **`ACCEPTANCE-0.2.md` e `ACCEPTANCE-0.3.md` não são tocados desde 10 e 11/09**
  (0.16.0 e 1.0.0). Precisa medir se o que entrou depois muda alguma coisa neles
  — e, se não mudar, escrever que não muda, em vez de deixar a dúvida de pé.

- [x] R4h — `docs/ACCEPTANCE-0.7.md` criado (1.6.25). Era o único marco entregue
  sem página de aceite, e o `MCP-0.7.md` nem estava listado no `docs/README.md`.
  **É a página mais curta do repositório, e esse é o argumento do próprio marco:**
  o MCP remoto não acrescentou comportamento sobre as notas, então o que resta é
  o que nem o 0.3 nem o 0.5 cobrem — um cliente MCP de verdade. A linha M2 é a que
  pode virar ADR: o contrato recusa abrir SSE, e o primeiro cliente que exigir um
  decide se isso se mantém. M11 e M12 existem por causa de *quando* isso entrou:
  release que traz transporte de rede é exatamente quando "o app não abre porta"
  para de ser conferido
- [ ] R4i — medir 0.2 e 0.3 contra o que entrou depois de 10/09 e 11/09.
  Estender o que estiver desatualizado; e onde não estiver, registrar a medição
  na própria página, com a data, para o próximo turno não remedir

## Colhidos automaticamente
