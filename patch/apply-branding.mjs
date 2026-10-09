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
  if (text.includes('\r\n')) { // CRLF'li dosyalarda çok satırlı yamalar için
    from = from.replace(/\r?\n/g, '\r\n');
    to = to.replace(/\r?\n/g, '\r\n');
  }
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

// Uzak ekran pencereden büyükken fare kenara gelince görüntünün kayması (scrollauto + original)
// yerine: görüntü pencereye sığsın, kayma olmasın.
edit('libs/hbb_common/src/config.rs', t => replaceOnce(t,
  'keys::OPTION_VIEW_STYLE => self.get_string(key, "original", vec!["adaptive"]),',
  'keys::OPTION_VIEW_STYLE => self.get_string(key, "adaptive", vec!["original"]),'), 'varsayılan görünüm: adaptive');
edit('libs/hbb_common/src/config.rs', t => replaceOnce(t,
  'self.get_string(key, "scrollauto", vec!["scrolledge", "scrollbar"])',
  'self.get_string(key, "scrollbar", vec!["scrollauto", "scrolledge"])'), 'varsayılan kaydırma: scrollbar');

// 5) Arayüz: AnyDesk benzeri düzen (kırmızı vurgu + üstte büyük "çalışma alanı" ID bandı)
edit('flutter/lib/common.dart', t => t
  .replace('static const Color accent = Color(0xFF0071FF);', 'static const Color accent = Color(0xFFEF443B);')
  .replace('static const Color accent50 = Color(0x770071FF);', 'static const Color accent50 = Color(0x77EF443B);')
  .replace('static const Color accent80 = Color(0xAA0071FF);', 'static const Color accent80 = Color(0xAAEF443B);')
  .replace('static const Color button = Color(0xFF2C8CFF);', 'static const Color button = Color(0xFFEF443B);')
  .replaceAll('primary: Colors.blue,', 'primary: Color(0xFFEF443B),'), 'kırmızı vurgu rengi');

const homeDart = 'flutter/lib/desktop/pages/desktop_home_page.dart';
edit(homeDart, t => replaceOnce(t,
`    return _buildBlock(
        child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildLeftPane(context),
        if (!isIncomingOnly) const VerticalDivider(width: 1),
        if (!isIncomingOnly) Expanded(child: buildRightPane(context)),
      ],
    ));`,
`    final body = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildLeftPane(context),
        if (!isIncomingOnly) const VerticalDivider(width: 1),
        if (!isIncomingOnly) Expanded(child: buildRightPane(context)),
      ],
    );
    if (isIncomingOnly || bind.isOutgoingOnly()) {
      return _buildBlock(child: body);
    }
    return _buildBlock(
        child: Column(children: [
      _buildNvaHeader(context),
      const Divider(height: 1),
      _buildNvaHelp(context),
      Expanded(child: buildRightPane(context)),
    ]));`), 'ana düzen: üst bant + gövde (yan menü yok)');
// Sol panelde ID kutusu artık üst bantta (yalnızca "yalnız gelen" modunda solda kalır)
edit(homeDart, t => replaceOnce(t,
  '      if (!isOutgoingOnly) buildIDBoard(context),',
  '      if (!isOutgoingOnly && isIncomingOnly) buildIDBoard(context),'), 'sol panel: ID kutusu kaldırıldı');
