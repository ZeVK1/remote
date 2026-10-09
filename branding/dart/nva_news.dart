

// ---- NvaPrime: üst sekmeler, Haberler ve Oturum geçmişi (apply-branding.mjs tarafından eklenir) ----

/// Ana sayfa (desktop_home_page) tarafından doldurulur: ortadaki "Bu çalışma alanı" bloğu
/// ve adres çubuğunun sağındaki hesap/menü düğmeleri.
Widget Function(BuildContext)? nvaWorkspaceBuilder;
Widget Function(BuildContext)? nvaHeaderActionsBuilder;

/// Adres çubuğunun altındaki kırmızı şerit: girişsiz ya da ücretsiz planda yükseltme çağrısı.
class NvaLicenseBanner extends StatefulWidget {
  const NvaLicenseBanner({Key? key}) : super(key: key);

  @override
  State<NvaLicenseBanner> createState() => _NvaLicenseBannerState();
}

class _NvaLicenseBannerState extends State<NvaLicenseBanner> {
  Map<String, dynamic>? _lic;
  String? _loadedFor;

  Future<void> _load(String user) async {
    Map<String, dynamic>? lic;
    if (user.isNotEmpty) {
      try {
        final api = await bind.mainGetApiServer();
        final token = bind.mainGetLocalOption(key: 'access_token');
        final resp = await http
            .post(Uri.parse(_nvaApiUrl(api, '/api/nva/license')),
                headers: {
                  'Authorization': 'Bearer $token',
                  'Content-Type': 'application/json'
                },
                body: '{}')
            .timeout(const Duration(seconds: 8));
        if (resp.statusCode == 200) {
          lic = Map<String, dynamic>.from(jsonDecode(resp.body)['license']);
        }
      } catch (_) {}
    }
    if (mounted) setState(() => _lic = lic);
  }

  Future<void> _openPanel(String path) async {
    final api = await bind.mainGetApiServer();
    if (api.isNotEmpty) await launchUrlString(_nvaApiUrl(api, path));
  }

  Widget _link(String text, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Text(text,
          style: const TextStyle(
              color: Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w700,
              decoration: TextDecoration.underline,
              decorationColor: Colors.white)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final um = gFFI.userModel;
      final user = um.isLogin ? um.userName.value : '';
      if (user != _loadedFor) {
        _loadedFor = user;
        Future.microtask(() => _load(user));
      }
      const style = TextStyle(color: Colors.white, fontSize: 13);
      List<Widget> parts;
      if (user.isEmpty) {
        parts = [
          const Text('Ücretsiz kullanım (ticari olmayan). Daha fazla özellik için ',
              style: style),
          _link('giriş yapın', () => loginDialog()),
          const Text(' ya da ', style: style),
          _link('lisans alın', () => _openPanel('/dashboard?s=license')),
          const Text('.', style: style),
        ];
      } else if (_lic != null && (_lic!['plan_code'] ?? 'free') == 'free') {
        final max = (_lic!['max_devices'] ?? 0) as int;
        parts = [
          Text(
              '${_lic!['plan_name']} planı (${_lic!['active_devices']}/$max cihaz, '
              'aynı anda ${_lic!['max_concurrent_sessions'] ?? 1} oturum). ',
              style: style),
          _link('Profesyonel plana geçin', () => _openPanel('/dashboard?s=license')),
          const Text(' ve tüm özelliklerin kilidini açın.', style: style),
        ];
      } else {
        return const SizedBox.shrink();
      }
      return Container(
        width: double.infinity,
        color: MyTheme.accent,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Wrap(
          alignment: WrapAlignment.center,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: parts,
        ),
      );
    });
  }
}

class _NvaTabBar extends StatelessWidget {
  final int index;
  final ValueChanged<int> onChanged;
  const _NvaTabBar({Key? key, required this.index, required this.onChanged})
      : super(key: key);

  Widget _item(BuildContext context, String label, int i) {
    final selected = index == i;
    final base = Theme.of(context).textTheme.titleLarge?.color ?? Colors.black;
    return InkWell(
      onTap: () => onChanged(i),
      child: Container(
        padding: const EdgeInsets.only(bottom: 10, top: 4),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 15,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
            color: selected ? MyTheme.accent : base.withOpacity(0.45),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      _item(context, 'Haberler', 0),
      const SizedBox(width: 30),
      _item(context, 'Cihazlar', 1),
      const SizedBox(width: 30),
      _item(context, 'Oturum geçmişi', 2),
    ]);
  }
}

Color _nvaColor(dynamic hex, Color fallback) {
  try {
    final s = (hex ?? '').toString().replaceAll('#', '');
    if (s.length == 6) return Color(int.parse('FF$s', radix: 16));
  } catch (_) {}
  return fallback;
}

