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

- [x] R4a — **metade feita, metade é sudo.** `emulator`, `platform-tools` e a system image `android-35;google_apis;x86_64` baixados, licenças aceitas, AVD `tura` criado (Pixel 6, API 35). O que falta não é download: o emulador x86_64 exige KVM, e `/dev/kvm` não existe. **O diagnóstico que escrevi aqui em 17/09 estava errado** — eu disse que a CPU expunha `svm` e que a virtualização já estava ligada na BIOS. Medido em 18/09: a flag `svm` **não** está em `/proc/cpuinfo`, e o kernel tinha dito o contrário duas vezes — `SVM disabled (by BIOS) in MSR_VM_CR` no boot de 16/09 e `kvm_amd: SVM not supported by CPU 1` no modprobe de 17/09 16:06. É o `SVMDIS` travado pelo firmware, que nenhum `sudo` alcança. Procedimento certo em `docs/OWNER-ACTS.md` §3
- [x] R4b — ADR-083 escrita e `.loop/` commitado (1.6.19, empurrado). Decide que é memória versionada e entra na mesma ressalva de idioma do `.continue/`, com a linha desenhada estreita: *diretório cujo conteúdo é trabalho em curso, não produto do trabalho*. E diz que é local — o bloco de idioma é eco regenerado do repodocs, então generalizar passa por lá, como ADR-009 e ADR-010 passaram
- [x] R4c — `docs/OWNER-ACTS.md` (1.6.20, empurrado). Ler o script achou a fila errada sobre o próprio procedimento: ela mandava assinar "a versão corrente", e o script recusa o que não for `X.Y.0` — a versão a assinar é **1.6.0**, cujos anexos conferi na Release. A página registra a ordem do script, porque a ordem é a substância: checksum antes de assinar, e verificação contra a metade pública **commitada**, não contra a chave que acabou de assinar
- [x] R4d — `ACCEPTANCE-0.1d.md` estendido (1.6.21). Parou no I10 onde o 0.13.0 deixou; I11–I14 cobrem o drawer (1.6.14), a barra de Markdown (1.6.15) e o banner de backend não-atômico (1.6.17), mais as linhas automatizadas que fazem par. **Os três primeiros não precisam de aparelho:** o drawer é decidido por largura, não por plataforma, então estreitar a janela do desktop abaixo de 720px e voltar exercita a fronteira nos dois sentidos — coisa que um telefone, que está sempre de um lado só dela, não faz. O I14 ficou `n/a` com o motivo escrito: `LocalFs` responde `atomic_replace = true` em toda plataforma, então o banner não aparece em pasta local e nenhum passeio o produz
- [x] R4e — `docs/ACCEPTANCE-0.6.md` criado (1.6.22, com o S26 em 1.6.26). S1–S26, com cada controle nomeado pela palavra que aparece nele — lida do catálogo de i18n, não de memória. **Duas máquinas ou nada:** pasta sincronizada com ela mesma não prova coisa alguma, e o passeio do 0.5 vem antes. As falhas são percorridas de propósito: o S1 roda o teste de conexão errado quatro vezes antes de acertar, porque quatro frases mandando o dono para quatro máquinas diferentes é o recurso. S20 e S21 são as duas caixas em que o marco se apoia — byte a byte com `cmp`, e nada apareceu sem ser pedido. A metade de aparelho ficou declarada como não percorrível (o 0.4 ainda não produz aplicativo instalável) em vez de virar caixa que ninguém pode marcar
- [x] R4f — `ACCEPTANCE-0.5.md` estendido (1.6.23). Estava escrito contra o 0.18.0, quando o 0.5 era um servidor; o que chegou depois é o que faz dele uma **implantação** — nome público, CDN na frente, script que atualiza, assinatura que trava a atualização, e jeito de emitir credencial sem ssh. A página ainda dizia *no public deployment is claimed by this milestone*, que deixou de ser verdade em 16/09. **Duas caixas o servidor não consegue checar sobre si mesmo:** Cloudflare em Flexible mente o `X-Forwarded-Proto`, e `NOTES_SERVER_TRUSTED_HOPS` precisa valer o número de proxies que existe de fato. A assinatura é percorrida como **recusa**, não como sucesso — e está bloqueada até o OWNER-ACTS §1, o que a página diz em vez de listar passo que não roda

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
- [x] R4i — medido e fechado (1.6.26). **Um buraco de verdade:** o import de PDF
  entrou em 0.20.27 e não aparecia em documento de aceite nenhum — `grep -i pdf
  docs/ACCEPTANCE-*.md` voltava vazio. Viraram K14 e K15, e o K14 é o *cancelar*:
  o import só vira operação de workspace no salvar, então o passeio que importa é
  aquele em que nada deveria ter sido escrito. Uma frase velha (a do MinGW no 0.2,
  anterior ao 1.6.18) e uma linha que era de outro marco (o journal danificado do
  1.3.2 é do cofre de sync, não do `index.db` — virou S26 no 0.6). O 1.3.0 parecia
  candidato e não era: é latência de abertura no macOS, que o X1 já cobre. As duas
  páginas ganharam a data da medição, para o próximo passe medir a partir daqui

- [x] R4j — I15 e I16 no 0.1d (1.6.27). O **Help ▸ About** é o diálogo de onde
  sai um relato de bug, então versão errada nele é pior que diálogo nenhum — e não
  tinha caixa. O **I16** é a regra de que a chrome não é texto selecionável: o bug
  parecia de cor (captura com todo item do menu aceso) e era seleção de texto
  pintando os rótulos. A tabela automatizada ganhou o `About.test.tsx` e o
  resolvedor de i18n — o check antigo comparava os dois catálogos **entre si**,
  então chave faltando nos dois passava, que foi como um diálogo pediu nome sob o
  rótulo `tree.newNote.prompt`. A página agora carrega a data até onde foi medida

- [x] R4k — a mesma medição no 0.1a achou **uma frase que virou o contrário da
  verdade** (1.6.29). O §6 terminava dizendo que a checagem roda a cada chamada
  *"em vez de no open"* — escrito quando `resolve` conferia segmento por segmento
  e entregava o caminho para `fs::read`/`File::create`, que seguem symlink. O
  1.1.5 fechou exatamente essa janela: leitura com `O_NOFOLLOW`, e o temporário
  desvinculado e recriado com `O_CREAT|O_EXCL`, que recusa symlink. Frase velha em
  documento `ACTIVE` é pior que frase faltando, porque carrega a autoridade de
  estar escrita. A seção nomeava dois dos sete testes do `jail.rs`; os três que
  vieram com a correção estão nomeados agora

## Rodada 5 — reabastecida por medição, 18/09

O R4g está parqueado (firmware, não sudo — ver acima) e o publish está parqueado
(nem `./signing.env` nem `~/.config/tura-notes/build.env` existem). Nenhum dos
dois encerra rodada. O que a medição de hoje achou:

**Dois registros provadamente errados sobre a publicação, e errados em direções
opostas.** Medido agora, de fora:

- os dois feeds Linux **estão** publicados e legíveis — `linux-x86_64-deb.json` e
  `linux-x86_64-appimage.json`, ambos em `1.6.3`, assinaturas de 416 e 420 bytes,
  e o `.deb` baixa (HTTP 200, 7.210.292 bytes);
- não há feed de macOS (404), o que confere com a fila;
- **`samirhv.com.br/p/tura-notes` ainda diz "In preparation".**

E os documentos: `.continue/README.md` diz que a página *"não mostra mais Em
preparação"* (falso) e que deb e AppImage foram *"ingeridos"* (falso — é
exatamente o passo que o 1.6.28 achou anunciando sem publicar). `docs/updater.md`
diz o contrário, que *"the live updater feed has not been published"* e que
*"what remains is the act"* — também falso, e nas linhas 163 e 174. Nenhum dos
dois separa os **dois passos** de publicação, que é por que os dois erraram.

- [x] R5a — feito (1.6.32). Os dois registros corrigidos, e a distinção que
  faltava escrita em `docs/updater.md`: publicar o feed e ingerir no serviço de
  download são passos independentes, e é por não separá-los que cada página
  errou para um lado — o `updater.md` dizia que nada tinha sido publicado (os dois
  feeds Linux estão em 1.6.3, lidos de volta por HTTPS) e a fila dizia que os
  artefatos tinham sido ingeridos (a página ainda diz *In preparation*). A frase
  durável: **saída zero não é prova de publicação**. A metade do feed já se
  confere sozinha, refazendo o fetch e o hash; a metade da ingestão não tinha
  nada olhando, que é como ela falhou calada por seis releases. Também caiu a
  linha que dizia que mudar o nome do feed era de graça *"porque nada nunca foi
  publicado"* — era, até 17/09
- [x] R5b — medido (1.6.33). **O 0.1b voltou limpo e diz isso** com o comando que
  produziu a medição: `git log 1.5.0..HEAD` nos quatro caminhos dele devolve quatro
  commits, três são a interface móvel que já está no 0.1d e um é texto do teste de
  conexão. **O 0.1c teve dois achados.** O C14: o §2 mede restauração no reinício,
  e desde o 1.3.7 existe um *segundo* caminho para esse reinício — o botão
  **Install and restart**, que passou a fechar o workspace ele mesmo. É o reinício
  que ninguém percorre, porque quem está olhando uma versão nova não está olhando
  se as abas voltaram. E a regra herdada de i18n descrevia um check mais fraco do
  que o que roda: comparar os dois catálogos **entre si** deixa passar chave
  faltando nos dois, que foi exatamente como o diálogo de nova nota pediu nome sob
  o rótulo `tree.newNote.prompt`. A ADR-037 ficou intacta — ela diz vinte e cinco
  porque vinte e cinco foi o que se decidiu naquele dia

- [x] R5c — `docs/security.md` não mencionava MCP **nenhuma vez** (1.6.34). É o
  documento normativo, o que ganha em conflito com qualquer outro, e estava parado
  desde o 1.3.3 — antes do MCP remoto existir. O §2 tinha linha para o agente
  **lendo** (injeção de prompt) e nenhuma para o agente **agindo**, que é a metade
  que tem permissão. Duas linhas novas, e a segunda importa mais pelo que diz que
  o endpoint **não** faz: o `POST /v1/mcp` é envelope sobre o `dispatch`, não um
  segundo caminho de autorização. O §4.9 ganhou a consequência para cá: o momento
  perigoso é a chamada de ferramenta que o texto injetado defende, e o limite é o
  que a credencial admite — inclusive o catálogo **omitir** o que ela não pode usar,
  porque ferramenta que o agente enxerga é ferramenta que o agente vai defender. E
  o §8 ganhou o irmão da melhor linha dele: se `HTTP 200` não prova nada, saída
  zero também não — virou a **ADR-084**, com o caso medido

- [x] R5d — `docs/ARCHITECTURE.md` descrevia outra estrutura (1.6.35). O
  `CLAUDE.md` manda ler essa página antes de mexer em estrutura, e ela listava
  seis dos oito crates, não tinha `server/` nenhum, e ainda descrevia
  `packages/ui/` — diretório que nunca foi criado. O `notes-sync` e o
  `notes-sync-client` existem desde o 0.6 e não apareciam em lugar nenhum: nem na
  árvore, nem no diagrama, nem na tabela. **O diagrama é a parte que importa**,
  porque é o que alguém copia ao acrescentar um crate: o `notes-sync` fica ao lado
  do `notes-fs`, não acima do `notes-core`, porque domínio causal que não se
  raciocina sem filesystem é domínio que ninguém testa. E o `notes-server` é o
  único consumidor que pega `notes-core` **e** `notes-mcp`, que é exatamente a
  forma que o 0.7 defendeu. A ADR-042 ficou intacta — ela registra o que foi
  adiado naquele dia

- [x] R5e — `docs/versioning.md` não citava `--ref` uma vez sequer (1.6.36), e a
  resolução automática do `release.sh` tem um terceiro passo que dá resposta errada
  com cara de certa: `origin/HEAD`, senão `origin/<branch atual>`, senão `HEAD`
  local. **Conferido: `origin/HEAD` não estava definido neste clone**, então no
  `master` cai no passo 2 e acerta — que é por que ninguém nota — e num worktree em
  branch própria cai no passo 3 e lê um `version.md` que nunca foi empurrado. Foi
  assim que o badge foi parar no 1.6.6. Documentei e **consertei**: `git remote
  set-head origin -a`, com a prova medida (o `--dry-run` rodado do worktree parado
  em 1.6.29 passou a ler 1.6.35). Registrado no `ASSUMPTIONS.md` com como reverter

- [x] R5f — o `docs/product.md` §15 ainda listava `sync` como coisa que o produto
  não faz (1.6.37). A seção existe porque *"exclusão não declarada é lida como
  esquecimento"* — e listava justamente o marco que ganhou um roteiro de aceite de
  26 passos dois dias atrás. Tirado, com onde foi parar e o que custou: **nada** do
  §2 se moveu, porque sync é opt-in, desligado por padrão, e vai para servidor do
  próprio usuário. **Os dois vizinhos ficaram**, e essa é a parte que valia
  escrever em vez de só apagar a palavra: `user accounts` e `an official cloud
  server` não são trabalho pendente, são os dois itens da lista que o §1 não troca

- [x] R5g — rodei as quatro checagens de conformidade do `runbook.md` §7 e consertei
  a própria §7 (1.6.38). As quatro passam: gêmeos idênticos, `version.md` é `X.Y.Z`
  puro, `settings.json` parseia, e 212 versões com tag e Release, nenhuma faltando.
  **Mas a quarta é justamente o comando cujo default pode estar errado** (R5e).
  Checagem de conformidade que consegue dar "limpo" a partir do histórico errado é
  pior que checagem nenhuma, porque a saída dela é o que alguém cita. A §7 agora
  define o ponteiro antes, numa linha que é no-op quando ele já existe

- [x] R5h — a tabela de concessões do `.claude/README.md` dizia `_(nothing yet)_`
  (1.6.39). A página existe porque, nas palavras dela, *"norma que não bate com o
  artefato é defeito"* — e ilustra isso com um repositório irmão. O defeito estava
  **nela**: o `settings.json` carrega uma concessão desde 05/09 (as quatro entradas
  read-only de `gh`, com motivo ADR-019 e como reverter) escrita no `_comment` e
  nunca trazida para onde a norma manda. Registrada, com o revert explícito — apagar
  as quatro linhas não desliga a cláusula de hóspede, só faz ela perguntar toda vez.
  A página também ganhou o que **continua** sem concessão, conferido contra o arquivo
  em vez de lembrado. E os dois arquivos ainda chamavam o projeto de `notes`

- [x] R5i — o `SECURITY.md` ainda tinha o TODO do esqueleto (1.6.40). É o arquivo
  que o GitHub reconhece, o que liga o botão *Report a vulnerability* e a primeira
  coisa que alguém de fora lê — e a seção *Supported versions* ainda era o comentário
  HTML mandando substituí-la, com a frase *"no released artefact yet"* que é falsa
  há 214 Releases e um updater assinado servindo feeds vivos. Medido em vez de
  descrito: `origin/master` é a única branch de onde este projeto publica (as outras
  remotas são do Dependabot) e toda correção sai **para frente**, como `X.Y.Z` nova.
  A seção diz isso e o que decorre: nada é backportado, e *"minha versão está
  afetada?"* se responde pelo número, não por matriz de suporte

- [x] R5j — o item da fila do aceite do 0.1d ainda pedia dez áreas (1.6.41). A
  tabela é I1–I16 desde o 1.6.27. Item de fila que **subconta** é pior que um que
  superconta: quem percorre para no I10, marca o item, e as seis linhas novas não
  são percorridas por ninguém — enquanto o documento delas diz que estão pendentes
  e a fila diz que o marco acabou. Corrigido, com quais são as seis e com a coisa
  que vale saber antes de começar: três não precisam de aparelho. O `0.2-indice.md`
  foi medido no mesmo passe e está certo (X1–X13, e a tabela acaba no X13)

- [x] R5k — o `KNOWLEDGE-0.3.md`, que é de onde se configura MCP, não mencionava o
  segundo transporte (1.6.42). O `MCP-0.7.md` aponta para lá; nada apontava de
  volta. O custo é concreto, não arrumação: quem roda o servidor e quer um agente
  em outra máquina lia aquela página, achava só processo local e arquivo de config,
  e concluía que precisa expor alguma coisa — não precisa. A seção nova diz o que é
  compartilhado, que é o projeto inteiro (um catálogo, as mesmas oito ferramentas,
  o mesmo filtro de permissão, o `tools()` na lib chamado pelos dois), e o que muda,
  que é só como o chamador é identificado. E repete o que um leitor pode temer ao
  ouvir "transporte de rede": o app de desktop continua sem abrir porta, que é a
  ADR-007 e não é o que entrou no 0.7

- [x] R5l — `tools/doc-links.py` no gate (1.6.43). As correções que venho achando
  à mão são mecânicas — contagem num arquivo discordando de tabela noutro, link
  para âncora que não existe — e essa classe agora é do gate. **Âncora é a metade
  que apodrece:** arquivo renomeado faz barulho, título de ADR reescrito numa
  palavra órfã silenciosamente todo `#adr-0xx--…` que aponta para ele, e o GitHub
  responde âncora inexistente mostrando o topo da página, que se lê como link que
  funciona. Achou uma: o `architecture-proposal-v0.1.md` apontava para
  `#5-o-que-preciso-que-voce-confirme` e o título tem `você` — um circunflexo de
  distância, caindo no topo de um documento de 400 linhas. Três exclusões com
  motivo (o `fixtures/` é quebrado de propósito, o `CHANGELOG.md` não se reescreve,
  e código em bloco é sintaxe e não link) e um caminho na allowlist com o porquê: o
  `.pub` que só existe depois do OWNER-ACTS §1

- [x] R5m — 23 citações de ADR apontavam para o arquivo, não para a decisão
  (1.6.44). `[ADR-071](decisions.md)` resolve — o checker do 1.6.43 passava — e
  ainda é o link errado: cai no topo de um arquivo de 2.600 linhas com oitenta e
  tantas decisões. A regra do `CLAUDE.md` é *"não re-litigue direção decidida —
  linke a ADR"*, e citação que obriga a procurar é citação que se pula, e aí a
  direção é re-litigada. As 23 ganharam âncora derivada dos títulos, não digitada.
  **E a classe foi fechada, não limpa:** o `doc-links.py` ganhou a regra, provada
  não-vácua antes de subir (revertendo uma âncora o gate falha com arquivo e linha)

- [x] R5n — o `CHANGELOG.md` entrou no checker de links (1.6.45). O 1.6.43 pulava
  o arquivo inteiro porque ele não se reescreve — razão que vale para o histórico e
  **não** para o topo: a entrada que está sendo escrita agora é a única de onde
  ainda dá para manter um link quebrado fora, e era justamente a que ninguém
  checava. Três entradas publicadas isentas por nome. **A primeira isenção usava
  número de linha e estava errada por construção:** o arquivo cresce por cima, então
  toda entrada nova empurra as linhas históricas e des-isenta em silêncio — o
  próximo commit deixaria o gate vermelho por motivo que ninguém conserta. Peguei
  testando o guard, não lendo: inserir duas linhas para provar que link novo falha
  também fez as três linhas fixadas errarem o alvo. Chaveado por versão, provado nos
  dois sentidos

- [x] R5o — o `SELF-HOSTING.md` não tinha entrada para a falha que um terceiro
  aparelho causa (1.6.46). A seção *When it does not work* cobria formato de
  endereço, faixa privada, `403 https_required`, `413` e certificado que não sai —
  e nada sobre as duas falhas que uma implantação multi-dispositivo de verdade
  produz. **`429`, com um aparelho matando os outros:** atrás de um front que não
  encaminha o endereço do cliente, todos os aparelhos dividem um balde de 120/min,
  que passa a ser mais apertado que os 60/min que cada credencial já tem. E **CDN
  em Flexible**, que é pior que header faltando: o header é enviado e é mentira, o
  servidor manda HSTS e aceita. Escrito como coisa para ir olhar, não como coisa que
  vai falhar — que é exatamente o que a torna perigosa. As duas já estavam no
  `SERVER-0.5.md`; faltavam na página que alguém lê quando algo está errado

