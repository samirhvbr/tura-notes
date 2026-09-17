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

## Parqueado — espera um ato do dono, e não segura a fila

Ficam no fim de propósito: o hook entrega sempre o primeiro `- [ ]`, e um item
que espera outra pessoa no topo da fila é uma rodada que gasta um turno por
parada dizendo que nada aconteceu.

- [ ] R4g — **parqueado: bloqueado por ato do dono, não por sudo.** O emulador x86_64 exige KVM e o `kvm_amd` é recusado pelo firmware (`SVMDIS` em `MSR_VM_CR`), que só sai com **Advanced ▸ CPU Configuration ▸ SVM Mode ▸ Enabled** na UEFI e um reinício — ASUSTeK TUF GAMING X570-PLUS_BR, BIOS 5043. Conferido em 18/09: `/dev/kvm` ainda não existe e o boot corrente é o de 16/09 11:23, então o reset ainda não aconteceu. Não fico esperando por isto. Quando existir: com o emulador de pé, instalar o app gerado e registrar o que de fato acontece — abrir, escolher pasta, listar, editar. É a primeira evidência de execução do 0.4; até aqui só existe evidência de compilação
- [ ] R5-publish — rodar `./build-local.sh --publish` com o `--file-version`
  corrigido, que é o que tira o Access de *In preparation*. Conferido em 18/09:
  nem `./signing.env` nem `~/.config/tura-notes/build.env` existem nesta máquina
  e `~/.tauri/` só tem a chave do shvterm, então a build morre na assinatura do
  updater. Não gasto build que morre num segredo. Destrava com o arquivo reposto
  num dos dois caminhos, ou com `TURA_BUILD_ENV` apontando para onde ele está

## Colhidos automaticamente
