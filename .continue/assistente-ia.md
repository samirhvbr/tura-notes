# Assistente de IA para criar e editar documentos

> Especificação de trabalho **não construído**. Sai da fila quando o chat existir
> e funcionar num release instalado. Decisão: [ADR-100](../docs/decisions.md#adr-100--an-opt-in-ai-assistant-calls-the-provider-from-rust-keeps-the-key-in-the-system-keychain-and-edits-the-open-note-through-the-editor).
> **Estado em 01/10: os seis blocos estão construídos (1.10.0 a 1.10.5).** Falta só o aceite do dono com a chave real ([ACCEPTANCE-AI.md](../docs/ACCEPTANCE-AI.md)); o documento sai daqui quando ele passar.
>
> Respostas do dono em 29/09: Anthropic **e** compatível com OpenAI; chave no
> chaveiro do sistema; contexto = nota atual + o que ele anexar; a IA edita
> direto e o dono desfaz.

## O que o dono vê

1. **Configurações → Assistente de IA** (desligado por padrão, ADR-007):
   - interruptor "Ativar assistente de IA", com a frase fixa: *o texto que você
     enviar sai desta máquina para o provedor escolhido*;
   - provedores, um ou mais, cada um com:
     - tipo: **Anthropic** ou **compatível com OpenAI** (OpenAI, OpenRouter,
       Ollama, LM Studio…);
     - para o compatível: URL base (`https://…/v1`; `http://` só para
       `localhost`/`127.0.0.1`, que é o caso do Ollama);
     - **chave de API**: campo só de escrita. Depois de salva mostra
       `configurada · ••••1234`, com **Testar** e **Remover**. Nunca volta para
       a tela inteira;
     - modelo: lista vinda do provedor (`GET /v1/models`) no **Testar**, com
       campo livre de reserva. Padrão Anthropic: `claude-opus-5-5`;
   - provedor padrão do chat.
2. **Painel do chat** (lateral, como a busca; atalho a definir, por exemplo
   Ctrl+Shift+A):
   - cabeçalho com provedor/modelo e **o que vai junto**: chips "Nota atual"
     (e "Seleção", quando há), mais notas anexadas por "+ Anexar nota"
     (quick-open). Cada chip pode ser removido antes de enviar;
   - conversa com resposta **em streaming**, botão **Parar**;
   - a IA **edita a nota direto** quando o pedido é de escrita ("escreve uma
     introdução", "reescreve este parágrafo", "cria uma nota com…"). A edição
     entra no buffer do editor como **uma transação**, então **um Ctrl+Z desfaz
     tudo o que a IA fez naquele turno**; o autosave segue o caminho normal;
   - toda edição aplicada aparece no chat como um cartão "Editou *nota.md* —
     Desfazer", que também desfaz.
3. **Sem chave, sem chaveiro ou sem rede:** o painel diz o que falta e onde
   resolver. Nunca um erro genérico.

## Como funciona por dentro

- **Crate novo `crates/notes-ai`** (bump Y): provedores atrás de um trait
  `Provider { models(), stream(request) }`.
  - **Anthropic**: `POST https://api.anthropic.com/v1/messages` com
    `x-api-key`, `anthropic-version: 2023-06-01` e `"stream": true`. Lê o SSE
    (`message_start`, `content_block_delta`/`text_delta`, `message_delta` com
    `stop_reason`, `message_stop`). Pensamento adaptativo, com `effort`
    configurável (padrão `medium`). Trata `stop_reason: "refusal"` e
    `max_tokens` como estados próprios, não como erro genérico.
    `GET /v1/models` valida a chave e enche a lista.
  - **Compatível com OpenAI**: `POST {base}/chat/completions` com
    `stream: true` (`data: {choices[0].delta.content}` … `data: [DONE]`) e
    `GET {base}/models`.
  - HTTP pelo `reqwest` que o workspace já usa, com TLS nativo e timeouts.
- **Chave no chaveiro do sistema** (crate `keyring`: Keychain no macOS,
  Credential Manager no Windows, Secret Service no Linux). Serviço
  `br.com.samirhv.notes`, conta `ai:<id-do-provedor>`. O `settings.json` guarda
  só tipo, URL, modelo e `key_configured: bool`. **A chave nunca cruza o IPC**:
  os comandos são `ai_key_set(provider, key)`, que o Rust grava e esquece,
  `ai_key_clear`, `ai_test` e `ai_models`. No Linux sem Secret Service, o
  assistente fica indisponível, com aviso. Não há fallback para arquivo.
  Android fica fora no começo (o `keyring` não o cobre).
- **Chat sai do Rust, nunca do webview.** O CSP continua `connect-src ipc:`.
  Comando `ai_chat_start(conversation, context)` → eventos Tauri
  `ai:delta` / `ai:done` / `ai:error`; `ai_chat_cancel(id)`.
- **Contexto montado no Rust** a partir de caminhos (nota atual, anexadas), lido
  pelo core com a mesma guarda de raiz de sempre (`WorkspaceService::read_text`,
  só leitura, só notas). O frontend manda caminhos, e um único texto: a **seleção**,
  que só existe no editor e que o usuário escolheu. Limite de tamanho por nota e
  total, dito na tela quando corta (construído no bloco 4, 1.10.3).
- **Edição direta, pelo editor**: o modelo recebe duas ferramentas,
  `edit_note(path, operation, text)` (substituir seleção, inserir no cursor,
  substituir a nota inteira) e `create_note(path, text)`.
  - `edit_note` na nota aberta vira evento para o frontend, que aplica numa
    transação do CodeMirror (desfazer nativo) e salva pelo caminho normal
    (BaseRev, rascunho, conflito — nada novo).
  - `edit_note` numa nota não aberta abre a nota antes, para que o desfazer
    exista.
  - `create_note` usa o `create` do core.
  - Nenhuma escrita de arquivo sai do `notes-ai`.
- **Nada novo vai para dentro das notas** (sem metadados), e a conversa não é
  gravada em disco na primeira versão (fica na memória da janela).
- **Auditoria mínima local:** nenhum log com conteúdo. Só contagem de chamadas
  e erros no console de desenvolvimento.

## Blocos de construção (cada um é commit, gate e CI verde)

1. `notes-ai` + provedor Anthropic + SSE + testes contra servidor local falso
   (sem gastar crédito).
2. Provedor compatível com OpenAI + testes (inclui Ollama em `http://localhost`).
3. Chaveiro + settings + comandos (`ai_key_*`, `ai_test`, `ai_models`) + a
   seção de Configurações.
4. Painel do chat com streaming, contexto e cancelamento.
5. Ferramentas de edição (`edit_note`, `create_note`) aplicadas pelo editor
   com desfazer, e o cartão "Editou — Desfazer".
6. Docs (`docs/AI.md`, `security.md` §2 com a nova superfície), e o aceite
   com a chave real do dono.

## Fora desta versão

Busca no workspace inteiro (RAG), histórico de conversa em disco, Android,
anexar PDF ou imagem, e cobrança/uso por provedor na tela.
