// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! `cargo xtask notices [--text <file>]`: the third-party notices for what
//! ships inside moongazer.exe.
//!
//! The Rust part lists the crates compiled into the exe: the app's normal
//! dependencies for its Windows target, without proc-macro crates and build
//! dependencies, which only run at compile time. Each crate's texts come from
//! its own package; `FIXES` covers packages that lack them.

use std::collections::{BTreeSet, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use serde_json::{Map, Value, json};

use crate::util;

const USAGE: &str = "usage: cargo xtask notices [--text <file>]";
const TARGET: &str = "x86_64-pc-windows-msvc";
const DESKTOP: &str = "apps/desktop";
const APP_JSON: &str = "apps/desktop/src/generated/notices.json";
/// Vite's list of the npm packages in the bundle, at the root of the frontend
/// build (`build.license` in apps/desktop/vite.config.ts).
const VITE_LICENSES: &str = "licenses.json";
/// The standard texts in xtask/licenses/, by text id.
const STANDARD: [(&str, &str); 4] = [
    ("MIT", "MIT.txt"),
    ("Apache-2.0", "Apache-2.0.txt"),
    ("MPL-2.0", "MPL-2.0.txt"),
    ("WebView2-SDK", "WebView2-SDK.txt"),
];
/// Which license to take when a package offers a choice.
const PREFERENCE: [&str; 7] = [
    "MIT",
    "Apache-2.0",
    "BSD-3-Clause",
    "ISC",
    "Zlib",
    "Unicode-3.0",
    "MPL-2.0",
];
/// The webview2-com-sys version whose bindings pin this WebView2 SDK, whose
/// static loader it links into the exe.
const WEBVIEW2_SYS: (&str, &str) = ("0.39.1", "1.0.3800.47");
/// The UI font's license, and the Sarasa Gothic release `cargo xtask gen-data` takes the font from
/// (tools/datagen/src/font.ts).
const FONT_LICENSE: &str = "xtask/licenses/Sarasa-Gothic.txt";
/// Kept with RELEASE in tools/datagen/src/font.ts.
const SARASA_VERSION: &str = "1.0.43";
/// npm packages that reach the bundle only through CSS imports, which Vite's
/// list does not see, with the packages to resolve each one through.
const CSS_PACKAGES: [(&str, &[&str]); 2] = [
    ("tailwindcss", &[]),
    ("tw-animate-css", &["@heroui/styles"]),
];
/// Projects whose code THIRD_PARTY_NOTICES.md says Moongazer contains.
/// Listed only when no crate already carries the same copyright line.
const ADAPTED: [(&str, &str, &str); 5] = [
    (
        "Teyvat.me Capture",
        "https://github.com/tawan475/teyvat.me-capture",
        "Copyright (c) 2026 tawan475",
    ),
    (
        "irminsul and anime-game-data",
        "https://github.com/konkers/irminsul",
        "Copyright (c) 2025 Erik Gilling",
    ),
    (
        "reliquary",
        "https://github.com/IceDynamix/reliquary",
        "Copyright (c) 2024 IceDynamix",
    ),
    (
        "mhy-kcp",
        "https://github.com/hashblen/mhy-kcp",
        "Copyright (c) 2017 Zhang Cheng",
    ),
    (
        "pktmon",
        "https://github.com/emmachase/pktmon",
        "Copyright (c) 2025 emmachase",
    ),
];

/// A crate whose package lacks something the notices need.
struct Fix {
    name: &'static str,
    /// Copyright lines from its repository, for a package that has none.
    copyright: &'static [&'static str],
    /// A crate from the same repository whose license files apply.
    files_from: Option<&'static str>,
    /// More license files, relative to the package root, included whole: the
    /// ones for vendored code that the license choice does not reach.
    nested: &'static [&'static str],
}

const NO_FIX: Fix = Fix {
    name: "",
    copyright: &[],
    files_from: None,
    nested: &[],
};

const FIXES: &[Fix] = &[
    Fix {
        name: "alloc-stdlib",
        files_from: Some("alloc-no-stdlib"),
        ..NO_FIX
    },
    Fix {
        name: "etherparse",
        copyright: &["Copyright (c) 2024 Julian Schmid"],
        ..NO_FIX
    },
    Fix {
        name: "teyvatme-core",
        copyright: &["Copyright (c) 2026 tawan475"],
        ..NO_FIX
    },
    Fix {
        name: "webview2-com",
        copyright: &["Copyright (c) 2021 Bill Avery"],
        ..NO_FIX
    },
    Fix {
        name: "webview2-com-sys",
        copyright: &["Copyright (c) 2021 Bill Avery"],
        ..NO_FIX
    },
    // These two name no copyright holder anywhere; the authors are from the
    // `authors` field their earlier versions had.
    Fix {
        name: "pin-project-lite",
        copyright: &["Authors: Taiki Endo"],
        ..NO_FIX
    },
    Fix {
        name: "serde_json",
        copyright: &["Authors: Erick Tryzelaar, David Tolnay"],
        ..NO_FIX
    },
    Fix {
        name: "winnow",
        // The repository's COPYRIGHT file: contributors keep their copyright.
        copyright: &["Copyright (c) the winnow and nom contributors"],
        ..NO_FIX
    },
    Fix {
        name: "ring",
        nested: &[
            "LICENSE",
            "LICENSE-BoringSSL",
            "third_party/fiat/LICENSE",
            "src/polyfill/once_cell/LICENSE-MIT",
        ],
        ..NO_FIX
    },
    Fix {
        name: "regex-syntax",
        nested: &["src/unicode_tables/LICENSE-UNICODE"],
        ..NO_FIX
    },
    Fix {
        name: "tracing-core",
        nested: &["src/spin/LICENSE"],
        ..NO_FIX
    },
];

