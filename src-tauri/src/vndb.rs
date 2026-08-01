//! VNDB API v2 (kana) client — fetch visual novel info & releases.

use serde::Serialize;
use serde_json::{json, Value};

pub const API_BASE: &str = "https://api.vndb.org/kana";

const VN_FIELDS: &str = "id, title, alttitle, titles{lang, title, latin}, \
image{url,dims,sexual,violence,votecount}";
const CANDIDATE_FIELDS: &str = "id, title, alttitle, titles{lang, title, latin}";
const RELEASE_FIELDS: &str = "id, title, alttitle, released, platforms, \
languages{lang}, producers{id, name, original, developer, publisher}, \
media{medium, qty}, extlinks{url, label}";

// ── DTOs (mirror of src/core/vndb_api.py data classes) ───────────────

#[derive(Serialize, Clone, Debug)]
pub struct ProducerDto {
    pub id: String,
    pub name: String,
    pub original: String,
    pub developer: bool,
    pub publisher: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct VNReleaseDto {
    pub id: String,
    pub title: String,
    pub alttitle: Option<String>,
    pub released: String,
    pub platforms: Vec<String>,
    pub languages: Vec<String>,
    pub producers: Vec<ProducerDto>,
    pub media: Vec<Value>,
}

#[derive(Serialize, Clone, Debug)]
pub struct VNInfoDto {
    pub id: String,
    pub title: String,
    pub alttitle: Option<String>,
    pub titles: Vec<Value>,
    pub image: Option<Value>,
    pub releases: Vec<VNReleaseDto>,
}

#[derive(Serialize, Clone, Debug)]
pub struct VNCandidateDto {
    pub id: String,
    pub title: String,
    pub alttitle: Option<String>,
    pub titles: Vec<Value>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SearchOutcome {
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vn: Option<VNInfoDto>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub candidates: Option<Vec<VNCandidateDto>>,
}

impl SearchOutcome {
    pub fn vn(v: VNInfoDto) -> Self {
        Self {
            kind: "vn".to_string(),
            vn: Some(v),
            candidates: None,
        }
    }

    pub fn multiple(c: Vec<VNCandidateDto>) -> Self {
        Self {
            kind: "multiple".to_string(),
            vn: None,
            candidates: Some(c),
        }
    }
}

fn str_of(v: &Value, key: &str) -> String {
    v.get(key)
        .and_then(|x| x.as_str())
        .unwrap_or_default()
        .to_string()
}

fn opt_str(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(|x| x.as_str()).map(str::to_string)
}

fn array_of(v: &Value, key: &str) -> Vec<Value> {
    v.get(key)
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default()
}

impl ProducerDto {
    fn from_value(v: &Value) -> Self {
        Self {
            id: str_of(v, "id"),
            name: str_of(v, "name"),
            original: str_of(v, "original"),
            developer: v.get("developer").and_then(|x| x.as_bool()).unwrap_or(false),
            publisher: v.get("publisher").and_then(|x| x.as_bool()).unwrap_or(false),
        }
    }
}

impl VNReleaseDto {
    fn from_value(v: &Value) -> Self {
        let languages = v
            .get("languages")
            .and_then(|x| x.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|l| l.get("lang").and_then(|x| x.as_str()).map(str::to_string))
                    .collect()
            })
            .unwrap_or_default();
        let producers = array_of(v, "producers")
            .iter()
            .map(ProducerDto::from_value)
            .collect();
        Self {
            id: str_of(v, "id"),
            title: str_of(v, "title"),
            alttitle: opt_str(v, "alttitle"),
            released: str_of(v, "released"),
            platforms: v
                .get("platforms")
                .and_then(|x| x.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|p| p.as_str().map(str::to_string))
                        .collect()
                })
                .unwrap_or_default(),
            languages,
            producers,
            media: array_of(v, "media"),
        }
    }
}

impl VNInfoDto {
    fn from_value(v: &Value) -> Self {
        let releases = array_of(v, "releases")
            .iter()
            .map(VNReleaseDto::from_value)
            .collect();
        Self {
            id: str_of(v, "id"),
            title: str_of(v, "title"),
            alttitle: opt_str(v, "alttitle"),
            titles: array_of(v, "titles"),
            image: v.get("image").cloned().filter(|x| !x.is_null()),
            releases,
        }
    }
}

impl VNCandidateDto {
    fn from_value(v: &Value) -> Self {
        Self {
            id: str_of(v, "id"),
            title: str_of(v, "title"),
            alttitle: opt_str(v, "alttitle"),
            titles: array_of(v, "titles"),
        }
    }
}

// ── Client ────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct VndbClient {
    http: reqwest::blocking::Client,
}

