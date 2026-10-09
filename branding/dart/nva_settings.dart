

// ---- NvaPrime: Hakkında > "Güncellemeleri denetle" (apply-branding.mjs tarafından eklenir) ----
// Yalnızca sürüm sunucusuna sorar. Kurulumu, imzayı doğrulayan arka plan güncelleyicisi (servis) yapar;
// arayüzdeki RustDesk "Güncelle" yolu imza denetimini atladığı için kullanılmaz.
class _NvaCheckUpdateButton extends StatefulWidget {
  const _NvaCheckUpdateButton({Key? key}) : super(key: key);

  @override
  State<_NvaCheckUpdateButton> createState() => _NvaCheckUpdateButtonState();
}

class _NvaCheckUpdateButtonState extends State<_NvaCheckUpdateButton> {
  bool _busy = false;
  String _msg = '';
  String _newVersion = '';

  Future<void> _check() async {
    setState(() {
      _busy = true;
      _msg = '';
    });
    // "Başlangıçta denetle" kapalıysa denetim yapılmaz; bu tek denetim için geçici olarak açılır
    final prev = bind.mainGetLocalOption(key: kOptionEnableCheckUpdate);
    if (prev == 'N') {
      await bind.mainSetLocalOption(key: kOptionEnableCheckUpdate, value: 'Y');
    }
    await bind.mainGetSoftwareUpdateUrl();
    var nv = '';
    for (var i = 0; i < 16 && nv.isEmpty; i++) {
      await Future.delayed(const Duration(milliseconds: 500));
      nv = bind.mainGetNewVersion();
    }
    if (prev == 'N') {
      await bind.mainSetLocalOption(key: kOptionEnableCheckUpdate, value: prev);
    }
    if (!mounted) return;
    setState(() {
      _busy = false;
      _newVersion = nv;
      _msg = nv.isEmpty
          ? 'Güncel sürümü kullanıyorsunuz.'
          : 'Yeni sürüm $nv mevcut. Birkaç saat içinde kendiliğinden kurulur; hemen kurmak için indirebilirsiniz.';
    });
  }

  Future<void> _download() async {
    final api = await bind.mainGetApiServer();
    final base = api.endsWith('/') ? api.substring(0, api.length - 1) : api;
    if (base.isNotEmpty) await launchUrlString('$base/dashboard?s=downloads');
  }

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 6,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        OutlinedButton.icon(
          onPressed: _busy ? null : _check,
          icon: _busy
              ? const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.system_update_alt, size: 16),
          label: Text(_busy ? 'Denetleniyor...' : 'Güncellemeleri denetle'),
        ),
        if (_msg.isNotEmpty)
          Text(_msg,
              style: TextStyle(
                  color: _newVersion.isEmpty
                      ? const Color(0xFF1E8C79)
                      : MyTheme.accent)),
        if (_newVersion.isNotEmpty)
          TextButton(onPressed: _download, child: const Text('Şimdi indir')),
      ],
    );
  }
}

// ---- NvaPrime: Ayarlar > Hesap altındaki lisans kartı (apply-branding.mjs tarafından eklenir) ----
class _NvaAccountDetails extends StatefulWidget {
  const _NvaAccountDetails({Key? key}) : super(key: key);

  @override
  State<_NvaAccountDetails> createState() => _NvaAccountDetailsState();
}

class _NvaAccountDetailsState extends State<_NvaAccountDetails> {
  Map<String, dynamic>? _lic;
  String? _loadedFor;
  bool _loading = false;

  Future<String> _api() async {
    final api = await bind.mainGetApiServer();
    return api.endsWith('/') ? api.substring(0, api.length - 1) : api;
  }