pub fn run(root: &Path, args: &[&str]) -> Result<()> {
    let mut text = None;
    let mut args = args.iter();
    while let Some(arg) = args.next() {
        match *arg {
            "--text" => text = Some(PathBuf::from(args.next().context(USAGE)?)),
            _ => bail!(USAGE),
        }
    }
    write_app_json(root)?;
    if let Some(out) = text {
        write_text(root, &root.join(DESKTOP).join("dist"), &out)?;
    }
    Ok(())
}

/// Writes `apps/desktop/src/generated/notices.json`, which the About page
/// imports.
pub fn write_app_json(root: &Path) -> Result<()> {
    let notices = collect(root)?;
    let groups: Vec<Value> = notices
        .groups
        .iter()
        .filter(|group| !group.entries.is_empty())
        .map(|group| {
            let entries: Vec<Value> = group.entries.iter().map(Entry::to_json).collect();
            json!({ "id": group.id, "entries": entries })
        })
        .collect();
    let texts: Map<String, Value> = notices
        .texts
        .list
        .iter()
        .map(|(id, text)| (id.clone(), Value::from(text.as_str())))
        .collect();
    let out = root.join(APP_JSON);
    if let Some(dir) = out.parent() {
        fs::create_dir_all(dir)?;
    }
    let body = serde_json::to_string_pretty(&json!({
        "groups": groups,
        "texts": texts,
    }))? + "\n";
    fs::write(&out, &body).with_context(|| format!("writing {}", out.display()))?;
    println!(
        "notices: {} crates, {} texts, {} KiB -> {APP_JSON}",
        notices.groups[0].entries.len(),
        notices.texts.list.len(),
        body.len() / 1024
    );
    Ok(())
}

/// Writes the plain-text notices published with each release. Runs after the frontend build, whose bundled-package list
/// it reads from `frontend_dist`.
pub fn write_text(root: &Path, frontend_dist: &Path, out: &Path) -> Result<()> {
    let mut notices = collect(root)?;
    let npm = vite_packages(root, frontend_dist, &mut notices.texts)?;
    let frontend = notices
        .groups
        .iter_mut()
        .find(|group| group.id == "frontend")
        .context("no frontend group")?;
    frontend.entries.extend(npm);
    frontend.entries.sort_by(|a, b| a.name.cmp(&b.name));

    let license = fs::read_to_string(root.join("LICENSE")).context("reading LICENSE")?;
    let mut s = format!("Moongazer\n\n{}\n\n", clean(&license));
    s += &wrap(
        "The Moongazer logo and app icons (assets/logo/, the icons generated from it and the \
         logo shown in the app) are not covered by the MIT license above. All rights reserved.",
        "",
    );
    s += "\n\nThird-party notices\n\n";
    s += &wrap(
        "Moongazer contains the software and data below. Each entry names its license texts, \
         which follow at the end.",
        "",
    );
    for group in notices.groups.iter().filter(|g| !g.entries.is_empty()) {
        s += &format!("\n\n== {} ({}) ==\n", group.title, group.entries.len());
        for entry in &group.entries {
            s += &entry.to_text();
        }
    }
    s += "\n\n== License texts ==\n";
    for (id, text) in &notices.texts.list {
        s += &format!("\n---- {id} ----\n\n{text}\n");
    }
    fs::write(out, &s).with_context(|| format!("writing {}", out.display()))?;
    println!("notices: {} KiB -> {}", s.len() / 1024, out.display());
    Ok(())
}

#[derive(Default)]
struct Entry {
    name: String,
    version: Option<String>,
    /// The license that applies here: the one taken from the package's choice.
    license: Option<String>,
    /// The package's own license expression, when it offers a choice.
    expression: Option<String>,
    copyright: Vec<String>,
    note: Option<String>,
    /// Ids into `Texts`.
    texts: Vec<String>,
    links: Vec<String>,
}

impl Entry {
    fn add_copyright(&mut self, text: &str) {
        for line in copyright_lines(text) {
            if !self.copyright.contains(&line) {
                self.copyright.push(line);
            }
        }
    }

    fn add_text(&mut self, id: String) {
        if !self.texts.contains(&id) {
            self.texts.push(id);
        }
    }

    fn to_json(&self) -> Value {
        let mut m = Map::new();
        m.insert("name".into(), self.name.as_str().into());
        let optional = [
            ("version", &self.version),
            ("license", &self.license),
            ("expression", &self.expression),
            ("note", &self.note),
        ];
        for (key, value) in optional {
            if let Some(value) = value {
                m.insert(key.into(), value.as_str().into());
            }
        }
        m.insert("copyright".into(), self.copyright.clone().into());
        m.insert("texts".into(), self.texts.clone().into());
        if !self.links.is_empty() {
            m.insert("links".into(), self.links.clone().into());
        }
        Value::Object(m)
    }

    fn to_text(&self) -> String {
        let mut s = format!("\n{}", self.name);
        if let Some(version) = &self.version {
            s += &format!(" {version}");
        }
        s += "\n";
        if let Some(license) = &self.license {
            s += &format!("  License: {license}");
            if let Some(expression) = &self.expression {
                s += &format!(" (chosen from {expression})");
            }
            s += "\n";
        }
        for line in &self.copyright {
            s += &format!("  {line}\n");
        }
        if let Some(note) = &self.note {
            s += &wrap(note, "  ");
        }
        for link in &self.links {
            s += &format!("  {link}\n");
        }
        if !self.texts.is_empty() {
            s += &format!("  Text: {}\n", self.texts.join(", "));
        }
        s
    }
}

