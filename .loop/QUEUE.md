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

## Notas — não são itens, são coisas a fazer quando o arquivo for tocado

- **Português em quatro scripts de `tools/`:** `sign-server-release.sh` (25 linhas
  com acento em 78), `byte-preservation.sh`, `gen-fixtures.py` e
  `crash-save-loop.sh`. A regra de idioma **não** pede reescrever o que já existe,
  então isto não é item de fila. Mas o `sign-server-release.sh` é chamado de um
  runbook em inglês e o `cotenant.py` afirma sobre a string portuguesa dele — então
  a próxima edição de qualquer um deles já sai em inglês e leva o teste junto.

## Parqueado — espera um ato do dono, e não segura a fila

- [ ] R5x — **bump do `reqwest` 0.13.4 → 0.13.5, revertido e parqueado até o MinGW.**
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

- [ ] R4g — **parqueado: bloqueado por ato do dono, não por sudo.** O emulador x86_64 exige KVM e o `kvm_amd` é recusado pelo firmware (`SVMDIS` em `MSR_VM_CR`), que só sai com **Advanced ▸ CPU Configuration ▸ SVM Mode ▸ Enabled** na UEFI e um reinício — ASUSTeK TUF GAMING X570-PLUS_BR, BIOS 5043. Conferido em 18/09: `/dev/kvm` ainda não existe e o boot corrente é o de 16/09 11:23, então o reset ainda não aconteceu. Não fico esperando por isto. Quando existir: com o emulador de pé, instalar o app gerado e registrar o que de fato acontece — abrir, escolher pasta, listar, editar. É a primeira evidência de execução do 0.4; até aqui só existe evidência de compilação
- [x] R5-publish — **aconteceu, e o meu diagnóstico do bloqueio estava errado**
  (1.6.66). Medido agora: feeds Linux em `1.6.53`, feed `darwin-aarch64-app` em
  `1.6.63` com o payload respondendo 200, e o `/p/tura-notes` mostrando as duas
  versões. Eu tinha reportado bloqueio por chave do updater ausente, checando
  `./signing.env` e `~/.config/tura-notes/build.env` — esses dois guardam as
  **credenciais de notarização do macOS**. O `tools/updater-release.py` cai em
  `~/.config/tura-notes/updater.key`, que existe desde 16/09. A chave nunca faltou;
  eu conferi dois caminhos que não eram o dela

## Colhidos automaticamente
