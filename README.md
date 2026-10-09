# NvaPrime Remote (RustDesk tabanlı, kaynaktan derlenen sürüm)

Bu depo RustDesk'in **resmî kaynak kodunu** (etiket: `config.json` → `upstreamTag`) alır,
`patch/apply-branding.mjs` ile marka + sunucu ayarlarını uygular ve GitHub Actions ile
Windows kurulum dosyasını derler. Hazır exe'yi yeniden adlandırma/elle config yazma
yöntemi **bırakıldı**: klavye/fare çalışmaması ve ikinci pencere açılması bu yüzden oluyordu
(RustDesk, exe adının `<APP_NAME>.exe` olmasını bekler; servis, kayıt defteri ve tek-örnek
kilidi bu ada göre kurulur).

## Ne değişiyor?
| Dosya | Değişiklik |
|---|---|
| `libs/hbb_common/src/config.rs` | `APP_NAME`, `RENDEZVOUS_SERVERS`, `RS_PUB_KEY` (+ isteğe bağlı `api-server`) |
| `flutter/windows/CMakeLists.txt` | exe adı `NvaPrime.exe` |
| `build.py` | paketleyiciye `NvaPrime.exe` verilir |
| `Runner.rc`, `Cargo.toml`, `libs/portable/Cargo.toml` | Windows dosya özellikleri |
| `res/*.ico/png`, `flutter/assets/icon.png` | `branding/` içindeki simgeler |

`APP_NAME` değişince RustDesk kendiliğinden: arayüzdeki "RustDesk" yazılarını uygulama adıyla değiştirir,
`nvaprime://` bağlantı şemasını kullanır, güncelleme denetimini (api.rustdesk.com) kapatır,
servis/kayıt defteri/kurulum klasörü adlarını tutarlı üretir.

## Yayınlama (bir kez)
1. GitHub'da **public** bir depo açın (AGPL gereği kaynak herkese açık olmalı), bu klasörün içeriğini yükleyin
   (`src/` zaten `.gitignore`'da).
2. `config.json` değerlerini kontrol edin (`rendezvousServer`, `publicKey` = sunucudaki `id_ed25519.pub`).
3. **Actions → Build NvaPrime (Windows) → Run workflow**. İlk derleme ~60–90 dk sürer (sonrakiler önbellekle daha hızlı).
4. Çıktılar artifact olarak iner: `NvaPrime-<sürüm>-install.exe`, `-portable.exe`, `SHA256SUMS.txt`, kaynak arşivi.
5. Sürüm yayınlamak için etiket atın: `git tag v1.0.0 && git push --tags` → GitHub Releases'e otomatik yüklenir.

Yerelde yamaların uygulanışını denemek: `node patch/apply-branding.mjs <rustdesk-kaynak-dizini>`
(temiz bir kaynak üzerinde çalıştırın; beklenen satır bulunamazsa hata verip durur).

## Sunucu tarafı (zorunlu)
- `hbbs`/`hbbr` `-k _` ile (yalnızca sunucunun anahtarını bilen istemciler bağlanır) çalışmalı ve
  `hbbs`'e **genel** röle adresi verilmeli: `hbbs -r remote.nvaprime.com:21117 -k _`
  (repodaki eski `infra/docker-compose.yml` içindeki `-r localhost:21117` yanlıştır).
  `config.json` → `publicKey`, sunucudaki `id_ed25519.pub` içeriğiyle birebir aynı olmalı.
- Portlar: TCP 21115–21117, 21118/21119 (web), UDP 21116.
- PHP panel (`/api/...`) bu istemci için **gerekmez**; `apiServer` boş kalırsa istemci panelle konuşmaz.
  Panel ancak güvenlik açıkları kapatıldıktan sonra bağlanmalı (bkz. önceki denetim raporu).

## Güvenlik ilkeleri (değiştirmeyin)
- Sabit/varsayılan parola yok. RustDesk'in kendi rastgele geçici parolası + "kabul et" penceresi kullanılır.
- Kalıcı parola kullanıcı tarafından, arayüzden belirlenir.

## Lisans / marka
- RustDesk **AGPL-3.0**. Bu depo ve yayınlanan kaynak arşivi AGPL kapsamındadır; her sürümle birlikte
  `NvaPrime-source-*.tar.gz` yayınlanır. Hakkında sayfasındaki orijinal telif (Purslane Ltd) korunur.
- "RustDesk" adı/logosu kullanılmaz.
- Kod imzalama sertifikası yoksa Windows SmartScreen uyarı verir; imzalama için `build-windows.yml`
  sonuna bir imzalama adımı eklenebilir.

## Bilinen sınırlar / sonraki adımlar
- Yalnızca Windows x64. Android/macOS/Linux için ayrı iş akışı gerekir.
- Yazıcı sürücüsü (RustDesk markalı) ve MSI paketi bilinçli olarak dahil edilmedi.
- Sürüm yükseltme: `upstreamTag` değiştirip çalıştırın; yama adımı hata verirse ilgili satır upstream'de değişmiş demektir.
- Otomatik güncelleme kapalı (özel istemci olduğu için). Güncelleme için kendi sürüm denetim uç noktanız eklenebilir.
