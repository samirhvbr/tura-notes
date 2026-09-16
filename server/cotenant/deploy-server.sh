#!/usr/bin/env bash
# Atualiza o notes-server implantado neste host. Feito para ser descoberto pelo
# orquestrador /srv/www/deploy.sh, através de um symlink:
#
#   /srv/www/tura.samirhv.com.br/
#   ├── deploy.sh -> repo/server/cotenant/deploy-server.sh
#   └── repo/                       (o checkout deste repositório)
#
# POR QUE O CHECKOUT NÃO PODE FICAR EM /srv/www/tura-notes. O orquestrador roda
# todo `/srv/www/*/deploy.sh`, e a raiz DESTE repositório já tem um `deploy.sh`
# — o alias do build do app desktop (ADR-072). Com o checkout um nível acima, o
# deploy-all encontrava aquele arquivo e rodava a linha de empacotamento no
# servidor web: falhou só por não haver `rustc` ali. Um nível abaixo, o scanner
# (que varre um nível só) enxerga o symlink e mais nada.
#
# O QUE ESTE SCRIPT FAZ, e o que deliberadamente não faz. Ele reinstala o que o
# repositório versiona — a unidade systemd, o vhost, o wrapper de credenciais —
# e o binário do servidor quando a release muda. Ele não toca no `/var/lib/
# notes-server`: as notas estão ali, e um deploy que mexe em dado de usuário é
# um deploy que uma hora perde dado de usuário. Backup é operação separada e
# explícita (docs/SERVER-0.5.md).
#
# Requisito: root. Idempotente: sai cedo dizendo "nada novo" quando não há o que
# fazer, que é o que o resumo do orquestrador mostra como "sem novidades".
set -uo pipefail

BINARY=/usr/local/bin/notes-server
WRAPPER=/usr/local/bin/tura-credential
UNIT=/etc/systemd/system/notes-server.service
VHOST=/etc/apache2/sites-available/tura.samirhv.com.br.conf
STAMP=/usr/local/share/tura-notes/installed-version
HEALTH_URL="${TURA_HEALTH_URL:-https://tura.samirhv.com.br/healthz}"

