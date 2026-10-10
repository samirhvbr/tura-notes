use crate::{
    endpoint::validate_base,
    tidy,
    transport::{status_error, Clients},
    ApiKey, ChatRequest, Error, ModelInfo, OpenAiProvider, Provider, Result, StopReason,
    StreamEvent,
};
use reqwest::Url;
use std::{io::Read, sync::atomic::AtomicBool};

/// SHVIA, the owner's AI gateway (ADR-107): one address that already holds the
/// connections to the model providers, and publishes which infrastructures it
/// has and which models each one serves.
///
/// Chat is the OpenAI-compatible route (`{origin}/v1/chat/completions`), so the
/// reply, the stream and the tool calls are the code [`OpenAiProvider`] already
/// has; what this adds is the catalogue, so a person picks an infrastructure
/// and then a model of it instead of typing `model@infra`.
pub struct ShviaProvider {
    origin: Url,
    key: ApiKey,
    chat: OpenAiProvider,
    clients: Clients,
}

/// The most a catalogue may weigh, and the most it may hold. SHVIA lists a few
/// infrastructures with a few dozen models each; the bounds are for a server
/// that answers something else.
const MAX_BODY: u64 = 4 * 1024 * 1024;
const MAX_INFRAS: usize = 64;
const MAX_MODELS: usize = 2000;

/// A model as the catalogue names it. `name` is what is sent as the model of a
/// chat request (`model@infra` for a remote infrastructure), and `model` is the
/// part a person reads.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CatalogModel {
    pub name: String,
    pub model: String,
    pub parameter_size: Option<String>,
}

/// One infrastructure of the gateway and the models it serves.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Infra {
    pub key: String,
    pub label: String,
    pub driver: Option<String>,
    /// `None` when the gateway did not say; `Some(false)` is an infrastructure
    /// it knows is down, which the interface marks and does not hide.
    pub online: Option<bool>,
    pub models: Vec<CatalogModel>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Catalog {
    /// The infrastructures, the gateway's default first and the rest by label.
    pub infras: Vec<Infra>,
    pub default_infra: Option<String>,
}

impl ShviaProvider {
    pub const DEFAULT_ORIGIN: &'static str = "https://ai.shvia.org";

    /// `origin` is the gateway's address with no path: `https://ai.shvia.org`.
    pub fn new(origin: &str, key: ApiKey) -> Result<Self> {
        let origin = validate_base(origin)?;
        if origin.path() != "/" {
            return Err(Error::Endpoint(
                "it must be the address alone, with no path",
            ));
        }
        let base = origin
            .join("v1/")
            .map_err(|_| Error::Endpoint("not a URL"))?;
        Ok(Self {
            chat: OpenAiProvider::new(base.as_str(), Some(key.clone()))?,
            origin,
            key,
            clients: Clients::new()?,
        })
    }

    /// The infrastructures and models this key can use, from
    /// `GET /api/v1/profiles`. A key the gateway refuses fails here with
    /// [`Error::Unauthorized`], which is what makes it the key test.
    pub fn catalog(&self) -> Result<Catalog> {
        let url = self
            .origin
            .join("api/v1/profiles")
            .map_err(|_| Error::Endpoint("not a URL"))?;
        let response = self
            .clients
            .short
            .get(url)
            .header("authorization", format!("Bearer {}", self.key.expose()))
            .header("accept", "application/json")
            .send()
            .map_err(|_| Error::Offline)?;
        let status = response.status().as_u16();
        let mut body = vec![];
        response
            .take(MAX_BODY + 1)
            .read_to_end(&mut body)
            .map_err(|_| Error::Offline)?;
        if !(200..300).contains(&status) {
            return Err(status_error(status, &body));
        }
        if body.len() as u64 > MAX_BODY {
            return Err(Error::Protocol);
        }
        parse(&serde_json::from_slice(&body).map_err(|_| Error::Protocol)?)
    }
}

/// What a model name may be: the same characters the application accepts for a
/// model, so a name from the catalogue is one it can save.
fn usable(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 100
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._:/@-".contains(&b))
}

fn text(value: &serde_json::Value) -> Option<String> {
    value.as_str().map(tidy).filter(|s| !s.is_empty())
}

/// The catalogue from the gateway's answer. Unknown fields are ignored, a
/// profile with a name that cannot be sent is left out, and an infrastructure
/// the gateway marks disabled is left out with it.
fn parse(value: &serde_json::Value) -> Result<Catalog> {
    let profiles = value["profiles"].as_array().ok_or(Error::Protocol)?;
    let servers = value["servers"].as_object();
    let default_infra = text(&value["default_server"]);
    let mut infras: Vec<Infra> = vec![];
    let mut count = 0usize;
    for profile in profiles {
        let Some(name) = text(&profile["name"]).filter(|n| usable(n)) else {
            continue;
        };
        let key = text(&profile["server"])
            .or_else(|| name.split_once('@').map(|(_, infra)| infra.to_owned()))
            .unwrap_or_else(|| "local".to_owned());
        let meta = servers.and_then(|s| s.get(&key));
        if meta.is_some_and(|m| m["disabled"].as_bool() == Some(true)) {
            continue;
        }
        let model = text(&profile["model"])
            .or_else(|| name.split_once('@').map(|(m, _)| m.to_owned()))
            .unwrap_or_else(|| name.clone());
        let at = match infras.iter().position(|i| i.key == key) {
            Some(at) => at,
            None => {
                if infras.len() >= MAX_INFRAS {
                    return Err(Error::Protocol);
                }
                let from = |field: &str| {
                    meta.and_then(|m| text(&m[field]))
                        .or_else(|| text(&profile[field]))
                };
                infras.push(Infra {
                    label: meta
                        .and_then(|m| text(&m["label"]))
                        .or_else(|| text(&profile["server_label"]))
                        .unwrap_or_else(|| key.clone()),
                    driver: from("driver"),
                    online: meta
                        .and_then(|m| m["online"].as_bool())
                        .or_else(|| profile["server_online"].as_bool()),
                    key,
                    models: vec![],
                });
                infras.len() - 1
            }
        };
        if infras[at].models.iter().any(|m| m.name == name) {
            continue;
        }
        count += 1;
        if count > MAX_MODELS {
            return Err(Error::Protocol);
        }
        infras[at].models.push(CatalogModel {
            name,
            model,
            parameter_size: text(&profile["parameter_size"]),
        });
    }
    for infra in &mut infras {
        infra.models.sort_by(|a, b| a.model.cmp(&b.model));
    }
    infras.sort_by(|a, b| {
        let first = |i: &Infra| default_infra.as_deref() != Some(i.key.as_str());
        first(a)
            .cmp(&first(b))
            .then_with(|| a.label.to_lowercase().cmp(&b.label.to_lowercase()))
            .then_with(|| a.key.cmp(&b.key))
    });
    Ok(Catalog {
        infras,
        default_infra,
    })
}

impl Provider for ShviaProvider {
    /// Every model of every infrastructure, as the name a chat request sends.
    fn models(&self) -> Result<Vec<ModelInfo>> {
        Ok(self
            .catalog()?
            .infras
            .into_iter()
            .flat_map(|infra| {
                let label = infra.label;
                infra.models.into_iter().map(move |m| ModelInfo {
                    name: format!("{label} · {}", m.model),
                    id: m.name,
                })
            })
            .collect())
    }

    fn stream(
        &self,
        request: &ChatRequest,
        cancel: &AtomicBool,
        on_event: &mut dyn FnMut(StreamEvent),
    ) -> Result<StopReason> {
        self.chat.stream(request, cancel, on_event)
    }
}