struct Group {
    id: &'static str,
    title: &'static str,
    entries: Vec<Entry>,
}

struct Notices {
    groups: Vec<Group>,
    texts: Texts,
}

/// The license texts, each stored once.
struct Texts {
    standard: HashMap<&'static str, String>,
    /// `(id, text)` in order of first use.
    list: Vec<(String, String)>,
    by_text: HashMap<String, usize>,
}

impl Texts {
    fn new(root: &Path) -> Result<Self> {
        let mut standard = HashMap::new();
        for (id, file) in STANDARD {
            let path = root.join("xtask/licenses").join(file);
            let text =
                fs::read_to_string(&path).with_context(|| format!("reading {}", path.display()))?;
            standard.insert(id, clean(&text));
        }
        Ok(Self {
            standard,
            list: Vec::new(),
            by_text: HashMap::new(),
        })
    }

    /// Stores a text and returns its id, or the id of the identical one.
    fn add(&mut self, id: String, text: String) -> String {
        if let Some(&i) = self.by_text.get(&text) {
            return self.list[i].0.clone();
        }
        self.by_text.insert(text.clone(), self.list.len());
        self.list.push((id.clone(), text));
        id
    }

    fn standard(&mut self, id: &str) -> Result<String> {
        let (&id, text) = self
            .standard
            .get_key_value(id)
            .with_context(|| format!("no standard text `{id}`"))?;
        Ok(self.add(id.to_owned(), text.clone()))
    }

    /// Adds one license file to an entry: a standard MIT text becomes the
    /// shared copy plus its copyright lines; anything else is kept whole.
    fn attach(&mut self, entry: &mut Entry, id: String, text: &str) -> Result<()> {
        entry.add_copyright(text);
        let mit = &self.standard["MIT"];
        let id = if kind_of(text) == Some("MIT") && is_standard_mit(text, mit) {
            self.standard("MIT")?
        } else {
            self.add(id, text.to_owned())
        };
        entry.add_text(id);
        Ok(())
    }
}

/// Everything except the npm packages Vite lists, which only the text file
/// includes (the About page reads Vite's file itself).
fn collect(root: &Path) -> Result<Notices> {
    let mut texts = Texts::new(root)?;
    let crates = rust_crates(root, &mut texts)?;
    let components = components(&crates, &mut texts)?;
    let adapted = adapted(&crates, &mut texts)?;
    let frontend = css_packages(root, &mut texts)?;
    let fonts = fonts(root, &mut texts)?;
    let data = data(&mut texts)?;
    let group = |id, title, entries| Group { id, title, entries };
    Ok(Notices {
        groups: vec![
            group("crates", "Rust crates compiled into the program", crates),
            group(
                "components",
                "Other components compiled into the program",
                components,
            ),
            group("adapted", "Code adapted into Moongazer", adapted),
            group(
                "frontend",
                "Frontend packages bundled into the program",
                frontend,
            ),
            group("fonts", "Fonts bundled into the program", fonts),
            group("data", "Data and keys", data),
        ],
        texts,
    })
}

fn rust_crates(root: &Path, texts: &mut Texts) -> Result<Vec<Entry>> {
    let allow = allowed_licenses(root)?;
    let shipped = shipped_crates(root)?;
    let metadata = util::output(util::cargo(root).args([
        "metadata",
        "--locked",
        "--format-version",
        "1",
        "--filter-platform",
        TARGET,
    ]))?;
    let metadata: Value = serde_json::from_str(&metadata).context("parsing cargo metadata")?;
    let members: HashSet<&str> = metadata["workspace_members"]
        .as_array()
        .context("cargo metadata has no workspace_members")?
        .iter()
        .filter_map(Value::as_str)
        .collect();
    let packages = metadata["packages"]
        .as_array()
        .context("cargo metadata has no packages")?;

    let mut crates = Vec::new();
    let mut unattributed = Vec::new();
    for (name, version) in &shipped {
        let pkg = packages
            .iter()
            .find(|p| p["name"] == name.as_str() && p["version"] == version.as_str())
            .with_context(|| format!("{name} {version} is not in cargo metadata"))?;
        if pkg["id"].as_str().is_some_and(|id| members.contains(id)) {
            continue;
        }
        let entry = crate_entry(pkg, packages, &allow, texts)
            .with_context(|| format!("{name} {version}"))?;
        if entry.copyright.is_empty() {
            unattributed.push(format!("{name} {version}"));
        }
        crates.push(entry);
    }
    if !unattributed.is_empty() {
        bail!(
            "no copyright line, fix or authors for {}; add them to FIXES in xtask/src/notices.rs",
            unattributed.join(", ")
        );
    }
    Ok(crates)
}

/// `(name, version)` of every package compiled into the exe, our own included.
fn shipped_crates(root: &Path) -> Result<BTreeSet<(String, String)>> {
    let out = util::output(
        util::cargo(root)
            .args(["tree", "--locked", "-p", "moongazer", "--target", TARGET])
            .args([
                "-e",
                "normal,no-proc-macro",
                "--prefix",
                "none",
                "--format",
                "{p}",
            ]),
    )?;
    Ok(out
        .lines()
        .filter_map(|line| {
            let mut words = line.split_whitespace();
            let name = words.next()?;
            let version = words.next()?.strip_prefix('v')?;
            Some((name.to_owned(), version.to_owned()))
        })
        .collect())
}

