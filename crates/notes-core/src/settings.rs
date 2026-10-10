use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::state::Schemad;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct EditorSettings {
    pub font_size: u32,
    pub line_numbers: bool,
    pub word_wrap: bool,
    pub tab_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct FileSettings {
    #[ts(type = "number")]
    pub autosave_ms: u64,
    pub show_hidden: bool,
    /// How long a **resolved** conflict's snapshots are kept
    /// (`ARCHITECTURE.md` §4.3). An *unresolved* conflict is a draft and is
    /// never pruned. `0` disables pruning, which is what a user typing a zero
    /// into this field means — never "delete everything".
    ///
    /// `serde(default)` so a `settings.json` written before this field existed
    /// still loads at schema 1 rather than being backed up and reset.
    #[serde(default = "conflict_retention_days")]
    pub conflict_retention_days: u32,
}

fn conflict_retention_days() -> u32 {
    30
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct MarkdownSettings {
    pub default_view: String,
    pub raw_html: bool,
    pub remote_images: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct UiSettings {
    pub locale: String,
    pub theme: String,
}

/// `auto` applies the WebKitGTK workaround when Wayland and NVIDIA are both
/// present; `off` never does; `force` always does.
///
/// **A missing or unreadable settings file degrades to `auto`, never to `off`**
/// (`ARCHITECTURE.md` §12): not applying it yields a black window, applying it
/// needlessly yields slightly slower compositing.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct LinuxSettings {
    pub webkit_dmabuf_workaround: String,
}

/// What kind of server a provider is (ADR-100).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum AiProviderKind {
    Anthropic,
    /// OpenAI, OpenRouter, or a local Ollama or LM Studio. Named explicitly:
    /// the derived name would be `open_ai_compatible`.
    #[serde(rename = "openai_compatible")]
    #[ts(rename = "openai_compatible")]
    OpenAiCompatible,
    /// The owner's AI gateway (ADR-107): its address, a key, and a model picked
    /// from the infrastructures it lists. The model is stored as the gateway
    /// names it (`model@infra`).
    Shvia,
}

/// One configured AI provider. **No secret is here.** The API key lives in the
/// system keychain under this `id`, and whether one is set is asked of the
/// keychain each time rather than stored, so it cannot drift from the truth.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AiProviderSettings {
    pub id: String,
    pub kind: AiProviderKind,
    pub name: String,
    pub base_url: String,
    pub model: String,
}

/// The opt-in AI assistant (ADR-100). Off by default: until `enabled` is set,
/// the application opens no connection for it (ADR-007).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AiSettings {
    pub enabled: bool,
    pub default_provider: Option<String>,
    pub providers: Vec<AiProviderSettings>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Settings {
    pub schema: u32,
    pub editor: EditorSettings,
    pub files: FileSettings,
    pub markdown: MarkdownSettings,
    pub ui: UiSettings,
    pub linux: LinuxSettings,
    /// Absent from a file written before the assistant existed, which then
    /// reads as off. An older build reading a newer file ignores it.
    #[serde(default)]
    pub ai: AiSettings,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            schema: 1,
            editor: EditorSettings {
                font_size: 14,
                line_numbers: true,
                word_wrap: true,
                tab_size: 2,
            },
            files: FileSettings {
                autosave_ms: 750,
                show_hidden: false,
                conflict_retention_days: conflict_retention_days(),
            },
            markdown: MarkdownSettings {
                default_view: "source".into(),
                raw_html: false,
                remote_images: false,
            },
            ui: UiSettings {
                locale: "auto".into(),
                theme: "dark".into(),
            },
            linux: LinuxSettings {
                webkit_dmabuf_workaround: "auto".into(),
            },
            ai: AiSettings::default(),
        }
    }
}

impl Schemad for Settings {
    const CURRENT: u32 = 1;
    const NAME: &'static str = "settings.json";
    fn schema(&self) -> u32 {
        self.schema
    }
}

/// UI state, per workspace. Resettable: invalid content starts an empty session
/// and never stops the workspace opening.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Session {
    pub schema: u32,
    #[serde(default)]
    pub tabs: Vec<Tab>,
    #[serde(default)]
    pub active_tab: Option<notes_model::NoteId>,
    #[serde(default)]
    pub view_mode: String,
    #[serde(default = "yes")]
    pub sidebar_open: bool,
    #[serde(default = "sidebar_width")]
    pub sidebar_width: u32,
}

fn yes() -> bool {
    true
}
fn sidebar_width() -> u32 {
    300
}

/// Tabs are restored at 0.1c. The fields are named now so that arriving there is
/// not a schema migration for a reason already known today.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Tab {
    pub note_id: notes_model::NoteId,
    pub path: notes_model::RelPath,
    pub line: u32,
    pub col: u32,
    pub scroll_top: u32,
    pub pinned: bool,
}

impl Default for Session {
    fn default() -> Self {
        Self {
            schema: 1,
            tabs: Vec::new(),
            active_tab: None,
            view_mode: "source".into(),
            sidebar_open: true,
            sidebar_width: 300,
        }
    }
}

impl Schemad for Session {
    const CURRENT: u32 = 1;
    const NAME: &'static str = "session.json";
    fn schema(&self) -> u32 {
        self.schema
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_file_written_before_the_assistant_reads_as_off() {
        let mut v = serde_json::to_value(Settings::default()).unwrap();
        v.as_object_mut().unwrap().remove("ai");
        let s: Settings = serde_json::from_value(v).unwrap();
        assert_eq!(s.ai, AiSettings::default());
        assert!(!s.ai.enabled && s.ai.providers.is_empty() && s.ai.default_provider.is_none());
    }

    #[test]
    fn the_assistant_settings_round_trip_and_hold_no_secret() {
        let s = Settings {
            ai: AiSettings {
                enabled: true,
                default_provider: Some("p1".into()),
                providers: vec![AiProviderSettings {
                    id: "p1".into(),
                    kind: AiProviderKind::OpenAiCompatible,
                    name: "Ollama".into(),
                    base_url: "http://localhost:11434/v1".into(),
                    model: "llama3.1".into(),
                }],
            },
            ..Settings::default()
        };
        let text = serde_json::to_string(&s).unwrap();
        assert!(text.contains(r#""kind":"openai_compatible""#), "{text}");
        // Only the assistant's own section is looked at: a field elsewhere
        // may have "key" in its name for reasons of its own.
        let ai = serde_json::to_string(&serde_json::to_value(&s).unwrap()["ai"]).unwrap();
        assert!(
            !ai.to_ascii_lowercase().contains("key"),
            "a provider has no key field: {ai}"
        );
        let back: Settings = serde_json::from_str(&text).unwrap();
        assert_eq!(back.ai, s.ai);
    }

    #[test]
    fn a_newer_file_with_fields_this_build_does_not_know_still_loads() {
        let mut v = serde_json::to_value(Settings::default()).unwrap();
        v["ai"]["from_the_future"] = serde_json::json!(true);
        v["something_new"] = serde_json::json!(1);
        assert!(serde_json::from_value::<Settings>(v).is_ok());
    }
}
