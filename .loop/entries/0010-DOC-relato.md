---
n: 10
kind: DOC
sinal: relato
confianca: alta
ts: 2026-09-17T13:28:45-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: ""
decisao: encerrou: fila zerada
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- marcas de relato: 2

## Mensagem original

**Fila zerada: 14 de 14.** Oito versões empurradas na rodada 2, `Latest` em 1.6.15, nenhuma versão sem Release.

**1.6.15 — a barra de Markdown**, último item do bullet de interface do `ACCEPTANCE-0.4.md`, que agora está riscado inteiro.

Seis marcas abaixo de 720px, cada ação um toggle — barra cujo botão de negrito só adiciona asteriscos ensina o usuário a pegar o teclado para desfazer, que é justamente o teclado que ela existe para evitar.

**A lógica virou módulo puro, e isso pagou na hora.** CodeMirror não roda sob jsdom, então código dentro de handler é código não testado por construção; separado, são 14 testes sobre onde o cursor cai e o que uma seleção vazia faz. **Um deles achou bug real antes de qualquer coisa rodar em navegador:** o desembrulho calculava o fim da seleção a partir do início *antigo* — parece simétrico e erra pelo tamanho da seleção, então apertar negrito duas vezes deixava a seleção passando do texto que acabara de desembrulhar. O teste que pegou é o que aperta duas vezes a partir do estado exato que a primeira deixa.

Dois detalhes que são sobre telefone, não sobre Markdown: a ação é uma transação só, então é um undo em vez de uma reescrita desfeita caractere a caractere; e o `mousedown` é prevenido, porque tirar o foco do editor fecharia o teclado antes de a ação acontecer.

O que **não** está testado é o despacho no CodeMirror. Está escrito no CHANGELOG em vez de assumido — precisa de aparelho, que é item seu.

---

Uma decisão que mudei de ideia e não executei sozinho: eu tinha assumido commitar `.loop/` no fecho da rodada. Não commitei, e a razão é melhor que a anterior — `.loop/entries/` são arquivos dos meus relatos **em português**, e a regra de idioma do repositório tem três exceções nomeadas das quais `.loop/` não é nenhuma. Exceção nova pede ADR, não uma decisão minha no fim de uma rodada. Está no quadro, com o argumento dos dois lados.

Na sua coluna, dez linhas — e as que mais destravam trabalho meu são **emulador Android** (sem ele o SAF fica em contrato e o app gerado nunca roda) e **MinGW** (sem ele o gate fecha vermelho aqui e eu sigo de escotilha).

