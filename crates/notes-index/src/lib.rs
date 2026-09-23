//! SQLite persistence. Workspace traversal and note I/O belong to notes-core.
use notes_model::CoreError;
use rusqlite::{params, Connection, OptionalExtension};
use std::{collections::BTreeMap, path::Path, time::Duration};

type Result<T> = std::result::Result<T, CoreError>;
fn sql(e: rusqlite::Error) -> CoreError {
    CoreError::Internal {
        message: format!("SQLite: {e}"),
    }
}

/// The database file exists and is `0600` before SQLite opens it (R6-27a).
///
/// SQLite creates a missing file `0644` and gives its `-wal` and `-shm` files
/// the database's own mode, so the one file decides all three. The content
/// index holds the full text of every note; an existing file is tightened too.
fn private_file(path: &Path) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
        let io = |e: std::io::Error| CoreError::io("private_db", path.display(), &e);
        match std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(path)
        {
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                let mode = std::fs::metadata(path).map_err(io)?.permissions().mode();
                if mode & 0o077 != 0 {
                    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
                        .map_err(io)?;
                }
            }
            Err(e) => return Err(io(e)),
        }
    }
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}

fn open(path: &Path, schema: &str, supported: u32) -> Result<Connection> {
    private_file(path)?;
    let mut db = Connection::open(path).map_err(sql)?;
    db.busy_timeout(Duration::from_secs(5)).map_err(sql)?;
    let found: u32 = db
        .pragma_query_value(None, "user_version", |r| r.get(0))
        .map_err(sql)?;
    if found > supported {
        return Err(CoreError::SchemaAhead {
            store: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned(),
            found,
            supported,
        });
    }
    db.pragma_update(None, "journal_mode", "WAL").map_err(sql)?;
    db.pragma_update(None, "synchronous", "NORMAL")
        .map_err(sql)?;
    db.pragma_update(None, "foreign_keys", "ON").map_err(sql)?;
    if found < supported {
        let tx = db.transaction().map_err(sql)?;
        tx.execute_batch(schema).map_err(sql)?;
        tx.pragma_update(None, "user_version", supported)
            .map_err(sql)?;
        tx.commit().map_err(sql)?;
    }
    Ok(db)
}

/// Operational identity snapshot, kept in a separate database from derived data.
/// The serialized shape is the existing versioned registry, preserving all fields.
pub struct RegistryStore(Connection);
impl RegistryStore {
    pub fn open(path: &Path) -> Result<Self> {
        open(
            path,
            "CREATE TABLE registry (id INTEGER PRIMARY KEY CHECK(id=1), payload BLOB NOT NULL);",
            1,
        )
        .map(Self)
    }
    pub fn read(&self) -> Result<Option<Vec<u8>>> {
        self.0
            .query_row("SELECT payload FROM registry WHERE id=1", [], |r| r.get(0))
            .optional()
            .map_err(sql)
    }
    pub fn write_merged(&mut self, baseline: Option<&[u8]>, bytes: &[u8]) -> Result<()> {
        let tx = self
            .0
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .map_err(sql)?;
        let current: Option<Vec<u8>> = tx
            .query_row("SELECT payload FROM registry WHERE id=1", [], |r| r.get(0))
            .optional()
            .map_err(sql)?;
        let parse = |b: &[u8]| {
            serde_json::from_slice::<serde_json::Value>(b).map_err(|e| CoreError::Internal {
                message: format!("registry data: {e}"),
            })
        };
        let wanted = parse(bytes)?;
        let base = baseline
            .map(parse)
            .transpose()?
            .unwrap_or_else(|| serde_json::json!({}));
        let mut merged = current
            .as_deref()
            .map(parse)
            .transpose()?
            .unwrap_or_else(|| serde_json::json!({}));
        if current.is_none() {
            merged = wanted;
        } else {
            merge_object(&mut merged, &base, &wanted, true)?;
        }
        let mut paths = std::collections::BTreeSet::new();
        if let Some(notes) = merged.get("notes").and_then(|v| v.as_object()) {
            for note in notes.values() {
                if let Some(path) = note.get("path").and_then(|v| v.as_str()) {
                    if !paths.insert(path) {
                        return Err(CoreError::Unsupported {
                            cap: "concurrent identity assignment; reopen the workspace".into(),
                        });
                    }
                }
            }
        }
        let payload = serde_json::to_vec(&merged).map_err(|e| CoreError::Internal {
            message: e.to_string(),
        })?;
        tx.execute("INSERT INTO registry VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",[payload]).map_err(sql)?;
        tx.commit().map_err(sql)
    }
    pub fn write(&mut self, bytes: &[u8]) -> Result<()> {
        let tx = self.0.transaction().map_err(sql)?;
        tx.execute("INSERT INTO registry VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload", [bytes]).map_err(sql)?;
        tx.commit().map_err(sql)
    }
}

