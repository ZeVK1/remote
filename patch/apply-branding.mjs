// NvaPrime: resmi RustDesk kaynağına marka/sunucu yamalarını uygular.
// Kullanım: node patch/apply-branding.mjs <rustdesk-kaynak-dizini>
// Her değişiklik doğrulanır; beklenen yer bulunamazsa betik HATA ile durur
// (upstream sürümü değiştiğinde sessizce yanlış derleme çıkmasın diye).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const src = path.resolve(process.argv[2] || path.join(root, 'src'));
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));

const need = ['appName', 'company', 'rendezvousServer', 'publicKey'];
for (const k of need) if (!cfg[k]) throw new Error(`config.json: "${k}" boş olamaz`);
if (!/^[A-Za-z][A-Za-z0-9]*$/.test(cfg.appName))
  throw new Error('appName yalnızca harf/rakam olmalı (exe, servis ve kayıt defteri adı olarak kullanılır)');
if (!/^[A-Za-z0-9+/]{43}=$/.test(cfg.publicKey))
  throw new Error('publicKey geçerli bir ed25519 açık anahtarı (base64, 44 karakter) olmalı');

const exe = `${cfg.appName}.exe`;
let changed = 0;

function edit(rel, fn, label) {
  const p = path.join(src, rel);
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`YAMA UYGULANAMADI: ${rel} :: ${label}`);
  fs.writeFileSync(p, after);
  changed++;
  console.log(`ok  ${rel} :: ${label}`);
}
function replaceOnce(text, from, to) {
  if (!text.includes(from)) return text;
  return text.replace(from, () => to);
}

// 1) Uygulama adı + sunucu + anahtar (hbb_common)
edit('libs/hbb_common/src/config.rs', t => replaceOnce(t,
  'RwLock::new("RustDesk".to_owned())', `RwLock::new("${cfg.appName}".to_owned())`), 'APP_NAME');
edit('libs/hbb_common/src/config.rs', t => replaceOnce(t,
  'pub const RENDEZVOUS_SERVERS: &[&str] = &["rs-ny.rustdesk.com"];',
  `pub const RENDEZVOUS_SERVERS: &[&str] = &["${cfg.rendezvousServer}"];`), 'RENDEZVOUS_SERVERS');
edit('libs/hbb_common/src/config.rs', t => t.replace(
  /pub const RS_PUB_KEY: &str = "[^"]*";/, () => `pub const RS_PUB_KEY: &str = "${cfg.publicKey}";`), 'RS_PUB_KEY');

if (cfg.apiServer) {
  edit('libs/hbb_common/src/config.rs', t => replaceOnce(t,
    'pub static ref DEFAULT_SETTINGS: RwLock<HashMap<String, String>> = Default::default();',
    `pub static ref DEFAULT_SETTINGS: RwLock<HashMap<String, String>> = RwLock::new(HashMap::from([("api-server".to_owned(), "${cfg.apiServer}".to_owned())]));`),
    'api-server varsayılanı');
}

// 2) Windows exe adı: kod, exe adının "<APP_NAME>.exe" olmasını bekler (kurulum/servis/--server)
edit('flutter/windows/CMakeLists.txt', t => replaceOnce(t,
  'set(BINARY_NAME "rustdesk")', `set(BINARY_NAME "${cfg.appName}")`), 'BINARY_NAME');
edit('build.py', t => replaceOnce(t,
  "-e ../../{flutter_build_dir_2}/rustdesk.exe')", `-e ../../{flutter_build_dir_2}/${exe}')`), 'portable paketleyici exe adı');

// 3) Windows dosya özellikleri (SmartScreen/UAC'de görünen ad)
edit('flutter/windows/runner/Runner.rc', t => t
  .replace('VALUE "CompanyName", "Purslane Ltd"', `VALUE "CompanyName", "${cfg.company}"`)
  .replace('VALUE "FileDescription", "RustDesk Remote Desktop"', `VALUE "FileDescription", "${cfg.productDescription}"`)
  .replace('VALUE "InternalName", "rustdesk"', `VALUE "InternalName", "${cfg.appName}"`)
  .replace('VALUE "LegalCopyright", "Copyright © 2025 Purslane Ltd. All rights reserved."',
           `VALUE "LegalCopyright", "${cfg.company}. Based on RustDesk (c) Purslane Ltd, AGPL-3.0"`)
  .replace('VALUE "OriginalFilename", "rustdesk.exe"', `VALUE "OriginalFilename", "${exe}"`)
  .replace('VALUE "ProductName", "RustDesk"', `VALUE "ProductName", "${cfg.appName}"`), 'Runner.rc');
for (const rel of ['Cargo.toml', 'libs/portable/Cargo.toml']) {
  edit(rel, t => t
    .replace('ProductName = "RustDesk"', `ProductName = "${cfg.appName}"`)
    .replace('FileDescription = "RustDesk Remote Desktop"', `FileDescription = "${cfg.productDescription}"`)
    .replace('OriginalFilename = "rustdesk.exe"', `OriginalFilename = "${exe}"`), `${rel} winres`);
}

// 4) Simgeler
const icons = {
  'icon.ico': ['res/icon.ico', 'res/tray-icon.ico', 'flutter/windows/runner/resources/app_icon.ico'],
  'icon.png': ['res/icon.png', 'res/mac-icon.png'],
  '32x32.png': ['res/32x32.png'],
  '64x64.png': ['res/64x64.png'],
  '128x128.png': ['res/128x128.png'],
  '128x128@2x.png': ['res/128x128@2x.png'],
};
for (const [from, tos] of Object.entries(icons)) {
  const f = path.join(root, 'branding', from);
  if (!fs.existsSync(f)) throw new Error(`branding/${from} yok`);
  for (const to of tos) {
    const dst = path.join(src, to);
    if (!fs.existsSync(path.dirname(dst))) throw new Error(`hedef klasör yok: ${to}`);
    fs.copyFileSync(f, dst);
    changed++;
    console.log(`ok  ${to} <- branding/${from}`);
  }
}
// Uygulama içi logo (common.dart assets/icon.png'yi okur; yoksa svg'ye düşer)
const assetIcon = path.join(src, 'flutter/assets/icon.png');
fs.copyFileSync(path.join(root, 'branding/icon.png'), assetIcon);
changed++;

console.log(`\nTamam: ${changed} değişiklik uygulandı (${cfg.appName}, ${cfg.rendezvousServer}).`);
