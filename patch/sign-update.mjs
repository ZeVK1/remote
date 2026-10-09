// Güncelleme paketini imzalar: <dosya>.sig = Ed25519(özet) || özet  (96 bayt)
// Özet = dosyanın SHA-256'sı. İstemci (updater.rs) aynı biçimi sodium "sign::verify" ile doğrular.
// Kullanım: NVA_UPDATE_SIGNING_KEY="<PKCS8 PEM>" node patch/sign-update.mjs <dosya>
import crypto from 'node:crypto';
import fs from 'node:fs';

const file = process.argv[2];
const pem = process.env.NVA_UPDATE_SIGNING_KEY || (process.env.NVA_UPDATE_SIGNING_KEY_FILE && fs.readFileSync(process.env.NVA_UPDATE_SIGNING_KEY_FILE, 'utf8'));
if (!file || !fs.existsSync(file)) throw new Error('imzalanacak dosya yok: ' + file);
if (!pem) throw new Error('NVA_UPDATE_SIGNING_KEY (veya NVA_UPDATE_SIGNING_KEY_FILE) tanımlı değil');

const key = crypto.createPrivateKey(pem);
const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest(); // 32 bayt
const sig = crypto.sign(null, digest, key);                                          // 64 bayt
if (sig.length !== 64) throw new Error('beklenmeyen imza uzunluğu: ' + sig.length);
fs.writeFileSync(file + '.sig', Buffer.concat([sig, digest]));
console.log('imzalandı:', file + '.sig', 'sha256=' + digest.toString('hex'));