IconData _nvaIcon(dynamic name) {
  switch ((name ?? '').toString()) {
    case 'waving_hand':
      return Icons.waving_hand_outlined;
    case 'devices':
      return Icons.devices_other_outlined;
    case 'account':
      return Icons.account_circle_outlined;
    case 'key':
      return Icons.key_outlined;
    case 'shield':
      return Icons.shield_outlined;
    case 'language':
      return Icons.language_outlined;
    case 'code':
      return Icons.code;
    case 'star':
      return Icons.star_outline;
    case 'bolt':
      return Icons.bolt_outlined;
    case 'support':
      return Icons.support_agent_outlined;
    case 'warning':
      return Icons.warning_amber_outlined;
    default:
      return Icons.info_outline;
  }
}

/// Haber kutusuna tıklanınca: yalnızca http(s) bağlantıları ve uygulama içi eylemler açılır.
Future<void> _nvaOpen(String url) async {
  if (url.isEmpty) return;
  if (url == 'app:settings') {
    DesktopTabPage.onAddSetting();
    return;
  }
  if (url == 'app:login') {
    await loginDialog();
    return;
  }
  if (url.startsWith('https://') || url.startsWith('http://')) {
    await launchUrlString(url);
  }
}

String _nvaApiUrl(String api, String path) {
  final base = api.endsWith('/') ? api.substring(0, api.length - 1) : api;
  return '$base$path';
}

class NvaNewsPanel extends StatefulWidget {
  const NvaNewsPanel({Key? key}) : super(key: key);

  @override
  State<NvaNewsPanel> createState() => _NvaNewsPanelState();
}

class _NvaNewsPanelState extends State<NvaNewsPanel> {
  // Sunucuya ulaşılamazsa gösterilen yerleşik haberler
  static const List<Map<String, String>> _fallback = [
    {
      'title': 'NvaPrime Remote\'a hoş geldiniz',
      'body':
          '"Bu çalışma alanı" numaranızı karşı tarafa verin ya da en üstteki adres çubuğuna karşı tarafın ID\'sini yazarak bağlanın.',
      'icon': 'waving_hand',
      'color1': '#EF443B',
      'color2': '#B02A8F',
    },
    {
      'title': 'Uzak bir cihaza nasıl bağlanılır?',
      'body':
          '1) Karşı tarafın ID\'sini yazın  2) Bağlan\'a basın  3) Karşı tarafta tek kullanımlık parolayı girin ya da isteği kabul ettirin.',
      'icon': 'devices',
      'color1': '#4A5560',
      'color2': '#2B3138',
    },
    {
      'title': 'Güvenlik ipuçları',
      'body':
          'ID ve parolanızı yalnızca güvendiğiniz kişilerle paylaşın. Tanımadığınız bir bağlantı isteğini asla kabul etmeyin.',
      'icon': 'shield',
      'color1': '#8E3B5B',
      'color2': '#5A1F3A',
    },
  ];

  List<Map<String, dynamic>> _items = [];