  Future<void> _load(String user) async {
    if (user.isEmpty) {
      if (mounted) setState(() => _lic = null);
      return;
    }
    if (mounted) setState(() => _loading = true);
    Map<String, dynamic>? lic;
    try {
      final api = await _api();
      final token = bind.mainGetLocalOption(key: 'access_token');
      final resp = await http
          .post(Uri.parse('$api/api/nva/license'),
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
    if (mounted) {
      setState(() {
        _lic = lic;
        _loading = false;
      });
    }
  }

  Future<void> _open(String path) async {
    final api = await _api();
    if (api.isNotEmpty) await launchUrlString('$api$path');
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(children: [
        SizedBox(
            width: 170,
            child: Text(label,
                style: TextStyle(
                    color: Theme.of(context).textTheme.bodySmall?.color))),
        Expanded(
            child: Text(value,
                style: const TextStyle(fontWeight: FontWeight.w600))),
      ]),
    );
  }

  Widget _feature(bool ok, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(children: [
        Icon(ok ? Icons.check : Icons.close,
            size: 16, color: ok ? const Color(0xFF32BEA6) : Colors.grey),
        const SizedBox(width: 8),
        Text(text,
            style: TextStyle(
                color: ok ? null : Colors.grey,
                decoration: ok ? null : TextDecoration.lineThrough)),
      ]),
    );
  }

  Widget _box(List<Widget> children) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.background,
        border: Border.all(color: Theme.of(context).dividerColor),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Column(
          crossAxisAlignment: CrossAxisAlignment.start, children: children),
    ).marginOnly(left: 18, top: 16, right: 4);
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
      if (user.isEmpty) {
        return _Card(title: 'Lisans ve paket', children: [
          _box([
            const Text(
                'Giriş yapmadan da ücretsiz bağlanabilirsiniz. Hesapla giriş yaparsanız cihaz listesi, '
                'oturum geçmişi, takma adla bağlanma ve paketinizin özellikleri açılır.'),
            const SizedBox(height: 14),
            Wrap(spacing: 10, runSpacing: 8, children: [
              ElevatedButton(
                  onPressed: () => loginDialog(),
                  child: Text(translate('Login'))),
              OutlinedButton(
                  onPressed: () => _open('/register'),
                  child: const Text('Ücretsiz hesap oluştur')),
            ]),
          ]),
        ]);
      }
      final l = _lic;
      final List<Widget> body;
      if (l == null) {
        body = [
          Text(_loading
              ? 'Lisans bilgisi alınıyor...'
              : 'Lisans bilgisi alınamadı. İnternet bağlantınızı denetleyin.'),
        ];
      } else {
        final max = (l['max_devices'] ?? 0) as int;
        final free = (l['plan_code'] ?? 'free') == 'free';
        final exp = (l['expires_at'] ?? '').toString();
        body = [
          Row(children: [
            Text((l['plan_name'] ?? '').toString(),
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
            const SizedBox(width: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: free ? Colors.orange.withOpacity(0.15) : const Color(0x2232BEA6),
                borderRadius: BorderRadius.circular(3),
              ),
              child: Text(free ? 'Ücretsiz' : 'Etkin',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: free ? Colors.orange.shade800 : const Color(0xFF1E8C79))),
            ),
          ]),
          const SizedBox(height: 10),
          _row('Cihazlar',
              '${l['active_devices']} / ${max >= 1000 ? 'sınırsız' : max}'),
          _row('Aynı anda oturum', '${l['max_concurrent_sessions'] ?? 1}'),
          _row('Geçerlilik',
              exp.isEmpty ? 'Süresiz' : exp.substring(0, exp.length >= 10 ? 10 : exp.length)),
          const SizedBox(height: 6),
          _feature(l['allow_file_transfer'] == true, 'Dosya aktarımı'),
          _feature(l['allow_address_book'] == true, 'Adres defteri'),
          _feature(true, 'Oturum geçmişi ve takma adla bağlanma'),
          const SizedBox(height: 14),
          Wrap(spacing: 10, runSpacing: 8, children: [
            if (free)
              ElevatedButton(
                  onPressed: () => _open('/dashboard?s=license'),
                  child: const Text('Profesyonel plana geç')),
            OutlinedButton(
                onPressed: () => _open('/dashboard'),
                child: const Text('Web panelini aç')),
            OutlinedButton(
                onPressed: () => _open('/dashboard?s=devices'),
                child: const Text('Cihazlarım')),
            TextButton(
                onPressed: _loading ? null : () => _load(user),
                child: const Text('Yenile')),
          ]),
        ];
      }
      return _Card(title: 'Lisans ve paket', children: [_box(body)]);
    });
  }
}