fn allowed_licenses(root: &Path) -> Result<Vec<String>> {
    let deny: toml_edit::DocumentMut = fs::read_to_string(root.join("deny.toml"))
        .context("reading deny.toml")?
        .parse()
        .context("parsing deny.toml")?;
    let allow = deny
        .get("licenses")
        .and_then(|licenses| licenses.get("allow"))
        .and_then(toml_edit::Item::as_array)
        .context("deny.toml has no [licenses] allow list")?;
    Ok(allow
        .iter()
        .filter_map(|v| v.as_str())
        .map(str::to_owned)
        .collect())
}

fn crate_entry(
    pkg: &Value,
    packages: &[Value],
    allow: &[String],
    texts: &mut Texts,
) -> Result<Entry> {
    let name = pkg["name"].as_str().context("package without a name")?;
    let version = pkg["version"]
        .as_str()
        .context("package without a version")?;
    let expression = pkg["license"]
        .as_str()
        .context("declares no license expression")?;
    let fix = FIXES.iter().find(|fix| fix.name == name).unwrap_or(&NO_FIX);
    let dir = package_dir(pkg)?;
    let mut files = license_files(&dir)?;
    if let Some(from) = fix.files_from {
        let other = packages
            .iter()
            .find(|p| p["name"] == from)
            .with_context(|| format!("{from} is not in cargo metadata"))?;
        files = license_files(&package_dir(other)?)?;
    }
    let available: Vec<&str> = files.iter().filter_map(|f| f.kind).collect();
    let chosen = choose(expression, allow, &available)?;
    let license = chosen.join(" AND ");
    let mut entry = Entry {
        name: name.to_owned(),
        version: Some(version.to_owned()),
        expression: (license != expression).then(|| expression.to_owned()),
        license: Some(license),
        ..Entry::default()
    };
    let id = |path: &str| format!("{name}-{version}/{path}");
    for license in &chosen {
        let of_kind: Vec<&LicenseFile> = files
            .iter()
            .filter(|f| f.kind == Some(license.as_str()))
            .collect();
        match license.as_str() {
            "Apache-2.0" | "MPL-2.0" => {
                entry.add_text(texts.standard(license)?);
                for file in of_kind {
                    entry.add_copyright(&file.text);
                }
            }
            "MIT" if of_kind.is_empty() => entry.add_text(texts.standard("MIT")?),
            _ if of_kind.is_empty() => {
                bail!("the package has no {license} text; add it to FIXES in xtask/src/notices.rs")
            }
            _ => {
                for file in of_kind {
                    texts.attach(&mut entry, id(&file.path), &file.text)?;
                }
            }
        }
    }
    if chosen.iter().any(|l| l == "MPL-2.0") {
        // MPL-2.0 3.2: say where the source code is.
        entry.note = Some("Its source code is available from the links below.".to_owned());
        entry
            .links
            .push(format!("https://crates.io/crates/{name}/{version}"));
        if let Some(repo) = pkg["repository"].as_str() {
            entry.links.push(repo.trim_end_matches(".git").to_owned());
        }
    }
    for path in fix.nested {
        let file = read_license(&dir, path)?;
        texts.attach(&mut entry, id(path), &file.text)?;
    }
    if entry.copyright.is_empty() {
        for file in &files {
            entry.add_copyright(&file.text);
        }
    }
    if entry.copyright.is_empty() {
        entry.copyright = fix.copyright.iter().map(|&line| line.to_owned()).collect();
    }
    if entry.copyright.is_empty() {
        let authors = pkg["authors"]
            .as_array()
            .map(Vec::as_slice)
            .unwrap_or_default();
        let authors: Vec<String> = authors
            .iter()
            .filter_map(Value::as_str)
            .filter_map(author_name)
            .collect();
        if !authors.is_empty() {
            entry
                .copyright
                .push(format!("Authors: {}", authors.join(", ")));
        }
    }
    Ok(entry)
}

fn package_dir(pkg: &Value) -> Result<PathBuf> {
    let manifest = pkg["manifest_path"]
        .as_str()
        .context("package without manifest_path")?;
    Ok(Path::new(manifest)
        .parent()
        .context("manifest_path has no parent")?
        .to_path_buf())
}

/// An author from Cargo.toml without the e-mail address.
fn author_name(author: &str) -> Option<String> {
    let name = author.split('<').next().unwrap_or_default().trim();
    (!name.is_empty()).then(|| name.to_owned())
}

struct LicenseFile {
    path: String,
    text: String,
    kind: Option<&'static str>,
}

/// The license files at the root of a package.
fn license_files(dir: &Path) -> Result<Vec<LicenseFile>> {
    let mut names = Vec::new();
    for item in fs::read_dir(dir).with_context(|| format!("listing {}", dir.display()))? {
        let path = item?.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        let lower = name.to_lowercase();
        let wanted = ["license", "licence", "copying", "unlicense"]
            .iter()
            .any(|prefix| lower.starts_with(prefix));
        if wanted && path.is_file() {
            names.push(name.to_owned());
        }
    }
    names.sort();
    names.iter().map(|name| read_license(dir, name)).collect()
}

fn read_license(dir: &Path, path: &str) -> Result<LicenseFile> {
    let full = dir.join(path);
    let raw = fs::read(&full).with_context(|| format!("reading {}", full.display()))?;
    let text = clean(&String::from_utf8_lossy(&raw));
    Ok(LicenseFile {
        path: path.to_owned(),
        kind: kind_of(&text),
        text,
    })
}