- [x] R5p — o `docs/product.md` estava `PROPOSED` dizendo *"nothing described here
  has been built yet"* (1.6.47). **Não era formalidade:** a regra de ouro 2 diz que
  `PROPOSED` perde qualquer contradição para um `ACTIVE`, então a página que o
  `CLAUDE.md` manda ler *antes de mudar comportamento de produto* era, no papel, a
  que cede. Promovido pela regra da própria página (*a section becomes ACTIVE when
  its code exists and works*), e nomeando o que **não** reivindica: o aplicativo
  móvel do §5 continua sem existir. Mais duas: chamava o projeto de `notes`, e
  *"how it is built is in architecture.md"* apontava para o `architecture-v1.md`,
  que é `HISTORICAL` e cujo banner diz **não construa contra este arquivo** —
  documento vivo despachando leitor para um superseded, no primeiro parágrafo

- [x] R5q — varri o repositório atrás da classe que o 1.6.47 revelou — documento
  vivo linkando para superseded — e achei sete links, três defeituosos (1.6.48).
  O `roadmap.md` e duas ADRs escreviam `[architecture.md]` apontando para o
  `architecture-v1.md`: o texto nomeia o documento vivo e o link vai para o
  `HISTORICAL`, cujo banner diz *não construa contra este arquivo*. O `docs/README.md`
  ainda trazia o `product.md` como `PROPOSED` — regra do mesmo passe quebrada por
  mim, no passe que consertava um status — e rotulava o `architecture-v1.md` de
  `SUPERSEDED`, palavra que não é uma das cinco e que o `doc-status.sh` conta num
  comentário ter sido aposentada. **Sem regra nova no gate:** quatro links legítimos
  para três defeitos dá lista de exceção maior que os achados, e aí o check é pulado

- [x] R5r — o `decisions.md` usava duas palavras para o mesmo estado, 26 vezes
  (1.6.49). O `ADR-043` ao `ADR-068`, um bloco contíguo, dizia `ACTIVE`; todo ADR
  dos dois lados dizia `ACCEPTED`. É o argumento que o `doc-status.sh` já faz sobre
  o outro vocabulário, um arquivo adiante. **As palavras de ADR não são as de
  documento, de propósito, e agora está escrito:** documento é `ACTIVE` porque
  alguém decide se constrói contra ele *agora*; ADR é `ACCEPTED` porque a decisão
  foi tomada *então*, e continua tomada depois de ser substituída. E é por isso que
  o `SUPERSEDED` no preâmbulo **não** era violação — que foi o que pareceu na
  entrada. Medir antes de editar impediu de "consertar" uma linha certa.
  `tools/adr-status.py` no gate, provado contra as duas formas de falha

- [x] R5s — três documentos não estavam no índice, e um deles fui eu que escrevi
  (1.6.50). O `OWNER-ACTS.md` nasceu no 1.6.20, foi estendido no 1.6.31, é citado
  de três lugares — e nunca entrou no `docs/README.md`, em quatro dias e dois passes
  que foram cuidadosos com a regra do mesmo passe em tudo o mais. Isso é o argumento
  para checagem em vez de hábito. `tools/doc-index.py` no gate, provado não-vácuo.
  O `docs/history/` fica de fora de propósito: são rascunhos superados, e listar três
  páginas mortas ao lado de trinta vivas piora o índice. Mais um conserto do mesmo
  passe: a tabela *where a new document goes* ainda dizia que ADR é `ACTIVE`, o que
  o 1.6.49 mudou uma hora antes

- [x] R5t — o smoke do MCP remoto rodava no gate e em workflow nenhum (1.6.51). O
  `ci.yml` tem um comentário explicando por que certas checagens são duplicadas
  lá: *"listas divergem — toda checagem abaixo existia no `check.sh` e em nenhum
  workflow, então PR que quebrava uma era mergeado verde"*. Medido: divergiu de
  novo, em quatro scripts. Três são meus, de hoje. **O quarto é mais velho e pior:
  o `server/tests/mcp.py`**, única prova ponta a ponta do 0.7, rodava local e em
  lugar nenhum do CI — PR quebrando `POST /v1/mcp` era mergeado verde desde o
  1.6.5. Entrou ao lado do `cotenant.py`, que já constrói o binário. **E a lista
  deixou de ser mantida por memória:** `tools/ci-parity.py` lê os scripts do
  `check.sh` e exige que cada um apareça em algum workflow. Não checa *como* nem
  *em qual job* — colocar uma checagem é julgamento; só a presença é mecânica

- [x] R5u — **o CI estava vermelho há 47 execuções seguidas e o gate local escondia**
  (1.6.52). O job `server HTTPS container` falha desde o 1.6.0 — o commit que fez o
  `cotenant.py` assinar e verificar com `minisign` de verdade — porque o runner não
  tem `minisign` e nada instalava. O passo morria em `FileNotFoundError` antes da
  primeira asserção. Medido: 74 das últimas 100 execuções vermelhas, último verde
  no `dcdd1fa` (1.5.7), e tudo depois vermelho. O gate local ficou verde o tempo
  todo porque a mesma dependência foi notada e resolvida **aqui** e nunca lá. CI
  vermelho que ninguém lê é pior que CI nenhum: é sinal treinado a virar ruído.
  **E não achei olhando o CI:** achei porque o 1.6.51 pôs um passo novo nesse job e
  eu fui ver se o *meu* passo passava

- [x] R5v — o `cotenant.py` rodava um script bash com `sh` (1.6.53). Com o minisign
  instalado, o CI andou 28 linhas e parou no seguinte: `Illegal option -o pipefail`.
  O teste chamava `sh <script>` duas linhas depois de afirmar que o arquivo é
  executável; o script declara `#!/usr/bin/env bash` e usa `pipefail` e
  `${BASH_SOURCE[0]}`, que o dash não tem. **O que fez isso sobreviver é o dash se
  comportar diferente por versão:** aqui imprimia `Bad substitution` e seguia até a
  recusa que a asserção procura, então passava; no runner morria antes. Verde aqui e
  vermelho lá é a pior das quatro combinações, porque o gate local passa a atestar
  exatamente o que o CI reprova. Agora roda pelo próprio shebang, que é o que uma
  pessoa faz ao seguir o `OWNER-ACTS.md` §1
- [x] R5y — o `docs/SCOPE.md` ainda se chamava *"Notes (nome provisório)"* (1.6.56).
  O nome deixou de ser provisório no 1.0.0: o `brand.md` é `ACTIVE` e decide, 226
  Releases carregam, o aplicativo se chama assim. O documento se diz *a especificação
  permanente do produto*, que é exatamente por que a linha importava — especificação
  que trata o próprio nome do produto como provisório convida o leitor a tratar tudo
  abaixo como igualmente em aberto. Era a única ocorrência em todo o repositório.
  O corpo em português fica, como a regra de idioma manda: o que já existe não se
  reescreve pela regra, e a edição sai em inglês — que é o cabeçalho

- [x] R5z — o `README.md` subcontava o que está pronto e supercontava o que dá para
  baixar (1.6.57). Parava em *"milestones 0.1, 0.2 and 0.3 are implemented"* — dois
  marcos e meio invisíveis para quem só lê a capa — e a linha de aceite citava três
  passeios pendentes onde há sete. E dizia **macOS is published** enquanto, medido:
  nenhuma Release carrega `.dmg` (conferi 1.4.0, 1.5.0 e 1.6.0), não há feed de
  macOS (404) e o `/p/tura-notes` ainda diz *In preparation*. A build existe,
  assinada e notarizada; o que não existe é lugar de pegar. É a mesma confusão dos
  dois passos de publicação que o 1.6.32 teve de desfazer no `updater.md`, agora no
  lugar mais público do repositório

- [x] R6a — três documentos diziam que um trabalho estava na fila; a fila nunca
  tinha ouvido falar dele (1.6.58). O `roadmap.md` dizia que o 0.7 continuava
  enfileirado — saiu no 1.6.5, e o `.continue/README.md` diz isso num parágrafo
  próprio. E o `SYNC-0.6.md` dizia que retenção, dois-dispositivos e casos-limite do
  receptor estavam **"explicitly queued"** no `0.6-sync.md`, que só tem o aceite.
  Conferi o histórico do arquivo: nada foi removido de lá indevidamente — as três
  categorias **nunca foram escritas**. O trabalho é real (duas seções do próprio
  contrato e o `CLAUDE.md` dizem que está aberto), então a fila passou a carregar a
  **lacuna como lacuna**: não inventei a especificação, escrevi o que precisa ser
  decidido e que é decisão de produto

- [x] R6b — as instruções de instalação ainda mandavam o usuário de macOS buscar um
  download que não existe (1.6.59). O 1.6.57 consertou a seção *Status* e deixou a
  seção *Install* quatro parágrafos abaixo mandando pegar o `.dmg` em `/p/tura-notes`
  — com o comando de conferir o hash. É a regra do mesmo passe quebrada no commit que
  a estava aplicando, e esta tinha dente: linha de status exagerada custa impressão
  errada; instrução de instalação que não dá para seguir custa a noite de alguém

- [x] R6c — o terceiro lugar que dizia que o macOS está publicado, achado varrendo
  em vez de lendo (1.6.60). O 1.6.57 consertou o status do README, o 1.6.59 a seção
  de instalação quatro parágrafos abaixo — e o segundo conserto só aconteceu porque
  o primeiro estava errado no mesmo arquivo. Desta vez varri a afirmação em todos os
  documentos rastreados: apareceu no `runbook.md`, na tabela de plataformas, com a
  linha do macOS abrindo em **published**. É a página do operador, a que alguém lê
  para saber o que este repositório de fato entrega. **A lição é o método:** fato
  que aparece num documento aparece em três, e consertar a ocorrência que está na
  sua frente deixa as outras dizendo a coisa velha com a mesma autoridade. Gastei
  três commits aprendendo isso numa afirmação; a varredura custou um comando

- [x] R6d — duas páginas ainda descreviam uma ADR com a palavra que as ADRs
  deixaram de usar (1.6.61). Apliquei o método do 1.6.60 aos outros fatos que
  corrigi hoje: três voltaram limpos (nome do produto, contagem de marcos, o
  `packages/` removido) e um não. O `ACCEPTANCE-0.1c.md` e o `DECISIONS-0.1c.md`
  dizem *"ADR-015 is `ACTIVE`"*, e desde o 1.6.49 nenhuma ADR é `ACTIVE`. O
  `adr-status.py` não pega isto — ele checa o registro de decisões, e estes são
  outros documentos **falando sobre** ele. Quem pegou foi a varredura, que é o
  ponto: mudança de vocabulário cai num arquivo e é citada em outros, e as citações
  são a metade que ninguém edita

- [x] R6e — as instruções do agente subcontavam o projeto num marco inteiro
  (1.6.62). A varredura que achou o macOS em três lugares, virada para a contagem
  de marcos: o `README.md` foi corrigido no 1.6.57, e o `CLAUDE.md`/`AGENTS.md`
  diziam a mesma coisa e não foram. **O 0.7 não aparece** num parágrafo que depois
  gasta vinte linhas com blocos `0.20.x` individuais — um agente lendo as próprias
  instruções não saberia que o endpoint existe. A linha de aceite tinha a segunda
  metade do mesmo problema: *"remains tracked in the acceptance documents"* é
  verdade e não diz escala; são oito, e nenhuma caixa marcada. Duas afirmações
  varridas no mesmo passe voltaram certas: as oito ferramentas MCP conferem com o
  código, e as dezesseis áreas de interface conferem com a tabela

- [x] R6f — a página que toda sessão lê primeiro dizia que foi revista cinquenta
  versões atrás (1.6.63). O `CLAUDE.md` manda ler o `.continue/README.md` **sempre
  primeiro**, e o cabeçalho dele dizia *"last reviewed 12/09/2026, repository at
  1.1.0"*. Carimbo velho na primeira página da ordem de leitura é pior que carimbo
  nenhum: convida a sessão a desconfiar de linha certa, ou a confiar em linha que
  mudou por baixo — e não há como saber qual. Revisto de verdade e então carimbado.
  Três linhas estavam incompletas: o **0.4** não dizia que tudo ali está atrás de um
  bit de firmware (lendo antes, a conclusão era que o Android mal começou); o **0.6**
  só citava o aceite e não a lacuna de retenção; e o **MinGW** não tinha linha
  nenhuma, apesar de já ter segurado trabalho de verdade

- [x] R6g — um documento de aceite subcontava a própria suíte pela metade (1.6.64).
  O `ACCEPTANCE-0.1b.md` dizia *"262 tests; npm test is 8"*; medido agora: **526** e
  **127**. Contagem em documento de aceite é medição com data, e esta tinha deixado
  de ser as duas coisas. A direção importa: subcontar a cobertura automatizada faz
  o leitor achar que a metade verificada por máquina é mais magra do que é, e buscar
  passeio manual que já existe. Remedido, não ajustado — as duas suítes rodaram, e a
  afirmação da matriz de CI foi reconferida contra a run `8fd6b0e`. Os carimbos
  originais ficam ao lado dos novos: medição que apaga o próprio histórico deixa de
  ser evidência. E no `0.1a` a frase que importa ficou afiada: três sistemas
  operacionais verdes não fecham a matriz de capacidade, porque **a lacuna é sistema
  de arquivos** — segue sem run em SMB, NFS, exFAT ou FUSE

- [x] R6h — o resto das contagens de teste, varridas e quase todas certas (1.6.65).
  Dezesseis afirmações `N tests` em `docs/`: **treze certas**, e vale dizer isso em
  vez de só reportar os erros — todas as contagens por arquivo do `0.1d` batem, e o
  `xss` bate em 22. Três são instantâneos datados dentro de registros de verificação
  e estão certos **como registro**. **Duas estavam velhas**, as duas no
  `ACCEPTANCE-0.1a.md` e as duas o mesmo número: `cargo test --workspace` como 123
  onde hoje são 526. O critério ali é *"passa sem Tauri"* e continua atendido — o
  número nunca foi a afirmação. Mas medição parada por quatrocentas versões deixa de
  se ler como medição e passa a se ler como propriedade da suíte, que é como alguém
  depois conclui que a suíte encolheu

- [x] R6i — *"the update could not be completed"*, documentado por plataforma
  (1.6.67). Reportado em uso, e o `updater.md` não tinha nada sobre isso: cobria
  construir, assinar e publicar, e parava onde o usuário está. **O feed se inocenta
  pelo próprio sintoma** — versão mostrada significa endpoint resolvido, JSON lido e
  comparação feita; medi mesmo assim (`darwin-aarch64-app` em 1.6.63, payload 200).
  Lido do `tauri-plugin-updater 2.11.0`: no macOS o `rename` do `.app` é o passo que
  decide — `PermissionDenied` escala e **aparece o prompt de senha**; qualquer outro
  erro volta na hora e **sem prompt nenhum**, tipicamente `EXDEV`. Uma pergunta
  separa os dois: *apareceu o prompt?* Sem prompt = o app roda de onde não dá para
  movê-lo (dmg montado, ou `~/Downloads` com quarentena e App Translocation).
  E isso explica o que parecia coincidência: todo app Tauri 2 troca o bundle do
  mesmo jeito, então hábito de instalação que quebra um quebra os três

- [x] R6j — o updater jogava fora justamente o que responderia a pergunta (1.6.69).
  O `stores/updater.ts` terminava os dois caminhos de falha em `catch { set({ phase:
  "error" }) }`. É o defeito que o 1.6.10 consertou no cliente de sync, onde 29
  `.map_err(|_| …)` tornavam um intermitente indiagnosticável por construção — aqui
  era uma linha, e transformava toda falha possível numa frase que **nomeia a causa
  errada**. Nada rio acima escondia nada: o `updater.rs` já faz `.map_err(|e|
  e.to_string())`, então o texto do plugin atravessa o IPC inteiro e era descartado
  nos últimos três metros. Agora é guardado e mostrado literal, sem tradução, embaixo
  da frase traduzida — erro parafraseado é um segundo erro. Três testes, provados
  não-vácuos: com o comportamento antigo restaurado eles falham

- [x] R6k — a seção de diagnóstico envelheceu **um commit** depois de escrita
  (1.6.71). O 1.6.67 a montou em torno de uma pergunta — *apareceu o prompt de
  senha?* — porque naquele momento o app mostrava uma frase genérica e nada mais. O
  1.6.69, o commit seguinte, fez ele imprimir o erro real, e a seção não dizia isso:
  ensinava a inferir onde agora dá para ler. Regra do mesmo passe quebrada por mim
  **de novo**, e a terceira vez hoje que a varredura pegou trabalho meu. Vale como
  padrão: **commit que muda o que o usuário vê deixa velha a página que descreve
  aquela tela, e essa página nunca é o arquivo que você está editando**

- [x] R6l — a dica que eu subi uma hora antes está errada na plataforma onde isto é
  construído (1.6.72). O 1.6.69 trocou *"verifique a conexão"* por *"mova para
  Aplicativos"* — advice certo no macOS e sem sentido no Linux, onde não existe
  pasta Applications e a falha é um pedido de senha que não apareceu. Uma frase não
  serve as duas, então parou de tentar: o `env_report` já responde a plataforma
  (`std::env::consts::OS`) e o banner já o chama, então a dica segue a plataforma
  **sem Rust novo**. O erro literal aparece nos três casos, que é a parte que não
  depende de acertar o palpite. **Vale nomear em vez de consertar calado:** a
  mensagem do 1.6.69 foi escrita diagnosticando um problema de macOS e generalizou
  um remédio de macOS para todo mundo — errada justamente na máquina onde foi
  escrita, que é o tipo de erro que passa por revisão porque o autor nunca o vê

- [x] R6m — três testes para o galho que ficou errado por um commit (1.6.73). O
  1.6.72 fez a dica seguir a plataforma e subiu sem teste do galho — a suíte fechou
  verde porque nada afirmava qual frase aparece onde. Agora afirmam, e o que protege
  o usuário de Linux é o `queryByText(...).toBeNull()` na dica **errada**: teste que
  só confere se a frase certa apareceu passa igualmente feliz quando as duas
  aparecem. Provados não-vácuos contra o comportamento do 1.6.69

- [x] R6n — o update que falha virou passeio, porque deixou de ser beco sem saída
  (1.6.74). O C14 percorre o update que dá certo; nada percorria o que não dá — que
  é justamente o fluxo reportado em uso e o que mudou quatro vezes hoje. O C15 é
  provocável, não hipotético: rodar do `.dmg` montado no macOS, ou dispensar o
  pedido de senha no Linux. Três coisas têm de valer, e a primeira é a mais velha:
  **o workspace de volta é o que você tinha** — o install fecha pelo fluxo normal,
  então falhar depois disso não pode largar ninguém no Welcome, o que o `install()`
  trata desde o 1.3.7 e ninguém nunca olhou. As contagens que nomeiam essas linhas
  andaram junto: quatro lugares para uma linha, que é o argumento para ter varrido
  no 1.6.61 em vez de achar um de cada vez agora

- [x] R6o — intervalo que reivindica todas as linhas agora precisa saber contá-las
  (1.6.75). O 1.6.74 acrescentou **uma** linha de aceite e editou **quatro** arquivos
  para dizer isso, nenhum deles contendo a linha — e o arquivo que ninguém edita é o
  que subconta calado. Já deu errado: no 1.6.41 a fila mandava percorrer `I1–I10`
  onde havia dezesseis, e **subcontar é a direção cara** — o passeio para no dez, o
  item é marcado, e as seis linhas novas não são percorridas por ninguém. O
  `doc-ranges.py` lê a maior linha `| X<n> |` de `docs/` e reprova quando um
  `X1–X<n>` citado discorda. **Só intervalos que começam em 1 são checados**, e essa
  fronteira é o projeto inteiro: `I11–I13` é referência a um subconjunto, não
  afirmação de quantas linhas existem. Provado contra o erro real, não um inventado