  @override
  void initState() {
    super.initState();
    _items = _fallback.map((e) => Map<String, dynamic>.from(e)).toList();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = await bind.mainGetApiServer();
      if (api.isEmpty) return;
      final resp = await http
          .get(Uri.parse(_nvaApiUrl(api, '/api/nva/news')))
          .timeout(const Duration(seconds: 8));
      if (resp.statusCode != 200) return;
      final j = jsonDecode(resp.body);
      final list = (j['items'] as List)
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      if (list.isNotEmpty && mounted) {
        setState(() => _items = list);
      }
    } catch (_) {}
  }

  Widget _buildTile(Map<String, dynamic> t) {
    final c1 = _nvaColor(t['color1'], const Color(0xFFEF443B));
    final c2 = _nvaColor(t['color2'], const Color(0xFFB02A8F));
    final url = (t['action_url'] ?? '').toString();
    var label = (t['action_label'] ?? '').toString();
    if (label.isEmpty && url.isNotEmpty) label = 'Daha fazla bilgi';
    return InkWell(
      onTap: url.isEmpty ? null : () => _nvaOpen(url),
      child: Container(
        width: 235,
        height: 180,
        clipBehavior: Clip.hardEdge,
        decoration: BoxDecoration(
          gradient: LinearGradient(
              colors: [c1, c2],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight),
        ),
        child: Stack(
          children: [
            // AnyDesk kutucuklarındaki gibi büyük, soluk simge
            Positioned(
              right: -18,
              bottom: -18,
              child: Icon(_nvaIcon(t['icon']),
                  size: 120, color: Colors.white.withOpacity(0.12)),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(15, 16, 15, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    (t['title'] ?? '').toString(),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        height: 1.25,
                        fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: Text(
                      (t['body'] ?? '').toString(),
                      maxLines: 5,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          color: Colors.white.withOpacity(0.92),
                          fontSize: 13,
                          height: 1.35),
                    ),
                  ),
                  if (label.isNotEmpty)
                    Align(
                      alignment: Alignment.bottomRight,
                      child: Text('$label →',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              decoration: TextDecoration.underline,
                              decorationColor: Colors.white)),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final loggedIn = gFFI.userModel.isLogin;
      // Giriş yapılmışsa "giriş yap" kutusunu gösterme
      final tiles = _items
          .where((t) => !(loggedIn && (t['action_url'] ?? '') == 'app:login'))
          .map(_buildTile)
          .toList();
      return SingleChildScrollView(
        padding: const EdgeInsets.only(top: 16, bottom: 16),
        child: Wrap(spacing: 8, runSpacing: 8, children: tiles),
      );
    });
  }
}

class NvaSessionsPanel extends StatefulWidget {
  const NvaSessionsPanel({Key? key}) : super(key: key);

  @override
  State<NvaSessionsPanel> createState() => _NvaSessionsPanelState();
}

class _NvaSessionsPanelState extends State<NvaSessionsPanel> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!gFFI.userModel.isLogin) return;
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final api = await bind.mainGetApiServer();
      final token = bind.mainGetLocalOption(key: 'access_token');
      final resp = await http
          .post(Uri.parse(_nvaApiUrl(api, '/api/nva/sessions')),
              headers: {
                'Authorization': 'Bearer $token',
                'Content-Type': 'application/json'
              },
              body: '{}')
          .timeout(const Duration(seconds: 10));
      if (resp.statusCode == 200) {
        final j = jsonDecode(resp.body);
        final list = (j['items'] as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        if (mounted) setState(() => _items = list);
      } else {
        if (mounted) setState(() => _error = 'Sunucu hatası (${resp.statusCode})');
      }
    } catch (e) {
      if (mounted) setState(() => _error = 'Sunucuya ulaşılamadı');
    }
    if (mounted) setState(() => _loading = false);
  }

  String _typeLabel(String t) {
    switch (t) {
      case 'file_transfer':
        return 'Dosya aktarımı';
      case 'tcp_tunnel':
        return 'Tünel';
      case 'view_only':
        return 'Kamera';
      default:
        return 'Uzak kontrol';
    }
  }

  String _duration(int s) {
    if (s <= 0) return '';
    if (s < 60) return '$s sn';
    if (s < 3600) return '${s ~/ 60} dk';
    return '${s ~/ 3600} sa ${(s % 3600) ~/ 60} dk';
  }

  Widget _row(BuildContext context, Map<String, dynamic> r) {
    final out = r['direction'] == 'out';
    final peerId = (r['peer_id'] ?? '').toString();
    final name = (r['peer_name'] ?? '').toString();
    final dur = _duration((r['duration_seconds'] ?? 0) as int);
    final active = r['status'] == 'active';
    final sub = [
      out ? 'Giden' : 'Gelen',
      _typeLabel((r['type'] ?? '').toString()),
      (r['started_at'] ?? '').toString(),
      if (active) 'devam ediyor' else if (dur.isNotEmpty) dur,
    ].join(' · ');
    return ListTile(
      dense: true,
      leading: Icon(out ? Icons.north_east : Icons.south_west,
          color: out ? MyTheme.accent : Colors.green),
      title: Text(name.isNotEmpty ? '$name  ($peerId)' : peerId),
      subtitle: Text(sub),
      trailing: out && peerId.isNotEmpty
          ? TextButton(
              onPressed: () => connect(context, peerId),
              child: const Text('Tekrar bağlan'),
            )
          : null,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (!gFFI.userModel.isLogin) {
        return Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Oturum geçmişini görmek için hesabınızla giriş yapın.'),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () async {
                  await loginDialog();
                  _load();
                },
                child: Text(translate('Login')),
              ),
            ],
          ),
        );
      }
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Spacer(),
            IconButton(
              tooltip: 'Yenile',
              onPressed: _loading ? null : _load,
              icon: const Icon(Icons.refresh),
            ),
          ]),
          if (_error.isNotEmpty)
            Padding(
              padding: const EdgeInsets.all(8),
              child: Text(_error, style: const TextStyle(color: Colors.red)),
            ),
          Expanded(
            child: _items.isEmpty && !_loading
                ? const Center(
                    child: Text(
                        'Henüz kayıtlı oturum yok. Hesabınıza bağlı cihazlarla yapılan bağlantılar burada listelenir.',
                        textAlign: TextAlign.center))
                : ListView.separated(
                    itemCount: _items.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (c, i) => _row(c, _items[i]),
                  ),
          ),
        ],
      );
    });
  }
}

/// "ad@kullanici" takma adını sunucudan gerçek cihaz ID'sine çevirir; bulunamazsa null.
Future<String?> _nvaResolveAlias(String alias) async {
  try {
    final api = await bind.mainGetApiServer();
    if (api.isEmpty) return null;
    final resp = await http
        .get(Uri.parse(_nvaApiUrl(
            api, '/api/nva/resolve?alias=' + Uri.encodeQueryComponent(alias))))
        .timeout(const Duration(seconds: 8));
    if (resp.statusCode != 200) return null;
    final id = (jsonDecode(resp.body)['id'] ?? '').toString();
    return RegExp(r'^[0-9]{6,20}$').hasMatch(id) ? id : null;
  } catch (_) {
    return null;
  }
}