/// A paragraph wrapped at 80 columns, each line starting with `indent`.
fn wrap(text: &str, indent: &str) -> String {
    let mut out = String::new();
    let mut line = String::new();
    for word in text.split_whitespace() {
        if !line.is_empty() && indent.len() + line.len() + 1 + word.len() > 80 {
            out += &format!("{indent}{line}\n");
            line.clear();
        }
        if !line.is_empty() {
            line.push(' ');
        }
        line += word;
    }
    if !line.is_empty() {
        out += &format!("{indent}{line}\n");
    }
    out
}

/// LF line ends, no trailing spaces, no blank lines around the text.
fn clean(text: &str) -> String {
    let text = text.trim_start_matches('\u{feff}');
    let lines: Vec<&str> = text.lines().map(str::trim_end).collect();
    lines.join("\n").trim_matches('\n').to_owned()
}

/// Recognises a license text by phrases from its body.
fn kind_of(text: &str) -> Option<&'static str> {
    let text = text.to_lowercase();
    let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let has = |phrase: &str| text.contains(phrase);
    Some(if has("unicode license v3") {
        "Unicode-3.0"
    } else if has("unicode, inc. license agreement") {
        "Unicode-DFS-2016"
    } else if has("mozilla public license") {
        "MPL-2.0"
    } else if has("apache license") && has("version 2.0") {
        "Apache-2.0"
    } else if has("permission is hereby granted, free of charge") {
        "MIT"
    } else if has("permission to use, copy, modify") && has("with or without fee") {
        "ISC"
    } else if has("redistribution and use in source and binary forms") {
        if has("neither the name") || has("names of its contributors") {
            "BSD-3-Clause"
        } else {
            "BSD-2-Clause"
        }
    } else if has("altered source versions must be plainly marked") {
        "Zlib"
    } else {
        return None;
    })
}

/// Lines that name a copyright holder. License bodies mention copyright
/// too ("copyright notice", "COPYRIGHT HOLDERS"), and templates leave a
/// placeholder ("Copyright [yyyy] [name of copyright owner]").
fn is_copyright_line(line: &str) -> bool {
    let line = uncomment(line);
    let rest = if let Some(rest) = line
        .strip_prefix("Copyright")
        .or_else(|| line.strip_prefix("COPYRIGHT"))
    {
        rest
    } else if let Some(rest) = ["(c)", "(C)", "\u{a9}"]
        .iter()
        .find_map(|mark| line.strip_prefix(mark))
    {
        // "(c)" also numbers list items in license bodies ("(c) You must retain").
        return rest.trim_start().starts_with(|c: char| c.is_ascii_digit());
    } else {
        return false;
    };
    let lower = rest.to_lowercase();
    let next: String = lower
        .trim_start()
        .chars()
        .take_while(char::is_ascii_alphabetic)
        .collect();
    let body_word = [
        "notice",
        "notices",
        "and",
        "holder",
        "holders",
        "owner",
        "owners",
        "statement",
        "license",
        "licence",
        "permission",
    ]
    .contains(&next.as_str());
    let template = [
        "yyyy",
        "<year>",
        "[year]",
        "copyright holder>",
        "name of copyright owner",
    ]
    .iter()
    .any(|placeholder| lower.contains(placeholder));
    !body_word && !template
}

fn copyright_lines(text: &str) -> Vec<String> {
    text.lines()
        .filter(|line| is_copyright_line(line))
        .map(|line| {
            uncomment(line)
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ")
        })
        .collect()
}

fn uncomment(line: &str) -> &str {
    line.trim_start_matches(|c: char| c.is_whitespace() || "/#*;".contains(c))
}

/// Whether an MIT text is the standard one once its title and copyright lines
/// are left out and whitespace is ignored.
fn is_standard_mit(text: &str, standard: &str) -> bool {
    let words = |text: &str| -> Vec<String> {
        text.lines()
            .filter(|line| !is_copyright_line(line) && !is_mit_title(line))
            .flat_map(str::split_whitespace)
            .map(str::to_owned)
            .collect()
    };
    words(text) == words(standard)
}

fn is_mit_title(line: &str) -> bool {
    let line: String = line
        .to_lowercase()
        .chars()
        .filter(|c| !"():".contains(*c))
        .collect();
    let line = line.trim().trim_start_matches("the ").trim();
    matches!(line, "mit" | "mit license" | "mit license mit")
}

/// Picks the licenses to follow from an SPDX expression: an alternative whose
/// licenses are all on deny.toml's allow list, preferring one whose texts the
/// package ships, then `PREFERENCE`.
fn choose(expression: &str, allow: &[String], available: &[&str]) -> Result<Vec<String>> {
    let rank = |id: &String| {
        PREFERENCE
            .iter()
            .position(|p| p == id)
            .unwrap_or(PREFERENCE.len())
    };
    alternatives(expression)?
        .into_iter()
        .filter(|alt| alt.iter().all(|id| allow.contains(id)))
        .min_by_key(|alt| {
            let missing = alt
                .iter()
                .filter(|id| !available.contains(&id.as_str()))
                .count();
            (missing, alt.iter().map(rank).max())
        })
        .with_context(|| format!("`{expression}` offers no license on deny.toml's allow list"))
}