- [x] R6p — o gate cresceu 23% num dia e nada sabia dizer o custo (1.6.76). O
  `build-clock.sh` mede o build passo a passo; o gate não media nada. Agora mede, e
  a primeira leitura é o motivo de ter: **38s para 35 passos, dos quais o `cargo
  test` são 17**. Vinte e quatro passos ficam abaixo de um segundo e viram uma linha
  somada — trinta nomes em `0s` enterram os três que importam. Os seis checadores de
  hoje estão todos nessa soma, ou seja: **o gate não é o que otimizar**, e agora isso
  é medição e não impressão. Não é `source build-clock.sh` de propósito: os dois
  `step` têm contratos opostos — o do build aborta na primeira falha, este segue e
  reporta todas. **E o `ci-parity.py` se pegou no comentário que explica isso:** lia
  todo caminho `tools/…` do `check.sh`, inclusive dentro de comentário, e exigia
  workflow para arquivo que o gate nunca executa. Agora descarta comentário antes —
  conserto de correção, não de arrumação

- [x] R6q — uma linha de aceite mandava o dono confirmar um recurso que já entregou
  (1.6.78). Medi o catálogo ao contrário — não *toda `t()` resolve*, que o
  `i18n-keys.py` já faz, mas *toda string chega a uma tela* — e seis não chegam.
  Cinco são os controles de vista do topo que o 0.1d substituiu. A sexta é pior que
  morta: `rail.graphSoon` diz *"Graph view arrives at 0.3"*, o 0.3 entregou, e o
  `Rail.tsx` mostra Graph como painel normal. **E o I1 do `ACCEPTANCE-0.1d.md` ainda
  mandava verificar que "Graph is visibly disabled"** — linha que o dono só pode
  reprovar: percorre hoje, o recurso funciona, e isso se lê como defeito contra o
  documento em vez de documento três marcos atrasado. **Sem checador novo:** chave
  alcançada por template ou por variável é normal aqui, então a medição precisa de
  prefixo e de varredura literal, e erra nos dois. Seis achados em 349 chaves é
  varredura para repetir à mão, não passo de gate para confiar

- [x] R6r — a seção de onboarding mandava copiar um arquivo que não existe (1.6.79).
  O `runbook.md` §2 ainda era o esqueleto: `cp .env.example .env`, contra um arquivo
  que nunca existiu porque este aplicativo não tem configuração para copiar — e
  embaixo, uma nota em itálico perguntando ao **autor** qual é o caminho, deixada
  onde está o **leitor**. Reescrita a partir de medição: clonei num diretório vazio
  e rodei, duas vezes. **Toolchain de Rust sozinho dá 37 de 39 passos**, e as duas
  falhas são o par de frontend falhando *pelo nome* — que é o guard do 1.6.18
  fazendo exatamente o que foi escrito para fazer. `npm ci` é o remédio inteiro, e
  depois dele o gate fecha **verde em 41s, 35 passos**

- [x] R6s — oito ferramentas, **seis** permissões, e três documentos diziam outra
  coisa (1.6.80). Rodei a configuração de MCP exatamente como o `KNOWLEDGE-0.3.md`
  imprime — mesmo JSON, workspace de verdade, binário de release, `initialize` e
  `tools/list`. O exemplo funciona literal, que já é a primeira coisa que importa
  numa página de configuração. Mas cinco permissões devolveram **sete** ferramentas:
  o `Read` admite `notes_list` além de `notes_read`, e o `Update` admite
  `notes_append` além de `notes_update`. O `MCP-0.7.md`, o `roadmap.md` §0.7 e o
  `security.md` — o normativo, na linha que **eu** escrevi no 1.6.34 — diziam *"each
  behind its own permission"*. **Não é preciosismo de contagem:** quem escreve
  credencial de menor privilégio a partir dessas frases acredita que dá para conceder
  leitura sem conceder listagem, e não dá. É defeito de documentação que vira de
  segurança: não deixa o código errado, deixa errado o modelo que o operador tem dele

- [x] R6t — a prévia de sync cumpre todas as promessas da página dela, conferido
  rodando (1.6.81). Mesmo método do 1.6.79 e do 1.6.80, e desta vez **voltou limpo**
  — o que vale registrar em vez de descartar: verificação que não acha nada é
  evidência, e esta converte quatro afirmações em observações. Rodei o comando como
  o `SYNC-0.6.md` imprime, contra duas pastas reais: as três ações significam o que
  a tabela diz; a saída **nunca** traz texto de nota (plantei marcadores nos dois
  corpos e nenhum aparece no JSON); nada é criado dentro das pastas de origem; e
  repetir devolve **os mesmos UUIDs**, que é a promessa em que o pareamento inteiro
  se apoia. Registrado no `ACCEPTANCE-0.6.md` como checagem de máquina datada e
  **não** como caixa marcada — a regra de que o passeio é do dono não dobra porque
  uma máquina concordou com a página

- [x] R6u — a CLI de operador faz o que a página dela diz, recusas inclusive
  (1.6.82). Quarto caminho documentado executado em vez de lido. Rodado literal
  contra um diretório descartável: `workspace create` → `token create` → `serve`
  não precisa de nada que a página omita; o `token create` imprime **só** o UUID; o
  arquivo de segredo nasce `0600` e um segundo create no mesmo nome é recusado com
  `File exists`; o `token list` é redigido; `-` concede `[]`. **A parte que conferi
  de propósito foram os códigos de saída:** quatro recusas, todas saindo `1`. Não é
  formalidade — a ADR-084 nasceu hoje porque um passo de release devolvia zero sem
  publicar nada, e recusa que sai zero é o mesmo defeito uma camada abaixo: o script
  do operador arquivaria uma credencial que nunca foi criada

- [x] R6v — o audit foi grepado atrás das três coisas que ele promete nunca guardar
  (1.6.83). Quinto caminho documentado executado. Subi o servidor, criei nota pelo
  `POST` documentado, li e busquei — com **três marcadores plantados em três
  lugares**: um no texto da nota, um no caminho dela, um na query de busca. Depois
  grepei o audit pelos três, pelo segredo da credencial e pela palavra
  `Authorization`. **Os cinco: zero.** O que ele guarda é exatamente a lista da
  página, e o `X-Request-Id` devolvido ao cliente aparece lá — a metade que torna
  uma pergunta de suporte respondível sem perguntar o que a pessoa estava editando.
  Três recusas caíram na mesma sessão: `PUT` sem `If-Match` é 428, sem credencial é
  401, e o listener está em `127.0.0.1:8787` e em mais lugar nenhum, conferido com
  `ss -ltn`. **O passo de audit do dono continua:** máquina confirmando que três
  marcadores não estão lá não é uma pessoa lendo o audit de uma sessão real

- [x] R6w — a correção das permissões, confirmada perguntando ao servidor em vez de
  à fonte (1.6.84). O 1.6.80 corrigiu três documentos — inclusive o `security.md`,
  que é o que ganha em conflito — a partir de **ler** o `AgentService::permission`.
  Correção tirada de leitura é hipótese com boa evidência; esta é a mesma afirmação
  perguntada a um servidor de pé. Duas credenciais, uma permissão cada, `tools/list`
  no `POST /v1/mcp`: só-`read` devolve `notes_list` **e** `notes_read`; só-`update`
  devolve `notes_append` **e** `notes_update`. Exatamente o que as páginas passaram
  a dizer. Valia ter feito: a alternativa era deixar um documento normativo apoiado
  numa leitura de código

- [x] R6x — a variável que torna o primeiro critério do spike irrespondível não está
  em arquivo de shell nenhum (1.6.86). O `SPIKE-0.0.md` avisava que rodar com o
  `WEBKIT_DISABLE_DMABUF_RENDERER` já setado não prova nada, e dizia que *o shell do
  dono* exporta. Rastreei em vez de repetir: não está em `~/.bashrc`, `~/.profile`,
  `~/.zshrc`, `/etc/environment`, `environment.d/` nem no ambiente do systemd.
  Subindo o `/proc/<pid>/environ` pela árvore, ela entra no **`sshvterm-sidecar`** —
  ausente no `sshvterm` e ausente no `gnome-shell`. **Isso troca a instrução de
  tarefa por distinção:** processo aberto de um terminal daquele app herda a
  variável; aberto da sessão do desktop, não. As duas formas de lançar o aplicativo
  **não são o mesmo teste**, e é também o formato de todo relato futuro de "funciona
  pelo lançador e não pelo terminal"

- [x] R6y — a mesma afirmação em mais dois lugares, e eu tinha **acabado** de
  escrever a regra sobre isso (1.6.87). O 1.6.86 rastreou a variável até o
  `sshvterm-sidecar` e corrigiu o `SPIKE-0.0.md`; aí eu não varri. O
  `DECISIONS-0.1b.md` carregava a mesma frase duas vezes. **É exatamente a regra que
  o 1.6.60 existe para registrar** — fato que aparece num documento aparece em três
  — escrita por mim quatro horas e vinte e seis versões antes. Escrever não fez eu
  cumprir. As duas corrigidas, e a correção rende na segunda: a variável segue
  **como o aplicativo foi lançado**, não quem lançou, que é a diferença entre "a
  máquina do dono está contaminada" e "rodar do terminal e rodar da sessão do
  desktop são testes diferentes" — a primeira lê como desculpa, a segunda é
  procedimento

- [x] R6z — uma quarta cópia, dentro de uma ADR, corrigida **anexando** e não
  editando (1.6.88). A varredura completa depois do 1.6.87 — que já era a varredura
  que eu devia ter feito no 1.6.86 — achou mais uma na **ADR-033**. Tratada
  diferente das outras três de propósito: página que descreve como as coisas são se
  corrige no lugar; **ADR é registro do que foi decidido *e acreditado* num dia**, e
  ADR que edita o próprio raciocínio em silêncio deixa de ser registro — mesma
  decisão do 1.6.48, que deixou a ADR-037 dizendo *vinte e cinco*. A frase fica e
  uma correção datada senta embaixo, com a parte que muda para o próximo leitor: o
  remédio não é *"limpe seu perfil de shell"*, é que rodar de um terminal daquele
  app e rodar da sessão do desktop **são testes diferentes**. Quatro cópias de uma
  afirmação, achadas em três varreduras, num repositório onde a regra sobre isso
  está escrita — por mim. A varredura é barata; lembrar de rodá-la é que não

- [x] R7a — o gate passou a notar versão escrita e nunca commitada (1.6.90). O
  1.6.89 dobrou um heading do `1.6.87` que tinha entrada, bump e gate verde e
  **nenhum commit**. Nada podia pegar: o `release.sh` caminha o `version.md` pelo
  histórico e nunca viu aquele número, e o `pre-push` compara com o remoto, onde o
  bump seguinte era incremento legítimo. O `changelog-versions.py` exige tag para
  todo `## X.Y.Z`, **menos o que o `version.md` nomeia agora** — esse é o commit
  sendo escrito, cuja tag só existe depois do push. Hoje: 264 headings, 263 com tag.
  Provado contra a falha real, e os dois remédios vêm nomeados porque as duas causas
  pedem consertos opostos: versão nunca commitada quer a entrada dobrada na que
  levou o trabalho; versão commitada que perdeu a Release quer o `release.sh`

- [x] R7b — o checador novo estava certo aqui e errado no CI, pelo motivo de existir
  (1.6.91). O 1.6.90 subiu e o CI respondeu com **264 falsos negativos**: o
  `actions/checkout` é raso por padrão, e um `git log -- version.md` num checkout de
  um commit responde "nunca" para todas as versões. O checador estava certo; o chão
  não estava lá. Duas mudanças: o job `contracts` passa a clonar com
  `fetch-depth: 0`, só ele; **e o caso raso é detectado em vez de mal-respondido** —
  checagem que não pode rodar tem de dizer isso em vez de dar resposta confiante e
  errada, que é a regra do `FAILED, not run` que o 1.6.18 já pagou para aprender.
  Verificado contra um clone `--depth 1` de verdade. **Pego olhando a execução, a
  terceira vez hoje:** gate verde numa máquina é uma afirmação sobre aquela máquina

- [x] R7c — a matriz de capacidades descreve uma detecção que não existe (1.6.93).
  O `ARCHITECTURE.md` §11 abre com *"o adaptador reporta `Caps` por raiz"* e fecha
  nomeando `statfs().f_type`, `pathconf`, `GetVolumeInformationW` e cache no
  `registry.db`. **Nenhuma dessas quatro chamadas existe no repositório.** O
  `LocalFs` responde `Caps::LOCAL`, constante de compilação chaveada pelo **sistema
  operacional alvo**, não pelo filesystem embaixo do workspace. Então nenhuma linha
  da tabela pode disparar: workspace em exFAT reporta `trash: true`, em SMB reporta
  `atomic_replace: true`, e o banner de backend não-atômico do 1.6.17 fica invisível
  não porque filesystem local é atômico — é — mas porque **nada no sistema consegue
  responder outra coisa**. O `ACCEPTANCE-0.1a.md` tinha a versão fraca disso e eu
  afiei a metade errada no 1.6.64: dizia *"asserted rather than observed"*, que se lê
  como não-testado. Não-implementado é outra afirmação, e é a verdadeira

- [x] R7d — mais dois mecanismos que a arquitetura nomeia e o código não tem
  (1.6.94). Perguntei ao documento inteiro se cada identificador citado existe:
  81 candidatos, 17 ausências, a maioria legítima (palavras de status, chaves de
  Actions, APIs de iOS sob `[0.4]`). Duas não. **`note_convert_encoding` não
  existe**, e a página dizia que o editor fica travado *"até o usuário rodar
  `note_convert_eol(…)` ou `note_convert_encoding`"* — o primeiro é real, com botão
  na interface; o segundo, lugar nenhum. O documento prometia saída do read-only de
  UTF-8 inválido que o produto **deliberadamente** não dá, e o produto está certo:
  a string que ele mostra diz *"nada será convertido sem você mandar"*. Reescrever
  bytes do usuário com base num palpite é o que a ADR-001 proíbe. **E `FsEvent`
  também não existe** — a tabela de crates creditava o `notes-fs` com um watcher
  "normalizado para `FsEvent`"; o que o `watch.rs` expõe é `Watch` e `Degraded`

- [x] R7e — a mesma pergunta feita aos outros contratos, e eles estão limpos
  (1.6.95). O `ARCHITECTURE.md` nomeava três mecanismos inexistentes; a pergunta
  seguinte é se isso é hábito ou exceção. Conferi todo identificador dos outros
  cinco contratos contra o código: `SYNC-0.6.md` 19 citados e **zero** ausentes,
  `KNOWLEDGE-0.3.md` 14 e zero, `MCP-0.7.md` 12 e zero, `SERVER-0.5.md` uma ausência
  que é módulo do Apache, e o `SCOPE.md` três que são de iOS sob `[0.4]`. **É
  exceção, e o motivo é legível:** o `ARCHITECTURE.md` é o mais antigo e o escrito
  mais à frente do código — documento de projeto que ninguém releu como descrição
  depois que a implementação chegou. Os outros foram escritos ao lado do trabalho

- [x] R7f — os documentos de aceite e o registro de decisões, conferidos do mesmo
  jeito (1.6.96). **O conjunto de aceite está limpo:** todo arquivo de teste e toda
  função de teste que eles citam como evidência existe. É a camada em que o sistema
  de aceite inteiro se apoia — documento citando teste que não existe é evidência
  que não existe, e não há nenhuma. **O registro de decisões tem duas referências e
  as duas são vocabulário de ADR:** o `file_id`/`content_hash` da ADR-005 já está
  anotado pela ADR-020, escrita exatamente para aquela frase; e a ADR-004 cita um
  `workspace.json` que nunca existiu — são `registry.json`, `session.json`,
  `settings.json`, `recent.json` e `index.db`. Nota datada, frase original intacta,
  mesmo tratamento do 1.6.48 e do 1.6.88. **Todo documento do repositório já passou
  por essa checagem:** um tinha três ausências, um tem um nome ilustrativo, e os
  onze restantes estão exatos

## Rodada 6 — a revisão completa de 21/09, carregada inteira

Varredura de doze dimensões do repositório em 21/09, com o repositório em
`1.7.4`. Cada achado passou por um cético adversarial instruído a **refutar**:
62 brutos, 46 sobreviveram, 16 morreram. Os 41 abaixo são o que sobrou depois
de mesclar duplicatas, ordenados por impacto × probabilidade × barateza do
conserto — a numeração **é** a ordem de ataque, não a ordem em que apareceram.

O quadro vivo é <https://claude.ai/artifact/Vr8WJEfiinAfji3H7Et4Md>: a coleção
`tasks` tem uma linha por item desta rodada, e é lá que o dono acompanha. Mudou
de estado aqui, muda lá no mesmo passo — fila e quadro saem da mesma fonte e
divergir é o defeito.

**Os seis temas**, porque quase todo item é instância de um deles, e consertar
um sem ver o padrão deixa o gêmeo no lugar:

- **O que o usuário escreveu está menos protegido no front-end do que no core** — O core trata o byte do usuário como sagrado: escrita atômica, lock por documento, draft antes de suspender autosave, snapshot de conflito. O front-end desfaz isso em três pontos sem nenhum teste, e o estado não-reconstruível (registry, drafts, conflitos) é justamente o que não tem regra de perda nem de migração. A premissa do produto é defendida em Rust e abandonada em TypeScript.
- **Quadrático escondido atrás de um laço, invisível em fixture de três notas** — Cinco lugares sem relação entre si repetem a mesma forma: recomputar o conjunto inteiro dentro de um laço por item. Nenhum aparece nos testes porque todo fixture de unidade tem uma a três notas, e todos explodem exatamente no tamanho que o repositório declara suportar (10.000 notas, `fixtures/large`). A correção é sempre a mesma — içar o cálculo para fora do laço, ou parar de varrer o que já se sabe — e em dois casos o código certo já existe a três arquivos de distância.
- **Um sinal para muitas causas — o diagnóstico não discrimina** — Onde o sistema falha, ele conta sempre a mesma história. `LockTimeout` tem quatro produtores com uma frase só, e três deles não envolvem o lock que a frase nomeia; a auditoria grava o proxy como peer e colapsa oito operações MCP num hash constante; o pareamento recusa com um 'conflito' que não nomeia causa nem remédio. O efeito prático não é estético: a próxima investigação de incidente, e a que já está na fila, instrumentam o caminho errado e concluem que não há nada lá.
- **A regra vale num caminho e não no gêmeo** — O padrão mais frequente do relatório, e o mais barato de corrigir: uma decisão é tomada, escrita e implementada num caminho, e o caminho simétrico não a recebeu. O walk de watches recusa symlink, o event loop segue; o renderer Markdown classifica URL de imagem, o raw HTML não; o REST reduz erro a código, o MCP serializa o `CoreError` inteiro; `state.rs` diz que todo arquivo de estado passa por ele, drafts e conflitos não passam. Nenhuma dessas assimetrias é uma decisão — todas são a metade que faltou.
- **Controle verde que falha na direção errada** — Quatro controles do gate e um do servidor relatam sucesso justamente na condição que existem para pegar. O grep de `fs:` inverte o exit 2 do grep e passa quando o diretório some; o `crash-save-loop` fecha 1000 rodadas se o writer morrer no startup; o teste que diz cobrir contenção de lock não toma lock nenhum e não tem asserção; o rate limiter cheio nega todo desconhecido em vez de despejar o mais velho; o gate do `build.yml` cancela permanentemente os artefatos de um minor por qualquer falha do workflow de Release. Todos provam uma negativa que não conseguem observar.
- **Publicação e documentação: o que sai daqui e o que se lê primeiro** — A cadeia que entrega o binário e a página que a sessão lê antes de tudo são as partes menos governadas. `1.6.99` tem commit e changelog e não tem tag nem Release; duas actions de terceiros rodam em ref mutável no job que assina e publica; o `NOTICE` diz 'None yet' enquanto o binário linka 625 crates, seis deles MPL-2.0; e `docs/updater.md` mais o carimbo de `.continue/README.md` afirmam, com autoridade de página ACTIVE, quatro fatos que o próprio repositório retratou em 1.6.66.