pub struct Seen {
    pub path: String,
    pub size: u64,
    pub mtime: String,
}
pub struct Cached {
    pub size: u64,
    pub mtime: String,
    pub hash: String,
}
pub struct Indexed<'a> {
    pub seen: &'a Seen,
    pub hash: &'a str,
    pub text: &'a str,
}
pub struct WordHit {
    pub path: String,
    pub line: u32,
    pub col: u32,
    pub context: String,
}
/// The full-text index.
///
/// `fts_rowids` is the fix for a quadratic build (R6-12). The `fts` table keys
/// its rows by `rowid`, and `path` is `UNINDEXED` in it, so `DELETE FROM fts
/// WHERE path=?` is a scan of the whole virtual table — once per note, over a
/// table that grows to every note: 35.8 s for a cold build of 3 000 notes of
/// ~22 KB and 75.5 s for a forced one, measured before this. The map is read
/// **once** by [`Index::plan`], a single scan, and every delete after it goes by
/// `rowid`. Making `rowid` match `notes` instead would have been the textbook
/// answer and a schema change, which forces every user to reindex and makes the
/// release a minor; this needed neither.
///
/// Without a `plan()` first, the old delete by path still runs — slow, and
/// correct.
pub struct Index {
    conn: Connection,
    fts_rowids: Option<std::collections::HashMap<String, i64>>,
}
impl Index {
    pub fn open(path: &Path) -> Result<Self> {
        open(path, "DROP TABLE IF EXISTS notes; DROP TABLE IF EXISTS fts; CREATE TABLE notes(path TEXT PRIMARY KEY, size INTEGER NOT NULL, mtime TEXT NOT NULL, hash TEXT NOT NULL, document TEXT NOT NULL);
            CREATE VIRTUAL TABLE fts USING fts5(path UNINDEXED, text, tokenize='unicode61 remove_diacritics 2');", 2).map(|conn| Self { conn, fts_rowids: None })
    }
    pub fn documents(&self) -> Result<Vec<(String, notes_markdown::Document)>> {
        let mut q = self
            .conn
            .prepare("SELECT path,document FROM notes ORDER BY path")
            .map_err(sql)?;
        let rows = q
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
            .map_err(sql)?;
        rows.map(|row| {
            let (p, d) = row.map_err(sql)?;
            let d = serde_json::from_str(&d).map_err(|e| CoreError::Internal {
                message: format!("index document: {e}"),
            })?;
            Ok((p, d))
        })
        .collect()
    }
    pub fn plan(&mut self) -> Result<BTreeMap<String, Cached>> {
        let rowids = {
            let mut q = self
                .conn
                .prepare("SELECT rowid, path FROM fts")
                .map_err(sql)?;
            let rows = q
                .query_map([], |r| Ok((r.get::<_, String>(1)?, r.get::<_, i64>(0)?)))
                .map_err(sql)?;
            rows.collect::<std::result::Result<std::collections::HashMap<_, _>, _>>()
                .map_err(sql)?
        };
        self.fts_rowids = Some(rowids);
        let mut q = self
            .conn
            .prepare("SELECT path,size,mtime,hash FROM notes")
            .map_err(sql)?;
        let rows = q
            .query_map([], |r| {
                Ok((
                    r.get(0)?,
                    Cached {
                        // A SQLite INTEGER *is* an i64, and rusqlite 0.40 stopped
                        // pretending otherwise: it dropped the `u64` impls rather
                        // than keep a conversion that can fail at runtime. The
                        // cast lives here, at the one boundary that has to know,
                        // and `size` stays `u64` for every caller. Nothing about
                        // the stored bytes changes, so no reindex is forced — a
                        // file large enough to lose information here would have to
                        // exceed 8 EiB.
                        size: r.get::<_, i64>(1)? as u64,
                        mtime: r.get(2)?,
                        hash: r.get(3)?,
                    },
                ))
            })
            .map_err(sql)?
            .collect::<std::result::Result<_, _>>()
            .map_err(sql);
        rows
    }
    pub fn apply(&mut self, note: Indexed<'_>, reparse: bool) -> Result<()> {
        let Index { conn, fts_rowids } = self;
        let tx = conn.transaction().map_err(sql)?;
        if reparse {
            let document =
                serde_json::to_string(&notes_markdown::parse(note.text)).map_err(|e| {
                    CoreError::Internal {
                        message: e.to_string(),
                    }
                })?;
            tx.execute("INSERT INTO notes VALUES(?1,?2,?3,?4,?5) ON CONFLICT(path) DO UPDATE SET size=excluded.size,mtime=excluded.mtime,hash=excluded.hash,document=excluded.document", params![note.seen.path,note.seen.size as i64,note.seen.mtime,note.hash,document]).map_err(sql)?;
            match fts_rowids.as_mut() {
                Some(map) => {
                    if let Some(rowid) = map.remove(&note.seen.path) {
                        tx.execute("DELETE FROM fts WHERE rowid=?1", [rowid])
                            .map_err(sql)?;
                    }
                    tx.execute(
                        "INSERT INTO fts(path,text) VALUES(?1,?2)",
                        params![note.seen.path, note.text],
                    )
                    .map_err(sql)?;
                    map.insert(note.seen.path.clone(), tx.last_insert_rowid());
                }
                None => {
                    tx.execute("DELETE FROM fts WHERE path=?1", [&note.seen.path])
                        .map_err(sql)?;
                    tx.execute(
                        "INSERT INTO fts VALUES(?1,?2)",
                        params![note.seen.path, note.text],
                    )
                    .map_err(sql)?;
                }
            }
        } else {
            tx.execute(
                "UPDATE notes SET size=?2,mtime=?3 WHERE path=?1",
                params![note.seen.path, note.seen.size as i64, note.seen.mtime],
            )
            .map_err(sql)?;
        }
        tx.commit().map_err(sql)
    }
    pub fn remove(&mut self, paths: &[String]) -> Result<()> {
        let Index { conn, fts_rowids } = self;
        let tx = conn.transaction().map_err(sql)?;
        for p in paths {
            tx.execute("DELETE FROM notes WHERE path=?1", [p])
                .map_err(sql)?;
            match fts_rowids.as_mut() {
                Some(map) => {
                    if let Some(rowid) = map.remove(p) {
                        tx.execute("DELETE FROM fts WHERE rowid=?1", [rowid])
                            .map_err(sql)?;
                    }
                }
                None => {
                    tx.execute("DELETE FROM fts WHERE path=?1", [p])
                        .map_err(sql)?;
                }
            }
        }
        tx.commit().map_err(sql)
    }
    pub fn words(&self, query: &str, limit: usize) -> Result<Vec<WordHit>> {
        let terms: Vec<_> = query
            .split(|c: char| !c.is_alphanumeric())
            .filter(|s| !s.is_empty())
            .map(|s| format!("\"{s}\""))
            .collect();
        if terms.is_empty() {
            return Ok(Vec::new());
        }
        let mut stmt = self.conn.prepare("SELECT path,highlight(fts,1,char(1),char(2)) FROM fts WHERE fts MATCH ?1 ORDER BY rank,path LIMIT ?2").map_err(sql)?;
        let rows = stmt
            .query_map(params![terms.join(" AND "), limit as i64], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            })
            .map_err(sql)?;
        rows.map(|row| {
            let (path, text) = row.map_err(sql)?;
            let first = text.find('\u{1}').unwrap_or(0);
            let before = &text[..first];
            let line = before.bytes().filter(|b| *b == b'\n').count() as u32 + 1;
            let col = before.rsplit('\n').next().unwrap_or("").chars().count() as u32 + 1;
            let context = text
                .lines()
                .nth(line as usize - 1)
                .unwrap_or("")
                .replace(['\u{1}', '\u{2}'], "")
                .chars()
                .take(240)
                .collect();
            Ok(WordHit {
                path,
                line,
                col,
                context,
            })
        })
        .collect()
    }
}