edit(homeDart, t => replaceOnce(t,
`  buildRightPane(BuildContext context) {`,
`  Widget _buildNvaHeader(BuildContext context) {
    final model = gFFI.serverModel;
    final textColor = Theme.of(context).textTheme.titleLarge?.color;
    return Container(
      width: double.infinity,
      color: Theme.of(context).colorScheme.background,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            translate("Your Desktop"),
            style: TextStyle(fontSize: 16, color: textColor?.withOpacity(0.7)),
          ),
          const SizedBox(width: 16),
          AnimatedBuilder(
            animation: model.serverId,
            builder: (_, __) => SelectableText(
              model.serverId.text,
              style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w600,
                  color: MyTheme.accent),
            ),
          ),
          const SizedBox(width: 8),
          Tooltip(
            message: translate("Copy"),
            child: IconButton(
              icon: Icon(Icons.copy_rounded,
                  size: 20, color: textColor?.withOpacity(0.6)),
              onPressed: () {
                Clipboard.setData(ClipboardData(text: model.serverId.text));
                showToast(translate("Copied"));
              },
            ),
          ),
          const SizedBox(width: 20),
          _buildNvaPassword(context),
          const SizedBox(width: 16),
          OutlinedButton.icon(
            icon: const Icon(Icons.share_outlined, size: 18),
            label: const Text('Davet et'),
            onPressed: () {
              // Karşı tarafa gönderilecek hazır mesaj: ID + tek kullanımlık parola + indirme adresi
              final msg = 'NvaPrime Remote ile bana bağlanabilirsiniz:\\n' +
                  'ID: ' + model.serverId.text + '\\n' +
                  'Parola: ' + model.serverPasswd.text + '\\n' +
                  'İndir: ${cfg.apiServer || 'https://' + cfg.rendezvousServer}';
              Clipboard.setData(ClipboardData(text: msg));
              showToast('Davet metni kopyalandı');
            },
          ),
          const Spacer(),
          _buildNvaAccount(context),
          const SizedBox(width: 8),
          buildPopupMenu(context),
        ],
      ),
    );
  }

  Widget _buildNvaAccount(BuildContext context) {
    return Obx(() {
      final um = gFFI.userModel;
      if (!um.isLogin) {
        return Row(children: [
          OutlinedButton.icon(
            icon: const Icon(Icons.account_circle_outlined, size: 18),
            label: Text(translate("Login")),
            onPressed: () async {
              await loginDialog();
            },
          ),
          const SizedBox(width: 6),
          TextButton(
            onPressed: () => launchUrl(Uri.parse('${cfg.apiServer || 'https://' + cfg.rendezvousServer}/register')),
            child: const Text('Kayıt ol'),
          ),
        ]);
      }
      return Row(children: [
        const _NvaLicenseChip(),
        const SizedBox(width: 8),
        Tooltip(
          message: translate("Logout"),
          child: TextButton.icon(
            icon: const Icon(Icons.account_circle, size: 18, color: MyTheme.accent),
            label: Text(um.userName.value),
            onPressed: logOutConfirmDialog,
          ),
        ),
      ]);
    });
  }

  // Tek kullanımlık parola (eski yan menüden üst banda taşındı)
  Widget _buildNvaPassword(BuildContext context) {
    final textColor = Theme.of(context).textTheme.titleLarge?.color;
    return ChangeNotifierProvider.value(
      value: gFFI.serverModel,
      child: Consumer<ServerModel>(builder: (context, model, child) {
        final showOneTime = model.approveMode != 'click' &&
            model.verificationMethod != kUsePermanentPassword;
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(translate("One-time Password"),
                style: TextStyle(
                    fontSize: 12, color: textColor?.withOpacity(0.55))),
            Row(mainAxisSize: MainAxisSize.min, children: [
              AnimatedBuilder(
                animation: model.serverPasswd,
                builder: (_, __) => GestureDetector(
                  onTap: () {
                    if (showOneTime) {
                      Clipboard.setData(
                          ClipboardData(text: model.serverPasswd.text));
                      showToast(translate("Copied"));
                    }
                  },
                  child: Text(
                    showOneTime ? model.serverPasswd.text : '••••••',
                    style: const TextStyle(
                        fontSize: 20, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              if (showOneTime)
                IconButton(
                  tooltip: translate('Refresh Password'),
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                  constraints:
                      const BoxConstraints(minWidth: 30, minHeight: 30),
                  icon: const Icon(Icons.refresh, size: 18),
                  onPressed: () => bind.mainUpdateTemporaryPassword(),
                ),
              if (!bind.isDisableSettings())
                IconButton(
                  tooltip: translate('Change Password'),
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                  constraints:
                      const BoxConstraints(minWidth: 30, minHeight: 30),
                  icon: const Icon(Icons.edit, size: 18),
                  onPressed: () =>
                      DesktopSettingPage.switch2page(SettingsTabKey.safety),
                ),
            ]),
          ],
        );
      }),
    );
  }

  // Yükleme/güncelleme gibi yardım kartları (eski yan menüdeydi); kart yoksa yer kaplamaz
  Widget _buildNvaHelp(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: gFFI.serverModel,
      child: Obx(() => Container(
            alignment: Alignment.centerLeft,
            constraints: const BoxConstraints(maxWidth: 560),
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: buildHelpCards(stateGlobal.updateUrl.value),
          )),
    );
  }

  buildRightPane(BuildContext context) {`), 'üst bant (_buildNvaHeader)');
edit(homeDart, t => replaceOnce(t,
  "import 'package:flutter_hbb/common/widgets/custom_password.dart';",
  "import 'package:flutter_hbb/common/widgets/custom_password.dart';\nimport 'package:flutter_hbb/common/widgets/login.dart';\nimport 'package:http/http.dart' as http;"), 'import: login + http');
edit(homeDart, t => t.replace(/\s*$/, '\n') + fs.readFileSync(path.join(root, 'branding/dart/nva_account.dart'), 'utf8'), 'lisans rozeti sınıfı');

