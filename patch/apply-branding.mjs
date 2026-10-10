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
// Plan izinleri: her masaüstü bağlantısı (kartlar, geçmiş, adres defteri, alt pencereler) buradan geçer
edit('flutter/lib/common.dart', t => replaceOnce(t,
`    bool? isSharedPassword}) async {
  if (isFileTransfer) {
    await rustDeskWinManager.newFileTransfer(id,`,
`    bool? isSharedPassword}) async {
  final nvaDenied = await _nvaSessionCheck(
      id,
      isFileTransfer
          ? 'file'
          : (isTcpTunneling || isRDP)
              ? 'tunnel'
              : isTerminal
                  ? 'terminal'
                  : isViewCamera
                      ? 'camera'
                      : 'remote');
  if (nvaDenied != null) {
    _nvaShowDenied(nvaDenied);
    return;
  }
  if (isFileTransfer) {
    await rustDeskWinManager.newFileTransfer(id,`), 'bağlantı öncesi plan denetimi');
edit('flutter/lib/common.dart', t => t.replace(/\s*$/, '\n') + fs.readFileSync(path.join(root, 'branding/dart/nva_limits.dart'), 'utf8'), 'plan denetimi yardımcıları');
// Cihazlar sekmesi (AnyDesk gibi): simgelerin yanında ad (Son oturumlar, Favoriler, Keşfedilenler, Adres defteri);
// planda adres defteri yoksa o sekme gizlenir
const peerTabDart = 'flutter/lib/common/widgets/peer_tab_page.dart';
edit(peerTabDart, t => replaceOnce(t,
`                        child: Icon(model.tabIcon(t), color: color)
                            .paddingSymmetric(horizontal: 4),`,
`                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Icon(model.tabIcon(t), color: color, size: 16),
                          const SizedBox(width: 6),
                          Text(model.tabTooltip(t),
                              style: TextStyle(color: color, fontSize: 14)),
                        ]).paddingSymmetric(horizontal: 6),`), 'cihaz sekmeleri: yazılı');
edit(peerTabDart, t => replaceOnce(t,
`        children: model.visibleEnabledOrderedIndexs.map((t) {
          final selected = model.currentTab == t;`,
`        children: model.visibleEnabledOrderedIndexs
            .where((t) =>
                nvaAllowAddressBook.value || t != PeerTabIndex.ab.index)
            .map((t) {
          final selected = model.currentTab == t;`), 'cihaz sekmeleri: plana göre adres defteri');
