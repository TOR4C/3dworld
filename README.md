# 3D World — Simulasi Lingkungan Alam Prosedural

Game simulasi lingkungan alam 3D berbasis browser (WebGL2) dengan kamera terbang bebas (*free view*) tanpa avatar. Dunia dibuat secara prosedural dan tak terbatas melalui *chunk streaming*, diawali dengan lanskap kaldera dan pulau.

## Fitur Utama
- **100% Prosedural**: Seluruh medan, tekstur (kayu, kulit pohon, atap ijuk, batu, kain pasar, normal map air), vegetasi, bangunan, pasar, air, langit, cuaca, dan fauna dibuat lewat kode.
- **Chunk Streaming Tak Terbatas**: Dunia dimuat dan dibongkar otomatis di sekitar kamera secara bertahap agar tetap ringan.
- **Siklus Siang–Malam & Cuaca**: Matahari, bintang malam, kabut dinamis, hujan 3D, serta lentera desa & pasar yang menyala saat senja/malam.
- **Kontrol Free View (Desktop & Mobile)**:
  - **Desktop**: Klik layar (Pointer Lock), Mouse (lihat), `W/A/S/D` (gerak relatif arah pandang termasuk *pitch*), `Space`/`C` (naik/turun), `Shift` (cepat), `Scroll` (ubah kecepatan dasar), `ESC` (lepas pointer lock).
  - **Mobile / Touch**: Seret satu jari pada layar untuk melihat, analog virtual untuk bergerak, tombol `Naik`, `Turun`, dan `Cepat` (toggle on/off) dengan pelacakan `pointerId` terpisah sehingga bisa ditekan bersamaan sambil menyeret layar.
- **Fisika & Kolisi**: Gerakan diredam (*velocity damping*), kamera tidak menembus tanah dan tidak menyelam ke dalam air.

## Struktur Arsitektur (`src/`)
- `src/core/`: `Engine.ts` (WebGL2 renderer & loop), `EventBus.ts`, `MathNoise.ts`
- `src/services/`:
  - `TerrainService.ts`: Heightmap kaldera Danau, Pulau, dan dataran tinggi prosedural tak terbatas
  - `ChunkService.ts`: Streaming & disposal chunk medan
  - `TextureService.ts`: Generator tekstur prosedural berbasis Canvas
  - `VegetationService.ts`: Pohon pinus, pohon tropis, semak, dan batu (*InstancedMesh*)
  - `SettlementService.ts`: Rumah tradisional, Pasar pinggir danau dengan objek 3D, dermaga, perahu, dan gazebo.
  - `WaterService.ts`: Permukaan air dengan normal map animasi
  - `AtmosphereService.ts`: Siklus siang–malam, sky dome shader, bintang, dan pencahayaan
  - `WeatherService.ts`: Cuaca cerah, kabut, dan hujan partikel 3D
  - `FaunaService.ts`: Burung terbang, itik/unggas air, dan kunang-kunang/kupu-kupu
  - `ControlsService.ts`: Kontrol desktop & mobile multi-pointerId + kolisi
  - `HudService.ts`: Antarmuka HUD, kontrol cuaca/waktu, dan tombol sentuh.
 
## Aturan Keras:
- dilarang menggunakan aset eksternal
- semua aset dibuat dengan kode (prosedural)
- penambahan aset, perubahan aset selalu dicatat di ASSETS.md

## Build & Menjalankan
```bash
npm install
npm run dev      # Mode pengembangan
npm run build    # Output statis di folder dist/
```
