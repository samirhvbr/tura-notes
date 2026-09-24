---
n: 31
kind: DOC
sinal: relato
confianca: alta
ts: 2026-09-23T17:59:08-03:00
sessao: cf91c092-dbd4-4bbf-a3af-6fba8e51f594
item_da_fila: "R7-10 — **o checkpoint ainda valida o estado inteiro a cada gravacao** (`crates/notes-sync-client/src/state.rs`, `validate`). Resto do R6-15 depois de 1.8.5: cada publicacao recebida agora e decodificada uma vez por validacao, nao duas, mas um passe grava ate 20 checkpoints e cada um valida tudo. No teto (32 MiB decodificados) isso ainda e ~20 decodificacoes completas por passe. Caminho: payload recebido e imutavel depois de aceito, entao validar cada publicacao **uma vez** quando entra (`fetch_into`) e, nas gravacoes seguintes, so as invariantes estruturais e as novas; guardar um resumo verificado por publicacao no proprio estado. Cuidado: e a rede de seguranca contra gravar estado invalido — o teste tem de provar que estado corrompido continua recusado"
decisao: continuou
fecho_do_turno: completo
respondida: n/a
---
## Por que DOC
- marcas de relato: 1

## Mensagem original

1.8.5 pushed and waiting on CI; 1.8.10 gate still running. R7-10 is next: a per-process record of received payloads already verified, keyed on exact equality, so each checkpoint stops re-decoding all of them.