edit(peerTabDart, t => replaceOnce(t,
`  Widget _createPeersView() {
    final model = Provider.of<PeerTabModel>(context);`,
`  Widget _createPeersView() {
    final model = Provider.of<PeerTabModel>(context);
    if (!nvaAllowAddressBook.value && model.currentTab == PeerTabIndex.ab.index) {
      Future.microtask(() => handleTabSelection(PeerTabIndex.recent.index));
    }`), 'cihaz sekmeleri: gizli sekmeden çık');

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
    // Adres çubuğu ve "Bu çalışma alanı" bloğu bağlantı sayfasında çizilir; parçaları buradan verilir
    nvaWorkspaceBuilder = _buildNvaWorkspace;
    nvaHeaderActionsBuilder = _buildNvaActions;
    return _buildBlock(
        child: Column(children: [
      _buildNvaHelp(context),
      Expanded(child: buildRightPane(context)),
    ]));`), 'ana düzen: adres çubuğu + çalışma alanı (yan menü yok)');
// Sol panelde ID kutusu artık üst bantta (yalnızca "yalnız gelen" modunda solda kalır)
edit(homeDart, t => replaceOnce(t,
  '      if (!isOutgoingOnly) buildIDBoard(context),',
  '      if (!isOutgoingOnly && isIncomingOnly) buildIDBoard(context),'), 'sol panel: ID kutusu kaldırıldı');
edit(homeDart, t => replaceOnce(t,
`  buildRightPane(BuildContext context) {`,
`  // Adres çubuğunun sağı: hesap/lisans + ana menü
  Widget _buildNvaActions(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      const SizedBox(width: 12),
      _buildNvaAccount(context),
      const SizedBox(width: 4),
      _buildNvaMainMenu(context),
    ]);
  }

  // AnyDesk'teki gibi ana menü (önceden yalnızca Ayarlar açılıyordu)
  Widget _buildNvaMainMenu(BuildContext context) {
    final textColor = Theme.of(context).textTheme.titleLarge?.color;
    PopupMenuItem<int> item(int v, IconData icon, String text) =>
        PopupMenuItem<int>(
          value: v,
          height: 36,
          child: Row(children: [
            Icon(icon, size: 18, color: textColor?.withOpacity(0.7)),
            const SizedBox(width: 12),
            Text(text, style: const TextStyle(fontSize: 14)),
          ]),
        );
    return PopupMenuButton<int>(
      tooltip: 'Menü',
      icon: Icon(Icons.menu, color: textColor?.withOpacity(0.7)),
      onSelected: (v) async {
        switch (v) {
          case 0:
            DesktopTabPage.onAddSetting();
            break;
          case 1:
            DesktopSettingPage.switch2page(SettingsTabKey.safety);
            break;
          case 2:
            nvaMainTab.value = 1;
            gFFI.peerTabModel.setCurrentTab(PeerTabIndex.ab.index);
            break;
          case 3:
            nvaMainTab.value = 2;
            break;
          case 4:
            final dir = bind.mainVideoSaveDirectory(root: false);
            try {
              await Directory(dir).create(recursive: true);
            } catch (_) {}
            await launchUrl(Uri.file(dir));
            break;
          case 5:
            await launchUrl(Uri.parse('${cfg.apiServer || 'https://' + cfg.rendezvousServer}/dashboard'));
            break;
          case 6:
            DesktopSettingPage.switch2page(SettingsTabKey.about);
            break;
        }
      },
      itemBuilder: (_) => [
        item(0, Icons.settings_outlined, translate('Settings')),
        item(1, Icons.lock_outline, 'Çalışma alanı parolasını değiştir'),
        if (nvaAllowAddressBook.value)
          item(2, Icons.contacts_outlined, translate('Address book')),
        item(3, Icons.history, 'Oturum geçmişi'),
        item(4, Icons.videocam_outlined, 'Oturum kayıtları'),
        const PopupMenuDivider(),
        item(5, Icons.language, 'Web paneli'),
        item(6, Icons.info_outline, 'Sürüm ve güncellemeler'),
      ],
    );
  }

  // Ortadaki blok: "Bu çalışma alanı" + büyük ID + parola + Davet et
  Widget _buildNvaWorkspace(BuildContext context) {
    final model = gFFI.serverModel;
    final textColor = Theme.of(context).textTheme.titleLarge?.color;
    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 14,
      runSpacing: 10,
      children: [
          Text(
            'Bu çalışma alanı',
            style: TextStyle(fontSize: 18, color: textColor?.withOpacity(0.75)),
          ),
          AnimatedBuilder(
            animation: model.serverId,
            builder: (_, __) => SelectableText(
              model.serverId.text,
              style: const TextStyle(
                  fontSize: 46,
                  fontWeight: FontWeight.w500,
                  letterSpacing: 1,
                  color: MyTheme.accent),
            ),
          ),
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
          _buildNvaPassword(context),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: MyTheme.accent,
              side: const BorderSide(color: MyTheme.accent),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(3)),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
            icon: const Icon(Icons.share_outlined, size: 18),
            label: const Text('Davet et'),
            // Davet: ID / takma ada "bana bağlanın" bildirimi ya da ID + parola + indirme adresini kopyala
            onPressed: () => nvaShowInviteDialog(
                model.serverId.text,
                model.serverPasswd.text,
                '${cfg.apiServer || 'https://' + cfg.rendezvousServer}'),
          ),
      ],
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
  "import 'package:flutter_hbb/common/widgets/custom_password.dart';\nimport 'package:flutter_hbb/common/widgets/login.dart';\nimport 'package:flutter_hbb/models/peer_tab_model.dart';\nimport 'package:http/http.dart' as http;"), 'import: login + http');
edit(homeDart, t => t.replace(/\s*$/, '\n') + fs.readFileSync(path.join(root, 'branding/dart/nva_account.dart'), 'utf8'), 'lisans rozeti sınıfı');

// 6) Sağ bölme: AnyDesk'teki gibi üst sekmeler (Haberler / Cihazlar) + haber kutuları
const connDart = 'flutter/lib/desktop/pages/connection_page.dart';
edit(connDart, t => replaceOnce(t,
  "import 'package:flutter_hbb/consts.dart';",
  "import 'package:flutter_hbb/consts.dart';\nimport 'package:flutter/services.dart';\nimport 'package:flutter_hbb/common/widgets/login.dart';\nimport 'package:flutter_hbb/desktop/pages/desktop_tab_page.dart';\nimport 'package:http/http.dart' as http;"), 'connection: importlar');
edit(connDart, t => replaceOnce(t,
  "  String selectedConnectionType = 'Connect';",
  "  String selectedConnectionType = 'Connect';\n  int _nvaTab = 0; // 0: Haberler, 1: Cihazlar, 2: Oturum geçmişi"), 'connection: sekme durumu');