/// The ways to satisfy an SPDX expression, each a list of license ids. AND
/// binds tighter than OR; the legacy `/` means OR.
fn alternatives(expression: &str) -> Result<Vec<Vec<String>>> {
    let spaced = expression
        .replace('(', " ( ")
        .replace(')', " ) ")
        .replace('/', " OR ");
    let tokens: Vec<&str> = spaced.split_whitespace().collect();
    let mut pos = 0;
    let alts = parse_or(&tokens, &mut pos);
    match alts {
        Some(alts) if pos == tokens.len() => Ok(alts),
        _ => bail!("cannot read the license expression `{expression}`"),
    }
}

fn parse_or(tokens: &[&str], pos: &mut usize) -> Option<Vec<Vec<String>>> {
    let mut alts = parse_and(tokens, pos)?;
    while tokens.get(*pos) == Some(&"OR") {
        *pos += 1;
        alts.extend(parse_and(tokens, pos)?);
    }
    Some(alts)
}

fn parse_and(tokens: &[&str], pos: &mut usize) -> Option<Vec<Vec<String>>> {
    let mut alts = parse_atom(tokens, pos)?;
    while tokens.get(*pos) == Some(&"AND") {
        *pos += 1;
        let right = parse_atom(tokens, pos)?;
        alts = alts
            .iter()
            .flat_map(|left| {
                right
                    .iter()
                    .map(move |r| [left.clone(), r.clone()].concat())
            })
            .collect();
    }
    Some(alts)
}

fn parse_atom(tokens: &[&str], pos: &mut usize) -> Option<Vec<Vec<String>>> {
    let token = *tokens.get(*pos)?;
    *pos += 1;
    match token {
        "(" => {
            let alts = parse_or(tokens, pos)?;
            if tokens.get(*pos) != Some(&")") {
                return None;
            }
            *pos += 1;
            Some(alts)
        }
        "AND" | "OR" | ")" | "WITH" => None,
        id => Some(vec![vec![id.to_owned()]]),
    }
}

/// What Cargo does not list: the WebView2 loader, the standard library and
/// the SQLite that libsqlite3-sys compiles in.
fn components(crates: &[Entry], texts: &mut Texts) -> Result<Vec<Entry>> {
    let mut entries = vec![Entry {
        name: "Rust standard library".to_owned(),
        license: Some("MIT".to_owned()),
        expression: Some("MIT OR Apache-2.0".to_owned()),
        copyright: vec!["Copyright (c) The Rust Project Developers".to_owned()],
        texts: vec![texts.standard("MIT")?],
        links: vec!["https://github.com/rust-lang/rust/blob/master/COPYRIGHT".to_owned()],
        ..Entry::default()
    }];
    let version_of = |name: &str| {
        crates
            .iter()
            .find(|c| c.name == name)
            .and_then(|c| c.version.as_deref())
    };
    if let Some(version) = version_of("webview2-com-sys") {
        let (sys, sdk) = WEBVIEW2_SYS;
        if version != sys {
            bail!(
                "webview2-com-sys is {version}, not {sys}: check which WebView2 SDK its bindings \
                 pin (crates/update-bindings) and update WEBVIEW2_SYS in xtask/src/notices.rs"
            );
        }
        entries.push(Entry {
            name: "Microsoft WebView2 SDK, static loader (WebView2LoaderStatic.lib)".to_owned(),
            version: Some(sdk.to_owned()),
            license: Some("BSD-style license".to_owned()),
            copyright: vec!["Copyright (C) Microsoft Corporation. All rights reserved.".to_owned()],
            note: Some("Linked into the program by webview2-com-sys.".to_owned()),
            texts: vec![texts.standard("WebView2-SDK")?],
            links: vec![format!(
                "https://www.nuget.org/packages/Microsoft.Web.WebView2/{sdk}/license"
            )],
            ..Entry::default()
        });
    }
    if version_of("libsqlite3-sys").is_some() {
        entries.push(Entry {
            name: "SQLite".to_owned(),
            license: Some("Public domain".to_owned()),
            note: Some("Compiled in by libsqlite3-sys.".to_owned()),
            links: vec!["https://sqlite.org/copyright.html".to_owned()],
            ..Entry::default()
        });
    }
    Ok(entries)
}

fn adapted(crates: &[Entry], texts: &mut Texts) -> Result<Vec<Entry>> {
    let mut entries = Vec::new();
    for (name, link, copyright) in ADAPTED {
        if crates
            .iter()
            .any(|c| c.copyright.iter().any(|line| line == copyright))
        {
            continue;
        }
        entries.push(Entry {
            name: name.to_owned(),
            license: Some("MIT".to_owned()),
            copyright: vec![copyright.to_owned()],
            texts: vec![texts.standard("MIT")?],
            links: vec![link.to_owned()],
            ..Entry::default()
        });
    }
    Ok(entries)
}

fn data(texts: &mut Texts) -> Result<Vec<Entry>> {
    Ok(vec![
        Entry {
            name: "Snap.Metadata".to_owned(),
            license: Some("MIT".to_owned()),
            copyright: vec!["Copyright (c) 2022 DGP Studio".to_owned()],
            note: Some("Some names and event schedules in the program's game data.".to_owned()),
            texts: vec![texts.standard("MIT")?],
            links: vec!["https://github.com/SnapHutaoRemasteringProject/Snap.Metadata".to_owned()],
            ..Entry::default()
        },
        Entry {
            name: "DimbreathBot/AnimeGameData".to_owned(),
            note: Some(
                "The program's game data is generated from its tables. It has no license and \
                 asks for credit."
                    .to_owned(),
            ),
            links: vec!["https://github.com/DimbreathBot/AnimeGameData".to_owned()],
            ..Entry::default()
        },
        Entry {
            name: "game_data.gz".to_owned(),
            note: Some(
                "Built into the program: a game database made from the tables of \
                 DimbreathBot/AnimeGameData. No license covers it."
                    .to_owned(),
            ),
            ..Entry::default()
        },
        Entry {
            name: "Game client keys".to_owned(),
            note: Some(
                "gi.json, built into the program, and two RSA keys in teyvatme-protocol are the \
                 game client's keys. Teyvat.me Capture took them from irminsul and \
                 auto-artifactarium and does not license them; Moongazer's MIT license does not \
                 cover them."
                    .to_owned(),
            ),
            links: vec![
                "https://github.com/tawan475/teyvat.me-capture".to_owned(),
                "https://github.com/konkers/irminsul".to_owned(),
                "https://github.com/hashblen/auto-artifactarium".to_owned(),
            ],
            ..Entry::default()
        },
    ])
}

