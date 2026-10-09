
// ---- NvaPrime: plan izinleri, bağlantı başlamadan önce (apply-branding.mjs tarafından eklenir) ----
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