// Düzen (AnyDesk benzeri): en üstte tam genişlik adres çubuğu, lisans şeridi,
// ortada "Bu çalışma alanı", altta sekmeler (Haberler / Cihazlar / Oturum geçmişi)
edit(connDart, t => replaceOnce(t,
`    return Column(
      children: [
        Expanded(
            child: Column(
          children: [
            Row(
              children: [
                Flexible(child: _buildRemoteIDTextField(context)),
              ],
            ).marginOnly(top: 22),
            SizedBox(height: 12),
            Divider().paddingOnly(right: 12),
            Expanded(child: PeerTabPage()),
          ],
        ).paddingOnly(left: 12.0)),`,
`    return Column(
      children: [
        Container(
          color: Theme.of(context).colorScheme.background,
          padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
          child: Row(children: [
            Expanded(child: _buildRemoteIDTextField(context)),
            if (nvaHeaderActionsBuilder != null)
              nvaHeaderActionsBuilder!(context),
          ]),
        ),
        const Divider(height: 1),
        const NvaLicenseBanner(),
        if (nvaWorkspaceBuilder != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 30, 24, 26),
            child: nvaWorkspaceBuilder!(context),
          ),
        Expanded(
            child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Obx(() => _NvaTabBar(
                index: nvaMainTab.value,
                onChanged: (i) => nvaMainTab.value = i)),
            const Divider(height: 1),
            Expanded(
                child: Obx(() => nvaMainTab.value == 0
                    ? const NvaNewsPanel()
                    : (nvaMainTab.value == 2
                        ? const NvaSessionsPanel()
                        : PeerTabPage()))),
          ],
        ).paddingSymmetric(horizontal: 30)),
        const NvaInviteListener(),`), 'connection: adres çubuğu + çalışma alanı + sekmeler');
// Uzak ID kutusu: kart yerine tek satırlık adres çubuğu (durum noktası + kutu + Bağlan + menü)
edit(connDart, t => replaceOnce(t,
`      width: 320 + 20 * 2,
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 22),`,
`      width: double.infinity,
      padding: EdgeInsets.zero,`), 'adres çubuğu: genişlik');
edit(connDart, t => replaceOnce(t,
`        child: Column(
          children: [
            getConnectionPageTitle(context, false).marginOnly(bottom: 15),
            Row(
              children: [
                Expanded(
                    child: RawAutocomplete<Peer>(`,
`        child: Row(
          children: [
            Obx(() => Tooltip(
                  message: stateGlobal.svcStatus.value == SvcStatus.ready
                      ? translate('Ready')
                      : translate('Not ready'),
                  child: Icon(Icons.circle,
                      size: 11,
                      color: stateGlobal.svcStatus.value == SvcStatus.ready
                          ? const Color(0xFF32BEA6)
                          : Colors.orange),
                )).marginOnly(right: 10),
            Expanded(
                child: Row(
              children: [
                Expanded(
                    child: RawAutocomplete<Peer>(`), 'adres çubuğu: tek satır');
edit(connDart, t => replaceOnce(t,
`                )),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(top: 13.0),
              child: Row(mainAxisAlignment: MainAxisAlignment.end, children: [`,
`                )),
              ],
            )),
            Padding(
              padding: const EdgeInsets.only(left: 10.0),
              child: Row(mainAxisSize: MainAxisSize.min, children: [`), 'adres çubuğu: düğmeler yanda');
edit(connDart, t => replaceOnce(t,
`                          style: const TextStyle(
                            fontFamily: 'WorkSans',
                            fontSize: 22,
                            height: 1.4,
                          ),`,
`                          style: const TextStyle(
                            fontFamily: 'WorkSans',
                            fontSize: 17,
                            height: 1.3,
                          ),`), 'adres çubuğu: yazı boyu');
edit(connDart, t => replaceOnce(t,
`                                  : translate('Enter Remote ID'),
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 15, vertical: 13)),`,
`                                  : 'Uzak adresi girin (ID ya da ad@kullanıcı)',
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 10)),`), 'adres çubuğu: ipucu');
edit(connDart, t => replaceOnce(t,
`    return Container(
        constraints: const BoxConstraints(maxWidth: 600), child: w);`,
`    return w;`), 'adres çubuğu: tam genişlik');
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
  "'© ${DateTime.now().toString().substring(0, 4)} " + cfg.company + ". Bazı bölümler © Purslane Ltd. AGPL-3.0.\\n$license',"), 'hakkında: telif metni');
