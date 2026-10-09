

// ---- NvaPrime: üst sekmeler, Haberler ve Oturum geçmişi (apply-branding.mjs tarafından eklenir) ----
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
        padding: const EdgeInsets.only(bottom: 6, top: 4),
        decoration: BoxDecoration(
          border: Border(
              bottom: BorderSide(
                  width: 2,
                  color: selected ? MyTheme.accent : Colors.transparent)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 16,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? MyTheme.accent : base.withOpacity(0.55),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      _item(context, 'Haberler', 0),
      const SizedBox(width: 28),
      _item(context, 'Cihazlar', 1),
      const SizedBox(width: 28),
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
          'Üstteki ID\'nizi karşı tarafa verin ya da kutuya karşı tarafın ID\'sini yazarak bağlanın.',
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
    final label = (t['action_label'] ?? '').toString();
    final url = (t['action_url'] ?? '').toString();
    return InkWell(
      onTap: url.isEmpty ? null : () => _nvaOpen(url),
      child: Container(
        width: 235,
        height: 180,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
              colors: [c1, c2],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight),
          borderRadius: BorderRadius.circular(3),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(_nvaIcon(t['icon']), color: Colors.white70, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    (t['title'] ?? '').toString(),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Expanded(
              child: Text(
                (t['body'] ?? '').toString(),
                maxLines: 5,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    color: Colors.white, fontSize: 13, height: 1.3),
              ),
            ),
            if (label.isNotEmpty)
              Align(
                alignment: Alignment.bottomRight,
                child: Text('$label →',
                    style: const TextStyle(color: Colors.white, fontSize: 13)),
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
        padding: const EdgeInsets.only(top: 14, right: 12, bottom: 16),
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
