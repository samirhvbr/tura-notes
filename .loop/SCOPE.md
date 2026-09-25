# Fronteira desta rodada

## Pode entrar sem perguntar

- Commit e push em `origin/master`, com bump e `CHANGELOG.md` no mesmo commit e
  gate verde antes de cada push. Push limpo não espera ninguém.
- Corrigir documento envelhecido pela própria mudança, no mesmo passe.
- `gh release edit` no corpo de um Release **já publicado por nós**, quando o
  texto que ele carrega estiver comprovadamente errado.
- `./build-local.sh --publish` — autorizado explicitamente pelo dono em 17/09,
  resposta `voce-roda` no artefato.
- `tools/build-linux.sh --publish` **a cada minor (`X.Y.0`)**, de um worktree
  limpo em `origin/master` (nunca da arvore de trabalho, que carrega o que ainda
  nao foi commitado), e depois o feed lido de fora (`linux-x86_64-deb.json` e
  `linux-x86_64-appimage.json` na versao publicada). Autorizado pelo dono em
  24/09, resposta `q_publish_linux` no quadro. Patch (`X.Y.Z` com Z > 0) nao
  entra: continua do dono.
  **Travado no mesmo dia, por medicao:** o publish roda no servidor
  `sudo -u www-data` (o `files:add` do artisan e o `mkdir/install/mv` do feed),
  e `ssh b3sys@100.64.100.125 'sudo -n -u www-data true'` responde "a password
  is required". Senha nao se digita, e sudo esta na lista de parar. Ate o dono
  responder `q_publish_sudo`, o loop avisa no quadro quando uma X.Y.0 fica verde
  e o publish e do dono.
- Criar e apagar worktree próprio sob `~/x/`.
- Ler qualquer coisa do repositório e rodar o gate quantas vezes for preciso.

- **Depois de cada push, o CI dos quatro SOs antes do próximo item** (desde
  23/09). A rodada 6 empurrou cinco commits com `master` vermelho no CI porque só
  o gate local era olhado; dois testes supunham o disco desta máquina (btrfs,
  sensível a caixa). Vermelho no CI é o próximo item, antes de qualquer outro.
  Uma re-execução de diagnóstico é permitida **uma vez**, e só com a medição que
  mostra que o código medido não mudou — nunca para repetir até dar verde.
- **O gate roda inteiro, sem `NOTES_NO_WINDOWS_CHECK`** (desde 23/09, com o
  MinGW instalado).

## Para e registra no artefato, não pergunta no chat

Estas não são perguntas para o chat: viram linha na coleção `tasks` do artefato
https://claude.ai/artifact/Vr8WJEfiinAfji3H7Et4Md com `state: "bloqueado"`,
`who: "samir"` e a evidência medida — e o trabalho segue no próximo item.

**O quadro mudou em 21/09.** O anterior (`7PjQHdRBS4t2wSJZWA8ZLR`) não existe
mais — lido de fora, responde que não há tal artefato, coleção ou documento. O
de agora é o da revisão completa, e carrega as duas coisas ao mesmo tempo: a
seção **Decisões**, onde o dono responde, e a coleção `tasks`, uma linha por
item da rodada 6. **Manter o quadro atualizado é parte do item, não depois
dele:** ao pegar um item, `state: "fazendo"`; ao commitar, `state: "feito"` com
a versão que o carregou; ao travar, `state: "bloqueado"` com o que foi medido.
Um item commitado que o quadro ainda mostra pendente é a mesma falha que esta
rodada achou em cinco lugares — o registro que relata sucesso sem observar.

- Qualquer coisa que precise de `sudo` ou instale pacote no sistema.
- A chave privada de assinatura do servidor (`sign-server-release.sh init`) e
  qualquer ato que dependa dela.
- `workflow_dispatch` e outros atos de publicação que a fila marca como do dono.
- Aceite manual em release instalado ou em dispositivo físico.
- Reverter uma ADR, ou decidir direção de produto que uma ADR não cobre.
- Apagar dado que não seja derivado, ou reescrever histórico publicado.
- Gastar dinheiro, tocar credencial, ou publicar em host que não seja o
  `b3sys@100.64.100.125` já confirmado.

## Regra de silêncio

Enquanto o loop estiver armado, não escrever relato para o chat. O que precisa
sobreviver vai para o commit, para `docs/`, para esta fila, ou para o quadro do
artefato — que é onde o dono acompanha.
