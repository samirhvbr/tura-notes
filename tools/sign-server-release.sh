#!/usr/bin/env bash
# Assina o tarball do notes-server de uma release, com uma chave que o CI nunca
# teve. ADR-081.
#
# POR QUE ISTO EXISTE. `deploy-server.sh` baixa o tarball e o `.sha256` da mesma
# URL do GitHub, e o `build.yml` produz os dois no mesmo passo, no mesmo runner.
# Quem estiver em posição de servir outro tarball está em posição de servir o
# digest dele. O checksum responde "chegou inteiro?", e nada além disso.
#
#   tools/sign-server-release.sh init        # uma vez, gera o par
#   tools/sign-server-release.sh 1.5.0       # assina e anexa a assinatura
#
# A METADE PRIVADA NUNCA ENTRA NO REPOSITÓRIO NEM NO CI. Fica em
# `~/.config/tura-notes/notes-server.key` (ou `TURA_SERVER_KEY`), e é uma chave
# SEPARADA da do atualizador: a do atualizador vai embarcada em toda aplicação
# desktop instalada, e uma chave que empurra atualização de desktop e binário de
# servidor é um comprometimento com dois raios de explosão.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBKEY="$ROOT/server/cotenant/notes-server.pub"
SECKEY="${TURA_SERVER_KEY:-$HOME/.config/tura-notes/notes-server.key}"
REPO_SLUG="${TURA_REPO_SLUG:-samirhvbr/tura-notes}"

die() { echo "sign-server-release: $1" >&2; exit 1; }
command -v minisign >/dev/null 2>&1 || die "minisign não está instalado (brew install minisign / apt install minisign)"

if [ "${1:-}" = "init" ]; then
    # Recusa em vez de sobrescrever, e essa é a regra inteira: gerar por cima de
    # uma chave em uso invalida silenciosamente toda assinatura já publicada, e
    # o sintoma aparece num deploy, num host que está servindo.
    [ -e "$SECKEY" ] && die "já existe uma chave privada em $SECKEY — não vou sobrescrever"
    [ -e "$PUBKEY" ] && die "já existe uma chave pública em $PUBKEY — não vou sobrescrever"
    mkdir -p "$(dirname "$SECKEY")" || die "não consegui criar $(dirname "$SECKEY")"
    chmod 0700 "$(dirname "$SECKEY")" 2>/dev/null
    minisign -G -p "$PUBKEY" -s "$SECKEY" || die "minisign -G falhou"
    chmod 0600 "$SECKEY" || die "não consegui restringir $SECKEY"
    echo
    echo "Metade privada: $SECKEY  (NÃO versione, faça backup fora do repositório)"
    echo "Metade pública: $PUBKEY  (commite este arquivo)"
    exit 0
fi

version="${1:-}"
[ -n "$version" ] || die "uso: $0 init | $0 X.Y.0"
echo "$version" | grep -Eq '^[0-9]+\.[0-9]+\.0$' \
    || die "assinatura é por release de anexos, que sai só em minor (X.Y.0); recebi '$version'"
[ -f "$SECKEY" ] || die "sem chave privada em $SECKEY — rode '$0 init' uma vez"
[ -f "$PUBKEY" ] || die "sem chave pública em $PUBKEY — rode '$0 init' uma vez"
command -v gh >/dev/null 2>&1 || die "gh não está instalado"

name="notes-server-$version-x86_64-linux.tar.gz"
work="$(mktemp -d)" || die "não consegui criar diretório temporário"
trap 'rm -f "$work/$name" "$work/$name.sha256" "$work/$name.minisig"; rmdir "$work" 2>/dev/null' EXIT

echo "==> baixando $name da release $version"
gh release download "$version" --repo "$REPO_SLUG" --dir "$work" \
    --pattern "$name" --pattern "$name.sha256" \
    || die "a release $version não traz $name (o build de anexos rodou?)"

# O checksum antes de assinar. Assinar um download truncado publica uma
# assinatura válida sobre bytes errados, que é pior que não assinar: passa a
# verificação do deploy e instala um binário que não executa.
( cd "$work" && sha256sum -c "$name.sha256" >/dev/null ) || die "checksum de $name não confere; não assinei"

echo "==> assinando com $SECKEY"
( cd "$work" && minisign -Sm "$name" -s "$SECKEY" \
    -t "tura-notes $version notes-server x86_64-linux" >/dev/null ) || die "minisign -S falhou"

# Verifica contra a metade PÚBLICA COMMITADA, não contra a privada que acabou de
# assinar. É o que pega a chave errada — um par antigo, um backup restaurado —
# aqui, e não num host que está servindo.
( cd "$work" && minisign -Vm "$name" -p "$PUBKEY" >/dev/null ) \
    || die "a assinatura não confere com $PUBKEY: a chave privada usada não é o par da que está commitada"

echo "==> anexando $name.minisig à release $version"
gh release upload "$version" "$work/$name.minisig" --repo "$REPO_SLUG" --clobber \
    || die "upload da assinatura falhou"
echo "✅ $version assinada e publicada"
