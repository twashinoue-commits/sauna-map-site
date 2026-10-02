# 日本全国サウナMAP (Leaflet + OpenStreetMap版)

サウナ部の活動報告フォームの回答を集計した、全国のサウナ・温泉施設マップです。
実際のOpenStreetMapタイル上に、都道府県ごとの掲載件数(色の濃淡)と各施設のピンを重ねて表示します。

## 自動反映の仕組み

```
Googleフォーム回答 → スプレッドシート「サウナ部活動報告」
  → Apps Script (apps-script/Code.gs) がシート全体を GitHub に送信 (repository_dispatch)
  → GitHub Actions (.github/workflows/sync-from-sheet.yml) が scripts/sync.js を実行
      - 新しい施設は OpenStreetMap Nominatim で緯度経度を取得 (coords.json に保存)
      - 投稿者名を「部員A」のように匿名化 (poster-map.json には名前のハッシュだけを保存)
      - data.json を作り直してコミット
  → GitHub Pages が自動で再デプロイ (数分)
```

- フォームが送信されると自動で反映されます。
- シートを手で直したときは、シートのメニュー「サウナMAP > サイトに反映」で反映できます。
- ピンの位置がずれている場合は `coords.json` の該当施設の `lat` / `lng` を直してコミットしてください
  (施設名だけで位置を特定できず地域の中心に置いたものは `"approx": true` が付き、地図上で点線のピンになります)。

## 初期設定(済んでいれば不要)

1. GitHub で fine-grained personal access token を作る
   - Repository access: `sauna-map-site` のみ
   - Permissions: Contents = Read and write
2. スプレッドシートの [拡張機能] > [Apps Script] に `apps-script/Code.gs` の内容を貼り付けて保存
3. Apps Script の [プロジェクトの設定] > [スクリプト プロパティ] に `GITHUB_TOKEN` = 1. のトークン を追加
4. エディタで `setupTrigger` を選んで実行し、権限を承認する
5. リポジトリの Secrets に `POSTER_SALT`(匿名化用のランダム文字列)が設定されていること

## ファイル構成

- `index.html` — ページ本体(Leaflet地図・一覧・フィルタ)
- `data.json` — サウナ施設データ(自動生成。手で編集しない)
- `coords.json` — 施設名 → 緯度経度(手で修正してよい)
- `poster-map.json` — 投稿者名のハッシュ → 匿名ラベル
- `japan-prefectures.geojson` — 都道府県境界データ(簡略化済み)
- `scripts/sync.js` — シートの行から data.json を作るスクリプト
  (手動実行: `POSTER_SALT=... node scripts/sync.js <CSVパス>`)
- `apps-script/Code.gs` — スプレッドシート側に貼る Apps Script

## 技術メモ

- 地図: [Leaflet](https://leafletjs.com/) + [OpenStreetMap](https://www.openstreetmap.org/copyright) タイル(無料・APIキー不要)
- ジオコーディング: [Nominatim](https://nominatim.org/)(利用規約に従い1秒1リクエスト)
- 都道府県境界は [dataofjapan/land](https://github.com/dataofjapan/land) のデータを簡略化して使用