impl VndbClient {
    pub fn new() -> Self {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            reqwest::header::CONTENT_TYPE,
            "application/json".parse().unwrap(),
        );
        headers.insert(reqwest::header::ACCEPT, "application/json".parse().unwrap());
        let http = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .default_headers(headers)
            .build()
            .expect("failed to build http client");
        Self { http }
    }

    fn post(&self, endpoint: &str, payload: Value) -> Result<Value, String> {
        let url = format!("{}/{}", API_BASE, endpoint);
        let resp = self.http.post(&url).json(&payload).send().map_err(|e| {
            if e.is_timeout() {
                "请求超时，请检查网络连接。".to_string()
            } else if e.is_connect() {
                "无法连接到 VNDB API，请检查网络连接。".to_string()
            } else {
                format!("网络请求失败：{e}")
            }
        })?;
        let status = resp.status().as_u16();
        match status {
            200 => resp.json::<Value>().map_err(|e| format!("解析响应失败：{e}")),
            404 => Err("未找到该视觉小说。".to_string()),
            429 => Err("请求过于频繁，请稍后再试。".to_string()),
            code if code >= 400 => {
                let body = resp.text().unwrap_or_default();
                let msg = serde_json::from_str::<Value>(&body)
                    .ok()
                    .and_then(|v| {
                        v.get("errors")
                            .and_then(|e| e.get(0))
                            .and_then(|e| e.get("msg"))
                            .and_then(|m| m.as_str())
                            .map(str::to_string)
                    })
                    .unwrap_or(body);
                Err(format!("API 错误 ({code}): {msg}"))
            }
            _ => Err(format!("API 错误 ({status}): 未知状态码")),
        }
    }

    fn fetch_all(&self, endpoint: &str, mut payload: Value, max_pages: u32) -> Result<Vec<Value>, String> {
        let mut results: Vec<Value> = Vec::new();
        let mut page: u32 = 1;
        while page <= max_pages {
            payload["page"] = json!(page);
            let data = self.post(endpoint, payload.clone())?;
            if let Some(batch) = data.get("results").and_then(|r| r.as_array()) {
                results.extend(batch.iter().cloned());
            }
            if !data.get("more").and_then(|m| m.as_bool()).unwrap_or(false) {
                break;
            }
            page += 1;
        }
        Ok(results)
    }

    fn normalize_id(raw: &str) -> String {
        let trimmed = raw.trim().to_lowercase();
        if trimmed.starts_with('v') {
            trimmed
        } else {
            format!("v{trimmed}")
        }
    }

    fn fetch_releases(&self, vn_id: &str) -> Result<Vec<Value>, String> {
        self.fetch_all(
            "release",
            json!({
                "filters": ["vn", "=", ["id", "=", vn_id]],
                "fields": RELEASE_FIELDS,
                "results": 100,
            }),
            5,
        )
    }

    pub fn search_vn_by_id(&self, vn_id: &str) -> Result<VNInfoDto, String> {
        let normalized = Self::normalize_id(vn_id);
        let data = self.post(
            "vn",
            json!({
                "filters": ["id", "=", normalized],
                "fields": VN_FIELDS,
            }),
        )?;
        let mut results = array_of(&data, "results").into_iter();
        let raw_vn = match results.next() {
            Some(v) => v,
            None => return Err(format!("未找到 ID 为 {normalized} 的视觉小说。")),
        };
        let releases = self.fetch_releases(&normalized)?;
        let mut raw = raw_vn;
        raw["releases"] = json!(releases);
        Ok(VNInfoDto::from_value(&raw))
    }

    pub fn search_vn_candidates(&self, title: &str) -> Result<Vec<VNCandidateDto>, String> {
        let data = self.post(
            "vn",
            json!({
                "filters": ["search", "=", title],
                "fields": CANDIDATE_FIELDS,
                "results": 10,
            }),
        )?;
        let results = array_of(&data, "results");
        if results.is_empty() {
            return Err(format!("未找到标题包含「{title}」的视觉小说。"));
        }
        Ok(results.iter().map(VNCandidateDto::from_value).collect())
    }

    pub fn search_vn(&self, query: &str) -> Result<SearchOutcome, String> {
        let q = query.trim();
        let lower = q.to_lowercase();
        let rest_digits = lower
            .strip_prefix('v')
            .map(|rest| !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit()))
            .unwrap_or(false);
        let all_digits = !q.is_empty() && q.chars().all(|c| c.is_ascii_digit());
        if rest_digits || all_digits {
            return Ok(SearchOutcome::vn(self.search_vn_by_id(q)?));
        }
        let candidates = self.search_vn_candidates(q)?;
        if candidates.len() > 1 {
            return Ok(SearchOutcome::multiple(candidates));
        }
        Ok(SearchOutcome::vn(self.fetch_vn_by_id(&candidates[0].id)?))
    }

    pub fn fetch_vn_by_id(&self, vn_id: &str) -> Result<VNInfoDto, String> {
        self.search_vn_by_id(vn_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_outcome_vn_serializes() {
        let vn = VNInfoDto {
            id: "v2622".to_string(),
            title: "Test".to_string(),
            alttitle: None,
            titles: vec![],
            image: None,
            releases: vec![],
        };
        let v = serde_json::to_value(SearchOutcome::vn(vn)).unwrap();
        assert_eq!(v["kind"], "vn");
        assert_eq!(v["vn"]["id"], "v2622");
        assert!(v.get("candidates").is_none());
    }

    #[test]
    fn search_outcome_multiple_serializes() {
        let cand = VNCandidateDto {
            id: "v1".to_string(),
            title: "A".to_string(),
            alttitle: None,
            titles: vec![],
        };
        let v = serde_json::to_value(SearchOutcome::multiple(vec![cand])).unwrap();
        assert_eq!(v["kind"], "multiple");
        assert_eq!(v["candidates"][0]["id"], "v1");
        assert!(v.get("vn").is_none());
    }
}
