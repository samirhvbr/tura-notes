# Fronteira desta rodada

## Pode entrar sem perguntar

- Commit e push em `origin/master`, com bump e `CHANGELOG.md` no mesmo commit e
  gate verde antes de cada push. Push limpo não espera ninguém.
- Corrigir documento envelhecido pela própria mudança, no mesmo passe.
- `gh release edit` no corpo de um Release **já publicado por nós**, quando o
  texto que ele carrega estiver comprovadamente errado.
- `./build-local.sh --publish` — autorizado explicitamente pelo dono em 17/09,
  resposta `voce-roda` no artefato.
- Criar e apagar worktree próprio sob `~/x/`.
- Ler qualquer coisa do repositório e rodar o gate quantas vezes for preciso.

## Para e registra no artefato, não pergunta no chat

Estas não são perguntas para o chat: viram linha na coleção `tasks` do artefato
https://claude.ai/artifact/7PjQHdRBS4t2wSJZWA8ZLR com `state: "bloqueado"`,
`who: "samir"` e a evidência medida — e o trabalho segue no próximo item.

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