edit(settingsDart, t => replaceOnce(t,
  "translate('Slogan_tip'),",
  "'Herkes için ücretsiz ve açık kaynak uzak masaüstü.',"), 'hakkında: slogan');
edit(settingsDart, t => replaceOnce(t,
  "decoration: const BoxDecoration(color: Color(0xFF2c8cff)),",
  "decoration: const BoxDecoration(color: Color(0xFFEF443B)),"), 'hakkında: renk');
// Ayarlar > Hesap: lisans/paket kartı (plan, cihaz kotası, özellikler, web paneli bağlantıları)
edit(settingsDart, t => replaceOnce(t,
  "import 'package:url_launcher/url_launcher_string.dart';",
  "import 'package:url_launcher/url_launcher_string.dart';\nimport 'package:http/http.dart' as http;"), 'ayarlar: http importu');
edit(settingsDart, t => replaceOnce(t,
  "        _Card(title: 'Account', children: [accountAction(), useInfo()]),",
  "        _Card(title: 'Account', children: [accountAction(), useInfo()]),\n        const _NvaAccountDetails(),"), 'ayarlar: hesap sayfasına lisans kartı');
edit(settingsDart, t => t.replace(/\s*$/, '\n') + fs.readFileSync(path.join(root, 'branding/dart/nva_settings.dart'), 'utf8'), 'ayarlar: lisans kartı sınıfı');
edit(settingsDart, t => replaceOnce(t,
`                _header(context),
                Flexible(child: _listView(tabs: _settingTabs())),`,
`                _header(context),
                _nvaSettingsSearch(),
                Flexible(
                    child: Obx(() => _listView(
                        tabs: _settingTabs()
                            .where((t) => _nvaSettingMatches(
                                t.key, t.label, nvaSettingsQuery.value))
                            .toList()))),`), 'ayarlar: arama kutusu');
// Gelen bağlantı penceresi: AnyDesk'teki izin profilleri gibi tek tıkla önayar
// ("Ekran paylaşımı": yalnızca görüntü + ses; "Tam erişim": hepsi). İzinler bağlantı süresince geçerlidir.
const cmDart = 'flutter/lib/desktop/pages/server_page.dart';
edit(cmDart, t => replaceOnce(t,
`  @override
  Widget build(BuildContext context) {
    final crossAxisCount = 4;`,
`  void _nvaPreset(Map<String, bool> p) {
    p.forEach((name, enabled) {
      bind.cmSwitchPermission(connId: client.id, name: name, enabled: enabled);
    });
    setState(() {
      client.keyboard = p['keyboard']!;
      client.clipboard = p['clipboard']!;
      client.audio = p['audio']!;
      client.file = p['file']!;
      client.restart = p['restart']!;
      client.recording = p['recording']!;
    });
  }

  Widget _nvaPresetRow() {
    Widget b(String label, IconData icon, Map<String, bool> p) => TextButton.icon(
          onPressed: () => _nvaPreset(p),
          style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
          icon: Icon(icon, size: 15),
          label: Text(label, style: const TextStyle(fontSize: 12)),
        );
    return Wrap(alignment: WrapAlignment.center, spacing: 4, children: [
      b('Ekran paylaşımı', Icons.visibility_outlined, {
        'keyboard': false,
        'clipboard': false,
        'audio': true,
        'file': false,
        'restart': false,
        'recording': false,
      }),
      b('Tam erişim', Icons.lock_open_outlined, {
        'keyboard': true,
        'clipboard': true,
        'audio': true,
        'file': true,
        'restart': true,
        'recording': true,
      }),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final crossAxisCount = 4;`), 'gelen bağlantı: profil önayarları');
edit(cmDart, t => replaceOnce(t,
`          Text(
            translate("Permissions"),
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ).marginOnly(left: 4.0, bottom: 8.0),`,
`          Text(
            translate("Permissions"),
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ).marginOnly(left: 4.0, bottom: 2.0),
          if (client.type_() != ClientType.camera)
            _nvaPresetRow().marginOnly(bottom: 4.0),`), 'gelen bağlantı: önayar satırı');
edit(cmDart, t => replaceOnce(t,
`      width: double.infinity,
      height: 160.0,
      margin: EdgeInsets.all(5.0),`,
`      width: double.infinity,
      height: 196.0,
      margin: EdgeInsets.all(5.0),`), 'gelen bağlantı: izin kutusu yüksekliği');
