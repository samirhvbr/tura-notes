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

## Rodada 7 — as 13 respostas de 23/09, e a fila corre ate esvaziar

O dono respondeu as treze perguntas no artefato em 23/09, e a resposta sobre a
rodada foi **ate esvaziar a fila**. Esta secao e a fila inteira, numa ordem so:
os pendentes da rodada 6, os parqueados que as respostas destravaram — cada um com
a decisao anotada no fim — e o trabalho novo que as respostas criaram.

A ordem: primeiro o que registra as decisoes (nada depois deve ser construido
sobre uma decisao que so existe no artefato), depois os dois de severidade alta,
depois os temas da revisao, e por ultimo o que muda superficie (`FileSystemAdapter`,
endpoint administrativo). O quadro vivo continua sendo
<https://claude.ai/artifact/Vr8WJEfiinAfji3H7Et4Md>.

**Regra nova desta rodada, aprendida na anterior:** depois de cada push, o CI dos
quatro SOs e conferido antes do proximo item. Vermelho e o proximo item. E com o
MinGW instalado, o gate roda inteiro — sem `NOTES_NO_WINDOWS_CHECK`.


- [x] R7-00 — **feito em 1.7.23.** Gate inteiro, **sem** `NOTES_NO_WINDOWS_CHECK`, pela primeira vez desde que o MinGW existe: 36 passos verdes, `clippy (windows)` em 16 s. E a primeira verificacao Windows local de todo o Rust da rodada 6 (1.7.9 a 1.7.20), que saiu com a ressalva escrita — nao acusou nada. No `.continue/README.md`, a linha **MinGW** saiu (o ato aconteceu) e as tres que diziam *espera o MinGW* agora apontam para R7-06 e R7-07
- [x] R7-01 — **feito em 1.7.24.** Nove ADRs, 086 a 094: dispositivo = credencial, uma por dispositivo; retencao sem expurgo automatico; fila movel em segundo plano; imagens remotas com a ordem que as torna seguras; nomes fora de UTF-8 como `OsString`; remocao dos dados como acao no produto; 0.4 no MacBook e em aparelho fisico; aceite na proxima minor; barreira de recepcao com reinicio. Nenhuma reverte ADR anterior (conferido por `img-src`, UTF-8, retencao e aceite em `decisions.md`), entao o bump e Z. **Achado ao escrever a 086:** `docs/security.md` §4.10 proibe servico administrativo fora de loopback ou interface privada, e o servidor de sync e publico — o R7-04 nao pode ser 'um endpoint admin'; precisa ser acao de usuario sobre os proprios dispositivos, ou superficie fora da interface publica, e se nenhuma servir vira pergunta. As tres perguntas do 0.6 saem de `.continue/0.6-sync.md`, da linha do 0.6 no indice e do `CLAUDE.md`/`AGENTS.md`, que dizia 'specified nowhere'
- [x] R6-35 — **feito em 1.7.25, como o dono decidiu (q_backfill).** `docs/versioning.md` ganhou *One version per push*: a 1.6.99 nao tem nem tera Release, e o `WOULD CREATE` que o `--backfill --dry-run` continua mostrando e esperado, nao achado. O `release.yml` nao mudou. Como ele publica so a versao do topo, a regra ficou do lado de quem empurra — cada bump no seu proprio push —, com o `1.7.5` de 22/09 como o segundo caso medido. O texto original do achado fica no historico do git
- [x] R7-02 — **feito em 1.7.26 (ADR-093).** Dezessete ocorrencias em oito arquivos: todo 'the following release' e toda coluna 'Following release' dos `ACCEPTANCE-*.md` passam a dizer a proxima minor (`X.Y.0`), mais os dois roteiros do `.continue/` em portugues e as quatro linhas do indice. Uma estava quebrada entre duas linhas de citacao no 0.7 e escapou da primeira troca. Nenhuma caixa foi marcada
- [x] R7-03 — **feito em 1.7.27 (ADR-092) — escrito, nao executado.** `docs/OWNER-ACTS.md` ganhou o §4, *Run milestone 0.4 on the MacBook*: toolchains, SDK com `platforms;android-36` e imagem `android-35` arm64, AVD, `npm run tauri -- android dev` no emulador e no aparelho por `adb`, e o iOS, que **precisa ser gerado** no Mac primeiro (`gen/apple` nao existe no repositorio) e commitado. O §3 da UEFI fica como historico, marcado superado, e o `MOBILE-0.4.md` aponta para o §4. A pagina diz em voz alta que nada ali foi rodado: nenhum agente nesta maquina alcanca o Mac, e a versao do NDK e escolha para comparar execucoes, nao requisito — o CI usa a do runner
- [x] R6-43 — **feito em 1.8.0, junto com o R6-26 (mesma minor, mesmo push).** O `Stat` ganhou `born_ns` — `statx` btime no Linux, birthtime no macOS, creation time no Windows — preenchido so no `stat_at`, que e o da correlacao. A Regra 1 continua casando pelo inode, e recusa quando o candidato **nasceu depois** da ultima modificacao registrada da nota que sumiu: arquivo renomeado nunca nasce depois de ter sido modificado; estranho num inode reciclado sempre nasce. Recusa cai na Regra 2 (conteudo), que e a direcao segura; nascimento desconhecido mantem o comportamento antigo. Tres testes da funcao pura, um que exige que a plataforma reporte nascimento (senao a guarda fica inerte em silencio — conferido em btrfs e tmpfs), e o **move intercalado** que o CI pegou em ext4 no 1.7.17: aqui passa com ou sem o conserto, porque btrfs nao recicla; no CI e o teste de verdade. **O Windows ja estava protegido** — o indice NTFS carrega numero de sequencia —, e o APFS nao recicla
- [x] R6-26 — **feito em 1.8.0, no mesmo push do R6-43 (ADR-090).** O nome fora de UTF-8 viaja **dentro** do `RelPath`, reversivel: cada byte invalido vira `U+FFFF` + dois hexa minusculos, `U+FFFF` literal vira dois. Todo nome valido fica byte a byte igual — nenhum caminho guardado, registro ou historico de sync se move — e o `.md` do fim sobrevive, entao `is_note` funciona. `notes-fs::osname` e o unico lugar que codifica (listagem, watcher, caminhada do Ctrl+P) e decodifica (a cela). **Decodificador estrito**, porque o caminho pode vir de par de sync, REST ou MCP: escape so para byte `>= 0x80` (senao `U+FFFF`+`2f` viraria `/`) e so na grafia canonica (senao a identidade, chaveada por caminho, racharia em duas). Achados no caminho: o `save` montava o temporario com `to_str()` e recusava a nota ('target has no file name'), e o `copy_tree` usava `e.name` — duplicar a pasta gravaria um gemeo com `U+FFFD`. Seis testes ponta a ponta com `reuni\xe3o.md` de verdade, seis do codec (inclusive varredura de todo byte em toda posicao e as duas tentativas de ataque), e um do watcher, que antes descartava o evento. Vermelho-antes reproduzido: `stat .../pasta/reuni\ufffdo.md: NotFound`
- [x] R6-07 — **feito em 1.8.1 (ADR-094).** As duas metades. (1) `apply()` **rele o documento depois que a barreira e adquirida** e repete a guarda: a leitura de antes era do documento anterior ao dreno, e durante o dreno a entrada ainda e admitida — uma tecla trocava o objeto e o `acceptSyncReload` nunca mais passava. Agora uma tecla no dreno faz a aplicacao **recusar** ('salve suas edicoes'), sem nada enviado. (2) A recuperacao ganhou **reiniciar o aplicativo**: comando novo `sync_recovery_restart`, o unico isento da barreira (como o `syncReload` ja era), que grava o rascunho de saida **e so reinicia se gravou**. Buffer limpo nao manda rascunho — nao ha nada que o disco e as revisoes aplicadas ja nao tenham. **Achado no caminho:** todo IPC do front passa por `tracked()`, que recusa sob a barreira — nem o rascunho conseguiria ser gravado de dentro da recuperacao antes disto. Quatro testes novos; o do dreno fica vermelho com a leitura antiga. Strings em en e pt-BR
- [x] R6-12 — **feito em 1.8.2, sem mudar o schema.** O caminho do livro — alinhar o rowid do `fts` com o de `notes` — mudaria o schema, forcaria reindex em todo usuario e faria da release uma minor (outra assinatura, outra rodada de aceite logo depois da 1.8.0). Em vez disso: o `plan()` le **uma vez** o mapa caminho→rowid do `fts`, e cada apagar vai por rowid. Sem `plan()`, o apagar por caminho antigo continua (lento e correto). Nao da para esvaziar o `fts` no comeco da reconstrucao forcada: se ela for cancelada, as notas 'sem mudanca' nunca mais voltam. **Medido, release, 3 000 notas de ~22 KB: 35,8 s → 1,08 s a frio, 75,5 s → 1,59 s forcada.** Medicao em `notes-index/tests/cost.rs` (ignorada, publicada, nao assertada — ADR-095). Dois testes de correcao, porque rowid errado apagaria o texto de **outra** nota
- [x] R6-13 — **feito em 1.8.3.** O inventario chamava `open_note` por nota, e cada chamada tomava o write lock, carregava o registry inteiro, observava uma nota e gravava o registry inteiro de volta. `identify_batch` le e faz hash **fora** do lock — segurar o lock durante a leitura de 10 mil arquivos faria um save concorrente estourar os 5 s e virar `LockTimeout`, exatamente o intermitente aberto — e toma o lock **uma vez** so para observar em memoria e gravar uma vez. **Medido por evento, nao por relogio:** 200 notas custavam **202** regravacoes do registry (1,82 s); agora <= 4 (0,08 s). Contador global `registry_writes()`, lido num binario de teste so dele (a licao do 1.7.20). Identidades conferidas estaveis entre dois inventarios
- [x] R6-14 — **feito em 1.8.4, e com um defeito de correcao junto.** O trim de pontuacao recontava a URL inteira a cada `)` removido — n parenteses custavam n². Agora conta `(` e `)` **uma vez** e desconta enquanto apara; `TRAILING` nao tem parentese, entao so o braco do `)` mexe na contagem. Teste de **vivacidade**, nao de relogio: 1 milhao de `)` linear em milissegundos, quadratico em horas — regressao vira timeout do CI. **O defeito de correcao:** o `analyse()` (indice, grafo, revisao de links) nao sabia de bloco de codigo e registrava URL dentro de codigo cercado como link real, `in_code: false` — o renderer sempre soube e nao linkava. Agora marca `in_code`, igual o codigo inline ja fazia; o braco vazio antigo de `CodeBlock` que o clippy apontou como inalcancavel saiu. Vermelho-antes provado no teste de codigo
- [x] R6-15 — **feito em 1.8.5, pela metade que nao mexe na rede de seguranca.** O `append` media cada payload (decodificando) e jogava o tamanho fora; o `validate` decodificava tudo de novo para somar bytes — a cada checkpoint. `append_sized` devolve o tamanho e o `validate` reaproveita: **24 → 12 decodificacoes** para 12 publicacoes recebidas, contadas por thread (imune a testes paralelos). A validacao continua em toda gravacao, que e a rede de seguranca contra gravar estado invalido; o que sobra — cada gravacao ainda valida o estado inteiro uma vez — virou o R7-10. Os 61 testes de recuperacao passam, inclusive os cinco do intermitente do `.continue/`
- [x] R7-10 — **feito em 1.8.11.** `notes_sync::transfer::Measured`: o tamanho do payload e lembrado **por igualdade da publicacao inteira**, nao por id — publicacao igual carrega os mesmos bytes e o mesmo hash declarado, entao a verificacao que passou para uma passa para a outra; payload trocado sob o mesmo id e outro valor, erra o cache e e decodificado e recusado. O cache vive no `Store` (um por processo), **nao no estado gravado** como a fila sugeria: um resumo verificado dentro do `client.json` seria confiado ao carregar, e o disco e justamente o que nao se confia. Todas as regras estruturais continuam em toda chamada; `fetch_into` mede ao receber, `validate` e `incoming` reaproveitam. Medido: 45 recebidos em 3 paginas, **255 decodificacoes -> 45**; reload do mesmo estado: 0; outro processo: 45. Payload trocado no disco sob o mesmo id e recusado pelo processo que ja verificou o original. Custo: uma copia de cada publicacao recebida em memoria, podada a cada validacao
- [x] R6-23a — **feito em 1.8.6.** O filtro de atributos do `ammonia` aplica ao HTML cru a politica que o Markdown ja aplicava. `img src` e decidido pelo `scheme_of` (que remove espaco e controle antes do `:`): o teste de prefixo literal `data:` deixava `da<TAB>ta:image/svg+xml` escapar, e o `ammonia` — cujo parser de URL remove o tab — aceitava `data`; os dois discordavam e o permissivo vencia. `a`/`area href` passa pelo `classify_link`: `href="data:text/html"` sobrevivia a sanitizacao. `notes-asset:` e aceito explicitamente, senao o filtro apagaria as imagens que o proprio Markdown emite. Dois fixtures em `fixtures/xss/`, **cada um vermelho por conta propria no codigo antigo** (o censo das quatro combinacoes pegou os dois), mais um teste por arquivo como o README da pasta pede. `ARCHITECTURE.md` §10 atualizado
- [x] R6-23 — **feito em 1.8.7 (ADR-089), sem pre-parsear HTML.** O achado dizia que reportar a imagem crua bloqueada exigiria reinterpretar o HTML no passe de reescrita — do tamanho de uma ADR. Nao exigiu: o filtro de atributos roda sincrono na thread do render, entao as URLs recusadas vao para um coletor **por thread** durante o `clean()`, e ha um builder por valor do opt-in (o filtro e um `'static` num builder compartilhado). `<img>` remota crua agora obedece `remote_images` e, recusada, entra em `blocked_remote` — o aviso oferece, em vez de a imagem sumir calada. `//host` tratado como a URL remota que e. Dois fixtures, vermelhos no filtro de 1.8.6. Isto e o que torna seguro o R6-24 abrir o `img-src`
- [x] R7-11 — **feito em 1.8.12 — diagnosticavel, nao resolvido, e isso e o que da para fazer sem nova ocorrencia.** Passo 2 nao achou portador: data dir por fixture, nenhuma thread (`notes-index`, `notes-content-index`, busca) captura o `_activity`, nada no binario faz fork/spawn. Passo 1 feito: `refusal()` separa `WouldBlock` (unico que vira `LockTimeout`) de `Interrupted` (tentado de novo) e de qualquer outro erro (vira `CoreError::io` com kind). Linha do intermitente em `.continue/README.md` atualizada — ela continua sendo o rastreador
- [x] R6-24 — **feito em 1.8.8, 1.8.9 e 1.8.10 (ADR-089).** 1.8.8 abre `img-src` a `https:` e poe `tools/csp.py` no gate e na CI (img-src exatamente as quatro fontes; §10 igual ao arquivo — que estava sem `base-uri` e `http://ipc.localhost`). 1.8.9: o gate verde **reverteu** a mudanca do CSP ainda nao commitada — `test_stamping_changes_only_the_version_line` restaurava o config com `git checkout --`; agora restaura os bytes que leu. 1.8.10 fecha os dois agravantes: `Rendered.shown_remote` + banner 'bloquear imagens remotas' (o opt-in agora desliga pela UI) e `set_markdown_trust` virou `set_raw_html`/`set_remote_images` — o Allow nao limpa mais o override de HTML cru. `devCsp` nao declarado: o dev e servido pelo Vite, cujo socket de HMR uma copia do CSP recusaria, e isso nao da para conferir sem sessao desktop.
- [x] R6-16 — **feito em 1.8.13.** `page` e `fetch` passam por `read_workspace`: lock **compartilhado e bloqueante** (como `admin::lock`), sem ramo de gravacao. Workspace sem `vault.json` ainda cai no caminho exclusivo — o primeiro toque grava o vault que fixa a identidade de sync, e isso continua unico. Escritor continua `try_write` (nao espera): um POST durante uma leitura ainda leva 503, e o teste fixa isso tambem. Teste com um lock compartilhado segurado a mao no lugar do outro leitor: 503 `busy` no codigo anterior, 200 agora; e o primeiro GET cria o vault e os seguintes concordam no workspace. SYNC-0.6.md descreve os dois modos
- [x] R6-17 — **feito em 1.8.14 e 1.8.15.** 1.8.14: o estado grava `unseen` (o `has_more` do ultimo fetch, so quando true), preview de pareamento em cache nao drenado e recusado com `Receiving { received }`, e o preview do desktop busca as paginas restantes antes de planejar (ate 50). Teste: 45 arquivos iguais — 1 pagina dava 20 links + 25 uploads; agora recusa nomeando 0 e 20, e drenado lista 45 links. 1.8.15: **o achado era maior que o Conflict** — `sync_error` transformava TODO erro do cliente de sync em `CoreError::Unsupported`, entao conflito, offline, credencial negada e 'ainda recebendo' apareciam todos como 'This storage does not support that.' Agora `CoreError::Sync { cause: SyncCause, received }` com frase propria por causa nos dois idiomas; `JoinError` (panico da tarefa) vira `Internal`
- [x] R6-18 — **feito em 1.8.16.** Duas tabelas (`addresses`, `tokens`), cada uma com teto 4096; no teto **despeja a janela mais antiga**, nunca recusa a chave nova. IPv6 cobrado por /64 (IPv4-mapeado vira IPv4). Nota: o 'agravante' do enunciado (timestamp nunca renovado derruba o dispositivo ativo em 60 s) e a janela fixa de um minuto documentada — a entrada some e a proxima abre janela nova, nao e recusa; o que recusava era a tabela cheia. `/healthz` continua depois do limite por endereco, e agora nao cai por saturacao. Testes: 4096 enderecos e o 4097o ainda passa (429 no codigo anterior), e 120 enderecos no mesmo /64 esgotam um orcamento (o codigo anterior dava 200). SERVER-0.5.md descreve teto, despejo e /64
- [x] R6-19 — **feito em 1.8.17.** `client` (endereco cobrado) gravado ao lado de `peer` em toda linha da API, inclusive a de autenticacao negada. MCP auditado como `mcp:<ferramenta>` (checada contra o catalogo — `api::MCP_TOOLS`, e um teste compara com `notes_mcp::tools`) ou `mcp:<metodo>`; alvo = hash do argumento `path`. Nada que o cliente mandou entra verbatim: um teste manda a ferramenta `rm -rf /` e confere que vira `mcp:unknown` e que nem ela nem o caminho aparecem no log. `audit_target` (8 argumentos) virou `audit_event(&Event)`. Limite declarado em SERVER-0.5.md: o resultado MCP e o do transporte — ferramenta que recusa dentro de resposta JSON-RPC ok ainda sai `ok`
- [x] R6-20 — **feito em 1.8.18.** `notes_mcp::refusal`: `{"code"}` + so o acionavel — `disk_rev` no conflito, `path` so se parsear como relativo (o que o chamador mandou), `kind` do I/O, `reason` do read-only, `permission_denied`. Raiz, `op`, mensagens e caminhos absolutos ficam no servidor. `notes-model` virou dependencia normal do notes-mcp (era so dev). Testes: o caso do achado (read_dir sem permissao) vira `{"code":"io","kind":"permission_denied"}`; sete variantes com caminho absoluto em todo campo string nao deixam nenhum string comecando com `/`. KNOWLEDGE-0.3.md descreve o formato
- [x] R6-21 — **feito em 1.8.19.** `mtime_ns` no schema MCP: `{"type":"string","pattern":"^-?[0-9]+$"}` (era `number`); as descricoes das quatro ferramentas de escrita dizem 'passe base_rev exatamente como notes_read devolveu' — a instrucao so existia no KNOWLEDGE-0.3.md, que cliente MCP nenhum le. O desserializador segue tolerante a numero. Teste stdio: o tipo publicado e `string`, o `base_rev` de um read e string que casa com o padrao, e reenviado assim a escrita passa
- [x] R6-22 — **feito em 1.8.20.** `offset` (0..1.000.000) publicado em `notes_list`/`notes_search`, e resposta truncada traz `next_offset`. `path` em `notes_list` nao: o core nao estreita a listagem por subarvore, e publicar um argumento que nao faz nada seria a mesma promessa vazia. Teste stdio: 350 notas, paginas de 200, as 350 alcancadas pelo `next_offset`
- [x] R6-27a — **feito em 1.8.21.** `paths::private_dir`: `0700` no data dir a cada partida (aperta instalacao existente — nada abaixo de um diretorio que outros nao atravessam e alcancavel), `0600` em `state::write_atomic`, nos bancos SQLite (arquivo pre-criado 0600 antes do `Connection::open`; `-wal`/`-shm` herdam o modo) e nos arquivos de lock. `tests/private_store.rs` percorre um data dir usado (workspace aberto + indice de conteudo) e falha em qualquer arquivo alcancavel por outra conta — na primeira execucao achou `workspaces.lock` e `index.lock` em 0664. Windows fica com a ACL do `%APPDATA%`. A parte de **remover** os dados continua no R6-27
- [x] R6-27 — **feito em 1.8.22 (ADR-091), com o R6-27a em 1.8.21.** `forget_workspace(id)` e `remove_app_data()` em `notes-core/src/forget.rs`: recusam com o novo `CoreError::DraftsPending { count }` enquanto houver qualquer `*.draft` (legivel ou nao), com `LockTimeout` enquanto outro processo segura o lease de atividade (tomado exclusivo), e com `Unsupported` se o workspace estiver aberto aqui. So apagam nomes que o app escreve (`NOTES_DATA_DIR` pode apontar para qualquer lugar); o diretorio some so se ficar vazio. Comandos `workspace_forget` e `app_data_remove` (este pausa o sync e reinicia o app — o controller e a janela guardam config em memoria). UI na Welcome: *Esquecer* por workspace recente e *Remover os dados do Tura…*, ambos com confirmacao `danger`, e a recusa aparece ali com o motivo. Fica de fora, declarado: a pasta de fila do sync que o usuario escolheu
- [x] R6-30a — **feito em 1.8.23.** `wait "$pid"; rc=$?` exigindo 137 e ao menos uma rodada fora do seed `LEN=1`; `CRASH_WRITER` para um stub, e `tools/tests/test_crash_loop.py` (gate + CI) prova as duas recusas e o caso bom
- [x] R6-30 — **feito em 1.8.24 (q_crashloop).** `.github/workflows/crash.yml` reutilizavel: `ci.yml` chama no push e ele roda sozinho toda noite, em ubuntu, macOS, Windows e Arch. No Windows acha `crash-writer.exe` e aceita o status de termino do Git Bash, rejeitando so as saidas proprias do writer. §14 do ARCHITECTURE corrigido (mktemp -d, fixtures/large gerado a mao)
- [x] R7-06 — **feito em 1.8.25.** `misplaced_path` (`/Volumes/` ou `/AppTranslocation/`), `supported()` recusa no macOS, `UpdateStatus.relocate`, fase `relocate` com a frase de mover para Aplicativos. Linha do indice `.continue/README.md` removida
- [x] R7-07 — **feito em 1.7.28 (ADR-095), tres dos quatro — e o quarto nao era deste item.** Passou para a frente do R6-43 porque duas de tres execucoes do CI no Ubuntu cairam em assercao de relogio, em commits so de documento. (1) `deep.rs`, os dois tetos de 1 s: agora a **contagem de diretorios lidos** na abertura — 2 de 20 962 na fixture, igual para 10 e 120 repositorios. **Com uma caminhada sincrona injetada, a abertura levou 38 ms: o teto antigo nao pegava a propria regressao; a contagem foi de 2 para 2 163.** (2) indice sob mudancas: conta **caminhada substituida enquanto rodava**, no ponto da substituicao — contar so inicios leu como violacao a caminhada fresca que a staleness lembrada pede; com a regra antiga, falha na primeira mudanca; roda em 0,5 s em vez de ate 120 s. (3) rate limit: relogio injetado; o teste agora prova tambem que a janela **expira**. Os contadores sao por instancia, pelo que o 1.7.20 ensinou. **O `control.rs` nao e relogio** (log do par 3 contra 4, so Windows) — foi para o R7-09. As duas linhas de intermitente de relogio sairam do `.continue/`
- [ ] R7-09 — **o intermitente de Windows que nao e de relogio: `received_bytes_remain_pending_until_explicit_application`** (`crates/notes-sync-client/src/control.rs`, hoje `#[cfg_attr(windows, ignore)]` desde 1.5.0). Separado do R7-07 em 23/09: nao tem prazo nem espera; o log do par tem 3 entradas onde se esperam 4, so no Windows. Suspeita a conferir, nao conclusao: `fs::write` de 'saved offline edit' logo depois de aplicar, e a captura decidindo por `stat` — no NTFS o par tamanho+mtime pode nao ter mudado do jeito esperado. Diagnostico possivel **sem** maquina Windows: branch com o `ignore` removido e o `stat` de antes e depois impresso, rodando so o job `windows-latest`. Tirar o atributo quando fechar
- [x] R5x — **feito em 1.8.26.** `reqwest = "=0.13.5"`; o lockfile so troca as dependencias do reqwest para versoes que ja estavam na arvore. Gate inteiro, com `clippy (windows)`. O PR #19 do Dependabot fecha sozinho
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
  lá; o do `lucide-react` (#17) foi aplicado à mão em 1.6.54 **23/09 — destravado:** o MinGW esta instalado (`/usr/bin/x86_64-w64-mingw32-gcc`). O gate volta a ter o passo `clippy (windows)` inteiro, que era a condicao. Refazer o bump, rodar o gate completo sem escotilha, e fechar o PR #19.
- [x] R6-25 — **feito em 1.8.27.** `ASSET_ORIGIN` por plataforma no renderer; sanitizador trata `http://notes-asset.localhost` como asset so no Windows/Android; overlays `tauri.windows.conf.json`/`tauri.android.conf.json` com a origem, conferidos pelo `tools/csp.py`. Ainda nao rodado em nenhuma das duas plataformas
- [x] R6-28 — **feito em 1.8.28.** Plugin de clipboard removido (init, dependencia, as duas concessoes; 28 pacotes a menos no lockfile). Descricao da capability e §12 do ARCHITECTURE dizem a verdade: dialog abre arquivos, e `pdf_extract` e o `token_file` do `sync_control_probe` leem fora da raiz, cada um com sua guarda nomeada
- [x] R6-29 — **feito em 1.8.29.** `tools/no-fs-capability.sh` unico para gate e CI: exige o diretorio e ao menos um arquivo de capability, e le tambem os `tauri*.conf.json` (capability inline). Diretorio movido e `fs:` inline, testados a mao, falham
- [x] R6-31 — **feito em 1.8.30.** `build.yml` decide pela existencia do Release e pelo sentinela, nao pela conclusao do workflow; `release.sh` trata create perdido na corrida como skipped e propaga o 9. `tools/tests/test_release_exit.py` com `gh` falso
- [x] R6-32 — **feito em 1.8.31.** `dtolnay/rust-toolchain` e `Swatinem/rust-cache` por SHA no `build.yml`; `tools/action-pins.py` no gate e CI. Residuo nomeado no proprio arquivo: a imagem `archlinux:latest`
- [ ] R6-33 — **Todo pacote distribuído se declara MIT © Samir enquanto linka 625 crates, seis deles MPL-2.0** (`NOTICE:14`, severidade médio, conserto médio). Licenciamento não estava entre as dimensões revisadas e nada no repositório o fecha. O `NOTICE` existe para 'guardar atribuição de terceiros que uma licença exige e que o LICENSE não carrega' e diz 'None yet.', seguido de um exemplo copiado de outro repositório (SHVIA-WEB / Crawl4AI) que o próprio arquivo manda apagar quando houver entrada real. Enquanto isso, todo artefato é um binário estaticamente linkado com 625 pacotes Rust — 155 MIT puro, 282 `MIT OR Apache-2.0` e 6 MPL-2.0 (`cssparser`, `cssparser-macros`, `dtoa-short`, `option-ext`, `selectors`, chegando pela pilha ammonia/servo que sanitiza o HTML do preview) — mais um bundle JS de ~94 pacotes npm. `tauri.conf.json:46` declara `"license": "MIT"` sem `licenseFile`; `packaging/aur/notes-bin/PKGBUILD.in:12` declara `license=('MIT')` e instala só o LICENSE do projeto; `packaging/linux/tarball.sh:50` copia só o `LICENSE`. Não há `cargo-about`, `cargo-deny`, `about.toml`, arquivo `THIRD-PARTY` nem passo de licença em workflow ou gate — grep por todos eles não retorna nada. **Cenário:** Um usuário instala `tura-notes_1.7.4_amd64.deb`, abre `/usr/share/doc/tura-notes/copyright` (ou o `/usr/share/licenses/notes-bin/LICENSE` do AUR) e encontra uma única concessão MIT atribuída a Samir Hanna Verza cobrindo um binário que embute `selectors` e `cssparser` sob MPL-2.0 e 155 crates MIT cujos avisos de copyright obrigatórios não aparecem em lugar nenhum da distribuição. Quem redistribuir — empacotador de distro, mirror, o próprio AUR — herda um pacote cujo campo de licença é factualmente errado, e o campo `license=('MIT')` do AUR é conferível por qualquer revisor contra os crates linkados. **Conserto:** Acrescentar `cargo about generate` (ou o check de licenças do `cargo-deny` mais um coletor pequeno) como passo de build emitindo `THIRD-PARTY-NOTICES.md` a partir do lockfile, mais o lado npm via `license-checker`; distribuí-lo como `bundle.licenseFile` no tauri.conf.json para `.deb`/`.rpm`/AppImage carregarem, copiá-lo em `packaging/linux/tarball.sh` ao lado do LICENSE, e instalá-lo no PKGBUILD. Substituir o 'None yet' e o placeholder do SHVIA-WEB por um ponteiro para o arquivo gerado mais a entrada MPL-2.0 nomeando os crates e onde está o fonte deles. Uma linha `cargo deny check licenses` em `tools/check.sh` impede que uma dependência copyleft nova chegue calada. *(tema: Publicação e documentação: o que sai daqui e o que se lê primeiro)*
- [ ] R6-34 — **O estado do updater está errado em duas páginas ACTIVE e no índice da fila, com carimbo de 'tudo conferido'** (`docs/updater.md:288`, severidade médio, conserto pequeno). A linha 'Atualização desktop' de `.continue/README.md:23` e a seção 'What is published, measured from outside — 18/09/2026' de `docs/updater.md:281-303` afirmam quatro coisas que o próprio repositório retratou em 1.6.66 (eea985f, que consertou README.md, runbook.md e .loop/QUEUE.md e deixou essas duas): os feeds Linux estão em 1.6.3 (estão em 1.7.2), `/p/tura-notes` 'ainda diz In preparation' (lista 1.7.4), 'falta rodar o publish de novo' (já rodou), e falta a chave do updater nomeando `./signing.env` e `~/.config/tura-notes/build.env` — que guardam as credenciais de NOTARIZAÇÃO do macOS, enquanto `tools/updater-release.py:31-36` lê `~/.config/tura-notes/updater.key`, presente desde 16/09. A updater.md acrescenta uma quinta: diz que o feed `darwin-aarch64*.json` devolve 404 e 'não haverá um até existir build assinado num Mac' — esse feed está vivo em 1.7.4, e o changelog 1.7.3 descreve depurar uma atualização in-app no macOS baixada dele. O amplificador é o carimbo de `.continue/README.md:3` ('Last reviewed 18/09/2026, repositório em 1.6.62 — cada linha abaixo conferida'), imóvel por oito edições e 44 versões, que converte linha velha em linha certificada — que é exatamente o defeito que 1.6.63 foi escrito para consertar. **Cenário:** Uma sessão começa, lê `.continue/README.md` primeiro como manda o CLAUDE.md, vê um carimbo afirmando que toda linha foi conferida, e trata a linha de topo como estado atual: reporta o updater desktop como bloqueado por chave de assinatura faltando, ou gasta a sessão rodando de novo um publish que já teve sucesso. Quem for triar 'o que falta na trilha do updater' recebe respostas opostas de duas páginas ACTIVE, e a que é dona do contrato é a errada. **Conserto:** Remedir os três feeds e `/p/tura-notes`, reescrever a tabela de §'What is published' com a data de hoje mantendo o snapshot de 18/09 abaixo como registro datado (padrão de 1.6.64/1.6.65), derrubar os itens 1 e 2 de 'what remains' e deixar o 3, o aceite, que segue genuinamente aberto. Corrigir a linha da fila para o que falta de fato (aceite de upgrade instalado em macOS/AppImage/deb/rpm e a checagem do `.deb` do ADR-082) e recarimbar com 1.7.4. Registrar o fato novo que a remedição revela e que ninguém tem: Linux está em 1.7.2 e macOS em 1.7.4, isto é, os clientes Linux estão duas versões atrás. Para a recorrência, uma checagem barata em `tools/check.sh` que falhe quando `.continue/README.md` é modificado num commit cujo carimbo ainda nomeia versão antiga. *(tema: Publicação e documentação: o que sai daqui e o que se lê primeiro)*
- [ ] R6-36 — **create_new deixa temporários de nome aleatório na pasta do usuário, o caso que tmp_path existe para evitar** (`crates/notes-fs/src/local.rs:280`, severidade baixo, conserto pequeno). `tmp_path` (:112-137) carrega um comentário longo explicando que nome temporário aleatório é errado precisamente porque 'com nome aleatório cada crash deixa um NOVO, então eles se acumulam na pasta do usuário para sempre', e `tools/crash-save-loop.sh` afirma o limite resultante de no máximo um resto por nota. `create_new`, dez linhas abaixo, usa `tempfile::Builder` com sufixo aleatório e tem exatamente a propriedade que o comentário recusa. O `NamedTempFile` limpa no Drop, mas nada limpa depois de um SIGKILL ou queda de energia, que é o único caso de que a regra trata. O caminho de acumulação real não é import de anexo (lá cada import tem alvo com UUID novo, então nenhum esquema de nome limita nada) e sim escrita repetida no MESMO caminho: `notes-sync-client apply` reexecutando o mesmo caminho recebido após ser morto (sync.rs:453, :880), ou o usuário recriando o mesmo nome de nota. **Cenário:** Cada tentativa deixa um `.notes-create-<aleatório>.tmp`; com a nomeação de `tmp_path` elas colapsariam em um. Os restos são invisíveis de dentro do Tura — escondidos da árvore por `ignore.rs:38`, do watcher por `relativise` e do índice por `index.rs:169` — então o usuário nunca fica sabendo por dentro do app, e `crash-save-loop.sh` é cego para este caminho por construção, porque `crash-writer.rs:30` só chama `write_atomic`. **Conserto:** Dar a `create_new` o mesmo nome temporário determinístico que `tmp_path` já produz, aberto com `create_new(true)` depois de um `remove_file` incondicional (o padrão exato de `write_atomic` em :170-175, que também mantém a recusa de symlink por O_EXCL), publicando com `rename_noreplace` em vez de `persist_noclobber` para a garantia de não sobrescrever continuar igual. Uma varredura de `.notes-create-*.tmp` na abertura do workspace resolve a nomeação e também o caso de anexo, que a nomeação não alcança. E um modo `--create` no `crash-writer` para o `crash-save-loop.sh` passar a cobrir esta entrada. *(tema: A regra vale num caminho e não no gêmeo)*
- [ ] R6-37 — **PathIndex engole falha de spawn e fica em building: true para sempre** (`crates/notes-core/src/index.rs:80`, severidade baixo, conserto pequeno). `PathIndex::start` sobe o walk com `.spawn(...).ok()` — o `Result` é descartado. Se a thread não puder ser criada, o closure que faria `building.store(false, ...)` é dropado sem rodar, então `building` fica `true` e `paths` fica vazio pela vida daquele `PathIndex`. A condição de reconstrução de `quick_open` (lib.rs:1549) é `state.stale && !ix.snapshot().building`, então aquele índice nunca é substituído. O módulo irmão trata exatamente esse caso do jeito certo: `content_index::Job::start` checa `if let Err(e) = spawned` e põe `running = false` com o erro (:52-56). **Cenário:** Sob esgotamento de thread/memória ou `RLIMIT_NPROC` restritivo (contêiner, shell móvel), `std::thread::Builder::spawn` devolve `Err`. O Ctrl+P passa a devolver `QuickOpen { matches: [], indexed: 0, building: true }` em toda chamada, e a paleta afirma permanentemente que ainda está enchendo; não há campo `error` no `Snapshot` para a UI dizer algo mais verdadeiro. Dura enquanto o workspace estiver aberto — fechar e reabrir reconstrói `PathState::default()` e tenta o spawn de novo. **Conserto:** Espelhar `Job::start`: ligar o resultado do spawn e, no `Err`, pôr `building = false` (e um `error: Option<String>` no `Snapshot`, para a paleta poder dizer por que está vazia). Só `building = false` já basta para a próxima invalidação retentar o walk. *(tema: A regra vale num caminho e não no gêmeo)*
- [ ] R6-38 — **Spans de link dentro de código inline estão deslocados, e o golden fixou o valor errado** (`crates/notes-markdown/src/lib.rs:286`, severidade baixo, conserto pequeno). `collect_links_in_code(t, range.start, ...)` passa o início do span do `Event::Code` inteiro, que inclui a corrida de crases de abertura, mas `t` é o conteúdo já sem as crases — todo offset calculado ali fica curto pelo número de crases (mais o espaço de padding). O docstring de `Link::in_code` diz que esses spans são reportados justamente para a ferramenta de rename 'poder dizer o que NÃO tocou', e os bytes que ela apontaria estão errados. O caminho de BLOCO de código (:311) está certo, porque usa o range do `Event::Text`; só o inline está afetado. Atenção para a correção: pulldown-cmark também colapsa quebras de linha dentro de um code span num espaço, então o conteúdo não é substring da fonte com offset constante — não dá para simplesmente somar um número. **Cenário:** Hoje é latente, porque todo consumidor filtra `!l.in_code` antes de fatiar (knowledge.rs:132, references.rs:122, transfer.rs:83). O que é vivo é o contrato: o span errado cruza a IPC como `Document.links[].span` e está abençoado em `fixtures/markdown/links.doc.json` — exatamente o que o README dos goldens avisa ('um golden abençoado sem ser lido registra um bug como decisão'). O primeiro consumidor que honrar o docstring herda o defeito, e há formas que chegam a pânico de fronteira de caractere: um link cujo alvo e um caractere multibyte, escrito uma vez entre crases simples e uma vez entre crases duplas, dão span 0..8 caindo dentro do € de três bytes. **Conserto:** Passar a `collect_links_in_code` a fatia da fonte do code span (ou localizar o início do conteúdo dentro de `src[range]`) em vez de um inteiro corrigido. Depois re-abençoar `links.doc.json` LENDO o diff, e acrescentar ao corpus um link em código inline com caractere multibyte junto do parêntese de fechamento, mais um link em bloco cercado — `code-blocks.doc.json` tem `links` vazio, então o corpus hoje não fixa nenhum span in-code exceto o quebrado. *(tema: Controle verde que falha na direção errada)*
- [ ] R6-39 — **serverInfo.version é o version.md inteiro, não o primeiro semver dele** (`crates/notes-mcp/src/lib.rs:194`, severidade baixo, conserto pequeno). A resposta de `initialize` carimba `serverInfo.version` com `include_str!("../../../version.md").trim()`. Todo outro consumidor daquele arquivo no repositório aplica a regra documentada — o PRIMEIRO semver — porque a norma permite explicitamente que `version.md` seja um documento markdown: `tools/release.sh:81`, `stamp-version.sh:53`, `build-linux.sh:134`, `build-local.sh:595`, `.github/workflows/build.yml:92`, `deploy-server.sh:85` e `tools/tauri.mjs:13` todos extraem com regex. Só funciona hoje porque `version.md` é a string de 6 bytes '1.7.4\n'. Um segundo consumidor também desvia, de outro jeito: `tools/changelog-versions.py:76` usa o primeiro token separado por espaço. **Cenário:** Alguém adota a forma markdown que docs/versioning.md:24 permite. O `notes-mcp` compila, o gate passa, e toda resposta de `initialize` passa a anunciar o documento inteiro como `serverInfo.version` — um cliente que renderiza mostra um parágrafo onde deveria haver uma versão. Não derruba o handshake (Implementation.version é string livre no MCP) nem reprova ACCEPTANCE-0.7 M1 (que só afirma `serverInfo.name`), e o gate ficaria vermelho pelo changelog-versions.py no mesmo momento — é defeito latente de consistência, não risco de entrega. **Conserto:** Extrair o primeiro `X.Y.Z` da string incluída em tempo de build — um `build.rs` pequeno, ou fazer `tools/stamp-version.sh` gerar um `version.rs` do jeito que já carimba o bundle do Tauri (ADR-035), para o notes-mcp ler a mesma constante que os instaladores. Um teste unitário afirmando que `serverInfo.version` parseia como três inteiros separados por ponto fixa; hoje stdio.rs:33, mcp.py:95 e http.rs:415 só checam `serverInfo.name`. *(tema: A regra vale num caminho e não no gêmeo)*
- [ ] R6-40 — **A barra de abas declara o padrão ARIA de tabs e não implementa nenhum comportamento de teclado dele** (`apps/notes-app/src/app/Tabs.tsx:30`, severidade baixo, conserto pequeno). O `role="tablist"` (:30) contém botões `role="tab"` (:37-47), mas cada aba está embrulhada num `<div className="tab">` (:36) que é `display: flex`, então as abas não são filhas do tablist e a relação ARIA é inválida; não há handler de setas nem `tabIndex` rotativo, então toda aba e todo botão de fechar ficam na ordem sequencial de tabulação; não há `aria-controls` nem `role="tabpanel"` no painel do editor. O papel é afirmado e o contrato atrás dele não é cumprido. **Cenário:** Quem usa leitor de tela chega à barra e, justamente por causa da posse quebrada, NÃO ouve 'aba 1 de 4' — a informação de posição no conjunto é o que a hierarquia errada custa; ouve um 'tab, selected' isolado, sem noção de quantas notas estão abertas. Seguindo o padrão que o papel anuncia, aperta seta para a direita e nada acontece. Chegar à quarta nota custa 7 pressionamentos de Tab, e depois de ativar não há `aria-controls` que diga qual região mudou. Nenhuma tarefa fica bloqueada (Ctrl+P, a árvore e Enter numa aba continuam funcionando), mas é a única lacuna de nível básico encontrada nessa varredura — `tools/contrast.sh` passa com 42 pares em AA e `tools/i18n-keys.py` passa. **Conserto:** Ou implementar o padrão — `role="tab"` no elemento que o tablist possui diretamente, handler de Esquerda/Direita/Home/End com `tabIndex` rotativo (0 na ativa, -1 nas demais), tirar o botão de fechar da ordem de tabulação atrás de atalho ou do próprio handler da aba, `role="tabpanel"` no painel e `aria-controls` ligando — ou largar os papéis e deixar a barra ser uma lista rotulada de botões, que é honesto e não custa nada. *(tema: A regra vale num caminho e não no gêmeo)*
- [ ] R6-41 — **Três páginas de governança citam um ACCEPTANCE-0.0.md que não existe** (`docs/roadmap.md:6`, severidade baixo, conserto pequeno). `docs/roadmap.md:6`, `CLAUDE.md:107` e `AGENTS.md:107` carregam a mesma frase, atribuindo a caminhada de aceite do marco 0.0 a `docs/ACCEPTANCE-*.md` — um glob que o exclui. O aceite do 0.0 é `docs/SPIKE-0.0.md` §2, nomeado diferente de propósito ('o produto do spike é evidência, não software', SPIKE-0.0.md:9). A outra metade da acusação original não procede e deve ser descartada: 'none of them ticked' está CORRETO para o 0.0 — os três `[x]` em SPIKE-0.0.md:118-136 são o controle de regressão dmabuf do ADR-033 na máquina de desenvolvimento, uma subseção fechada em 08/09/2026, não aceite do dono em release instalado, e as caixas de Arch/Wayland/NVIDIA, iPhone e Android seguem vazias. `doc-links.py` não pega nada disso, porque a citação é um glob em prosa, não um link. **Cenário:** Uma sessão perguntada sobre quais marcos entregues não têm página de aceite faz glob em `docs/ACCEPTANCE-*.md`, não acha 0.0, e cria um `docs/ACCEPTANCE-0.0.md` duplicando o §2 do SPIKE-0.0.md — exatamente o movimento já feito para o 0.7 em `.loop/QUEUE.md:36-40` — deixando duas páginas donas de uma checklist só. Mitigado porque `.continue/README.md:38` é a primeira leitura obrigatória e nomeia SPIKE-0.0.md para o 0.0; por isso é baixo. **Conserto:** Escrever a exceção dentro da frase, nas três cópias: 'cada um com seu `ACCEPTANCE-*.md` (a caminhada do 0.0 está em `SPIKE-0.0.md`)'. Editar `CLAUDE.md` e `AGENTS.md` juntos para os gêmeos seguirem byte-idênticos abaixo do H1. *(tema: Publicação e documentação: o que sai daqui e o que se lê primeiro)*
- [ ] R6-42 — **workspace read-only nao aparece na interface** (`apps/notes-app/src`, achado durante o R6-05). `WorkspaceInfo.read_only` existe desde que o `TooNew` foi tratado, e **nenhum arquivo de `src/` le o campo** — os unicos consumidores sao `crates/notes-core/tests/protocol.rs:65` e `:549`. Ou seja: um workspace aberto somente-leitura porque o estado veio de uma versao mais nova se comporta como um workspace normal ate a primeira gravacao falhar, e a razao que o core carrega com cuidado nao chega a ninguem. Vale mais depois do R6-05, que acrescenta uma segunda razao (registry sumido) — as duas precisam da mesma faixa na UI. *(tema: Controle verde que falha na direcao errada)*
- [ ] R7-04 — **tela de dispositivos conectados, com revogacao por dispositivo** (resposta a nota de q_dispositivo: *pode fazer ja*). **Medido 23/09:** o servidor ja lista dispositivos de sync e aposenta um (`sync-device-list`, `sync-retire-device`) e revoga credencial por credencial (`token revoke`) — **tudo so pela CLI no host**. Falta: endpoint autenticado para listar e revogar, uma permissao que o autorize (hoje `Permission` tem seis, nenhuma administrativa), e a tela no `DeviceSync`. E superficie administrativa exposta na rede: ADR propria antes do codigo, `docs/security.md` no mesmo passe, auditoria de cada revogacao, e testes de que credencial sem a permissao nova recebe 403 **Restricao achada no R7-01:** `docs/security.md` §4.10 — servico administrativo so em loopback ou interface privada, e o servidor e publico. Ver ADR-086: ou e acao de usuario sobre os dispositivos do proprio workspace, ou fica fora da interface publica; se nenhuma servir, vira pergunta ao dono, nao excecao
- [ ] R7-05 — **retencao: limites maiores e aviso antes do 507** (q_retencao). Nada e expurgado automaticamente. Subir os limites do servidor com a razao escrita, e fazer o cliente avisar com antecedencia — um limiar de aviso antes do teto — em vez de descobrir no 507. Especificar em `SYNC-0.6.md` primeiro, porque o 0.6 dizia que isso estava aberto

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
- [x] R6-02 — **feito em 1.7.8.** O `inFlight` era booleano de modulo e **descartava**; a `ARCHITECTURE.md:354` diz que o core **enfileira** (*'saves are queued per document inside the core'*), entao o comentario invocava a secao que o codigo contrariava. Virou cadeia de promessas: nada e descartado, o save enfileirado rele o buffer quando chega a vez dele (manda o texto mais novo, nao o capturado) e carrega o `noteId`, entao um save ultrapassado por troca de aba recusa em vez de escrever a nota anterior na atual. O `leaveCurrent` ganhou o piso do rascunho: flush ter retornado nao e o buffer estar em disco, entao rele depois do await e cai para `keepDraft('exit')` se ainda estiver sujo. Sete testes novos em `editor.save.test.ts` e `tabs.test.ts`; **quatro sao vermelhos antes do conserto**, os outros tres sao guarda de regressao
- [x] R6-03 — **feito em 1.7.9, com uma ressalva no gate.** Medido, e pior do que o achado dizia: `encoding_to_unicode_table` casa exatamente `MacRomanEncoding`, `MacExpertEncoding` e `WinAnsiEncoding` e chama `panic!` em **todo o resto**, nao so em `/StandardEncoding`. Sonda rodada e removida: `panicked at pdf-extract-0.12.0/src/lib.rs:359: unexpected encoding "StandardEncoding"`. `pdf_extract` virou `#[tauri::command(async)]` (sai da thread da webview, e um PDF de 32 MiB deixa de congelar a janela) e o parse passa por `catch_unwind` em `extract_or_refuse`, virando o `CoreError::Unsupported` que a ADR-068 ja mandava devolver. Fixture nova em `fixtures/pdf/` com README, dois testes em `commands.rs`, e a linha **K16** na `ACCEPTANCE-0.3.md` — porque o que essa linha checa e que a janela sobreviveu, e isso teste de unidade nao substitui. **Ressalva:** o passo `clippy (windows)` do gate nao rodou (sem MinGW, `sudo`, ato do dono). Os outros 35 passos estao verdes. Nada aqui e especifico de Windows, mas a regra da rodada 4 diz que a escotilha so vale em commit que nao toca Rust, e este toca — entao fica registrado, nao contornado
- [x] R6-04 — **feito em 1.7.10, e achou coisa que o achado nao previa.** `LockTimeout` virou `LockTimeout { what: LockWait }` com tres causas tipadas (`WorkspaceWrite`, `ActivityExclusive`, `ActivityShared`), e o quarto produtor saiu do lock inteiro: `sync.rs:127` nao e lock nenhum — e reconciliacao que nao assentou, agora `NotSettled { passes, queued }`. **O tipo revelou dois testes asseverando a trava errada:** `an_exclusive_open_session_applies_and_reloads_clean_notes` e `shared_sessions_cannot_apply_or_upgrade_away_their_lease` diziam esperar o write lock do workspace e exercitam a trava do arquivo de atividade — nao dava para notar enquanto as duas compartilhavam uma variante sem campo. Corrigidos para a que de fato exercitam. **De quebra, `lock.rs:85`** (que estava so no tema 5, sem item proprio): o teste que dizia cobrir contencao chamava `acquire` duas vezes, e `acquire` nao toma lock — o lock e tomado no `with`. Nao tinha asercao nenhuma e nao podia falhar; agora entra nas duas secoes criticas. Consequencia pratica: o intermitente aberto em `.continue/README.md` conta cinco ocorrencias por **string**, e a string era compartilhada por esperas sem relacao — a contagem media a mensagem, nao a espera. **Ressalva:** `clippy (windows)` nao rodou, sem MinGW; os outros 35 passos verdes
- [x] R6-05 — **feito em 1.7.11 e 1.7.12, dois commits por assunto.** (a) O registry: `Loaded::Fresh` tomava um ramo so para 'nunca teve' e 'tinha e sumiu', e o indice de workspaces ja sabia a diferenca sem ser perguntado — raiz que ele ainda lista, sem registry, agora abre read-only com `WorkspaceReadOnly::IdentityLost`. O `read_only: bool` + `state_schema_ahead: Option<u32>` viraram um campo so que nao pode discordar de si mesmo. E o `registry.json` pre-SQLite e aposentado depois da migracao, porque um espelho congelado que o `load` ainda le e pior que nenhum. (b) Os dois stores de texto: `drafts::read` devolvia `Ok(None)` para cabecalho corrompido e `conflicts::list` fazia `continue` — os dois guardam a unica copia do que o usuario digitou. Agora `StateUnreadable`, `SchemaAhead` com a constante que ninguem lia, e `Conflicts.unreadable` contando em vez de sumir. **O `discard` era quem destruia de fato** (remove por caminho sem nunca ter lido): draft ilegivel e posto de lado como `.draft.unreadable`, nao apagado. Sete testes. **Anotado como R6-42:** `WorkspaceInfo.read_only` nao e lido por nenhum arquivo de `src/` — a razao que o core carrega com cuidado nao chega a interface nenhuma. **Ressalva:** `clippy (windows)` nao rodou, sem MinGW
- [x] R6-06 — **feito em 1.7.13.** O `?` na linha 20 saia da **funcao inteira**, nao da iteracao: a primeira entrada sem caractere com caixa encerrava a sondagem como inconclusiva, e o chamador le inconclusivo como *insensivel*. O proprio doc comment ja descrevia o comportamento certo (*'one where **no** entry has a cased letter'*) — so o codigo parava antes. **O exemplo do achado nao reproduz, e e por isso que passou despercebido:** nota nao serve, porque `.md` tem caixa — `flip_case("2026-09-22.md")` devolve `Some`. O caso real e **diretorio**: pasta de ano, ou nome em escrita sem caixa. Primeiro teste que escrevi passou com e sem o conserto; refeito com `2026/` e `文档/`, fica vermelho sem e verde com. **Ressalva:** `clippy (windows)` nao rodou, sem MinGW
- [x] R6-08 — **feito em 1.7.14.** `knowledge::candidates(&paths, ...)` constroi um `WikiLookup` inteiro — duas arvores sobre toda nota do workspace — a cada chamada, e era chamado dentro do laco por link de cada documento indexado, em **dois** call sites. Icado para fora: um lookup por revisao. **Medido:** 12 documentos x 8 links, o contador passa de **109 construcoes para 1**. O teste conta **construcoes**, nao milissegundos — teto de relogio e a forma que ja produziu tres intermitentes de Windows neste repositorio, e o que mudou de fato foi o numero de passagens pelo workspace. O contador (`knowledge::wiki_lookups_built`) fica como guarda de regressao. **Ressalva:** `clippy (windows)` nao rodou, sem MinGW
- [x] R6-09 — **feito em 1.7.15.** O `break` por orcamento deixava `matches` vazio, e vazio caia na 'Regra 3, por omissao', que **apaga o registro** — orcamento esgotado e ausencia de correspondencia davam a mesma resposta. Agora `ran_out` separa as duas: indeciso mantem o registro e chama `Recon::queue`, entao `reconcile` devolve `queued != 0` e o proximo passe termina a correlacao. Isso tambem faz o laco de dreno do `inventory_using` significar o que o comentario dele afirma — ele vigiava uma fila que a correlacao nunca escrevia. Teste com 30 notas de mesmo tamanho movidas por copy+delete (a forma que cliente de nuvem, move entre volumes e restore produzem): vermelho sem o conserto, `n02.md` com NoteId novo. **Ressalva:** `clippy (windows)` nao rodou, sem MinGW
- [x] R6-10 — **feito em 1.7.16.** Duas assimetrias contra o walk, no mesmo `if`: `p.is_dir()` **segue symlink** (o walk usa `symlink_metadata` justamente por causa da ADR-019), e instalava watch numa pasta so, **sem descer** — arvore movida para dentro e **um** evento para o topo, e tudo aninhado ficava sem vigilancia ate um scan completo tropecar nela. O event loop agora chama `add_watches_below`, que ja trata descida, limite da tabela de watches e contabilidade de erro. **Meu primeiro conserto estava errado e os testes pegaram:** evento de diretorio diz 'algo aconteceu aqui', nao 'isto e novo', entao eu re-descia a arvore inteira a cada mudanca na raiz. Resolvido com um `BTreeSet` dos diretorios ja vigiados, semeado pelo walk. Dois testes, vermelhos com o codigo antigo. **Ressalva:** `clippy (windows)` nao rodou, sem MinGW
- [x] R6-11 — **feito em 1.7.17, com ADR-085.** As duas invalidacoes estavam atras de `if !events.is_empty()`, e `Created` e **suprimido em varredura completa por design** — enquanto o `stores/sync.ts:164` dispara `reconcileAll` a cada 5s com `full = true`. Em workspace sem watch (mount de rede, inotify esgotado, backend SAF do 0.4) toda nota criada por fora ficava invisivel ao Ctrl+P, e **pior:** `building: false`, entao a paleta declarava lista completa. A mensagem do teste vermelho diz tudo — `indexed: 2, building: false` com tres notas no disco. Nao dava para restaurar a ADR-032 ao pe da letra (invalidar a cada tick poe a caminhada de fundo numa esteira de 5s), entao o criterio virou a **contagem que a varredura ja tem de graca**: arvore com numero diferente de caminhos e arvore que o cache nao descreve; sumico continua chegando como evento. Escrito como **ADR-085**, porque a guarda antiga era uma segunda qualificacao que nenhum ADR registrava. **Ressalva:** `clippy (windows)` nao rodou, sem MinGW




Os pendentes desta rodada foram para a **Rodada 7** em 23/09, na ordem nova.

## Notas — não são itens, são coisas a fazer quando o arquivo for tocado

- **Português em quatro scripts de `tools/`:** `sign-server-release.sh` (25 linhas
  com acento em 78), `byte-preservation.sh`, `gen-fixtures.py` e
  `crash-save-loop.sh`. A regra de idioma **não** pede reescrever o que já existe,
  então isto não é item de fila. Mas o `sign-server-release.sh` é chamado de um
  runbook em inglês e o `cotenant.py` afirma sobre a string portuguesa dele — então
  a próxima edição de qualquer um deles já sai em inglês e leva o teste junto.

## Parqueado — espera um ato do dono, e não segura a fila

- 🔒 R7-08 — **fila movel em segundo plano (WorkManager no Android, BGTask no iOS)** (q_ciclo_movel, decidido 23/09). Parqueado por ambiente, nao por decisao: so da para ver rodando no MacBook ou num aparelho, e escrever codigo movel que ninguem executou e o que o 0.4 ja registra como o problema dele. Sai daqui quando o R7-03 tiver o ambiente de pe



Ficam no fim de propósito: o hook entrega sempre o primeiro `- [ ]`, e um item
que espera outra pessoa no topo da fila é uma rodada que gasta um turno por
parada dizendo que nada aconteceu.

- [x] R4g — **encerrado por decisao, 23/09 (q_04):** o dono escolheu o MacBook e um aparelho Android fisico; o firmware desta maquina deixa de ser o caminho do 0.4 (ver R7-03). Texto original: **parqueado: bloqueado por ato do dono, não por sudo.** O emulador x86_64 exige KVM e o `kvm_amd` é recusado pelo firmware (`SVMDIS` em `MSR_VM_CR`), que só sai com **Advanced ▸ CPU Configuration ▸ SVM Mode ▸ Enabled** na UEFI e um reinício — ASUSTeK TUF GAMING X570-PLUS_BR, BIOS 5043. Conferido em 18/09: `/dev/kvm` ainda não existe e o boot corrente é o de 16/09 11:23, então o reset ainda não aconteceu. Não fico esperando por isto. Quando existir: com o emulador de pé, instalar o app gerado e registrar o que de fato acontece — abrir, escolher pasta, listar, editar. É a primeira evidência de execução do 0.4; até aqui só existe evidência de compilação
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


As dez perguntas completas, com opções e recomendação, estão no artefato — <https://claude.ai/artifact/Vr8WJEfiinAfji3H7Et4Md>, seção **Decisões**.

## Colhidos automaticamente