**Sete itens desta rodada esperam decisão sua e estão em `Parqueado` com `🔒`**, com a pergunta escrita. Não seguram a fila.

- [x] R6-01 — **feito em 1.7.7.** `fromOpened` zerava `externalRev`, e o watcher do `EditorBody` sai cedo em `applied.current === externalRev` — o texto restaurado ficava na store e nunca na tela. **O achado subestimou o alcance:** ele dizia que `resolveConflict` e `convertEol` escapavam por acidente, e o teste novo mostra que os tres quebram igual com o Editor montado e `readOnly` sem mudar. Os cinco pontos que trocam o buffer inteiro passam agora por um helper so (`replacing`), em vez de dois corrigirem a mao e tres esquecerem. `Editor.test.tsx` e o primeiro teste do repositorio que le `view.state.doc` em vez de `useEditor.getState().doc` — a distincao que faltava, porque e a unica em que os dois podem discordar: os 5 falham sem o conserto e passam com ele
- [ ] R6-02 — **save() desiste em silêncio enquanto há outro save em voo, e o flush de troca de aba perde teclas** (`apps/notes-app/src/stores/editor.ts:125`, severidade alto, conserto pequeno). O `inFlight` é de módulo, não por documento, e o comentário dele afirma cumprir a §5 de ARCHITECTURE — mas a §5 coloca essa fila NO CORE (mutex assíncrono por documento). O flag do front-end descarta o save que o core enfileiraria. Duas consequências com alcances diferentes: (a) `leaveCurrent()` faz `await save(true)` e deixa `open()` substituir o documento mesmo se o flush foi engolido — sem draft, sem erro; (b) o debounce do autosave é one-shot: se o timer dispara durante um save em voo, `save()` retorna e ninguém reagenda, então o buffer fica `status: "pending"` indefinidamente. A (b) não precisa de corrida nenhuma, só de `note_save` demorar mais que os 750 ms, e contradiz ARCHITECTURE.md:378-380 direto. Três call sites têm a mesma forma: `activate` (tabs.ts:126), `openPath` (tabs.ts:82) e `close` (tabs.ts:142) — o Ctrl+W é o mais provável na prática. **Cenário:** Workspace em mount de rede ou nota grande, `note_save` leva ~150 ms. O usuário digita, pausa 750 ms (autosave #1 sai com `sending = 5`), digita mais uma frase (`bufferVersion = 6`) e troca de aba dentro da janela. `leaveCurrent()` chama `save(true)`, que retorna na linha 125; `open()` limpa o debounce e substitui `doc`. O autosave #1 aterrissa, vê `d.noteId !== doc.noteId` e não faz nada. A versão 6 existiu só no objeto substituído: a última frase se foi, sem draft e sem banner. **Conserto:** Guardar a promessa do save em voo e fazer `save(true)` aguardá-la e reexecutar; no mínimo, `leaveCurrent()` reler `useEditor.getState().doc` depois do flush e recusar enquanto `bufferVersion !== savedVersion` (é a guarda que `reviewedMove` já usa em ReferenceReview.tsx:36-39), caindo para `keepDraft("exit")`. E rearmar o debounce quando `save()` recusa por `inFlight`. *(tema: O que o usuário escreveu está menos protegido no front-end do que no core)*
- [ ] R6-03 — **pdf_extract roda um parser que entra em pânico na thread da IPC, e um PDF em japonês mata o app** (`apps/notes-app/src-tauri/src/commands.rs:187`, severidade alto, conserto pequeno). `pdf_extract` é um comando Tauri bloqueante (sem `async`, sem `#[tauri::command(async)]`), então `tauri-macros` o executa inline na thread da webview, dentro do callback `extern "C"` de esquema do WebKitGTK. `pdf_extract::extract_text` é chamado com só o `Err` tratado, mas `pdf-extract 0.12.0` não retorna `Err` para o que não modela: entra em pânico. Não há `catch_unwind`, nem hook de pânico, nem `panic = "abort"` no workspace, então o unwind atravessa o quadro FFI e aborta o processo. Gatilhos reproduzidos: `/Encoding /StandardEncoding` ou `/BaseEncoding /StandardEncoding` (lib.rs:354-359, alcançado por `PdfSimpleFont` e `PdfType3Font`) e qualquer CMap predefinida não-Identity, isto é, praticamente todo PDF CJK — mais 32 `panic!`/`todo!` e 42 `unwrap()` no mesmo arquivo. ADR-068 (docs/decisions.md:1997) promete exatamente o contrário: recusar PDF malformado ou não suportado sem adivinhar. **Cenário:** O usuário clica em Import PDF (ExplorerToolbar.tsx:34-37) e escolhe um PDF japonês ou qualquer arquivo cujo font declare `/StandardEncoding`. Em vez do `CoreError::Unsupported` que o código pretende devolver, o processo inteiro morre. Vão junto todas as edições posteriores ao último debounce de 750 ms em TODAS as abas abertas, e o draft de saída (o handler de `beforeunload`) nunca roda. **Conserto:** `std::panic::catch_unwind(AssertUnwindSafe(...))` — ou `std::thread::spawn(...).join()`, que também tira o parse da thread principal — mapeando tanto `Err` quanto pânico para o `CoreError::Unsupported { cap: "PDF text extraction" }` que já existe; e marcar o comando como `async` para um PDF de 32 MiB não congelar a janela. Um fixture com `/BaseEncoding /StandardEncoding` fixa o comportamento; ACCEPTANCE-0.3 K15 só cobre >32 MiB e não-PDF. *(tema: A regra vale num caminho e não no gêmeo)*
- [ ] R6-04 — **LockTimeout tem quatro produtores com a mesma frase, e três não são o lock que a frase nomeia** (`crates/notes-model/src/error.rs:116`, severidade médio, conserto pequeno). Uma única mensagem, "timed out waiting for the workspace write lock", sai de quatro condições sem relação: `lock.rs:60` no `write.lock` de verdade (após 5 s girando a 20 ms); `lib.rs:405`, que tranca `workspaces.lock` — outro arquivo, compartilhado por todo workspace daquele data dir; `activity.rs:40/42`, o lease de atividade não-bloqueante, que falha em microssegundos e nunca espera; e `sync.rs:127`, a desistência do laço de reconcile, onde não há lock nenhum envolvido. O único teste que exercita um `LockTimeout` real (sync_application.rs:181) bate em `activity.rs:40`, não em `lock.rs:60` — então o caminho do write lock parece coberto e não está. E `lock.rs:82-84` piora: o teste `a_second_acquisition_in_the_same_process_still_works` chama `acquire()` duas vezes, nunca chama `with()`, não tem asserção nenhuma, e o comentário afirma uma propriedade falsa (fd-lock usa `flock(2)`, dois handles do mesmo processo SE excluem). **Cenário:** O plano escrito em `.continue/README.md:31` — separar os dois caminhos pela string de causa e medir quanto tempo o write lock fica segurado — é executado. Nos cinco testes vermelhos a frase é a mesma independentemente de qual dos quatro sítios disparou; a instrumentação mostra retenção submilissegundo no `write.lock` (que naquelas execuções não foi disputado), a investigação conclui que não há nada ali, e o produtor real (o lease de atividade, ou o orçamento de reconcile) nunca é olhado. As três causas têm correções opostas: aumentar timeout, consertar tempo de vida do lease, ou consertar correlação. **Conserto:** Antes de instrumentar qualquer coisa: separar a variante. `LockTimeout { which: &'static str }` nomeando o arquivo de lock e se houve espera, `WorkspaceInUse` para activity.rs, e algo como `Unsupported { cap: "identity correlation did not settle" }` para sync.rs:127. Depois, um teste que realmente contenda — `with()` numa thread de fundo segurando além de um deadline encurtado — e trocar o teste vazio por ele. *(tema: Um sinal para muitas causas — o diagnóstico não discrimina)*
- [ ] R6-05 — **Perder registry.db regenera silenciosamente todo NoteId; draft e conflito somem sem distinção de 'não havia nada'** (`crates/notes-core/src/lib.rs:441`, severidade alto, conserto médio). Duas faces do mesmo buraco: o estado não-reconstruível não tem regra de perda nem de migração. (a) Desde a migração para SQLite, `state::store` escreve só em `registry.db`; `registry.json` vira `.bak-1` uma única vez (`if !backup.exists()`) e nunca mais é escrito, mas `state::load` ainda cai nele quando o `.db` some. Sem nenhum dos dois, retorna `Loaded::Fresh`, que `open_workspace` mapeia para um `Registry` vazio com `ahead: None` — o mesmo caminho de um workspace novo, sem aviso, sem `read_only` — e a linha 466 grava esse vazio por cima. `TooNew` é tratado com cuidado (read-only, motivo na UI); desaparecimento não é tratado de forma alguma. (b) `DraftInfo` e `ConflictSnapshot` carregam campo `schema` fixado em 1 e lido por ninguém, não implementam `Schemad` (que registry, settings, session, recents e workspaces implementam) e tratam falha de desserialização como AUSÊNCIA: `drafts::read` devolve `Ok(None)` (drafts.rs:69-71) e `conflicts::list` faz `continue` (conflicts.rs:147-149). São justamente os dois stores que guardam a única cópia de texto que o usuário digitou. **Cenário:** Caso A: o usuário lê ADR-004 ('`.notes` só guarda o que pode ser reconstruído e deve poder ser apagado'), vê `index.db` com 108 MB ao lado de `registry.db` com 8 KB, e apaga a pasta para forçar reindex. O workspace abre normal, sem aviso, e o próximo reconcile atribui NoteId novo a toda nota: cada `drafts/<id-antigo>.draft` fica órfão para sempre (o `open_note` procura pelo id ATUAL, lib.rs:576) e o histórico de sync se desprende do servidor, exatamente o que ADR-005 proíbe. Caso B: um restore traz `registry.json` de setembro sem o `.db`; `load` devolve `Ok`, a linha 466 grava esse registry antigo no `.db` novo, identidades criadas depois da migração somem e as pré-migração ressuscitam — também sem sinal. Caso C: uma versão futura adiciona campo a `DraftInfo` sem `#[serde(default)]`; o draft existente vira invisível, o arquivo nunca é podado nem listado, e o texto fica no disco inalcançável. **Conserto:** Distinguir 'nunca teve registry' de 'tinha e sumiu': gravar em `workspaces.json` (ou num sentinela ao lado do db) que este workspace já foi registrado e, com `Fresh` sobre um workspace registrado, abrir read-only com motivo nomeado, como `TooNew` já faz. Manter o espelho JSON vivo a cada `store` ou deletá-lo — um arquivo congelado que o `load` ainda lê é pior que nenhum. E dar ao cabeçalho do draft e ao sidecar de conflito a mesma regra dos outros: checar `schema` antes do corpo, recusar quando está à frente, copiar de lado quando está atrás, e devolver um erro distinto para 'existe draft e não deu para ler'. *(tema: O que o usuário escreveu está menos protegido no front-end do que no core)*
- [ ] R6-06 — **O probe de case desiste na primeira entrada sem letra, e workspace ext4 comum acaba com case-folding ligado** (`crates/notes-fs/src/probe.rs:20`, severidade médio, conserto pequeno). Dois defeitos encadeados. (a) `let flipped = flip_case(&e.name)?;` está dentro do `for`, mas o `?` retorna `None` da FUNÇÃO inteira — o probe abandona o veredito na PRIMEIRA entrada sem caractere com caixa, em vez de pulá-la, contrariando o próprio doc comment em probe.rs:5-7 ('nenhuma entrada tem letra com caixa'). `open_workspace` resolve `None` para `true` (lib.rs:435) e `LocalFs::list` ordena diretório primeiro e depois por nome minúsculo, então uma pasta chamada `2024`, `2026-09` ou `01` — a forma normal de um vault de notas — mata o probe. O veredito errado é PERSISTIDO no registry (lib.rs:440) e rederivado a cada abertura, então oscila entre sessões conforme a primeira entrada muda. (b) Com o flag ligado, `relocate` (lib.rs:957) pula `check_collision` só quando `to == from` byte a byte, enquanto `check_collision` compara `CompareKey` dobrado — um rename que só troca a caixa colide consigo mesmo e volta `AlreadyExists` nomeando o próprio arquivo, contradizendo o comentário três linhas acima. O mesmo atinge `create_note`, `move_entry`, o `notes_move` do agente (agent.rs:274) e references.rs:245. O único teste que guardaria isso (`the_case_probe_reaches_a_verdict_on_this_machine`) não pode falhar, porque toda entrada de `fixtures/basic` tem caixa. **Cenário:** Linux, ext4, `~/notas` com uma pasta `2024/` e uma nota `nota.md`. Ao abrir, `2024` é listada primeiro, `flip_case("2024")` é `None`, o `?` aborta, `unwrap_or(true)` grava `case_insensitive = true`. O usuário passa a não conseguir criar `README.md` ao lado de `readme.md`, nem renomear `nota.md` para `Nota.md` — ambos voltam 'already exists' nomeando o arquivo que ele está criando/renomeando — num filesystem que distingue os dois perfeitamente. Apagar a pasta `2024` conserta em silêncio; criar outra quebra de novo. **Conserto:** Trocar o `?` por `continue` em probe.rs:20, que é o que o doc comment já promete, e acrescentar a `fixtures/basic` uma entrada sem caixa (um diretório `2024/` ordena primeiro) para o teste existente passar a valer. Em `relocate`, pular `check_collision` quando `CompareKey(from) == CompareKey(to)`; depois disso, testar `LocalFs::rename` num volume case-insensitive de verdade (o `renamex_np(..., RENAME_EXCL)` do macOS é o único ponto ainda não verificado; o `MoveFileExW` com flags 0 do Windows é o jeito documentado de mudar a caixa no NTFS). *(tema: A regra vale num caminho e não no gêmeo)*
- [ ] R6-08 — **reference_preview reconstrói o índice wiki do workspace inteiro uma vez por link** (`crates/notes-core/src/references.rs:94`, severidade alto, conserto pequeno). `crate::knowledge::candidates(paths, target)` é `WikiLookup::new(paths).candidates(target)`, e `WikiLookup::new` percorre todo caminho do workspace rodando `RelPath::parse` + `CompareKey::new` + `to_owned` duas vezes por caminho e inserindo em dois `BTreeMap`. Está chamado de dentro de `doc.links.iter().any(...)` — uma vez por link wiki de cada documento de `index.documents()` — e de novo na linha 124, dentro do laço de reescrita por candidato. Custo O(notas × links × caminhos) onde deveria ser O(caminhos + links). `knowledge()` faz certo três arquivos adiante: iça `let lookup = WikiLookup::new(&live)` para fora do laço (knowledge.rs:108). `wiki_candidates()` (exposto como comando Tauri em commands.rs:503) reconstrói o lookup inteiro em toda chamada do front-end — terceira instância. **Cenário:** Medido em build release otimizado: `WikiLookup::new` custa 990 µs com 1.000 caminhos e 13,6 ms com 10.000. Renomear uma nota num workspace de 10.000 com ~5 links wiki por nota gasta ~680 s só dentro de `WikiLookup::new` (~270 s no tamanho de 6.707 que docs/ACCEPTANCE-0.2.md:90-97 mede). A forma içada custa 12 ms no total. Como `reference_preview` roda sob o mutex único do serviço (commands.rs:81-85, segurado durante toda a chamada síncrona em :482-487), todo comando Tauri atrás dele — salvar, listar árvore, buscar, status de índice — fica bloqueado; `reviewedMove` já forçou um save e está aguardando a promessa, então da cadeira do usuário é a aplicação travada, sem indicador de progresso e sem cancelar. **Conserto:** Construir `WikiLookup::new(&paths)` uma vez logo depois de `paths` (references.rs:87) e passar o `&lookup` para os dois call sites, substituindo a função livre `pub(crate) fn candidates` — duas linhas em knowledge.rs para tornar o tipo visível. Fazer o mesmo em `wiki_candidates()`. *(tema: Quadrático escondido atrás de um laço, invisível em fixture de três notas)*
- [ ] R6-09 — **correlate() converte um rename em delete+create quando o orçamento de hash acaba, e a identidade some do disco no mesmo tick** (`crates/notes-core/src/reconcile.rs:419`, severidade médio, conserto médio). Na Regra 2 (correlação por hash de conteúdo), o laço de candidatos faz `break` quando `*budget == 0` deixando `matches` vazio; vazio cai na 'Regra 3, por omissão' (:435), que remove o registro do registry (:449) e emite `ChangeKind::Removed`. O trabalho adiado nunca é enfileirado — `Recon::queue` só é chamado do laço principal (:226), nunca de `correlate` — então `reconcile` devolve `queued == 0` e nada retenta, e `store_registry` (:301-305) grava a remoção no disco no mesmo tick. O laço de dreno em `inventory_using` (sync.rs:119-126) existe exatamente para impedir isso, e o comentário dele diz isso, mas vigia uma fila que a correlação nunca escreve. Fato novo em relação ao enunciado original: o orçamento é decrementado por candidato de mesmo tamanho POR nota sumida (:417-427), então ele pode se esgotar dentro do próprio `correlate` — reorganizar mais de ~50 notas de uma vez basta, com zero arquivos modificados antes. **Cenário:** Qualquer move feito por copy+delete em vez de `rename(2)` — cliente de nuvem, move entre volumes, restore de backup, editor que escreve-novo-e-apaga — ou Windows devolvendo `native_id()` `None` num volume sem índice de arquivo (local.rs:459-463). Com o workspace fechado, o usuário move uma pasta de notas; no próximo `reconcile_all` a Regra 1 não dispara sem native id, a Regra 2 não hasheia nada, e toda nota movida perde o registro. O prejuízo não é corrupção — o caminho de recepção falha fechado com `Error::Conflict` (state.rs:2371) —, é a IDENTIDADE: o arquivo movido é republicado como `NoteId` novo, com cadeia de revisões desconectada do histórico no servidor, a nota antiga fica como `missing` esperando uma confirmação de delete que o usuário não pediu, e o ramo `renames` de `stage_receiver_changes` não consegue mais reconhecer o move porque casa por `previous.local.note_id`. **Conserto:** Quando `correlate` esgota `*budget` com candidatos por examinar, não cair na Regra 3: enfileirar via `Recon::queue` o caminho da nota sumida (e os candidatos `same_size` não hasheados) e manter o registro, para o próximo passe terminar a correlação — que é também o que faria o dreno de `inventory_using` significar o que o comentário dele afirma. Alternativa: `inventory_using` passar orçamento ilimitado, já que é uma operação explícita e de tamanho limitado. *(tema: O que o usuário escreveu está menos protegido no front-end do que no core)*
- [ ] R6-10 — **O watcher instala watch pós-walk seguindo symlink e sem descer, e uma árvore movida para dentro fica sem vigilância** (`crates/notes-fs/src/watch.rs:301`, severidade médio, conserto pequeno). Uma linha, dois defeitos, ambos por divergir do walk inicial. (a) `add_watches_below` (:377) usa `symlink_metadata` de propósito, 'para que um diretório symlinkado não seja descido e um loop não seja entrado'; o event loop usa `p.is_dir()`, que é `fs::metadata` e SEGUE symlink. Como o `inotify_add_watch` não passa `IN_DONT_FOLLOW`, adicionar um link cujo alvo já está vigiado devolve o MESMO descritor, e o notify sobrescreve o mapeamento descritor→caminho (inotify.rs:464); daí em diante todo evento daquele diretório real chega como `<link>/<nome>`, que o `resolve` recusa, e as dicas caem no `(None, Err(_))` de reconcile.rs:288. Um link apontando para fora da raiz instala watch de inotify fora do workspace. (b) O watch instalado é `NonRecursive` e não há walk abaixo dele, ao contrário do walk inicial — e o notify só enfileira adição recursiva quando o pai foi registrado com `is_recursive == true`. O comentário em :298-300 afirma justamente a cobertura que a linha não dá. **Cenário:** (a) Um cliente de sync, um `git checkout` ou um restore cria `/w/up -> .` (a forma exata do fixture de risco do próprio projeto, `tools/gen-deep.sh:79`). A partir daí toda edição externa na raiz é reportada como `up/nota.md` e descartada. (b) `mv ~/projeto/docs ~/notas/` com `docs/api/*.md` dentro: `~/notas/docs` ganha watch, `~/notas/docs/api` nunca ganha, e editar `rest.md` no VS Code não produz evento nenhum. Em ambos os casos a aba ainda atualiza, porque `reconcileAll` roda a cada 5 s (sync.ts:166), mas o critério '<1s' vira '<=5s' e — pior — nota NOVA criada por outro programa naquele diretório nunca aparece na barra lateral enquanto o workspace estiver aberto, porque `fs_changed` é a única coisa que refaz a listagem e `Created` é suprimido em varredura completa. **Conserto:** Trocar `p.is_dir()` por `std::fs::symlink_metadata(&p).map(|m| m.is_dir()).unwrap_or(false)` e chamar `add_watches_below(&mut watcher, &p, &walk_counters, &stopped)` em vez do `watcher.watch()` solitário — o canal de parada já está threaded, então cancelamento continua funcionando. Corrigir o comentário. `crates/notes-fs/tests/watch_walk.rs` não cobre a instalação pós-walk de forma alguma: um teste que cria `root/up -> .` com o watch vivo e depois afirma que uma edição em `root/nota.md` chega como `nota.md` fixa o caso. *(tema: A regra vale num caminho e não no gêmeo)*
- [ ] R6-11 — **Nota que aparece sem dica por arquivo nunca marca o índice nem o quick-open como vencidos** (`crates/notes-core/src/reconcile.rs:281`, severidade médio, conserto médio). `reconcile` emite `Created` só quando o tick teve dica E o caminho é arquivo E é nota (`if !full && stat.kind == EntryKind::File && path.is_note()`), e as duas invalidações — lista do quick-open e índice de conteúdo — estão atrás de `if !events.is_empty()` (:309 e :312). O caso mais forte não é o diretório movido, é a VARREDURA COMPLETA: `apps/notes-app/src/stores/sync.ts:164` dispara `reconcileAll` a cada 5 s incondicionalmente, e `full == true` suprime o ramo `Created` para toda nota criada externamente. Isso é um desvio de dois ADRs ATIVOS, não só um acoplamento: ADR-032 (docs/decisions.md:947) manda invalidar em 'qualquer tick de reconciliação' e aceita explicitamente a grosseria ('um tick que não mudou nada ainda assim derruba o cache — e isso é escolhido'); ADR-034 (:1093) diz que a cláusula sobrevive com exatamente UMA qualificação. O `if !events.is_empty()` é uma segunda qualificação, introduzida no mesmo commit que escreveu o ADR-034, e nenhum ADR a registra. **Cenário:** Workspace sem watch (mount de rede, tabela de inotify esgotada, o backend SAF do 0.4) ou qualquer nota criada por outro programa: `quick_open` toma o ramo `state.stale && !ix.snapshot().building` com `stale == false` e devolve a lista capturada na abertura do workspace. O Ctrl+P não acha as notas novas, e `QuickOpen.building` é false, então a paleta nem diz que a lista está incompleta. A janela é indefinida (limpa por qualquer `CoreEvent` posterior ou por reabrir o workspace), não permanente. O índice de conteúdo escapa só porque `IndexControls.tsx:35` roda `indexStart` a cada dez segundos — um timer de UI, não uma garantia do core; qualquer outro consumidor de `index_status().stale`, como o `partial` de `word_hits`, é informado de que o resultado está completo quando não está. **Conserto:** Separar 'algo mudou aqui' de 'há evento visível ao usuário': marcar `content_dirty` e `paths.stale` no braço `(None, Ok(stat))` para `File` e `Dir`, antes da guarda `!full` que decide se ANUNCIA. Como ADR-032 é ATIVO e explícito, ou se restaura o comportamento dele atrás de uma checagem barata de forma da árvore, ou se escreve o ADR que o reverte. *(tema: A regra vale num caminho e não no gêmeo)*
- [ ] R6-12 — **Index::apply apaga a linha do FTS por coluna UNINDEXED, e a construção do índice fica quadrática** (`crates/notes-index/src/lib.rs:199`, severidade médio, conserto médio). `apply()` atualiza a entrada FTS com `DELETE FROM fts WHERE path=?1` seguido de `INSERT`. `path` é declarada `UNINDEXED` na tabela fts5 (:141), então não há índice e o SQLite planeja uma varredura completa da tabela virtual a cada delete; `remove()` (:220) reusa a mesma statement num laço. Como `build_locked` chama `apply` uma vez por nota, um build de N notas faz N varreduras sobre uma tabela que cresce até N linhas, com um commit por nota em cima. Medido: 31,4 s contra 0,6 s em 3.000 notas de ~22 KB — ~50x — o que extrapola para 5-6 minutos no `fixtures/large` de 10.000 notas do próprio repositório. **Cenário:** O usuário aponta o Tura para um vault de 10.000 notas, ou aperta 'Rebuild index' (IndexControls.tsx:63 chama `indexStart(true)`, que força `reparse = true` para toda nota). O job de índice segura `index.lock` e mói por minutos enquanto a barra lateral mostra 'indexando' e a busca por palavra devolve `partial = true` o tempo todo. Atenção: pular o DELETE quando o caminho ainda não existe conserta só o build frio — no rebuild forçado todo caminho já está em `plan()` e a guarda não pula nada. **Conserto:** Parar de chavear a linha do fts por coluna UNINDEXED: manter o rowid do fts igual ao rowid de `notes` e apagar por rowid, ou usar o idioma `INSERT INTO fts(fts, rowid, path, text) VALUES('delete', ...)`; alternativamente, com `force`, dropar e recriar a tabela fts. A guarda de 'sem linha anterior' (`cached.is_none()` já é conhecido em content_index.rs:174) é segura e vale para o build frio, mas não substitui isso. *(tema: Quadrático escondido atrás de um laço, invisível em fixture de três notas)*
- [ ] R6-13 — **inventory() reescreve o registry inteiro via SQLite uma vez por nota, cada vez sob o write lock** (`crates/notes-core/src/sync.rs:132`, severidade médio, conserto médio). `inventory_using` termina chamando `service.open_note(&path)` para toda nota. `open_note` toma o `write.lock` e, dentro da seção crítica, `open_note_locked` recarrega o registry (lib.rs:552-554) e chama `state::store` incondicionalmente (lib.rs:568-570) — sem checagem de sujeira, e nenhuma é possível como está, porque `Registry::observe` sempre bumpa `last_seen` (registry.rs:119-128). Cada `store` abre uma conexão SQLite nova (com probe de `user_version` e três `pragma_update`) e roda uma transação IMMEDIATE que parseia o payload atual, a baseline e o payload desejado, faz merge de 3 vias, varre todo registro procurando caminho duplicado e reserializa o registry inteiro. Medido com `notes-sync-plan`: 0,49 s / 1,78 s / 6,83 s a 100 / 200 / 400 notas, e 13,2 s com 400 notas sobre registry já populado (~33 ms de trabalho travado por nota), escalando como N². No limite de 10.000 notas (imposto em sync.rs:104) um inventory é de minutos a horas. **Cenário:** O sintoma não é 'uma seção crítica longa', é 'um passe de sync que nunca termina'. E o caminho que compartilha o lock do editor não é o de recepção (esse roda contra `<state_dir>/inspection`), é o `Controller::pair` em modo 'download' (control.rs:483-487), porque o app Tauri constrói o Controller com `service.data_dir()` (src-tauri/src/lib.rs:27): parear um workspace não-vazio para download roda o inventory quadrático inteiro sobre o registry vivo e o `write.lock` só para descobrir que ele não está vazio, e então devolve `Conflict`. **Conserto:** Tomar o lock uma vez em volta do laço de `open_note` (ou acrescentar um `read_note` que não persiste) e fazer `state::store` do registry virar no-op quando `observe` não mudou nada — o que exige `observe` parar de bumpar `last_seen` sem necessidade, ou reportar se mudou. Em `pair` modo download, checar se o workspace está vazio antes de inventariá-lo. *(tema: Quadrático escondido atrás de um laço, invisível em fixture de três notas)*
- [ ] R6-14 — **Varredura quadrática de parênteses nos autolinks trava preview e indexação por causa de uma nota** (`crates/notes-markdown/src/lib.rs:636`, severidade médio, conserto pequeno). O trim de pontuação final em `autolinks()` reconta a URL candidata inteira a cada passo: para cada `)` que retira, roda `slice.matches(')').count()` e `slice.matches('(').count()` sobre o resto todo, então n parênteses de fechamento desbalanceados custam O(n²). O gatilho é específico — uma corrida longa de `)` logo depois de um token `http(s)://` sem espaço no meio; um blob minificado terminando em `}))});` sai do laço no primeiro `}`. `autolinks()` é chamado duas vezes por render, e a chamada de `analyse()` (:270), ao contrário de `rewrite()`, não tem guarda de `code_depth`, então texto dentro de bloco de código cercado também dispara. `analyse()` é o que `notes_markdown::parse()` roda, isto é, o caminho do indexador (notes-index/src/lib.rs:193) e do sync (notes-sync/src/transfer.rs:79), nenhum dos dois atrás do debounce do preview. **Cenário:** Um `.md` chega por sync, import ou colagem com `https://a` seguido de 100.000 `)`. Medido em build otimizado do trecho verbatim: 5k parênteses 45 ms, 10k 183 ms, 20k 724 ms, 40k 2,89 s, contra 86 µs para 40k bytes sem parêntese. Pior, em `notes-index/src/lib.rs:190` a transação de escrita do SQLite é aberta ANTES do `parse()` da linha 193, então a varredura quadrática roda com a transação de índice segurada. No teto de 8 MiB que `content_index.rs:179` admite, são dezenas de horas. **Conserto:** Contar `(` e `)` uma vez antes do laço de trim e decrementar conforme os caracteres caem, ou limitar o comprimento do candidato antes do trim. Independentemente, pôr guarda de `code_depth` no braço `Event::Text` de `analyse()` (:266) e acrescentar um fixture em `fixtures/edge-cases/` que fixe o custo. *(tema: Quadrático escondido atrás de um laço, invisível em fixture de três notas)*
- [ ] R6-15 — **transfer() re-hasheia o cache inteiro e faz fsync do arquivo de estado inteiro a cada revisão publicada** (`crates/notes-sync-client/src/state.rs:550`, severidade médio, conserto médio). O laço de publicação chama `self.save(&state, false)` depois de CADA revisão, e `save` roda `state.validate()`, que decodifica todo payload em cache duas vezes (uma reconstruindo `incoming` por `transfer::append` -> `payload_size`, outra no laço de contabilidade de bytes) — e três vezes quando há anexo, porque `attachment_size` decodifica de novo e roda `notes_markdown::parse` para reconstruir o conjunto de caminhos referenciados, com decode+reencode+blake3 por asset. Depois serializa o estado inteiro e faz fsync do arquivo e do diretório. Por passe são 22 validações e 21 reescritas (o `load()` valida, o laço salva até 20 vezes, `fetch_into` salva mais uma), e o agendador de fundo ainda envolve `transfer()` em `stage()`, `conflicts()`, `status()`, `acknowledge()` e `receiver_changes()`, cada um com seu próprio `load()` -> `validate()`. **Cenário:** No teto documentado (32 MiB decodificados / 64 MiB serializados) um único passe faz cerca de 1,4 GB de trabalho base64+blake3 e escreve ~1,3 GB com 42 fsyncs para publicar um punhado de notas. O transporte de fundo opcional do desktop (control.rs:411) roda isso num timer segurando o write lock de `client.lock` (state.rs:530-531), então o custo também aparece como `Error::Busy` para qualquer comando CLI concorrente no mesmo diretório de estado. (O alvo móvel do 0.4 não conta ainda: o `notes-sync-client` não está ligado ao app móvel.) **Conserto:** O checkpoint por publicação é deliberado ('Every receipt is checkpointed separately', state.rs:527-528), então manter o checkpoint e baratear o `save`: validar no `load` e na entrada de mutação, não em toda escrita; ou fazer o `validate` calcular o total de bytes a partir do replay de `incoming` que ele já fez, em vez de uma segunda varredura de `payload_size` — isso já remove um decode completo de graça. *(tema: Quadrático escondido atrás de um laço, invisível em fixture de três notas)*
- [ ] R6-16 — **Endpoints de leitura do sync tomam o lock exclusivo do vault, então dois dispositivos simultâneos dão 503 a um** (`server/notes-server/src/sync.rs:207`, severidade médio, conserto médio). `transaction_workspace` sempre toma `lock.try_write()` — exclusivo e não-bloqueante, então contenção vira `Error::Busy` imediato em vez de espera. Dois dos seus chamadores HTTP nunca escrevem: `page` (:478) e `fetch` (:509), ambos devolvendo `changed = false`. (`devices`, :278, é só da CLI offline, não entra nisso.) O lock é segurado por todo o caminho de carga — `symlink_metadata`, leitura de até 64 MiB, `serde_json::from_slice` e `Vault::validate`, que reconstrói o journal inteiro e recalcula `payload_size` de toda publicação — então a janela de colisão é a duração inteira da requisição e cresce com o vault. `admin::lock` já demonstra a forma certa para o store de credenciais: `lock.read()`, compartilhado, a cada requisição HTTP. **Cenário:** Dois dispositivos pareados — a premissa do marco 0.6 — consultam `GET /v1/workspaces/home/sync/revisions` em momentos sobrepostos. O `try_write` do segundo falha, vira 503 `busy` (api.rs:564), o passe termina, `s.failures` incrementa e o próximo passe é adiado para `interval * 2^failures` limitado a 3600 s (control.rs:458, 647-649): com o intervalo mínimo de 120 s, uma colisão adia para 240 s e repetições escalam rumo a uma hora, por uma leitura que não muda nada. Quanto maior o workspace, maior a janela e mais frequente a colisão. **Conserto:** Partir `transaction_workspace` em caminho de leitura e de escrita (ou dar um argumento de modo): o de leitura toma `lock.read()`, compartilhado e bloqueante, e pula o ramo de serializar/persistir; `page` e `fetch` migram para ele. Atenção: `transaction_workspace` escreve quando `changed || !exists` (:231), então um `page` contra workspace sem `vault.json` cria o arquivo sob aquela guarda — o create-on-first-touch precisa continuar exclusivo. *(tema: Quadrático escondido atrás de um laço, invisível em fixture de três notas)*
- [ ] R6-17 — **O pareamento em Reconcile mostra um plano errado e depois recusa com um Conflict que não nomeia causa** (`crates/notes-sync-client/src/state.rs:1981`, severidade médio, conserto médio). `Controller::pair` busca exatamente uma página (control.rs:508, no máximo 20 revisões) e `pairing_snapshot` monta o lado remoto apenas a partir de `Self::incoming(state)` — o que já está em cache. Notas remotas ainda não buscadas simplesmente não existem no plano, e os arquivos locais correspondentes são classificados como `Upload` em vez de `Link`. Como `fetch_into` descarta `page.has_more` (state.rs:809-818), nem o core nem a UI conseguem dizer que a visão é parcial. O que separa esse plano errado de um pareamento confirmado é a checagem de cursor em `confirm_pairing` (:2078-2085), que recusa com `Error::Conflict` — e no app desktop essa falha é renderizada como 'This storage does not support that.' (commands.rs:537-541 -> en.json:171). **Cenário:** A máquina A publica 60 notas; a B pareia em Reconcile contra a mesma pasta de 60 arquivos e recebe, sem pedir, 20 linhas `link` e 40 linhas `upload` para arquivos que já estão no servidor. Nada corrompido é commitado — o digest de confirmação amarra o cursor —, mas a superfície de decisão mente. Pior: quando a página 1 traz a criação de uma nota e uma página posterior a atualização dela, o cache parcial exibe um `conflict` fantasma naquele caminho, e o remédio documentado para conflito (SYNC-0.6.md:806-810 — renomear o arquivo local para ele subir como nota separada) cria então uma duplicata de identidade de verdade, que um confirm posterior e já drenado aceita. **Conserto:** Persistir `has_more` e recusar (ou marcar visivelmente) um preview tomado sobre cursor não drenado, dizendo isso na recusa — 'ainda recebendo: N de M'. O dreno em vários passes é deliberado e documentado (SYNC-0.6.md:783-785), então a correção não é 'fazer laço no fetch', é parar de produzir plano a partir de cache parcial. E mapear esse `Conflict` para uma string que não seja 'This storage does not support that.' *(tema: Um sinal para muitas causas — o diagnóstico não discrimina)*
- [ ] R6-18 — **A tabela do rate limiter nega todo desconhecido depois de 4096 entradas, transformando flood em indisponibilidade** (`server/notes-server/src/api.rs:87`, severidade médio, conserto pequeno). `Server::rate` mantém um `HashMap` compartilhado pelos dois namespaces (`ip:` e `token:`). Ao chegar a 4096 entradas vivas ele para de admitir chaves novas e devolve `false` — que os chamadores traduzem em 429 — em vez de despejar alguma. A cardinalidade é controlada pelo atacante: a chave por endereço é cobrada ANTES da autenticação (:276-281), então uma requisição de um endereço basta para criar uma entrada que vive 60 s. Agravante que o enunciado original subestimou: o timestamp é escrito no insert e nunca renovado, então o `retain` derruba até um dispositivo continuamente ativo 60 s depois da primeira requisição dele, e ele é recusado na reentrada. O `/healthz` está dentro do raio: a checagem de rate (:276) precede o atalho de health (:282). **Cenário:** O deploy é um nome público em IPv6 (nginx-tura.conf:26). Um atacante em qualquer VPS com um /64 roteado manda 4096 requisições de endereços diferentes, sem credencial e sem caminho válido, em poucos segundos. Nos 60 s seguintes toda requisição de quem não está na tabela leva 429: o telefone do Samir, todo dispositivo pareado, e o `curl` de `deploy-server.sh:197-198` — que usa `-fsS`, trata 429 como falha e aborta o deploy com 'o serviço não respondeu em loopback após o restart', culpando o serviço. Re-inundar uma vez por minuto sustenta isso a ~68 req/s. **Conserto:** Na saturação, despejar a entrada mais antiga em vez de recusar a chave nova — o limite de memória continua e a direção da falha inverte. Manter dois mapas com tetos separados (há no máximo 1024 credenciais, então esse mapa pode ser exatamente limitado), considerar chavear IPv6 por /64, e escrever o teto da tabela e o comportamento na saturação no parágrafo de limites de SERVER-0.5.md, já que a §7 de docs/security.md faz da ausência de limite uma decisão a registrar. *(tema: Controle verde que falha na direção errada)*
- [ ] R6-19 — **A auditoria do servidor não permite investigar um incidente: peer é sempre o proxy e todo MCP é a mesma linha** (`server/notes-server/src/api.rs:324`, severidade médio, conserto pequeno). Dois buracos no mesmo registro. (a) O campo `peer` recebe o endereço de connect-info nos três call sites (:324, :348, :360); em qualquer deploy com proxy — o único modo não-loopback suportado — isso é sempre o proxy (`NOTES_SERVER_TRUSTED_PROXY=127.0.0.1` no unit file). O endereço real do cliente é calculado uma linha antes para o rate limiter (`server.charged_address`, :277) e descartado. (b) O registro é montado do verbo HTTP e do caminho ANTES do `dispatch`: como todo MCP é `POST /v1/mcp`, toda chamada — `notes_read`, `notes_delete`, `tools/list`, `ping`, notificação sem id, corpo que não parseia — vira operação `create_or_move` com `target_ref` idêntico (hash da string '/v1/mcp'), o que anula exatamente o propósito escrito em docs/SERVER-0.5.md:315-318 ('permite correlacionar autoria sem registrar caminhos de notas'). **Cenário:** Uma credencial vaza e o atacante apaga 40 notas via `POST /v1/mcp`. O `events.jsonl` mostra 40 pares idênticos de `{"operation":"create_or_move","result":"ok","target_ref":"<hash de /v1/mcp>"}` — indistinguíveis de um agente que CRIOU 40 notas — e todas as linhas, as do atacante e as dos dispositivos do dono, dizem `"peer":"127.0.0.1"`. Nos templates nginx/Apache o log de acesso do front ainda salva a atribuição por junção de horário e status; no deploy `compose.yml` + `Caddyfile` (duas linhas, sem diretiva `log`) o endereço do cliente não fica registrado em lugar nenhum. **Conserto:** Calcular `let client = server.charged_address(peer, request.headers());` uma vez em `execute` antes do `into_parts()` e levá-lo para dentro do closure: gravar os dois campos (`peer` = o salto de transporte, `client` = o endereço cobrado) torna um X-Forwarded-For forjado visível em vez de sobrescrever a verdade. E passar o método JSON-RPC + nome da ferramenta (strings de allowlist, não argumentos) e um hash do argumento `path` para `audit_target`, o que mantém a §6 intacta e faz a linha significar alguma coisa. *(tema: Um sinal para muitas causas — o diagnóstico não discrimina)*
- [ ] R6-20 — **O MCP devolve o CoreError cru ao cliente, incluindo caminho absoluto do servidor; o REST reduz a um código** (`crates/notes-mcp/src/lib.rs:148`, severidade médio, conserto pequeno). `call()` serializa o `CoreError` tipado inteiro no texto do resultado da ferramenta. O REST nunca faz isso: `impl From<CoreError> for ApiError` mapeia toda variante para status fixo e uma de poucas strings constantes, e emite `{"error":"<code>"}` sem mais campo nenhum. Os dois envelopes, que deveriam ser o mesmo, divergem exatamente no ponto que carrega detalhe do servidor. O caminho mais alcançável: `adopt_locked` chama `fs.list(&RelPath::root())` em toda chamada de ferramenta MCP e `AgentService::paths()` chama `list` por subdiretório durante `notes_list`; `LocalFs::list` reporta `CoreError::io("read_dir", abs.display(), &e)` com o caminho ABSOLUTO (local.rs:149). **Cenário:** Uma subpasta dentro do escopo da própria credencial perde permissão de leitura — sem rename, sem unmount. O agente remoto recebe `{"code":"io","op":"read_dir","path":"/srv/notes/workspaces/samir/allowed/sub","kind":"permission_denied"}`, e dali vai para o transcript do agente e para o provedor que o hospeda; a mesma falha no REST devolve `500 {"error":"operation_failed"}`. docs/security.md §8 pede que um erro não carregue stack trace, query, caminho ou versão. **Conserto:** Projetar o erro pela mesma redução que o REST usa antes de chegar ao `content`: emitir `{"code": e.code()}` (o `CoreError::code()` já existe em error.rs:144, é o vocabulário compartilhado para isso) mais apenas os campos acionáveis pelo chamador (`disk_rev` no conflito, o `path` que o próprio chamador mandou), descartando `root`, `message` e os caminhos absolutos de `LocalFs::open`/`list`/`stat_at`. Um caso em server/tests/mcp.py afirmando que nenhum corpo de erro MCP contém caminho começando com `/` fixa a classe. *(tema: A regra vale num caminho e não no gêmeo)*
- [ ] R6-21 — **O schema MCP declara base_rev.mtime_ns como number; o formato do fio é string, de propósito** (`crates/notes-mcp/src/lib.rs:123`, severidade médio, conserto pequeno). `tools()` publica `mtime_ns` como `{"type":"number"}`, mas `BaseRev.mtime_ns` é `i128` com `#[serde(with = "ns_string")]` (notes-model/src/lib.rs:103-105), então o servidor só emite string — e o motivo está escrito acima do módulo e em DECISIONS-0.1a D-16: `mtime_ns` é ~1,7e18 e `Number.MAX_SAFE_INTEGER` é 9,0e15. Como o REST nunca expõe essa forma (base_rev viaja como ETag base64) e `notes_mcp::handle` é o catálogo único de stdio e `POST /v1/mcp`, esse schema é a ÚNICA declaração publicada do tipo, e está errada na direção exata que o tipo string existe para evitar. O binding TS diz `#[ts(type = "string")]`; o MCP é o único dissidente. **Cenário:** Bifurca, e os dois ramos são perda. (a) O agente, guiado pelo `"type":"number"`, emite `1757268123456789321` como número JSON; um host JS arredonda para `...789248` ao reserializar os argumentos, `ns_string::deserialize` aceita o número em silêncio, `current != base` em agent.rs:266 e a escrita é recusada como conflito de escrita obsoleta — que se repete a cada tentativa, para sempre. (b) O agente que copia a string verbatim (o que docs/KNOWLEDGE-0.3.md:144 manda fazer) é rejeitado por qualquer host que valide argumentos contra o inputSchema, antes da chamada sair. Nenhum teste pega: stdio.rs:124 e mcp.py:117-122 ecoam o objeto parseado de volta, preservando a string. **Conserto:** Declarar `{"type":"string","pattern":"^-?[0-9]+$"}` (ou `["string","number"]`, para casar com o deserializador tolerante) e acrescentar 'copie base_rev sem alterar' às descrições das ferramentas de escrita — essa instrução hoje só existe em KNOWLEDGE-0.3.md, que nenhum cliente MCP lê. Um teste comparando o tipo emitido pelo schema com o tipo que `serde_json::to_value(BaseRev{..})` produz fecha a classe. *(tema: A regra vale num caminho e não no gêmeo)*
- [ ] R6-22 — **O catálogo MCP não publica offset, então notas além do limite são inalcançáveis por notes_list** (`crates/notes-mcp/src/lib.rs:124`, severidade médio, conserto pequeno). `AgentArgs` carrega `offset` e `AgentService::call` o honra para `notes_list` e `notes_search` até 1.000.000; o REST expõe isso como `cursor` e o openapi.json documenta. O schema MCP publica só `limit` (default 100, teto 200 pelo schema e pelo `clamp(1, 200)`), e como `handle` rejeita qualquer chave ausente das propriedades publicadas (`a.keys().all(...)`, :238), o agente que tenta paginar leva `-32602 Invalid tool arguments`. `notes_list` também não publica `path`, então nem dá para estreitar a listagem a um subdiretório para caber no teto. O `"truncated": true` que o catálogo devolve é uma promessa de continuação que a superfície não cumpre. **Cenário:** Workspace com 350 notas: o agente recebe 200 caminhos e `truncated: true`, manda `{"limit": 200, "offset": 200}` e é recusado. Por MCP remoto ele ainda pode cair no REST com a mesma credencial; no MCP por stdio (marco 0.3, arquivo de config, sem servidor) esse escape não existe e o teto é absoluto — as 150 notas restantes só são alcançáveis adivinhando uma query de `notes_search` que case. **Conserto:** Acrescentar `"offset": {"type":"integer","minimum":0,"maximum":1000000}` às propriedades de `notes_list`/`notes_search` (o core já aceita, nada mais muda) e, melhor ainda, devolver o `nextCursor` do próprio MCP quando `truncated` for true. Um caso em server/tests/mcp.py criando 201 notas e afirmando que a 201ª é alcançável fixa. *(tema: A regra vale num caminho e não no gêmeo)*
- [ ] R6-25 — **Nenhuma imagem carrega no Android nem no Windows: o CSP permite notes-asset:, que é a forma que essas plataformas não roteiam** (`apps/notes-app/src-tauri/tauri.conf.json:24`, severidade médio, conserto médio). `asset.rs` foi escrito de propósito para lidar com a reescrita de Windows/Android — o comentário em :63-66 diz que o WebView reescreve para `http://notes-asset.localhost/<path>` e o handler aceita o id do workspace como host ou como primeiro segmento. As duas coisas que tinham de mudar junto não mudaram: `notes-markdown` ainda emite o literal `notes-asset://<id>/<path>` (lib.rs:475) e o CSP ainda lista só `notes-asset:`. Nessas duas plataformas o esquema cru não é registrado e nunca chega ao handler; e a forma reescrita não passa no `img-src`, porque `notes-asset:` não casa URL `http:` e `'self'` é `http://tauri.localhost`. Não existe URL que simultaneamente alcance `asset::serve` e passe no CSP — o Tauri não remenda esquemas custom declarados pelo usuário no CSP. **Cenário:** No build Android do 0.4, abrir uma nota com `![](img/a.png)` e ir para o preview: toda imagem de toda nota é um ícone quebrado, sem nenhum erro vindo do lado Rust. O mesmo vale para o NSIS do Windows, hoje latente porque aquele job está com `if: false`. É latente também no Android porque o 0.4 nunca rodou (bloqueado em KVM), mas dispara na primeira execução em qualquer das duas — que é o próximo marco da trilha móvel ativa. **Conserto:** Dois sítios mais um documento, e consertar um só deixa tudo quebrado: `tauri.conf.json:24` ganha `http://notes-asset.localhost` ao lado de `notes-asset:` (espelhando o que `connect-src` já faz para `ipc:`), e `crates/notes-markdown/src/lib.rs:475` emite a forma `http://notes-asset.localhost/<id>/<path>` no Windows e no Android — idealmente com a origem vindo do shell (`EnvReport`/`RenderOpts`) em vez de hard-coded. `docs/ARCHITECTURE.md:871-874` tem uma terceira cópia já desatualizada do CSP, a corrigir no mesmo passe; e docs/ACCEPTANCE-0.1b.md:455-457 já dizia que essa forma de URL foi 'afirmada por leitura, não por execução' — a leitura estava errada. *(tema: A regra vale num caminho e não no gêmeo)*
- [ ] R6-28 — **O arquivo de capabilities concede leitura de clipboard que ninguém usa e descreve uma invariante falsa** (`apps/notes-app/src-tauri/capabilities/default.json:4`, severidade médio, conserto pequeno). Dois problemas no arquivo que um auditor abre primeiro. (a) A capability concede `clipboard-manager:allow-read-text` e `allow-write-text` e `lib.rs:112` inicializa o plugin, mas nenhum código do front-end invoca nenhum dos dois — o pacote JS nem está instalado; toda operação de clipboard usa a plataforma Web. A concessão de LEITURA é a que importa: permite que qualquer coisa rodando na webview leia o clipboard do SO à vontade, sem gesto do usuário e sem prompt — a única permissão do arquivo que lê dado FORA do domínio de confiança da aplicação (uma senha, um TOTP, o bearer `nt_...` que o dono copia para o arquivo de token), e o `navigator.clipboard.readText()` não oferece isso em WebKitGTK/WKWebView/WebView2. (b) A `description` do arquivo diz que a permissão de dialog é 'directories only' e que 'toda leitura e escrita passa por um comando deste crate, que valida o caminho resolvido contra a raiz do workspace'. As duas frases são falsas: `dialog:allow-open` nunca teve sintaxe de escopo para isso (`directory` é argumento de runtime), e dois comandos aceitam caminho absoluto arbitrário da webview sem validação de workspace — `pdf_extract(path: String)` (commands.rs:178) e `sync_control_probe(..., token_file: String)` (commands.rs:622). `docs/ARCHITECTURE.md:865` repete tudo. Atenção: o grep de CI não defende nada disso — `ci.yml:41` e `check.sh:166` só procuram `"fs:[a-z-]+"`. **Cenário:** Um revisor auditando o alcance da webview lê essas duas frases, conclui que nenhum caminho de arquivo entra no processo pelo dialog nem escapa do jail, e por isso não examina `pdf_extract`, que stata e lê até 32 MiB de qualquer lugar do sistema de arquivos. A frase falsa é exatamente a que sustenta a conclusão errada, e já sobreviveu à varredura de precisão do próprio repositório (docs/ARCHITECTURE.md:6-13, 19/09/2026), porque aquela auditou IDENTIFICADORES e `dialog:allow-open` é um identificador que resolve. **Conserto:** Apagar as duas linhas de `clipboard-manager:*`, a chamada `tauri_plugin_clipboard_manager::init()` em lib.rs:112 e a dependência em Cargo.toml:24 — zero mudança visível ao usuário. Reescrever a `description` e ARCHITECTURE.md:865 para o que é verdade: o dialog abre diretórios E arquivos, a seleção de arquivo é inescopável por construção, e `pdf_extract` e o `token_file` de `sync_control_probe` são os comandos nomeados que leem fora da raiz, com a guarda de cada um ao lado — para o próximo leitor conferir a guarda em vez de confiar na capability. *(tema: Publicação e documentação: o que sai daqui e o que se lê primeiro)*
- [ ] R6-29 — **O controle 'nenhuma capability fs' passa quando o diretório dele não existe, no gate e no CI** (`tools/check.sh:166`, severidade médio, conserto pequeno). O passo é `! grep -rqE "\"fs:[a-z-]+\"" apps/notes-app/src-tauri/capabilities/`. `grep -r` sobre caminho inexistente sai com 2, o `!` transforma 2 em sucesso, e o passo imprime `ok` — o controle não distingue 'nenhuma capability fs concedida' de 'o diretório onde me mandaram olhar não está lá'. O CI tem o mesmo buraco na outra sintaxe (ci.yml:41), onde diretório ausente torna o `if` falso e a linha 45 imprime 'no fs capability granted'. As duas cópias falham abertas. É o passo cuja função inteira é provar uma negativa, que é a forma que falha aberta mais calada. Reproduzido: `grep -rqE ... missing/; echo $?` -> 2; `if ! grep ...; then echo PASS; fi` -> PASS. **Cenário:** Um upgrade do Tauri ou uma reorganização faz o `build.rs` definir `capabilities_path_pattern`, ou uma versão do Tauri muda o diretório padrão, enquanto os dois greps continuam apontando para o caminho antigo. Um `"fs:allow-read-file"` acrescentado ao default.json realocado viaja para um release assinado com gate e CI verdes. (Há uma segunda linha de defesa que o enunciado original não tinha: o `tauri-build` rejeita em tempo de build permissão cujo manifesto de plugin não exista, então um `fs:*` num arquivo que o Tauri PARSEIA quebra a compilação — mas isso não cobre o caso em que o Tauri lê outro diretório, nem o ponto cego abaixo.) **Conserto:** Afirmar que o palheiro existe antes de provar a negativa: `[ -d <dir> ] && [ -n "$(ls -A <dir>)" ] && ! grep -rqE ...`, idêntico nas duas cópias para não divergirem. E estender o padrão ao `tauri.conf.json`: o Tauri 2.11.5 também aceita capabilities inline em `app.security.capabilities`, ponto cego que não precisa de mudança de diretório nenhuma. Vale auditar os passos vizinhos de mesma forma (`version placeholder`, `one .menu rule block`, `chrome is not selectable`), embora esses leiam um arquivo nomeado e falhem corretamente quando ele some. *(tema: Controle verde que falha na direção errada)*
- [ ] R6-31 — **Uma execução falha do Release cancela permanentemente o build de artefatos daquele minor, sem retry** (`.github/workflows/build.yml:86`, severidade médio, conserto pequeno). `build.yml` é o único produtor do `.deb`, do `.AppImage` e dos tarballs de `notes-server`/`notes-mcp`/`notes-sync-client`, e roda em `workflow_run: [Release] types: [completed]`. O primeiro passo curto-circuita para `build=false` a QUALQUER conclusão não-sucesso do workflow de Release — erro transitório da API do `gh`, execução cancelada, falha de runner, ou a corrida entre o snapshot de `gh release list` (release.sh:165) e o `gh release create` (:211) — antes de chegar nas três checagens (:98-100, :109-111, :123-128) que decidiriam certo sozinhas. Como artefato só é construído em `X.Y.0` e nada re-dispara (o `paths: ["version.md"]` não pode disparar de novo sem número novo), aquele Release fica com notas e zero assets. Existe um terceiro caminho para a mesma perda que deixa o workflow de Release VERDE: `publish` retorna 9 quando o orçamento da API está abaixo de RATE_FLOOR (release.sh:190-191), esse retorno não é propagado em `--current` (:265), `FAILED` fica 0 e a linha 295 sai 0. **Cenário:** `version.md` vai a 1.8.0 e é empurrado; alguma dessas condições ocorre. O Release 1.8.0 fica sem nenhum asset, permanentemente, e `server/cotenant/deploy-server.sh:132-137`, que deriva `X.Y.0` e baixa `notes-server-1.8.0-x86_64-linux.tar.gz` daquele Release, falha com 404. Só um `workflow_dispatch` manual recupera. O comentário de concurrency em build.yml:38-58 mostra que o dono já pagou por esse sintoma com 1.4.0 e 1.5.0 — mas a correção de 1.5.5 (mover o grupo de concurrency para os jobs) não toca este caminho. **Conserto:** Apagar o curto-circuito por conclusão (ou movê-lo para depois da checagem de existência via `gh release view`): deixar o job prosseguir quando o Release daquela versão realmente existe — o sentinela de `.SRCINFO` (:106-111) já torna a reexecução idempotente. Em `tools/release.sh`, tratar um create que falha por 'já existe' como SKIPPED em vez de FAILED (reconferir com `gh release view` antes de contar falha) e propagar o retorno 9 de `publish` para o status de saída. Verificável com `gh release view X.Y.0 --json assets -q '.assets|length'`. *(tema: Controle verde que falha na direção errada)*
- [ ] R6-32 — **Actions de terceiros em ref mutável dentro do job que compila, assina e publica os binários** (`.github/workflows/build.yml:172`, severidade médio, conserto pequeno). `dtolnay/rust-toolchain@stable` é referência de BRANCH — mutável por definição e invisível ao Dependabot, que não abre PR para branch ref. Ela roda no job `linux`, que declara `permissions: contents: write` (:166), antes de `npm run tauri build` (:190) e antes do `gh release upload` (:243), com acesso de escrita a `target/release/bundle/` — e os `.sha256` são produzidos no mesmo job (:206-227), então certificam o que aquele job produziu. `Swatinem/rust-cache@v2` é evidência mais fraca (tag maior é prática comum e o Dependabot a acompanha), mas restaura cache de build gravável. Terceira ocorrência viva em :425, noutro job com `contents: write` e `GH_TOKEN`. O job `macos` (`if: false`) carrega `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD` e `APPLE_PASSWORD` — exposição futura, não atual. **Cenário:** A branch `stable` é reapontada — conta de mantenedor comprometida ou engano comum, como no incidente tj-actions/changed-files de março de 2025. A próxima publicação de um `X.Y.0` executa o passo do atacante, compila e sobe `notes-server-X.Y.0-x86_64-linux.tar.gz` com o `.sha256` do mesmo runner. Em seguida `tools/sign-server-release.sh` baixa exatamente esses dois arquivos, confere o digest contra o digest que aquele runner escreveu, assina os bytes com a chave minisign offline, e `deploy-server.sh` valida contra a chave pública fixada e instala. A assinatura é válida; ela atesta 'isto foi o que o CI publicou'. Isso é o risco residual que ADR-081 JÁ aceita por escrito — o que é novo é que esse CI tem uma porta de entrada de terceiro, mutável e de custo zero para fechar. **Conserto:** Fixar as actions de terceiros nos jobs com `contents: write` em SHA de 40 caracteres com a versão em comentário à direita (`dtolnay/rust-toolchain@<sha> # stable`), que o Dependabot atualiza normalmente e que torna uma tag movida um no-op. Vale olhar junto o job `arch` (:275), que roda em `container: archlinux:latest` com `pacman -Syu --noconfirm` e sobe para o mesmo Release — superfície maior, mesmo caminho. *(tema: Publicação e documentação: o que sai daqui e o que se lê primeiro)*
- [ ] R6-33 — **Todo pacote distribuído se declara MIT © Samir enquanto linka 625 crates, seis deles MPL-2.0** (`NOTICE:14`, severidade médio, conserto médio). Licenciamento não estava entre as dimensões revisadas e nada no repositório o fecha. O `NOTICE` existe para 'guardar atribuição de terceiros que uma licença exige e que o LICENSE não carrega' e diz 'None yet.', seguido de um exemplo copiado de outro repositório (SHVIA-WEB / Crawl4AI) que o próprio arquivo manda apagar quando houver entrada real. Enquanto isso, todo artefato é um binário estaticamente linkado com 625 pacotes Rust — 155 MIT puro, 282 `MIT OR Apache-2.0` e 6 MPL-2.0 (`cssparser`, `cssparser-macros`, `dtoa-short`, `option-ext`, `selectors`, chegando pela pilha ammonia/servo que sanitiza o HTML do preview) — mais um bundle JS de ~94 pacotes npm. `tauri.conf.json:46` declara `"license": "MIT"` sem `licenseFile`; `packaging/aur/notes-bin/PKGBUILD.in:12` declara `license=('MIT')` e instala só o LICENSE do projeto; `packaging/linux/tarball.sh:50` copia só o `LICENSE`. Não há `cargo-about`, `cargo-deny`, `about.toml`, arquivo `THIRD-PARTY` nem passo de licença em workflow ou gate — grep por todos eles não retorna nada. **Cenário:** Um usuário instala `tura-notes_1.7.4_amd64.deb`, abre `/usr/share/doc/tura-notes/copyright` (ou o `/usr/share/licenses/notes-bin/LICENSE` do AUR) e encontra uma única concessão MIT atribuída a Samir Hanna Verza cobrindo um binário que embute `selectors` e `cssparser` sob MPL-2.0 e 155 crates MIT cujos avisos de copyright obrigatórios não aparecem em lugar nenhum da distribuição. Quem redistribuir — empacotador de distro, mirror, o próprio AUR — herda um pacote cujo campo de licença é factualmente errado, e o campo `license=('MIT')` do AUR é conferível por qualquer revisor contra os crates linkados. **Conserto:** Acrescentar `cargo about generate` (ou o check de licenças do `cargo-deny` mais um coletor pequeno) como passo de build emitindo `THIRD-PARTY-NOTICES.md` a partir do lockfile, mais o lado npm via `license-checker`; distribuí-lo como `bundle.licenseFile` no tauri.conf.json para `.deb`/`.rpm`/AppImage carregarem, copiá-lo em `packaging/linux/tarball.sh` ao lado do LICENSE, e instalá-lo no PKGBUILD. Substituir o 'None yet' e o placeholder do SHVIA-WEB por um ponteiro para o arquivo gerado mais a entrada MPL-2.0 nomeando os crates e onde está o fonte deles. Uma linha `cargo deny check licenses` em `tools/check.sh` impede que uma dependência copyleft nova chegue calada. *(tema: Publicação e documentação: o que sai daqui e o que se lê primeiro)*
- [ ] R6-34 — **O estado do updater está errado em duas páginas ACTIVE e no índice da fila, com carimbo de 'tudo conferido'** (`docs/updater.md:288`, severidade médio, conserto pequeno). A linha 'Atualização desktop' de `.continue/README.md:23` e a seção 'What is published, measured from outside — 18/09/2026' de `docs/updater.md:281-303` afirmam quatro coisas que o próprio repositório retratou em 1.6.66 (eea985f, que consertou README.md, runbook.md e .loop/QUEUE.md e deixou essas duas): os feeds Linux estão em 1.6.3 (estão em 1.7.2), `/p/tura-notes` 'ainda diz In preparation' (lista 1.7.4), 'falta rodar o publish de novo' (já rodou), e falta a chave do updater nomeando `./signing.env` e `~/.config/tura-notes/build.env` — que guardam as credenciais de NOTARIZAÇÃO do macOS, enquanto `tools/updater-release.py:31-36` lê `~/.config/tura-notes/updater.key`, presente desde 16/09. A updater.md acrescenta uma quinta: diz que o feed `darwin-aarch64*.json` devolve 404 e 'não haverá um até existir build assinado num Mac' — esse feed está vivo em 1.7.4, e o changelog 1.7.3 descreve depurar uma atualização in-app no macOS baixada dele. O amplificador é o carimbo de `.continue/README.md:3` ('Last reviewed 18/09/2026, repositório em 1.6.62 — cada linha abaixo conferida'), imóvel por oito edições e 44 versões, que converte linha velha em linha certificada — que é exatamente o defeito que 1.6.63 foi escrito para consertar. **Cenário:** Uma sessão começa, lê `.continue/README.md` primeiro como manda o CLAUDE.md, vê um carimbo afirmando que toda linha foi conferida, e trata a linha de topo como estado atual: reporta o updater desktop como bloqueado por chave de assinatura faltando, ou gasta a sessão rodando de novo um publish que já teve sucesso. Quem for triar 'o que falta na trilha do updater' recebe respostas opostas de duas páginas ACTIVE, e a que é dona do contrato é a errada. **Conserto:** Remedir os três feeds e `/p/tura-notes`, reescrever a tabela de §'What is published' com a data de hoje mantendo o snapshot de 18/09 abaixo como registro datado (padrão de 1.6.64/1.6.65), derrubar os itens 1 e 2 de 'what remains' e deixar o 3, o aceite, que segue genuinamente aberto. Corrigir a linha da fila para o que falta de fato (aceite de upgrade instalado em macOS/AppImage/deb/rpm e a checagem do `.deb` do ADR-082) e recarimbar com 1.7.4. Registrar o fato novo que a remedição revela e que ninguém tem: Linux está em 1.7.2 e macOS em 1.7.4, isto é, os clientes Linux estão duas versões atrás. Para a recorrência, uma checagem barata em `tools/check.sh` que falhe quando `.continue/README.md` é modificado num commit cujo carimbo ainda nomeia versão antiga. *(tema: Publicação e documentação: o que sai daqui e o que se lê primeiro)*
- [ ] R6-36 — **create_new deixa temporários de nome aleatório na pasta do usuário, o caso que tmp_path existe para evitar** (`crates/notes-fs/src/local.rs:280`, severidade baixo, conserto pequeno). `tmp_path` (:112-137) carrega um comentário longo explicando que nome temporário aleatório é errado precisamente porque 'com nome aleatório cada crash deixa um NOVO, então eles se acumulam na pasta do usuário para sempre', e `tools/crash-save-loop.sh` afirma o limite resultante de no máximo um resto por nota. `create_new`, dez linhas abaixo, usa `tempfile::Builder` com sufixo aleatório e tem exatamente a propriedade que o comentário recusa. O `NamedTempFile` limpa no Drop, mas nada limpa depois de um SIGKILL ou queda de energia, que é o único caso de que a regra trata. O caminho de acumulação real não é import de anexo (lá cada import tem alvo com UUID novo, então nenhum esquema de nome limita nada) e sim escrita repetida no MESMO caminho: `notes-sync-client apply` reexecutando o mesmo caminho recebido após ser morto (sync.rs:453, :880), ou o usuário recriando o mesmo nome de nota. **Cenário:** Cada tentativa deixa um `.notes-create-<aleatório>.tmp`; com a nomeação de `tmp_path` elas colapsariam em um. Os restos são invisíveis de dentro do Tura — escondidos da árvore por `ignore.rs:38`, do watcher por `relativise` e do índice por `index.rs:169` — então o usuário nunca fica sabendo por dentro do app, e `crash-save-loop.sh` é cego para este caminho por construção, porque `crash-writer.rs:30` só chama `write_atomic`. **Conserto:** Dar a `create_new` o mesmo nome temporário determinístico que `tmp_path` já produz, aberto com `create_new(true)` depois de um `remove_file` incondicional (o padrão exato de `write_atomic` em :170-175, que também mantém a recusa de symlink por O_EXCL), publicando com `rename_noreplace` em vez de `persist_noclobber` para a garantia de não sobrescrever continuar igual. Uma varredura de `.notes-create-*.tmp` na abertura do workspace resolve a nomeação e também o caso de anexo, que a nomeação não alcança. E um modo `--create` no `crash-writer` para o `crash-save-loop.sh` passar a cobrir esta entrada. *(tema: A regra vale num caminho e não no gêmeo)*
- [ ] R6-37 — **PathIndex engole falha de spawn e fica em building: true para sempre** (`crates/notes-core/src/index.rs:80`, severidade baixo, conserto pequeno). `PathIndex::start` sobe o walk com `.spawn(...).ok()` — o `Result` é descartado. Se a thread não puder ser criada, o closure que faria `building.store(false, ...)` é dropado sem rodar, então `building` fica `true` e `paths` fica vazio pela vida daquele `PathIndex`. A condição de reconstrução de `quick_open` (lib.rs:1549) é `state.stale && !ix.snapshot().building`, então aquele índice nunca é substituído. O módulo irmão trata exatamente esse caso do jeito certo: `content_index::Job::start` checa `if let Err(e) = spawned` e põe `running = false` com o erro (:52-56). **Cenário:** Sob esgotamento de thread/memória ou `RLIMIT_NPROC` restritivo (contêiner, shell móvel), `std::thread::Builder::spawn` devolve `Err`. O Ctrl+P passa a devolver `QuickOpen { matches: [], indexed: 0, building: true }` em toda chamada, e a paleta afirma permanentemente que ainda está enchendo; não há campo `error` no `Snapshot` para a UI dizer algo mais verdadeiro. Dura enquanto o workspace estiver aberto — fechar e reabrir reconstrói `PathState::default()` e tenta o spawn de novo. **Conserto:** Espelhar `Job::start`: ligar o resultado do spawn e, no `Err`, pôr `building = false` (e um `error: Option<String>` no `Snapshot`, para a paleta poder dizer por que está vazia). Só `building = false` já basta para a próxima invalidação retentar o walk. *(tema: A regra vale num caminho e não no gêmeo)*
- [ ] R6-38 — **Spans de link dentro de código inline estão deslocados, e o golden fixou o valor errado** (`crates/notes-markdown/src/lib.rs:286`, severidade baixo, conserto pequeno). `collect_links_in_code(t, range.start, ...)` passa o início do span do `Event::Code` inteiro, que inclui a corrida de crases de abertura, mas `t` é o conteúdo já sem as crases — todo offset calculado ali fica curto pelo número de crases (mais o espaço de padding). O docstring de `Link::in_code` diz que esses spans são reportados justamente para a ferramenta de rename 'poder dizer o que NÃO tocou', e os bytes que ela apontaria estão errados. O caminho de BLOCO de código (:311) está certo, porque usa o range do `Event::Text`; só o inline está afetado. Atenção para a correção: pulldown-cmark também colapsa quebras de linha dentro de um code span num espaço, então o conteúdo não é substring da fonte com offset constante — não dá para simplesmente somar um número. **Cenário:** Hoje é latente, porque todo consumidor filtra `!l.in_code` antes de fatiar (knowledge.rs:132, references.rs:122, transfer.rs:83). O que é vivo é o contrato: o span errado cruza a IPC como `Document.links[].span` e está abençoado em `fixtures/markdown/links.doc.json` — exatamente o que o README dos goldens avisa ('um golden abençoado sem ser lido registra um bug como decisão'). O primeiro consumidor que honrar o docstring herda o defeito, e há formas que chegam a pânico de fronteira de caractere: um link cujo alvo e um caractere multibyte, escrito uma vez entre crases simples e uma vez entre crases duplas, dão span 0..8 caindo dentro do € de três bytes. **Conserto:** Passar a `collect_links_in_code` a fatia da fonte do code span (ou localizar o início do conteúdo dentro de `src[range]`) em vez de um inteiro corrigido. Depois re-abençoar `links.doc.json` LENDO o diff, e acrescentar ao corpus um link em código inline com caractere multibyte junto do parêntese de fechamento, mais um link em bloco cercado — `code-blocks.doc.json` tem `links` vazio, então o corpus hoje não fixa nenhum span in-code exceto o quebrado. *(tema: Controle verde que falha na direção errada)*
- [ ] R6-39 — **serverInfo.version é o version.md inteiro, não o primeiro semver dele** (`crates/notes-mcp/src/lib.rs:194`, severidade baixo, conserto pequeno). A resposta de `initialize` carimba `serverInfo.version` com `include_str!("../../../version.md").trim()`. Todo outro consumidor daquele arquivo no repositório aplica a regra documentada — o PRIMEIRO semver — porque a norma permite explicitamente que `version.md` seja um documento markdown: `tools/release.sh:81`, `stamp-version.sh:53`, `build-linux.sh:134`, `build-local.sh:595`, `.github/workflows/build.yml:92`, `deploy-server.sh:85` e `tools/tauri.mjs:13` todos extraem com regex. Só funciona hoje porque `version.md` é a string de 6 bytes '1.7.4\n'. Um segundo consumidor também desvia, de outro jeito: `tools/changelog-versions.py:76` usa o primeiro token separado por espaço. **Cenário:** Alguém adota a forma markdown que docs/versioning.md:24 permite. O `notes-mcp` compila, o gate passa, e toda resposta de `initialize` passa a anunciar o documento inteiro como `serverInfo.version` — um cliente que renderiza mostra um parágrafo onde deveria haver uma versão. Não derruba o handshake (Implementation.version é string livre no MCP) nem reprova ACCEPTANCE-0.7 M1 (que só afirma `serverInfo.name`), e o gate ficaria vermelho pelo changelog-versions.py no mesmo momento — é defeito latente de consistência, não risco de entrega. **Conserto:** Extrair o primeiro `X.Y.Z` da string incluída em tempo de build — um `build.rs` pequeno, ou fazer `tools/stamp-version.sh` gerar um `version.rs` do jeito que já carimba o bundle do Tauri (ADR-035), para o notes-mcp ler a mesma constante que os instaladores. Um teste unitário afirmando que `serverInfo.version` parseia como três inteiros separados por ponto fixa; hoje stdio.rs:33, mcp.py:95 e http.rs:415 só checam `serverInfo.name`. *(tema: A regra vale num caminho e não no gêmeo)*
- [ ] R6-40 — **A barra de abas declara o padrão ARIA de tabs e não implementa nenhum comportamento de teclado dele** (`apps/notes-app/src/app/Tabs.tsx:30`, severidade baixo, conserto pequeno). O `role="tablist"` (:30) contém botões `role="tab"` (:37-47), mas cada aba está embrulhada num `<div className="tab">` (:36) que é `display: flex`, então as abas não são filhas do tablist e a relação ARIA é inválida; não há handler de setas nem `tabIndex` rotativo, então toda aba e todo botão de fechar ficam na ordem sequencial de tabulação; não há `aria-controls` nem `role="tabpanel"` no painel do editor. O papel é afirmado e o contrato atrás dele não é cumprido. **Cenário:** Quem usa leitor de tela chega à barra e, justamente por causa da posse quebrada, NÃO ouve 'aba 1 de 4' — a informação de posição no conjunto é o que a hierarquia errada custa; ouve um 'tab, selected' isolado, sem noção de quantas notas estão abertas. Seguindo o padrão que o papel anuncia, aperta seta para a direita e nada acontece. Chegar à quarta nota custa 7 pressionamentos de Tab, e depois de ativar não há `aria-controls` que diga qual região mudou. Nenhuma tarefa fica bloqueada (Ctrl+P, a árvore e Enter numa aba continuam funcionando), mas é a única lacuna de nível básico encontrada nessa varredura — `tools/contrast.sh` passa com 42 pares em AA e `tools/i18n-keys.py` passa. **Conserto:** Ou implementar o padrão — `role="tab"` no elemento que o tablist possui diretamente, handler de Esquerda/Direita/Home/End com `tabIndex` rotativo (0 na ativa, -1 nas demais), tirar o botão de fechar da ordem de tabulação atrás de atalho ou do próprio handler da aba, `role="tabpanel"` no painel e `aria-controls` ligando — ou largar os papéis e deixar a barra ser uma lista rotulada de botões, que é honesto e não custa nada. *(tema: A regra vale num caminho e não no gêmeo)*
- [ ] R6-41 — **Três páginas de governança citam um ACCEPTANCE-0.0.md que não existe** (`docs/roadmap.md:6`, severidade baixo, conserto pequeno). `docs/roadmap.md:6`, `CLAUDE.md:107` e `AGENTS.md:107` carregam a mesma frase, atribuindo a caminhada de aceite do marco 0.0 a `docs/ACCEPTANCE-*.md` — um glob que o exclui. O aceite do 0.0 é `docs/SPIKE-0.0.md` §2, nomeado diferente de propósito ('o produto do spike é evidência, não software', SPIKE-0.0.md:9). A outra metade da acusação original não procede e deve ser descartada: 'none of them ticked' está CORRETO para o 0.0 — os três `[x]` em SPIKE-0.0.md:118-136 são o controle de regressão dmabuf do ADR-033 na máquina de desenvolvimento, uma subseção fechada em 08/09/2026, não aceite do dono em release instalado, e as caixas de Arch/Wayland/NVIDIA, iPhone e Android seguem vazias. `doc-links.py` não pega nada disso, porque a citação é um glob em prosa, não um link. **Cenário:** Uma sessão perguntada sobre quais marcos entregues não têm página de aceite faz glob em `docs/ACCEPTANCE-*.md`, não acha 0.0, e cria um `docs/ACCEPTANCE-0.0.md` duplicando o §2 do SPIKE-0.0.md — exatamente o movimento já feito para o 0.7 em `.loop/QUEUE.md:36-40` — deixando duas páginas donas de uma checklist só. Mitigado porque `.continue/README.md:38` é a primeira leitura obrigatória e nomeia SPIKE-0.0.md para o 0.0; por isso é baixo. **Conserto:** Escrever a exceção dentro da frase, nas três cópias: 'cada um com seu `ACCEPTANCE-*.md` (a caminhada do 0.0 está em `SPIKE-0.0.md`)'. Editar `CLAUDE.md` e `AGENTS.md` juntos para os gêmeos seguirem byte-idênticos abaixo do H1. *(tema: Publicação e documentação: o que sai daqui e o que se lê primeiro)*

## Notas — não são itens, são coisas a fazer quando o arquivo for tocado

- **Português em quatro scripts de `tools/`:** `sign-server-release.sh` (25 linhas
  com acento em 78), `byte-preservation.sh`, `gen-fixtures.py` e
  `crash-save-loop.sh`. A regra de idioma **não** pede reescrever o que já existe,
  então isto não é item de fila. Mas o `sign-server-release.sh` é chamado de um
  runbook em inglês e o `cotenant.py` afirma sobre a string portuguesa dele — então
  a próxima edição de qualquer um deles já sai em inglês e leva o teste junto.

## Parqueado — espera um ato do dono, e não segura a fila

- 🔒 R5x — **bump do `reqwest` 0.13.4 → 0.13.5, revertido e parqueado até o MinGW.**
  Tentei e desfiz, com o motivo medido. O `reqwest` é pinado exato por decisão
  (ADR-046: *"use pinned reqwest 0.13.4"*), e o `cargo update --precise` arrasta
  junto `windows-core 0.61.2 → 0.62.2`, `base64 0.22.1 → 0.23.1` e `getrandom
  0.3.4 → 0.4.3` — nada disso é patch, e um deles é cripto-adjacente. O gate
  fechou **vermelho pelo motivo certo**: `clippy (windows)` = `FAILED, not run —
  no MinGW C compiler`, e a regra desta rodada é que a escotilha
  `NOTES_NO_WINDOWS_CHECK=1` só vale em commit que **não** toca Rust. Este toca, e
  mexe justamente no `windows-core`. O CI tem um job Windows nativo que cobriria,
  mas usar isso para passar por cima da regra local é esvaziar a regra. Destrava com
  `sudo apt install gcc-mingw-w64-x86-64`. O PR do Dependabot (#19) fica aberto até
  lá; o do `lucide-react` (#17) foi aplicado à mão em 1.6.54


Ficam no fim de propósito: o hook entrega sempre o primeiro `- [ ]`, e um item
que espera outra pessoa no topo da fila é uma rodada que gasta um turno por
parada dizendo que nada aconteceu.

- 🔒 R4g — **parqueado: bloqueado por ato do dono, não por sudo.** O emulador x86_64 exige KVM e o `kvm_amd` é recusado pelo firmware (`SVMDIS` em `MSR_VM_CR`), que só sai com **Advanced ▸ CPU Configuration ▸ SVM Mode ▸ Enabled** na UEFI e um reinício — ASUSTeK TUF GAMING X570-PLUS_BR, BIOS 5043. Conferido em 18/09: `/dev/kvm` ainda não existe e o boot corrente é o de 16/09 11:23, então o reset ainda não aconteceu. Não fico esperando por isto. Quando existir: com o emulador de pé, instalar o app gerado e registrar o que de fato acontece — abrir, escolher pasta, listar, editar. É a primeira evidência de execução do 0.4; até aqui só existe evidência de compilação
- [x] R5-publish — **aconteceu, e o meu diagnóstico do bloqueio estava errado**
  (1.6.66). Medido agora: feeds Linux em `1.6.53`, feed `darwin-aarch64-app` em
  `1.6.63` com o payload respondendo 200, e o `/p/tura-notes` mostrando as duas
  versões. Eu tinha reportado bloqueio por chave do updater ausente, checando
  `./signing.env` e `~/.config/tura-notes/build.env` — esses dois guardam as
  **credenciais de notarização do macOS**. O `tools/updater-release.py` cai em
  `~/.config/tura-notes/updater.key`, que existe desde 16/09. A chave nunca faltou;
  eu conferi dois caminhos que não eram o dela

### Rodada 6 — os que esperam decisão sua

Cada um traz a pergunta. Respondida, o item volta para a fila como `- [ ]`.

- 🔒 R6-07 — **A barreira de recepção congela um documento lido antes do lock, grava por cima do que está sendo digitado e não tem saída** (`apps/notes-app/src/app/ReceivedSync.tsx:96`, severidade alto). `apply()` lê `useEditor.getState().doc` ANTES de chamar `acquireSyncBarrier()`, roda a guarda de sujo/gravando/conflito/draft sobre essa leitura, e só então adquire a barreira — que, com `pending > 0`, drena em fatias de 5 ms por até 5 s. Durante o dreno, `claiming` está setado mas `locked` ainda é false, e TODA guarda de input e de store testa apenas `locked`. Não é preciso corrida com reconcile: uma tecla, um Ctrl+S (que põe `status: "writing"`), ou um clique na árvore (cujo catch seta `lastError`) criam um objeto `doc` novo. Como `acceptSyncReload` compara por identidade (`if (useEditor.getState().doc !== before) return false`), a comparação nunca mais pode ser verdadeira, e `recover()` reenvia o mesmo `frozen.current` — o botão 'Retry safe reload' não consegue liberar a barreira. A janela fica `inert` e todo `tracked()` lança `unsupported`. **Cenário:** Com uma chamada `tracked()` lenta em voo (listagem de diretório ou busca em mount de rede), o usuário clica em 'Apply received revisions' e digita durante o dreno. O `sync_apply` é validado contra o snapshot limpo e ANTIGO (`snapshots(doc)`, ReceivedSync.tsx:109, conferido contra stat/hash em sync.rs:331-339), então os bytes recebidos são escritos no arquivo em que ele está digitando; o buffer digitado nunca mais pode ser salvo nem virar draft, porque `save()` e `keepDraft` estão travados em `locked`, que não limpa. A digitação se perde no restart, e até lá a janela é inutilizável sem matar o app. **Conserto, quando decidido:** Reler `useEditor.getState().doc` e repetir a guarda DEPOIS que `acquireSyncBarrier()` resolve, antes de atribuir `frozen.current` e montar `snapshots` — a leitura pré-lock só serve para decidir se vale tentar. E dar à recuperação um estado terminal com saída explícita: contar tentativas ou detectar falha que não pode melhorar (nota sumiu do disco) e liberar a barreira, em vez de deixar 'Retry safe reload' como único caminho. Essa segunda metade é decisão de produto: liberar a barreira e cair a nota para fechada/conflito com aviso de buffer não verificado, ou manter a barreira e oferecer um 'reiniciar o app' que escreve o buffer como draft de saída.
- 🔒 R6-23 — **O sanitizador de raw HTML não aplica a política de URL que o resto do crate aplica** (`crates/notes-markdown/src/lib.rs:904`, severidade médio). Com `raw_html` ligado, `Event::Html`/`Event::InlineHtml` passam verbatim e nunca visitam `url::classify_image` (:512); a única barreira restante é o `ammonia`, cujo `url_schemes` (:876) libera `http`/`https`/`data` para qualquer atributo de URL e cujo `attribute_filter` (:904) só inspeciona valores de `("img", "src")` que literalmente comecem com `data:`. Três consequências: (a) `remote_images` governa só imagens Markdown — um `<img src="https://...">` cru ignora o flag e `Rendered.blocked_remote` fica vazio, então nem o banner aparece; a forma relativa a esquema (`//host/x.png`), que xss.rs:105 proíbe, também passa; (b) `href` nunca é estreitado, então `<a href="data:text/html;base64,...">` sobrevive à sanitização; (c) o teste de prefixo `trim_start().to_ascii_lowercase().starts_with("data:")` é derrotado por um tab ou controle C0 dentro do esquema, enquanto o `ammonia` resolve o esquema com `Url::parse`, que remove tabs — os dois discordam e o permissivo vence, contornando `DATA_IMAGE_ALLOWLIST`. A suíte já declara que nada disso pode acontecer (xss.rs:114-123 e :137), mas nenhum fixture de `fixtures/xss/` exercita raw HTML com src remoto ou com tab. **Cenário:** Hoje o CSP do build empacotado (`img-src 'self' notes-asset: data:`) bloqueia a requisição, então não é um beacon vivo em release — mas dispara em `npm run tauri dev`, onde o Vite serve a página sem CSP. O que está quebrado agora é a primeira camada e o sinal: a invariante está escrita na suíte e nunca é exercitada, e o preview sub-reporta o que a nota contém. E é um armadilha de mão única: como `remote_images: true` também não funciona sob esse CSP (achado 24), o conserto natural é alargar `img-src` para `https:` — e no minuto em que alguém fizer isso, este buraco vira um beacon vivo sem nenhum teste disparando. **Conserto, quando decidido:** Reescrever o braço do filtro para casar com todo atributo de URL — `("a", "href") | ("img", "src") | ("area", "href")` — e decidir com `url::scheme_of`/`classify_image`/`classify_link`, que já removem espaço em branco e controles exatamente para isso, em vez de teste de prefixo sobre o valor cru. Acrescentar os fixtures que faltam: `<img src="https://...">` cru, `<img src="//...">`, `<a href="data:text/html;...">` e um `data:image/svg+xml` com tab no esquema. A decisão do dono só aparece se quiser que a imagem remota crua também entre em `Rendered.blocked_remote` — isso obriga a pré-parsear HTML no passe de reescrita e é do tamanho de um ADR.
- 🔒 R6-24 — **O opt-in 'permitir imagens remotas' nunca consegue mostrar uma imagem: img-src não tem fonte http(s)** (`apps/notes-app/src-tauri/tauri.conf.json:24`, severidade médio). `markdown_trust_set` existe, o flag por workspace existe, o renderer honra emitindo `<img src="https://...">` para `ImagePolicy::Remote`, e o preview tem banner com botão Allow ligado nele. Mas o CSP do processo só permite `'self'`, `notes-asset:` e `data:`, então o navegador bloqueia a carga. O opt-in vira um flag, apaga a única explicação que o usuário tinha e não produz nada. Não aparece em desenvolvimento porque o CSP só é injetado quando o Tauri serve a página (o `devUrl` do Vite não passa por `get_asset`), então a funcionalidade parece funcionar no `tauri dev` e está morta em todo build instalado. Agravante: o botão Allow é o ÚNICO chamador de `markdownTrustSet` em todo o front-end, ou seja, não há UI para desligar o flag; e como `set_markdown_trust` atribui os dois overrides incondicionalmente (preview.rs:109-110), passar `null` para rawHtml ainda limpa em silêncio qualquer override de raw HTML existente. **Cenário:** Num build instalado, a nota tem `![](https://example.com/x.png)`. O banner diz que uma imagem remota foi bloqueada e mostra a URL como texto. O usuário clica em Allow: o `blocked-image` vira `<img>` de verdade, o banner some, `blocked_remote` fica vazio — e o CSP bloqueia o fetch. Ele fica com um ícone quebrado, estritamente MENOS informação do que antes de clicar, e o flag de confiança ligado permanentemente para aquele workspace, sem jeito de desligar pela UI. **Conserto, quando decidido:** Três direções mutuamente exclusivas, e é decisão sua: (a) acrescentar `https:` a `img-src` — o mais simples, mas o CSP é por processo, então relaxa para todo workspace, inclusive os que nunca optaram, e torna o achado 23 um beacon vivo; (b) remover o opt-in e o botão Allow, deixando imagem remota permanentemente bloqueada e preservando a URL-como-texto, que ao menos diz o que foi recusado — `markdown_trust_set` encolhe para `raw_html` só; (c) buscar a imagem no lado Rust atrás do flag por workspace e servir de volta por um segundo esquema custom — é a única opção que mantém a promessa POR WORKSPACE, mas adiciona um caminho HTTP de saída ao app desktop, coisa que a postura vizinha ao ADR-007 vinha evitando. Em qualquer caso, declarar `devCsp` igual ao `csp` para o webview de dev parar de discordar do empacotado.
- 🔒 R6-26 — **Arquivo com nome fora de UTF-8 é listado como nota abrível e nunca abre, e duplicar a pasta para na metade** (`crates/notes-fs/src/local.rs:155`, severidade médio). `list` converte o nome do SO com `to_string_lossy`, trocando bytes inválidos por U+FFFD, e monta o `RelPath` a partir dessa string inventada, que `RelPath::parse` aceita; o `Entry` volta com `is_note: true` se o nome lossy termina em `.md`, então a árvore o oferece como linha clicável (Tree.tsx:110). Toda operação posterior resolve a string U+FFFD de volta ao disco, onde não existe arquivo nenhum, e falha `NotFound`. A outra metade também é assimétrica: `relativise` faz `seg.to_str()?` (watch.rs:423) e descarta o evento inteiro quando qualquer segmento não é UTF-8 válido, então mudanças externas naquele arquivo também nunca são reportadas. Consequência mais dura, num segundo caminho: `copy_tree` (lib.rs:1032-1037) lista a pasta e faz `open.fs.read(&e.path)?` por entrada, então duplicar uma pasta que contenha um desses aborta no meio, DEPOIS do `create_dir` e depois de alguns filhos já escritos, sem limpar o resultado pela metade. **Cenário:** Um usuário descompacta na pasta um backup feito no Windows com nomes cp1252, produzindo `reuni\xe3o.md`. A árvore mostra `reuni<U+FFFD>o.md` como nota; clicar devolve 'not found' para um arquivo que ele vê no `ls`. O índice de caminhos carrega o mesmo RelPath lossy, então o quick-open também oferece algo que não abre. E duplicar a pasta que contém esse arquivo deixa uma cópia parcial com aparência destrutiva. (Nenhum dado é perdido ou reescrito: o arquivo no disco fica intacto; o efeito é inalcançabilidade. Na prática só Unix — o APFS rejeita nome inválido na criação.) **Conserto, quando decidido:** Detectar a conversão lossy na fonte (`entry.file_name().to_str().is_none()`) e agir ali, em vez de deixar um `RelPath` que nunca esteve no disco entrar num `Entry` marcado `is_note`; `relativise` precisa do tratamento correspondente para as duas metades concordarem. A escolha é sua: (a) listar com o nome lossy mas marcar ilegível, como o motivo `NotUtf8` já faz na leitura — honesto, um estado a mais na UI; (b) omitir da listagem — mais simples, mas um arquivo do usuário fica invisível num app cuja premissa é que a pasta é dele; (c) carregar o `OsString` cru ao lado do `RelPath` pelo adapter para esses arquivos funcionarem de verdade — correto, mas muda a superfície do `FileSystemAdapter`, logo bump `Y` e provavelmente ADR, já que `RelPath` é documentado como o único tipo de caminho que a trait aceita.
- 🔒 R6-27 — **O store privado guarda o texto completo de toda nota no umask do processo, e não há caminho para removê-lo** (`crates/notes-core/src/paths.rs:15`, severidade médio). `data_dir()` cria `~/.local/share/notes/` e nunca define modo, nele nem em nada abaixo. Tudo que o app desktop escreve ali pega o umask: `state::write_atomic` usa `File::create` puro para drafts, snapshots de conflito, `session.json`, `settings.json` e `workspaces.json`, e o `notes-index` usa `Connection::open` puro para `index.db` — que não é lista de caminhos, é o TEXTO COMPLETO de toda nota, numa coluna `text` do fts5 mais uma coluna `document`. Medido nesta máquina: `index.db` com 108 MB em `-rw-r--r--`, e o diretório em `drwxrwxr-x`. Três crates irmãos do mesmo repositório fazem o oposto — `notes-sync/src/store.rs:30,47` põe 0700/0600, `notes-sync-client/src/state.rs:265` põe 0700, `remote.rs:125` RECUSA rodar com arquivo de token cujo modo tenha bit de grupo ou outro, e `admin::private_dir`/`private_file` do servidor põem 0700/0600. No notes-core só `activity.rs:34` faz isso, e só para um arquivo de lock vazio. **Cenário:** O usuário mantém `~/notas` em 0700 porque as notas são privadas, e na distribuição dele `$HOME` ou `~/.local/share` é 0755 (HOME_MODE antigo de Debian/Ubuntu, home gerenciada por AD/NFS, estação compartilhada): toda nota que ele já abriu fica legível por qualquer outra conta local via `index.db` em 0644, embora os arquivos-fonte estejam em 0600 — o app alarga as permissões de uma cópia do conteúdo do próprio usuário. Segundo cenário, sem multiusuário: ele desinstala o Tura (`apt remove`, ou apaga o AppImage) e `~/.local/share/notes/` fica indefinidamente com `workspaces.json` (o caminho de toda pasta que ele já abriu), o índice full-text, snapshots de conflito e `drafts/*.draft` — que por desenho nunca expiram — sem que o app, os pacotes ou a documentação nomeiem o diretório. **Conserto, quando decidido:** Dar ao notes-core o par `private_dir`/`private_file` que o servidor já tem: 0700 em `data_dir()` e em cada `workspaces/<id>/`, 0600 em todo arquivo criado por `state::write_atomic` e por `notes-index::open` — uma mudança que cobre drafts, conflitos, session, settings e índice sem tocar em nenhum call site. A remoção é decisão de produto: (a) só um caminho documentado — seção no README/docs nomeando o diretório por plataforma; (b) uma ação no produto ('esquecer este workspace' / 'remover os dados do Tura'), que é a única resposta que satisfaz a §9 de docs/security.md sem o usuário ler documentação, mas é um comando destrutivo novo que precisa recusar enquanto houver draft com trabalho não salvo; (c) purge de pacote no postrm do `.deb`, que só alcança Debian e só a conta que invoca. (a) e (b) compõem; (c) quase não.
- 🔒 R6-30 — **crash-save-loop.sh fecha 1000 rodadas limpas sem o writer nunca ter escrito** (`tools/crash-save-loop.sh:50`, severidade médio). O laço sobe o `crash-writer` em background, dorme 1-40 ms, manda SIGKILL, e o `wait` descarta o status de saída inteiro; o `check()` então valida o que estiver no disco contra o próprio cabeçalho `LEN=`. Nada afirma que o writer rodou, que o arquivo mudou do seed escrito na linha 25, ou que o processo morreu por sinal em vez de sair sozinho. Como stdout e stderr vão para /dev/null, a falha é muda. Reproduzido com um binário stub que sai 101 sem escrever: 5/5 verdes. Gatilhos reais: `write_atomic` devolvendo `Err` e caindo no `exit(2)` (ENOSPC, TMPDIR cheio, mount noexec ou read-only, diferença de permissão), `target/debug/crash-writer` velho ou incompatível, ou pânico em crash-writer.rs:20-21. **Cenário:** Qualquer uma dessas condições específicas do ambiente ocorre no runner. O critério de aceite carro-chefe do 0.1a — mil kills nunca deixam nota truncada — reporta 1000 rodadas verdes enquanto o caminho de escrita atômica não foi exercitado uma única vez. Uma regressão puramente lógica em `write_atomic` ainda seria pega pelos testes de unidade do notes-fs na mesma execução de CI; o que este gate cobre com exclusividade, e perde, é exatamente a classe de falha específica de ambiente e de binário. **Conserto, quando decidido:** Três linhas: capturar `wait "$pid"; rc=$?` e exigir 137 (SIGKILL) ou ao menos rejeitar 101/2; e afirmar ao menos uma vez por execução que o payload no disco saiu do seed `LEN=1` (a primeira escrita do crash-writer é `LEN=100`). Duas correções de documento no mesmo passe: `docs/ARCHITECTURE.md:915` deve dizer que o writer roda contra um `mktemp -d` novo, só no ubuntu-latest, em push para master ou PR com label — não `fixtures/large`, não quatro SOs, não nightly, não no release; e `:926` deve dizer que `fixtures/large` é gerado à mão por `tools/gen-large.sh`, não no CI. Fica uma decisão sua: fazer o CI casar com o documento (crash loop em macOS/Windows/Arch e nightly, exercitando o `ReplaceFileW` que hoje não tem cobertura de crash em plataforma nenhuma além do Linux), ou fazer o documento casar com o CI; e, separadamente, se as duas medições cronometradas que consomem `fixtures/large` (performance.rs:64, search.rs:330) devem passar a rodar no CI ou permanecem verificação do dono.
- 🔒 R6-35 — **A versão 1.6.99 tem commit e changelog, e não tem tag nem Release — pela quinta vez pela mesma causa** (`CHANGELOG.md:379`, severidade médio). `1.6.99` foi escrita, bumpada, commitada e empurrada (commit `1dfffbf`), e é a única versão de todo o histórico de `version.md` sem tag local ou remota e sem GitHub Release — confirmado: existem as tags `1.6.98` e `1.7.0`, não existe `1.6.99`. Isso quebra a invariante normativa de docs/versioning.md ('o `version.md` no GitHub é igual aos Releases no GitHub', 'o bump e o Release são um ato só'). O mecanismo é verificável: `release.yml` roda `./tools/release.sh --current`, que publica só a versão que `version.md` tem no head empurrado; quando duas versões viajam num push, a mais antiga nunca é tagueada — há run de Release para 1.6.98 e para 1.6.100 e nada entre. Fato de contexto que muda o enquadramento: NÃO é um mecanismo novo. `.loop/entries/0002` registra 1.6.2 precisando de `--backfill` por isso mesmo, e `0006` registra 1.6.4, 1.6.5 e 1.6.6. É a quinta ocorrência de uma classe já diagnosticada, reparada à mão a cada vez, e `tools/changelog-versions.py` documenta em detalhe que jamais consulta tags — então o único buraco que ele não consegue ver é justamente o que abriu. **Cenário:** Alguém segue a entrada de 1.6.99 (que descreve uma correção real do updater) até `.../releases/tag/1.6.99` e recebe 404; `git diff 1.6.98..1.6.99` falha por não existir a ref. Uma versão existe no `git log` e no CHANGELOG e em nenhum lugar que o GitHub mostre. E vai acontecer de novo, em silêncio e com gate verde, no próximo push que carregar dois bumps. **Conserto, quando decidido:** `./tools/release.sh --backfill --ref origin/master` fecha o buraco (é idempotente e o `reconcile_latest` deixa o badge Latest em 1.7.4) — a flag `--ref` é obrigatória: rodar de um worktree em branch própria faz o script ler o HEAD local e arrastar o badge para trás, que foi o que aconteceu em 1.6.6. Duas decisões suas: (a) fazer o backfill agora, publicando um Release datado de hoje para uma versão empurrada em 18/09 — a alternativa é deixar uma lacuna permanente e anotá-la em docs/versioning.md; (b) fechar a recorrência. A checagem tem de continuar offline para honrar o 'funciona no trem' de changelog-versions.py:18-24, mas `git tag` é local: comparar as versões de `git log -p -- version.md` com as tags locais teria sinalizado isto, dado um `git fetch --tags` antes ou uma tolerância para a versão mais recente ainda sem tag. Alternativa mais simples: `release.yml` chamar `--backfill` em vez de `--current`, que é idempotente e custa alguns segundos por push.

As dez perguntas completas, com opções e recomendação, estão no artefato — <https://claude.ai/artifact/Vr8WJEfiinAfji3H7Et4Md>, seção **Decisões**.

## Colhidos automaticamente
