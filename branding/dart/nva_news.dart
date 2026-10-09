

// ---- NvaPrime: Haberler paneli ve üst sekmeler (apply-branding.mjs tarafından eklenir) ----
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
    ]);
  }
}

class _NvaTile {
  final String title;
  final String body;
  final String action;
  final IconData icon;
  final List<Color> colors;
  final VoidCallback? onTap;
  const _NvaTile(this.title, this.body, this.action, this.icon, this.colors,
      [this.onTap]);
}

class NvaNewsPanel extends StatelessWidget {
  const NvaNewsPanel({Key? key}) : super(key: key);

  List<_NvaTile> _tiles() {
    final loggedIn = gFFI.userModel.isLogin;
    return [
      _NvaTile(
        'NvaPrime Remote\'a hoş geldiniz',
        'Soldaki ID\'nizi karşı tarafa verin ya da kendi bağlantınızı kurmak için üstteki kutuya karşı tarafın ID\'sini yazın.',
        '',
        Icons.waving_hand_outlined,
        const [Color(0xFFEF443B), Color(0xFFB02A8F)],
      ),
      _NvaTile(
        'Uzak bir cihaza nasıl bağlanılır?',
        '1) Karşı tarafın ID\'sini yazın  2) Bağlan\'a basın  3) Karşı tarafta tek kullanımlık parolayı girin ya da isteği kabul ettirin.',
        '',
        Icons.devices_other_outlined,
        const [Color(0xFF4A5560), Color(0xFF2B3138)],
      ),
      _NvaTile(
        loggedIn ? 'Hesabınız bağlı' : 'Hesabınızı bağlayın',
        loggedIn
            ? 'Adres defteriniz ve cihaz listeniz tüm bilgisayarlarınızda aynı. Paketinizi üstteki rozetten görebilirsiniz.'
            : 'Giriş yapın: adres defteriniz ve cihaz listeniz her bilgisayarınızda sizinle olsun. Hesap ücretsiz.',
        loggedIn ? '' : 'Giriş yap',
        Icons.account_circle_outlined,
        const [Color(0xFF2F7DB8), Color(0xFF1E4F7A)],
        loggedIn
            ? null
            : () async {
                await loginDialog();
              },
      ),
      _NvaTile(
        'Başında kimse yokken erişim',
        'Ayarlar > Güvenlik bölümünden kalıcı bir parola belirleyin; böylece ID ve parolayla her zaman bağlanabilirsiniz.',
        'Ayarları aç',
        Icons.key_outlined,
        const [Color(0xFFD9352C), Color(0xFF8E1F2B)],
        () => DesktopTabPage.onAddSetting(),
      ),
      _NvaTile(
        'Güvenlik ipuçları',
        'ID ve parolanızı yalnızca güvendiğiniz kişilerle paylaşın. Tanımadığınız bir bağlantı isteğini asla kabul etmeyin.',
        '',
        Icons.shield_outlined,
        const [Color(0xFF8E3B5B), Color(0xFF5A1F3A)],
      ),
      _NvaTile(
        'Web paneli',
        'Cihazlarınızı, oturumlarınızı ve lisansınızı tarayıcıdan yönetin.',
        'Paneli aç',
        Icons.language_outlined,
        const [Color(0xFF3F6E5C), Color(0xFF244336)],
        () => launchUrlString('https://remote.nvaprime.com/dashboard'),
      ),
      _NvaTile(
        'Açık kaynak',
        'NvaPrime Remote, RustDesk\'e dayanır ve AGPL-3.0 lisanslıdır. Kaynak kodu herkese açıktır.',
        'Kaynak kodu',
        Icons.code,
        const [Color(0xFF5C5F8A), Color(0xFF30325A)],
        () => launchUrlString('https://github.com/ZeVK1/remote'),
      ),
    ];
  }

  Widget _buildTile(_NvaTile t) {
    return InkWell(
      onTap: t.onTap,
      child: Container(
        width: 235,
        height: 180,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
              colors: t.colors,
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
                Icon(t.icon, color: Colors.white70, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    t.title,
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
                t.body,
                maxLines: 5,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    color: Colors.white, fontSize: 13, height: 1.3),
              ),
            ),
            if (t.action.isNotEmpty)
              Align(
                alignment: Alignment.bottomRight,
                child: Text('${t.action} →',
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
      final tiles = _tiles();
      return SingleChildScrollView(
        padding: const EdgeInsets.only(top: 14, right: 12, bottom: 16),
        child: Wrap(
          spacing: 8,
          runSpacing: 8,
          children: tiles.map(_buildTile).toList(),
        ),
      );
    });
  }
}