// 6) Sağ bölme: AnyDesk'teki gibi üst sekmeler (Haberler / Cihazlar) + haber kutuları
const connDart = 'flutter/lib/desktop/pages/connection_page.dart';
edit(connDart, t => replaceOnce(t,
  "import 'package:flutter_hbb/consts.dart';",
  "import 'package:flutter_hbb/consts.dart';\nimport 'package:flutter_hbb/common/widgets/login.dart';\nimport 'package:flutter_hbb/desktop/pages/desktop_tab_page.dart';\nimport 'package:http/http.dart' as http;"), 'connection: importlar');
edit(connDart, t => replaceOnce(t,
  "  String selectedConnectionType = 'Connect';",
  "  String selectedConnectionType = 'Connect';\n  int _nvaTab = 0; // 0: Haberler, 1: Cihazlar, 2: Oturum geçmişi"), 'connection: sekme durumu');
edit(connDart, t => replaceOnce(t,
`            Divider().paddingOnly(right: 12),
            Expanded(child: PeerTabPage()),`,
`            _NvaTabBar(
                index: _nvaTab,
                onChanged: (i) => setState(() => _nvaTab = i)),
            Divider(height: 1).paddingOnly(right: 12),
            Expanded(
                child: _nvaTab == 0
                    ? const NvaNewsPanel()
                    : (_nvaTab == 2 ? const NvaSessionsPanel() : PeerTabPage())),`), 'connection: sekmeler');
// Hakkında sayfası: bağlantılar rustdesk.com yerine kendi sitemize; telif/slogan/renk
const settingsDart = 'flutter/lib/desktop/pages/desktop_setting_page.dart';
const site = cfg.apiServer || ('https://' + cfg.rendezvousServer);
edit(settingsDart, t => replaceOnce(t,
  "launchUrlString('https://rustdesk.com/privacy.html');",
  "launchUrlString('" + site + "/privacy');"), 'hakkında: gizlilik bağlantısı');
edit(settingsDart, t => replaceOnce(t,
  "launchUrlString('https://rustdesk.com');",
  "launchUrlString('" + site + "');"), 'hakkında: website bağlantısı');
edit(settingsDart, t => replaceOnce(t,
  "'Copyright © ${DateTime.now().toString().substring(0, 4)} Purslane Ltd.\\n$license',",
  "'© ${DateTime.now().toString().substring(0, 4)} " + cfg.company + ". RustDesk (© Purslane Ltd.) tabanlıdır, AGPL-3.0.\\n$license',"), 'hakkında: telif metni');
edit(settingsDart, t => replaceOnce(t,
  "translate('Slogan_tip'),",
  "'Herkes için ücretsiz ve açık kaynak uzak masaüstü.',"), 'hakkında: slogan');
edit(settingsDart, t => replaceOnce(t,
  "decoration: const BoxDecoration(color: Color(0xFF2c8cff)),",
  "decoration: const BoxDecoration(color: Color(0xFFEF443B)),"), 'hakkında: renk');
// Takma ad ile bağlanma: "ad@kullanici" yazılırsa sunucudan gerçek ID'ye çevrilir
edit(connDart, t => replaceOnce(t,
`  void onConnect(
      {bool isFileTransfer = false,
      bool isViewCamera = false,
      bool isTerminal = false}) {
    var id = _idController.id;
    connect(context, id,`,
`  void onConnect(
      {bool isFileTransfer = false,
      bool isViewCamera = false,
      bool isTerminal = false}) async {
    var id = _idController.id;
    if (id.contains('@') && !RegExp(r'^[0-9]+@').hasMatch(id)) {
      final resolved = await _nvaResolveAlias(id);
      if (resolved == null) {
        showToast('Takma ad bulunamadı: ' + id);
        return;
      }
      id = resolved;
    }
    connect(context, id,`), 'connection: takma ad çözümleme');
// Alttaki "kendi sunucunuzu kurun" reklamı kaldırılsın
edit(connDart, t => replaceOnce(t,
  '            if (!isIncomingOnly) setupServerWidget(),',
  '            // (kendi sunucunuzu kurun reklamı kaldırıldı)'), 'connection: sunucu reklamı');
edit(connDart, t => t.replace(/\s*$/, '\n') + fs.readFileSync(path.join(root, 'branding/dart/nva_news.dart'), 'utf8'), 'connection: haber paneli sınıfları');
// Sol paneldeki tekrar eden "Sizin Masaüstünüz" başlığı (artık üst bantta)
edit(homeDart, t => replaceOnce(t,
`              if (!isOutgoingOnly)
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    translate("Your Desktop"),`,
`              if (false)
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    translate("Your Desktop"),`), 'sol panel: tekrar eden başlık');

