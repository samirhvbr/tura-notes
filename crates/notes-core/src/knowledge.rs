//! Knowledge relationships are derived from the one Markdown parser.
use crate::{Result, WorkspaceService};
use notes_fs::FileSystem;
use notes_markdown::LinkKind;
use notes_model::{CompareKey, RelPath};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use ts_rs::TS;
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct KnowledgeNote {
    pub path: RelPath,
    pub tags: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct LinkEdge {
    pub from: RelPath,
    pub to: RelPath,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct UnresolvedLink {
    pub from: RelPath,
    pub target: String,
    pub candidates: Vec<RelPath>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Knowledge {
    pub notes: Vec<KnowledgeNote>,
    pub edges: Vec<LinkEdge>,
    pub unresolved: Vec<UnresolvedLink>,
    pub partial: bool,
}

fn stem(path: &str) -> &str {
    path.strip_suffix(".markdown")
        .or_else(|| path.strip_suffix(".md"))
        .unwrap_or(path)
}
fn key(value: &str) -> Option<String> {
    let path = RelPath::parse(value).ok()?;
    let folded = CompareKey::new(&path, true);
    Some(stem(folded.as_str()).to_owned())
}
/// How many wiki lookups this process has built.
///
/// Counted because the cost of this type is *how often it is constructed*, and
/// that is an event a test can assert on. The alternative — asserting that a
/// link review finishes inside some number of milliseconds — is the wall-clock
/// shape that has produced three separate Windows flakes in this repository;
/// the number of passes over the workspace is the thing that actually changed,
/// so it is the thing measured.
static BUILDS: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Reads the counter above. For tests: a review of any number of links must
/// build exactly one.
pub fn wiki_lookups_built() -> u64 {
    BUILDS.load(std::sync::atomic::Ordering::Relaxed)
}

/// A wiki-name index over the workspace's notes.
///
/// Building it walks every path and fills two maps, so it is a **workspace-wide
/// cost** and belongs outside any loop over notes or links. `references.rs`
/// built one per link through the `candidates` helper below, which is the
/// difference between one pass and one pass per link.
pub(crate) struct WikiLookup {
    full: BTreeMap<String, Vec<RelPath>>,
    names: BTreeMap<String, Vec<RelPath>>,
}
impl WikiLookup {
    pub(crate) fn new(paths: &[RelPath]) -> Self {
        BUILDS.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let mut lookup = Self {
            full: BTreeMap::new(),
            names: BTreeMap::new(),
        };
        for path in paths {
            if let Some(k) = key(path.as_str()) {
                lookup.full.entry(k).or_default().push(path.clone());
            }
            if let Some(k) = key(path.file_name()) {
                lookup.names.entry(k).or_default().push(path.clone());
            }
        }
        lookup
    }
    pub(crate) fn candidates(&self, target: &str) -> Vec<RelPath> {
        let target = target.split('#').next().unwrap_or("").trim();
        let Some(k) = key(target.strip_prefix("./").unwrap_or(target)) else {
            return vec![];
        };
        let map = if target.contains('/') {
            &self.full
        } else {
            &self.names
        };
        map.get(&k).cloned().unwrap_or_default()
    }
}
/// One lookup, one question. Correct only where the question is asked once —
/// `wiki_candidates` below is that caller. Anything asking per link builds the
/// lookup itself and keeps it.
pub(crate) fn candidates(paths: &[RelPath], target: &str) -> Vec<RelPath> {
    WikiLookup::new(paths).candidates(target)
}
impl WorkspaceService {
    pub fn wiki_candidates(&self, target: &str) -> Result<Vec<RelPath>> {
        let paths = self
            .walk()?
            .into_iter()
            .filter(RelPath::is_note)
            .collect::<Vec<_>>();
        Ok(candidates(&paths, target))
    }
    pub fn knowledge(&self) -> Result<Knowledge> {
        let open = self.open()?;
        let status = self.index_status()?;
        let index = notes_index::Index::open(&open.dir.join("index.db"))?;
        let docs = index.documents()?;
        let paths = docs
            .iter()
            .filter_map(|(p, _)| RelPath::parse(p).ok())
            .filter(|p| open.fs.stat(p).is_ok())
            .collect::<Vec<_>>();
        // Unindexed/oversized homonyms still make a destination ambiguous.
        let live = self
            .walk()?
            .into_iter()
            .filter(RelPath::is_note)
            .collect::<Vec<_>>();
        let lookup = WikiLookup::new(&live);
        let path_set = paths.iter().cloned().collect::<BTreeSet<_>>();
        let mut edge_set = BTreeSet::new();
        let mut result = Knowledge {
            notes: vec![],
            edges: vec![],
            unresolved: vec![],
            partial: live.len() != paths.len()
                || docs.len() != paths.len()
                || status.running
                || status.stale
                || status.cancelled
                || status.error.is_some()
                || status.skipped > 0,
        };
        for (path, doc) in docs {
            let path = RelPath::parse(&path)?;
            if !path_set.contains(&path) {
                continue;
            }
            result.notes.push(KnowledgeNote {
                path: path.clone(),
                tags: doc.tags,
            });
            for link in doc.links.into_iter().filter(|l| !l.in_code) {
                let targets = match link.kind {
                    LinkKind::Wiki => lookup.candidates(&link.target),
                    LinkKind::RelativePath => {
                        let base = path.parent().unwrap_or_else(RelPath::root);
                        let target = link.target.split(['#', '?']).next().unwrap_or("");
                        notes_markdown::url::resolve_relative(&base, target)
                            .filter(|p| path_set.contains(p))
                            .into_iter()
                            .collect()
                    }
                    _ => continue,
                };
                if targets.len() == 1 {
                    let target = targets[0].clone();
                    if edge_set.insert((path.clone(), target.clone())) {
                        result.edges.push(LinkEdge {
                            from: path.clone(),
                            to: target,
                        });
                    }
                } else if link.kind == LinkKind::Wiki {
                    result.unresolved.push(UnresolvedLink {
                        from: path.clone(),
                        target: link.target,
                        candidates: targets,
                    });
                }
            }
        }
        // A bounded response; the UI labels truncation instead of suggesting completeness.
        if result.notes.len() > 1000 || result.edges.len() > 5000 || result.unresolved.len() > 1000
        {
            result.partial = true;
        }
        result.notes.truncate(1000);
        result.edges.retain(|e| {
            result.notes.iter().any(|n| n.path == e.from)
                && result.notes.iter().any(|n| n.path == e.to)
        });
        result.edges.truncate(5000);
        result.unresolved.truncate(1000);
        Ok(result)
    }
}

pub use notes_markdown::knowledge::{metadata, Metadata};
