---
n: 32
kind: ASK
sinal: pergunta-direta
confianca: alta
ts: 2026-09-23T19:38:00-03:00
sessao: cf91c092-dbd4-4bbf-a3af-6fba8e51f594
item_da_fila: ""
decisao: continuou
fecho_do_turno: completo
respondida: false
---
## Por que ASK
- pergunta direta no fecho: '**R7-09:** autoriza um PR de diagnóstico só para rodar o job de Windows?'

## Pergunta(s) detectada(s)
> **R7-04:** aprova o ADR-096?
> **R7-09:** autoriza um PR de diagnóstico só para rodar o job de Windows?

## Mensagem original

A fila da rodada 7 está vazia. Sobraram três itens 🔒, que dependem de você. Tudo até a 1.8.43 está commitado e com o gate inteiro verde; está no ar até a 1.8.15, e a 1.8.16 → 1.8.43 está subindo agora, um push por vez, cada um só depois do CI dos quatro SOs verde.

**O que saiu (1.8.8 → 1.8.43)**
- **Imagens e segurança do preview:** o opt-in de imagens remotas funciona e dá para desligar pela tela. No Windows e no Android as imagens passam a carregar, mas isso ainda não foi rodado em nenhuma das duas plataformas. O webview perdeu a leitura de clipboard, que ninguém usava.
- **Servidor e MCP:**
  - Leituras simultâneas de sync não dão mais 503.
  - Uma enxurrada de endereços não tranca mais todo mundo fora.
  - A auditoria registra o cliente real e a ferramenta MCP usada.
  - Erros de MCP não vazam mais caminho absoluto do servidor.
  - O schema MCP está corrigido e a paginação passou a funcionar.
- **Sync:**
  - O pareamento espera o histórico inteiro antes de montar o plano.
  - Os erros de sync dizem a causa em vez de "This storage does not support that".
  - Cada passe decodifica o payload recebido uma vez só (eram 255 decodificações, agora 45).
  - Os limites do servidor dobraram (medido antes: ~99 ms por request no teto antigo), e o app avisa a partir de 80%.
- **Dados do app:**
  - A pasta de dados passou a ser `0700`, arquivos `0600`.
  - A tela inicial ganhou "Esquecer" e "Remover os dados do Tura", que recusam enquanto houver rascunho não salvo.
  - Workspace somente-leitura agora aparece na interface.
- **Release e CI:**
  - O crash loop agora prova que o writer escreveu e roda em Linux, macOS, Windows e Arch, toda noite.
  - Actions de terceiros fixadas por SHA.
  - Todo pacote leva `THIRD-PARTY-NOTICES.md`, e o gate recusa licença fora da lista permitida.
  - Um minor não perde mais os artefatos por falha do workflow de Release.

**Dois problemas meus que corrigi no caminho**
- Um teste de build revertia edições não commitadas do `tauri.conf.json` com `git checkout`, e isso chegou a apagar a mudança do CSP no meio de um gate verde. Corrigido na 1.8.9.
- A 1.8.25 falharia no clippy do Linux. Corrigi dentro do próprio commit antes de qualquer push (reescrevi só commits locais).

**O intermitente dos testes de recovery voltou (CI do macOS na 1.8.15)**
- Passou no rerun.
- Agora se sabe que alguém realmente segura o lock de atividade, mas ainda não se sabe quem.
- Desde a 1.8.43, a próxima ocorrência vai imprimir quem é.

**Pendente com você (tudo no quadro do artefato)**
1. **R7-04:** aprova o ADR-096? É uma permissão `devices`, desligada por padrão, para listar e revogar os aparelhos do workspace pelo app.
2. **R7-09:** autoriza um PR de diagnóstico só para rodar o job de Windows? Hoje o escopo do loop cobre push em master e nada além disso.
3. **R7-08:** a fila móvel em segundo plano precisa de aparelho.
4. **O 1.8.21 que você publicou:** o `build-local.sh --publish` e o `build-linux.sh --publish` rodaram no mesmo checkout em que eu tinha a futura 1.8.22 aplicada e ainda não commitada. Então o binário que os feeds Linux e o `/p/tura-notes` oferecem como 1.8.21 provavelmente contém esse código. Vale republicar a partir de um checkout limpo. Para não repetir: builds num worktree separado.
5. **Deploy do tura.samirhv.com.br:** continua esperando `tools/sign-server-release.sh 1.8.0` na sua máquina.

