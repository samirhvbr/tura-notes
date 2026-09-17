---
n: 13
kind: ASK
sinal: handoff
confianca: alta
ts: 2026-09-17T15:26:13-03:00
sessao: 36de2a23-371b-4493-b693-f19e4485e8ba
item_da_fila: "R4d — roteiro de aceite do **0.1d** (interface), no formato que o `ACCEPTANCE-0.1d.md` já usa: passos que o dono percorre num release instalado, com o que observar em cada um. Só comportamento observável; nada que um teste automatizado já cubra"
decisao: continuou
fecho_do_turno: completo
respondida: false
---
## Por que ASK
- entrega de bastão no fecho (\bsigo (?:com|por|para|pra)\b)
- sem `?` — handoff é o único sinal; detector de pontuação erraria aqui
- 2 item(ns) pendente(s) colhido(s) do fecho

## Itens colhidos para a fila
- [ ] o   não cobre nada da interface que saiu depois dele (gaveta, barra de Markdown, aviso de backend não atômico)
- [ ] o   idem, e **o   não existe** — embora a fila diga que o que resta do 0.6 é justamente aceite do dono. Sigo por eles

## Mensagem original

**Bloqueado num ponto, e é uma linha sua — dois comandos:**

```
! sudo modprobe kvm_amd
! sudo usermod -aG kvm $USER     # e relogar
```

Baixei tudo que você autorizou: `emulator`, `platform-tools`, a system image `android-35;google_apis;x86_64`, licenças aceitas, AVD `tura` criado (Pixel 6, API 35). **O que falta não é download.** O emulador x86_64 exige KVM e `/dev/kvm` não existe. Diagnóstico exato: sua CPU é AMD e expõe a flag `svm`, então a virtualização **já está ligada na BIOS** — falta o módulo carregado e você no grupo. Sem isso ele morre em `x86_64 emulation currently requires hardware acceleration`.

Enquanto isso a fila andou — 4 de 7, e os três restantes são roteiros de aceite que não dependem de emulador:

**1.6.19 — `.loop/` commitado, ADR-083.** Sua resposta foi "tudo, com uma ADR". A parte difícil era o idioma: a regra é inglês com três ressalvas e `.loop/` não é nenhuma. A ADR decide que ele entra na mesma ressalva do `.continue/` — trabalho em curso, escrito na língua de quem pensa — com a linha desenhada estreita: *diretório cujo conteúdo é trabalho em curso, não produto do trabalho*. E diz que é decisão **local**, porque o bloco de idioma é eco regenerado do repodocs e seria apagado sem ninguém notar; generalizar passa por lá, como ADR-009 e ADR-010 passaram.

**1.6.20 — `docs/OWNER-ACTS.md`.** E ler o script achou a fila errada sobre o próprio procedimento: ela mandava assinar "a versão corrente", mas `sign-server-release.sh` recusa o que não for `X.Y.0` — assinatura sai só em minor. **A versão a assinar é 1.6.0**, cujos dois anexos eu conferi na Release em vez de assumir. A página registra a ordem em que o script trabalha, porque a ordem é a substância: checksum **antes** de assinar (assinar download truncado publica assinatura válida sobre bytes errados, que passa na verificação do deploy e instala binário que não roda), e verificação contra a metade pública **commitada**, não contra a chave que acabou de assinar.

Restam R4d, R4e e R4f — e ali achei três lacunas reais: o `ACCEPTANCE-0.1d.md` não cobre nada da interface que saiu depois dele (gaveta, barra de Markdown, aviso de backend não atômico), o `ACCEPTANCE-0.5.md` idem, e **o `ACCEPTANCE-0.6.md` não existe** — embora a fila diga que o que resta do 0.6 é justamente aceite do dono. Sigo por eles.

