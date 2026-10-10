
// ---- NvaPrime: plan izinleri, bağlantı başlamadan önce (apply-branding.mjs tarafından eklenir) ----

/// Planın adres defteri izni (lisans bilgisi gelince güncellenir). Kapalıysa Adres defteri sekmesi gizlenir;
/// sunucu da bu durumda /api/ab isteğini reddeder.
final nvaAllowAddressBook = true.obs;

/// UTC "YYYY-MM-DD HH:MM:SS" (sunucu saati) -> bilgisayarın yerel saati, "YYYY-MM-DD HH:MM"
String nvaLocalTime(String utc) {
  try {
    final d = DateTime.parse(utc.trim().replaceFirst(' ', 'T') + 'Z').toLocal();
    String two(int v) => v.toString().padLeft(2, '0');
    return '${d.year}-${two(d.month)}-${two(d.day)} ${two(d.hour)}:${two(d.minute)}';
  } catch (_) {
    return utc;
  }
}
/// Girişli hesabın planı bu bağlantıya izin vermiyorsa nedenini döner, izin varsa null.
/// Girişsiz kullanım ve sunucuya ulaşılamaması bağlantıyı engellemez.
Future<String?> _nvaSessionCheck(String id, String type) async {
  try {
    final token = bind.mainGetLocalOption(key: 'access_token');
    final api = await bind.mainGetApiServer();
    if (token.isEmpty || api.isEmpty) return null;
    final resp = await http
        .post(Uri.parse('$api/api/nva/session-check'),
            headers: {
              'Authorization': 'Bearer $token',
              'Content-Type': 'application/json'
            },
            body: jsonEncode({'type': type, 'peer': id}))
        .timeout(const Duration(seconds: 6));
    if (resp.statusCode != 200) return null;
    final j = jsonDecode(resp.body);
    if (j is Map && j['allow'] == false) {
      return (j['reason'] ?? 'Planınız bu bağlantıya izin vermiyor.').toString();
    }
  } catch (_) {}
  return null;
}

void _nvaShowDenied(String reason) {
  gFFI.dialogManager.show((setState, close, context) => CustomAlertDialog(
        title: const Text('Bağlantı başlatılamadı'),
        content: Text(reason),
        actions: [dialogButton('OK', onPressed: close)],
        onSubmit: close,
        onCancel: close,
      ));
}
