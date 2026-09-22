# 日本全国サウナMAP (Leaflet + OpenStreetMap版)

サウナ部の活動報告フォームの回答を集計した、全国のサウナ・温泉施設マップです。
実際のOpenStreetMapタイル上に、都道府県ごとの掲載件数(色の濃淡)と各施設のピンを重ねて表示します。

## データ更新方法

このサイトは静的ファイルなので、フォームの回答が増えたら以下の手順で更新します。

1. Googleフォームの回答スプレッドシートをCSVでエクスポートする
2. そのCSVをClaudeに渡す
3. Claudeが `data.json` を作り直し、このリポジトリにコミット・プッシュする
4. GitHub Pagesが自動で再デプロイする(数十秒〜数分)

## ファイル構成

- `index.html` — ページ本体(Leaflet地図・一覧・フィルタ)
- `data.json` — サウナ施設データ(施設名・都道府県・緯度経度・評価など)
- `japan-prefectures.geojson` — 都道府県境界データ(簡略化済み)

## 技術メモ

- 地図: [Leaflet](https://leafletjs.com/) + [OpenStreetMap](https://www.openstreetmap.org/copyright) タイル(無料・APIキー不要)
- 都道府県境界は [dataofjapan/land](https://github.com/dataofjapan/land) のデータを簡略化して使用