fn merge_object(
    current: &mut serde_json::Value,
    base: &serde_json::Value,
    wanted: &serde_json::Value,
    top: bool,
) -> Result<()> {
    let empty = serde_json::Map::new();
    let a = base.as_object().unwrap_or(&empty);
    let b = wanted.as_object().unwrap_or(&empty);
    let keys = a
        .keys()
        .chain(b.keys())
        .collect::<std::collections::BTreeSet<_>>();
    let object = current.as_object_mut().ok_or_else(|| CoreError::Internal {
        message: "registry is not an object".into(),
    })?;
    for key in keys {
        if a.get(key) == b.get(key) {
            continue;
        }
        if top && key == "notes" {
            let target = object
                .entry(key.clone())
                .or_insert_with(|| serde_json::json!({}));
            merge_object(
                target,
                a.get(key).unwrap_or(&serde_json::Value::Null),
                b.get(key).unwrap_or(&serde_json::Value::Null),
                false,
            )?;
        } else {
            if object.get(key) != a.get(key) && object.get(key) != b.get(key) {
                return Err(CoreError::Unsupported {
                    cap: "identity registry changed in another process; reopen the workspace"
                        .into(),
                });
            }
            match b.get(key) {
                Some(value) => {
                    object.insert(key.clone(), value.clone());
                }
                None => {
                    object.remove(key);
                }
            }
        }
    }
    Ok(())
}