/// The UI font, built in unmodified.
fn fonts(root: &Path, texts: &mut Texts) -> Result<Vec<Entry>> {
    let path = root.join(FONT_LICENSE);
    let text =
        clean(&fs::read_to_string(&path).with_context(|| format!("reading {}", path.display()))?);
    // The notices head the file; after the first, each starts "Portions Copyright".
    let copyright = text
        .lines()
        .take_while(|line| !line.starts_with("This Font Software"))
        .filter(|line| line.contains("Copyright"))
        .map(str::to_owned)
        .collect();
    Ok(vec![Entry {
        name: "Sarasa Gothic".to_owned(),
        version: Some(SARASA_VERSION.to_owned()),
        license: Some("OFL-1.1".to_owned()),
        copyright,
        note: Some(
            "The UI font: SarasaUiSC-Regular.ttf and SarasaUiSC-SemiBold.ttf from the release, unmodified."
                .to_owned(),
        ),
        texts: vec![texts.add(format!("Sarasa-Gothic-{SARASA_VERSION}/LICENSE"), text)],
        links: vec!["https://github.com/be5invis/Sarasa-Gothic".to_owned()],
        ..Entry::default()
    }])
}

fn css_packages(root: &Path, texts: &mut Texts) -> Result<Vec<Entry>> {
    let mut entries = Vec::new();
    for (name, via) in CSS_PACKAGES {
        let mut dir = root.join(DESKTOP);
        for step in via.iter().chain([&name]) {
            dir = resolve_package(&dir, step)?;
        }
        let manifest = dir.join("package.json");
        let pkg: Value = serde_json::from_str(
            &fs::read_to_string(&manifest)
                .with_context(|| format!("reading {}", manifest.display()))?,
        )?;
        let version = pkg["version"].as_str().unwrap_or_default();
        let mut entry = Entry {
            name: name.to_owned(),
            version: Some(version.to_owned()),
            license: pkg["license"].as_str().map(str::to_owned),
            ..Entry::default()
        };
        let files = license_files(&dir)?;
        if files.is_empty() {
            bail!("npm package {name} has no license file");
        }
        for file in files {
            texts.attach(
                &mut entry,
                format!("{name}-{version}/{}", file.path),
                &file.text,
            )?;
        }
        entries.push(entry);
    }
    Ok(entries)
}

/// The packages in Vite's list. For a choice that includes MIT, the MIT text
/// replaces the first license file Vite took.
fn vite_packages(root: &Path, frontend_dist: &Path, texts: &mut Texts) -> Result<Vec<Entry>> {
    let path = frontend_dist.join(VITE_LICENSES);
    let list: Value = serde_json::from_str(&fs::read_to_string(&path).with_context(|| {
        format!(
            "reading {}; build the frontend first (vite.config.ts sets build.license)",
            path.display()
        )
    })?)
    .with_context(|| format!("parsing {}", path.display()))?;
    let desktop = root.join(DESKTOP);
    let mut entries = Vec::new();
    for item in list
        .as_array()
        .context("Vite's license list is not an array")?
    {
        let name = item["name"].as_str().context("package without a name")?;
        let version = item["version"].as_str().unwrap_or_default();
        let identifier = item["identifier"].as_str();
        let offers_mit = identifier.is_some_and(|id| {
            id != "MIT" && alternatives(id).is_ok_and(|alts| alts.contains(&vec!["MIT".to_owned()]))
        });
        let mit = offers_mit
            .then(|| resolve_package(&desktop, name).ok())
            .flatten()
            .and_then(|dir| license_files(&dir).ok())
            .and_then(|files| files.into_iter().find(|f| f.kind == Some("MIT")));
        let (license, text) = match mit {
            Some(file) => (Some("MIT"), file.text),
            None => (
                identifier,
                clean(
                    item["text"]
                        .as_str()
                        .with_context(|| format!("npm package {name} has no license file"))?,
                ),
            ),
        };
        let mut entry = Entry {
            name: name.to_owned(),
            version: Some(version.to_owned()),
            license: license.map(str::to_owned),
            expression: identifier
                .filter(|&id| Some(id) != license)
                .map(str::to_owned),
            ..Entry::default()
        };
        texts.attach(&mut entry, format!("{name}-{version}"), &text)?;
        entries.push(entry);
    }
    Ok(entries)
}