// Sürüm + "Güncellemeleri denetle". RustDesk, adı "RustDesk" olmayan derlemeyi "özel istemci" sayıp güncelleme
// denetimini ve arayüzünü kapatır; bizim kendi sürüm sunucumuz olduğu için açılır.
edit('src/common.rs', t => replaceOnce(t,
`pub fn check_software_update() {
    if is_custom_client() {
        return;
    }
`,
`pub fn check_software_update() {
    // NvaPrime: kendi sürüm sunucumuz var; özel istemcide de denetlenir
`), 'güncelleme denetimi: özel istemcide de');
edit('flutter/lib/common.dart', t => replaceOnce(t,
`    if (!bind.isCustomClient()) {
      platformFFI.registerEventHandler(
          kCheckSoftwareUpdateFinish,`,
`    if (true) {
      platformFFI.registerEventHandler(
          kCheckSoftwareUpdateFinish,`), 'güncelleme denetimi: açılışta');
edit(settingsDart, t => replaceOnce(t,
`        if (!isWeb && !bind.isCustomClient())
          _OptionCheckBox(
            context,
            'Check for software update on startup',`,
`        if (!isWeb)
          _OptionCheckBox(
            context,
            'Check for software update on startup',`), 'ayarlar: başlangıçta güncelleme denetimi seçeneği');
edit(homeDart, t => replaceOnce(t,
`    if (!bind.isCustomClient() &&
        updateUrl.isNotEmpty &&
        !isCardClosed &&
        bind.mainUriPrefixSync().contains('rustdesk')) {
      final isToUpdate = (isWindows || isMacOS) && bind.mainIsInstalled();
      String btnText = isToUpdate ? 'Update' : 'Download';
      GestureTapCallback onPressed = () async {
        final Uri url = Uri.parse('https://rustdesk.com/download');
        await launchUrl(url);
      };
      if (isToUpdate) {
        onPressed = () {
          handleUpdate(updateUrl);
        };
      }`,
`    if (updateUrl.isNotEmpty && !isCardClosed) {
      // NvaPrime: kurulumu imzayı doğrulayan arka plan güncelleyicisi yapar; RustDesk'in arayüzden
      // indirip kuran yolu (handleUpdate) imza denetimini atladığı için burada yalnızca indirme sayfası açılır.
      const isToUpdate = false;
      String btnText = 'Download';
      GestureTapCallback onPressed = () async {
        await launchUrl(Uri.parse('${site}/dashboard?s=downloads'));
      };`), 'ana sayfa: yeni sürüm kartı (imzalı yol)');
edit(settingsDart, t => replaceOnce(t,
`              SelectionArea(
                  child: Text('\${translate('Version')}: $version')
                      .marginSymmetric(vertical: 4.0)),`,
`              SelectionArea(
                  child: Text('\${translate('Version')}: $version',
                          style: const TextStyle(fontWeight: FontWeight.w600))
                      .marginSymmetric(vertical: 4.0)),
              const _NvaCheckUpdateButton().marginOnly(top: 4, bottom: 8),`), 'hakkında: güncellemeleri denetle');
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
                }
                // Görüntü kalitesi varsayılanı "dengeli"den "en iyi"ye çıktı; eski kayıtlar bir kez taşınır
                // (işaret sayesinde kullanıcı sonradan "dengeli" seçerse değiştirilmez)
                if !config.options.contains_key("nva-quality-v1") {
                    if config.image_quality == "balanced" {
                        config.image_quality = "best".to_owned();
                    }
                    config.options.insert("nva-quality-v1".to_owned(), "Y".to_owned());
                    store = true;
                }`), 'eski cihaz ayarı geçişi (ekran kayması, görüntü kalitesi)');
// Görüntü kalitesi varsayılanı: dengeli -> en iyi (AnyDesk gibi net görüntü)
edit('libs/hbb_common/src/config.rs', t => replaceOnce(t,
  'self.get_string(key, "balanced", vec!["best", "low", "custom"])',
  'self.get_string(key, "best", vec!["balanced", "low", "custom"])'), 'varsayılan görüntü kalitesi: en iyi');
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
// Girişliyken bağlanma: istemci API token'ı varsa hbbs ile KeyExchange bekler; bu yalnızca
// RustDesk Pro'da var, açık kaynak hbbs göndermez → 18 sn sonra "Failed to secure tcp: deadline
// has elapsed". hbbs token'ı zaten kullanmıyor; hiç göndermeyelim (düz metin sızmasın da).
edit('src/client.rs', t => replaceOnce(t,
  '        match Self::_start(peer, key, token, conn_type, interface.clone()).await {',
  `        let _ = token; // NvaPrime: açık kaynak hbbs'e API token'ı gönderilmez (Pro KeyExchange yok)
        match Self::_start(peer, key, "", conn_type, interface.clone()).await {`), 'girişliyken bağlantı (secure tcp)');
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