log() { printf '[%(%H:%M:%S)T] %s\n' -1 "$*"; }
fail() { log "❌ $*"; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "rode como root: sudo bash $0"

# ── Imunidade à auto-modificação ─────────────────────────────────────────────
# Este script roda `git pull` no repositório que o contém, e o bash lê o arquivo
# conforme executa: trocar o arquivo embaixo dele faz o que roda depois do pull
# não ser, de forma confiável, o arquivo que começou a rodar. O deploy do
# samirhv.com.br documenta o caso real em que isso pulou um passo em silêncio e
# ainda assim reportou sucesso. A cópia corta o problema na raiz.
#
# A CONSEQUÊNCIA, ESCRITA: uma alteração NESTE arquivo vale no deploy SEGUINTE,
# nunca no que a trouxe. É a troca desejada.
if [ "${TURA_DEPLOY_PINNED:-0}" != "1" ]; then
    REPO="$(cd "$(dirname "$(realpath "${BASH_SOURCE[0]}")")/../.." && pwd)"
    PINNED=$(mktemp /run/tura-deploy.XXXXXX)
    cp -- "$(realpath "${BASH_SOURCE[0]}")" "$PINNED"
    export TURA_DEPLOY_PINNED=1 TURA_DEPLOY_PINNED_FILE="$PINNED" TURA_REPO="$REPO"
    exec bash "$PINNED" "$@"
fi
trap 'rm -f "${TURA_DEPLOY_PINNED_FILE:-}"' EXIT

REPO="${TURA_REPO:?}"
[ -d "$REPO/.git" ] || fail "$REPO não é um checkout git"

exec 9>/run/tura-deploy.lock
flock -n 9 || fail "outro deploy do Tura já está rodando"

OWNER=$(stat -c '%U' "$REPO")
asowner() { if [ "$(id -un)" = "$OWNER" ]; then "$@"; else sudo -u "$OWNER" "$@"; fi; }

log "==> Repo: $REPO | Dono: $OWNER"

# ── 1. Trazer o repositório ──────────────────────────────────────────────────
before=$(asowner git -C "$REPO" rev-parse HEAD 2>/dev/null) || fail "git rev-parse falhou"
asowner git -C "$REPO" fetch --quiet origin master || fail "git fetch falhou"
asowner git -C "$REPO" merge --ff-only origin/master >/dev/null \
    || fail "fast-forward falhou (árvore divergiu? resolva à mão)"
after=$(asowner git -C "$REPO" rev-parse HEAD)

version=$(grep -oE '[0-9]+\.[0-9]+\.[0-9]+' "$REPO/version.md" | head -1)
[ -n "$version" ] || fail "sem versão em version.md"

# Os anexos de release saem nos bumps MINOR (X.Y.0), não nos patches — então a
# release que carrega o binário desta linha é sempre o X.Y.0 correspondente.
# Derivar em vez de perguntar à API do GitHub: é determinístico e não gasta as
# 60 requisições por hora que o host compartilha com o monitor do site.
target="${version%.*}.0"
installed=$(cat "$STAMP" 2>/dev/null || echo "")

log "==> Repositório $before → $after | versão $version | binário alvo $target (instalado: ${installed:-nenhum})"

# ── 2. O que mudou de fato ───────────────────────────────────────────────────
# `cmp` e não a data do commit: um arquivo pode vir no pull sem ter mudado, e
# reiniciar um serviço que guarda notas por causa de um commit que não o tocou é
# custo sem contrapartida.
changed=0
sync_file() {  # origem destino modo -> 1 quando escreveu
    local src=$1 dst=$2 mode=$3
    cmp -s "$src" "$dst" 2>/dev/null && return 1
    install -m "$mode" "$src" "$dst" || fail "não consegui instalar $dst"
    log "  ✎ $dst atualizado"
    return 0
}

restart_service=0; reload_apache=0
sync_file "$REPO/server/cotenant/notes-server.service" "$UNIT" 0644 && { restart_service=1; changed=1; }
sync_file "$REPO/server/cotenant/tura-credential" "$WRAPPER" 0755 && changed=1
sync_file "$REPO/server/cotenant/apache-tura.conf" "$VHOST" 0644 && { reload_apache=1; changed=1; }

# ── 3. Binário do servidor ───────────────────────────────────────────────────
if [ "$installed" != "$target" ]; then
    log "==> Baixando notes-server $target..."
    tmp=$(mktemp -d); trap 'rm -rf "$tmp"; rm -f "${TURA_DEPLOY_PINNED_FILE:-}"' EXIT
    base="https://github.com/samirhvbr/tura-notes/releases/download/$target"
    name="notes-server-$target-x86_64-linux.tar.gz"
    ( cd "$tmp" && curl -fsSLO "$base/$name" && curl -fsSLO "$base/$name.sha256" ) \
        || fail "download de $target falhou (a release tem o anexo de Linux?)"
    # O checksum antes de qualquer coisa tocar em /usr/local/bin. Um tarball
    # truncado instala um binário que existe e não executa.
    ( cd "$tmp" && sha256sum -c "$name.sha256" >/dev/null ) || fail "checksum de $name não confere"
    ( cd "$tmp" && tar -xzf "$name" ) || fail "não consegui extrair $name"
    install -m 0755 "$tmp/notes-server" "$BINARY" || fail "não consegui instalar $BINARY"
    mkdir -p "$(dirname "$STAMP")" && printf '%s\n' "$target" > "$STAMP"
    log "  ✎ $BINARY → $target"
    restart_service=1; changed=1
fi

if [ "$changed" -eq 0 ] && [ "$before" = "$after" ]; then
    log "✓ nada novo — repositório, arquivos e binário já estão no lugar."
    exit 0
fi

# ── 4. Aplicar ───────────────────────────────────────────────────────────────
if [ "$reload_apache" -eq 1 ]; then
    # O configtest antes do reload não é zelo: este Apache serve mais de oito
    # sites, e um vhost ruim derruba todos.
    apachectl configtest >/dev/null 2>&1 || fail "vhost inválido — Apache NÃO recarregado"
    systemctl reload apache2 || fail "reload do Apache falhou"
    log "  ↻ Apache recarregado"
fi

if [ "$restart_service" -eq 1 ]; then
    systemctl daemon-reload
    systemctl restart notes-server || fail "notes-server não reiniciou"
    log "  ↻ notes-server reiniciado"
fi

# ── 5. Conferir, nesta ordem ─────────────────────────────────────────────────
# Primeiro em loopback, porque responde à pergunta "o serviço subiu?" sem passar
# por proxy, DNS ou CDN. `/healthz` fica ATRÁS do portão do proxy confiável, por
# isso o cabeçalho: sem ele um servidor perfeito responde 403.
for _ in $(seq 1 20); do
    curl -fsS -m 3 -H 'X-Forwarded-Proto: https' http://127.0.0.1:8787/healthz >/dev/null 2>&1 && break
    sleep 0.5
done
curl -fsS -m 3 -H 'X-Forwarded-Proto: https' http://127.0.0.1:8787/healthz >/dev/null \
    || fail "o serviço não respondeu em loopback após o restart"
log "  ✓ serviço saudável em loopback"

# Depois pelo nome público, que é a pergunta "o caminho inteiro está de pé?".
if curl -fsS -m 10 "$HEALTH_URL" >/dev/null 2>&1; then
    log "  ✓ $HEALTH_URL responde"
else
    log "  ⚠️  $HEALTH_URL não respondeu — serviço de pé, caminho público não. Verifique Apache, DNS e CDN."
fi

log "✅ Deploy do Tura concluído: $(asowner git -C "$REPO" rev-parse --short HEAD) (versão $version, binário $target)"