/// Node's lookup: the nearest `node_modules/<name>` above `from`, with pnpm's
/// links resolved so that its own dependencies are found next to it.
fn resolve_package(from: &Path, name: &str) -> Result<PathBuf> {
    let dir = from
        .ancestors()
        .map(|dir| dir.join("node_modules").join(name))
        .find(|dir| dir.join("package.json").is_file())
        .with_context(|| {
            format!(
                "npm package {name} not found from {}; run pnpm install",
                from.display()
            )
        })?;
    dir.canonicalize()
        .with_context(|| format!("resolving {}", dir.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    const MIT: &str = include_str!("../licenses/MIT.txt");

    #[test]
    fn copyright_lines_need_a_holder_but_no_year_or_c() {
        for line in [
            "Copyright (c) 2016 Dropbox, Inc.",
            "Copyright Mozilla Foundation",
            "  Copyright 2015-2025 Brian Smith.",
            "Copyright \u{a9} 1991-2023 Unicode, Inc.",
            "COPYRIGHT 2020 Example",
            "// Copyright (C) Microsoft Corporation. All rights reserved.",
            "(c) 2020 Example",
        ] {
            assert!(is_copyright_line(line), "{line}");
        }
    }

    #[test]
    fn license_bodies_and_templates_are_not_copyright_lines() {
        for line in [
            "copyright notice and this permission notice appear in all copies.",
            "COPYRIGHT AND PERMISSION NOTICE (UNICODE LICENSE V3)",
            "COPYRIGHT HOLDERS AND CONTRIBUTORS \"AS IS\"",
            "COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE",
            "   Copyright [yyyy] [name of copyright owner]",
            "   Copyright {yyyy} {name of copyright owner}",
            "Copyright (c) <year> <copyright holders>",
            "Grant of Copyright License. Subject to the terms",
            "(c) You must retain, in the Source form of any Derivative Works",
            "(c) under Patent Claims infringed by Covered Software in the absence of",
        ] {
            assert!(!is_copyright_line(line), "{line}");
        }
    }

    #[test]
    fn mit_texts_are_standard_regardless_of_title_copyright_and_wrapping() {
        let words: Vec<&str> = MIT.split_whitespace().collect();
        let lines: Vec<String> = words.chunks(6).map(|w| w.join(" ")).collect();
        let text = format!(
            "The MIT License (MIT)\n\nCopyright (c) 2014 Someone\nCopyright 2020 Other\n\n{}",
            lines.join("\n")
        );
        assert!(is_standard_mit(&text, MIT));
        assert!(is_standard_mit(&format!("MIT License\n\n{MIT}"), MIT));
        assert_eq!(
            copyright_lines(&text),
            ["Copyright (c) 2014 Someone", "Copyright 2020 Other"]
        );
        assert_eq!(
            copyright_lines("// Copyright  2015 Brian Smith.\n"),
            ["Copyright 2015 Brian Smith."]
        );
    }

    #[test]
    fn mit_texts_with_other_words_keep_their_own_text() {
        let extra = format!("{MIT}\nPortions of this software are under another license.");
        assert!(!is_standard_mit(&extra, MIT));
        let reworded = MIT.replace("free of charge", "at no cost");
        assert!(!is_standard_mit(&reworded, MIT));
    }

    #[test]
    fn choices_prefer_mit_then_what_the_package_ships() {
        let allow: Vec<String> = ["MIT", "Apache-2.0", "BSD-3-Clause", "ISC", "Unicode-3.0"]
            .map(str::to_owned)
            .to_vec();
        let pick = |expr, available: &[&str]| choose(expr, &allow, available).ok();
        assert_eq!(
            pick("MIT OR Apache-2.0", &["MIT", "Apache-2.0"]).unwrap_or_default(),
            ["MIT"]
        );
        assert_eq!(pick("Apache-2.0 / MIT", &[]).unwrap_or_default(), ["MIT"]);
        assert_eq!(
            pick("BSD-3-Clause/MIT", &["BSD-3-Clause"]).unwrap_or_default(),
            ["BSD-3-Clause"]
        );
        assert_eq!(
            pick("CC0-1.0 OR MIT-0 OR Apache-2.0", &[]).unwrap_or_default(),
            ["Apache-2.0"]
        );
        assert_eq!(
            pick("(MIT OR Apache-2.0) AND Unicode-3.0", &[]).unwrap_or_default(),
            ["MIT", "Unicode-3.0"]
        );
        assert_eq!(
            pick("Apache-2.0 AND ISC", &[]).unwrap_or_default(),
            ["Apache-2.0", "ISC"]
        );
        assert_eq!(pick("GPL-3.0-only", &[]), None);
        assert_eq!(pick("MPL-2.0", &[]), None);
    }

    #[test]
    fn malformed_expressions_are_rejected() {
        for expr in [
            "",
            "MIT OR",
            "(MIT",
            "MIT Apache-2.0",
            "Apache-2.0 WITH LLVM-exception",
        ] {
            assert!(alternatives(expr).is_err(), "{expr}");
        }
    }

    #[test]
    fn license_kinds_are_told_apart() {
        assert_eq!(kind_of(MIT), Some("MIT"));
        assert_eq!(
            kind_of(include_str!("../licenses/Apache-2.0.txt")),
            Some("Apache-2.0")
        );
        assert_eq!(
            kind_of(include_str!("../licenses/MPL-2.0.txt")),
            Some("MPL-2.0")
        );
        assert_eq!(
            kind_of(include_str!("../licenses/WebView2-SDK.txt")),
            Some("BSD-3-Clause")
        );
        assert_eq!(kind_of("This project is dual-licensed."), None);
    }

    #[test]
    fn authors_lose_their_email_addresses() {
        assert_eq!(
            author_name("Jane Doe <jane@example.com>").as_deref(),
            Some("Jane Doe")
        );
        assert_eq!(author_name("<jane@example.com>"), None);
    }
}
