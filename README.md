# 日本全国サウナMAP (Leaflet + OpenStreetMap版)

サウナ部の活動報告フォームの回答を集計した、全国のサウナ・温泉施設マップです。
実際のOpenStreetMapタイル上に、都道府県ごとの掲載件数(色の濃淡)と各施設のピンを重ねて表示します。

## データ更新方法

### 方法A: ページ上から登録(推奨・個別の施設を1件追加)

ページ右上の「＋ サウナを登録する」から、部内パスワードを入力してフォームに記入すると、
入力内容がプリセットされた状態でGitHubの新規Issue画面が開きます。内容を確認して
「Submit new issue」を押すと、GitHub Actionsが自動で

1. 住所をジオコーディング(OpenStreetMap Nominatim)
2. 投稿者名を匿名化(`poster-map.json`で「部員A」のように対応管理)
3. `data.json` に追記してコミット・プッシュ
4. Issueにコメントして自動クローズ

まで行い、数分でマップに反映されます。**GitHubアカウントでのログインが必要です。**
部内パスワードはページのJavaScript内に書かれているだけの軽い入力障壁で、本当の意味での
アクセス制御ではない点に注意してください(見ようと思えば誰でも見られます)。

### 方法B: CSVを一括インポート(フォーム回答をまとめて反映したい場合)

1. Googleフォームの回答スプレッドシートをCSVでエクスポートする
2. そのCSVをClaudeに渡す(または `node build_data.js <CSVパス>` を自分で実行する)
3. `data.json` の変更をこのリポジトリにコミット・プッシュする
4. GitHub Pagesが自動で再デプロイする(数十秒〜数分)

## ファイル構成

- `index.html` — ページ本体(Leaflet地図・一覧・フィルタ・登録フォーム)
- `data.json` — サウナ施設データ(施設名・都道府県・緯度経度・評価など)
- `japan-prefectures.geojson` — 都道府県境界データ(簡略化済み)
- `poster-map.json` — 投稿者名の匿名化マッピング(実名→「部員A」等)
- `.github/ISSUE_TEMPLATE/new-sauna.yml` — 登録フォームのIssueテンプレート
- `.github/workflows/process-sauna-issue.yml` — Issueを自動処理してdata.jsonに反映するAction
- `scripts/process_issue.js` — Issue本文をパースしてdata.jsonに追記する処理本体
- `build_data.js` — CSVを一括インポートするためのスクリプト

## 技術メモ

- 地図: [Leaflet](https://leafletjs.com/) + [OpenStreetMap](https://www.openstreetmap.org/copyright) タイル(無料・APIキー不要)
- 都道府県境界は [dataofjapan/land](https://github.com/dataofjapan/land) のデータを簡略化して使用
- 登録フォームはGitHubの書き込み権限をクライアント側に一切持たない設計です(GitHub Actionsの
  自動トークンのみがリポジトリへの書き込みを行うため、ページのJavaScriptを覗かれても
  リポジトリが書き換えられる心配はありません)
