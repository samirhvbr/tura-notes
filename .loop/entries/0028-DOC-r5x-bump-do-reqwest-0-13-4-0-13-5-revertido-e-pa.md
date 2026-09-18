---
n: 28
kind: DOC
sinal: relato
confianca: media
ts: 2026-09-17T21:21:04-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "R5x — **bump do `reqwest` 0.13.4 → 0.13.5, revertido e parqueado até o MinGW.**"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- nenhum sinal de pergunta ou de espera

## Mensagem original

**Bloqueado — `sudo apt install gcc-mingw-w64-x86-64` e o SVM na UEFI.**

O achado mais pesado desta rodada veio de uma pergunta nova: **cada identificador que um documento nomeia existe no código?**

**O `ARCHITECTURE.md` §11 descreve uma detecção que ninguém escreveu** (1.6.93). A página diz que *"o adaptador reporta `Caps` por raiz"* e nomeia `statfs().f_type`, `pathconf`, `GetVolumeInformationW` e cache no `registry.db`. **Nenhuma dessas quatro chamadas existe no repositório.** O `LocalFs` responde `Caps::LOCAL`, constante de compilação chaveada pelo sistema operacional — o filesystem embaixo do workspace nunca é consultado. Consequência concreta: workspace em exFAT reporta `trash: true`, em SMB reporta `atomic_replace: true`, e o banner de backend não-atômico do 1.6.17 fica invisível **não** porque disco local é atômico — é — mas porque nada no sistema consegue responder outra coisa.

Isso também corrige uma leitura minha: no 1.6.64 eu afiei a frase do `ACCEPTANCE-0.1a` dizendo que aquelas linhas estão *"asserted rather than observed"*. Não-testado é uma afirmação; **não-implementado** é outra, e é a verdadeira.

**Mais dois no mesmo documento** (1.6.94). O `note_convert_encoding`, que a página oferece como saída do read-only de UTF-8 inválido, não existe — e o produto está **certo** em não tê-lo: reescrever bytes do usuário com base num palpite é o que a ADR-001 proíbe, e a string que o app mostra já diz *"nada será convertido sem você mandar"*. O documento prometia uma porta que o produto deliberadamente não abre. E o `FsEvent`, creditado na tabela de crates e no diagrama do watcher, também não existe — o que o `watch.rs` expõe é `Watch` e `Degraded`.

**E é exceção, não hábito** (1.6.95). A mesma checagem nos outros cinco contratos: `SYNC-0.6` 19 citados e zero ausentes, `KNOWLEDGE-0.3` 14 e zero, `MCP-0.7` 12 e zero, e as poucas ausências de `SERVER-0.5` e `SCOPE` são módulo do Apache e APIs de iOS sob `[0.4]`. O motivo é legível: o `ARCHITECTURE.md` é o mais antigo e o escrito mais à frente do código — documento de projeto que ninguém releu como descrição depois que a implementação chegou.

CI verde, 270 versões com Release, `Latest` em 1.6.95.