// Eski kayıtlı cihaz ayarları: RustDesk'in ilk varsayılanı (orijinal boyut + otomatik kaydırma) fareyle ekranın kaymasına
// yol açıyordu. Bu iki değer birlikte kayıtlıysa bir kerelik yeni varsayılana çevrilir.
edit('libs/hbb_common/src/config.rs', t => replaceOnce(t,
`                let mut config: PeerConfig = config;
                let mut store = false;`,
`                let mut config: PeerConfig = config;
                let mut store = false;
                if config.view_style == "original" && config.scroll_style == "scrollauto" {
                    config.view_style = "adaptive".to_owned();
                    config.scroll_style = "scrollbar".to_owned();
                    store = true;
                }`), 'eski cihaz ayarı geçişi (ekran kayması)');
// Ana pencere varsayılan boyutu (yan menü kalktı, üst bant geniş): 800x600 -> 1100x720
edit('flutter/windows/runner/main.cpp', t => replaceOnce(t,
  'Win32Window::Size size(800u, 600u);',
  'Win32Window::Size size(1100u, 720u);'), 'varsayılan pencere boyutu');

// 7) Uzaktan (otomatik) güncelleme: kendi sunucumuz + GitHub sürümleri + İMZA DOĞRULAMA
if (cfg.appVersion) {
  // Ürün sürümü (ör. 1.4.6-2): RustDesk "1.4.6-N" biçimini ve sürüm karşılaştırmasını kendi içinde destekler
  edit('Cargo.toml', t => replaceOnce(t, 'version = "1.4.6"', `version = "${cfg.appVersion}"`), 'ürün sürümü');
}
edit('libs/hbb_common/src/lib.rs', t => replaceOnce(t,
  'const URL: &str = "https://api.rustdesk.com/version/latest";',
  `const URL: &str = "${cfg.apiServer}/version/latest";`), 'güncelleme denetimi adresi');
const updRs = 'src/updater.rs';
edit(updRs, t => replaceOnce(t,
  '"{}/rustdesk-{}-x86_64.{}",',
  `"{}/${cfg.appName}-{}-portable.{}",`), 'güncelleme dosya adı');
edit(updRs, t => replaceOnce(t,
  'const DUR_ONE_DAY: Duration = Duration::from_secs(60 * 60 * 24);',
  'const DUR_ONE_DAY: Duration = Duration::from_secs(60 * 60 * 4);'), 'denetim aralığı: 4 saat');
if (!cfg.updatePublicKey) throw new Error('config.json: updatePublicKey gerekli (imzasız güncelleme kabul edilmez)');
edit(updRs, t => replaceOnce(t,
  "        // We have checked if the `conns` is empty before, but we need to check again.",
`        // NvaPrime: yalnızca bizim anahtarımızla imzalanmış sürümler kurulur (sunucu/depo ele geçirilse bile)
        if let Err(e) = verify_update_signature(&client, &download_url, &file_path) {
            log::error!("Update signature check failed: {}", e);
            std::fs::remove_file(&file_path).ok();
            bail!("Update signature check failed: {}", e);
        }
        // We have checked if the \`conns\` is empty before, but we need to check again.`), 'imza doğrulama çağrısı');
edit(updRs, t => t.replace(/\s*$/, '\n') + `
/// "<dosya>.sig" = Ed25519 imzalı (imza||özet) 96 bayt; özet, indirilen dosyanın SHA-256'sıdır.
fn verify_update_signature(
    client: &reqwest::blocking::Client,
    download_url: &str,
    file_path: &PathBuf,
) -> ResultType<()> {
    use hbb_common::sodiumoxide::crypto::sign;
    use sha2::{Digest, Sha256};
    const UPDATE_PK_B64: &str = "${cfg.updatePublicKey}";
    let Some(pk) = crate::common::get_rs_pk(UPDATE_PK_B64) else {
        bail!("Invalid update public key");
    };
    let resp = client.get(format!("{}.sig", download_url)).send()?;
    if !resp.status().is_success() {
        bail!("Failed to download the signature: {}", resp.status());
    }
    let signed = resp.bytes()?;
    let Ok(signed_digest) = sign::verify(&signed, &pk) else {
        bail!("Signature mismatch");
    };
    let mut hasher = Sha256::new();
    let mut f = std::fs::File::open(file_path)?;
    std::io::copy(&mut f, &mut hasher)?;
    let digest = hasher.finalize();
    if digest.as_slice() != signed_digest.as_slice() {
        bail!("Update file digest mismatch");
    }
    Ok(())
}
`, 'imza doğrulama işlevi');

if (cfg.apiServer) {
  edit('libs/hbb_common/src/config.rs', t => replaceOnce(t,
    'pub static ref DEFAULT_SETTINGS: RwLock<HashMap<String, String>> = Default::default();',
    `pub static ref DEFAULT_SETTINGS: RwLock<HashMap<String, String>> = RwLock::new(HashMap::from([("api-server".to_owned(), "${cfg.apiServer}".to_owned()), ("allow-auto-update".to_owned(), "Y".to_owned())]));`),
    'api-server + otomatik güncelleme varsayılanları');
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
