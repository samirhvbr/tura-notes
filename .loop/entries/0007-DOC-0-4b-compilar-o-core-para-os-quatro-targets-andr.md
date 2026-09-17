---
n: 7
kind: DOC
sinal: relato
confianca: alta
ts: 2026-09-17T13:10:08-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "0.4b — compilar o core para os quatro targets Android já instalados (`cargo build -p notes-core --target aarch64-linux-android` e os outros três) e transformar isso num passo do gate, se for barato; é a evidência de compilação que o `ACCEPTANCE-0.4.md` diz existir para iOS e não existe para Android"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- marcas de relato: 2

## Mensagem original

Rodada 2: **10 feitos, 3 na fila.** Quatro versões empurradas, `Latest` em 1.6.11, 187 versões com Release, nenhuma faltando.

**1.6.9 — o carimbo, reproduzido e fechado.** Não era escritor misterioso. Os dois scripts fazem copiar-carimbar-construir-restaurar; cada um está certo sozinho e o par não compõe — o segundo build copia um arquivo já carimbado e a restauração dele torna isso permanente. O repro precisava do carimbo **de pé pela duração do build**: sem isso, 80 ciclos não reproduzem, que é exatamente por que minha primeira passada concluiu "não reproduzível". E o guard teve que ir **antes da cópia**: eu o pus primeiro dentro do `stamp-version.sh` e o race sobreviveu, porque o dano está na cópia, não no carimbo.

**1.6.10 — o intermitente do gate não fechou, e o item diz isso.** O que caiu foi a barreira: `ApplicationBlocked` nascia de 29 `.map_err(|_| ...)` que jogavam fora o erro de baixo. Era indiagnosticável por construção — doze execuções não disseram nada porque não havia o que dizer. Agora a variante carrega a causa. `Error::Busy` ficou intacto, então contenção de lock continua lendo como contenção. O próximo passo não é investigar, é esperar a próxima ocorrência, que se nomeia.

**1.6.11 — o projeto Android está no repositório.** A máquina já estava provisionada (NDK 28.2, platforms 34–36, os quatro targets Rust); faltava só exportar duas variáveis. 40 arquivos, 388 KB, sem build output nem material de assinatura — conferido com `--untracked-files=all`, não assumido.

**Uma coisa que decidi não fazer.** O item mandava escrever um documento novo para o 0.4. Não escrevi: o `ACCEPTANCE-0.4.md` já é a lista do que falta e está `ACTIVE`, e um segundo com o mesmo conteúdo é a duplicação que o `docs/repodocs.md` manda checar antes de criar arquivo. Emendei o existente no mesmo commit.

Na sua coluna, o que eu não alcanço: **iOS precisa de um Mac** (Android eu sigo daqui), MinGW, assinatura do binário do servidor, anexo do 1.4.0, validação da atualização nos quatro formatos, máquina Windows, aceites em release instalado — e a pergunta sobre a **outra sessão** que estava escrevendo no tree principal, que agora commitou e empurrou o `1.6.7`.

Quadro: https://claude.ai/artifact/7PjQHdRBS4t2wSJZWA8ZLR

