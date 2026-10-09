

// ---- NvaPrime: hesap/lisans kartı (apply-branding.mjs tarafından eklenir) ----
class _NvaLicenseChip extends StatefulWidget {
  const _NvaLicenseChip({Key? key}) : super(key: key);

  @override
  State<_NvaLicenseChip> createState() => _NvaLicenseChipState();
}

class _NvaLicenseChipState extends State<_NvaLicenseChip> {
  String _text = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = await bind.mainGetApiServer();
      final token = bind.mainGetLocalOption(key: 'access_token');
      if (api.isEmpty || token.isEmpty) return;
      final resp = await http.post(Uri.parse('$api/api/nva/license'),
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json'
          },
          body: '{}');
      if (resp.statusCode != 200) return;
      final j = jsonDecode(resp.body) as Map<String, dynamic>;
      final l = j['license'] as Map<String, dynamic>;
      final max = (l['max_devices'] ?? 0) as int;
      final maxText = max >= 1000 ? '∞' : '$max';
      if (!mounted) return;
      setState(() {
        _text = '${l['plan_name']} · ${l['active_devices']}/$maxText cihaz';
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_text.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        border: Border.all(color: MyTheme.accent.withOpacity(0.5)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(_text,
          style: const TextStyle(fontSize: 12, color: MyTheme.accent)),
    );
  }
}
