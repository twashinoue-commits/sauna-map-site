/**
 * サウナMAP 自動反映スクリプト
 *
 * スプレッドシート「サウナ部活動報告」の [拡張機能] > [Apps Script] に貼り付けて使う。
 * フォーム送信時(と、メニューから手動実行したとき)にシート全体をGitHubへ送り、
 * GitHub Actions が data.json を作り直してサイトを更新する。
 *
 * 初期設定:
 *   1. [プロジェクトの設定] > [スクリプト プロパティ] に GITHUB_TOKEN を追加
 *      (sauna-map-site リポジトリだけに Contents: Read and write を付けた fine-grained token)
 *   2. エディタで関数 setupTrigger を選んで1回だけ実行(権限の承認を求められたら許可)
 */

const GITHUB_OWNER = "twashinoue-commits";
const GITHUB_REPO = "sauna-map-site";
const SHEET_NAME = "フォームの回答 1";

function syncToSite() {
  const token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!token) throw new Error("スクリプト プロパティに GITHUB_TOKEN が設定されていません");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const rows = sheet.getDataRange().getDisplayValues();

  const res = UrlFetchApp.fetch(
    "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/dispatches",
    {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
      },
      payload: JSON.stringify({
        event_type: "sheet-updated",
        client_payload: { rows: JSON.stringify(rows) },
      }),
      muteHttpExceptions: true,
    }
  );
  if (res.getResponseCode() !== 204) {
    throw new Error("GitHubへの送信に失敗しました (" + res.getResponseCode() + "): " + res.getContentText());
  }
}

/** シートを開いたときに「サウナMAP」メニューを追加する(手入力で修正したあとに使う) */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("サウナMAP")
    .addItem("サイトに反映", "syncToSiteFromMenu")
    .addToUi();
}

function syncToSiteFromMenu() {
  syncToSite();
  SpreadsheetApp.getActiveSpreadsheet().toast("送信しました。数分でサイトに反映されます。", "サウナMAP");
}

/** 初回に1回だけ実行: フォーム送信時に syncToSite が走るトリガーを登録する */
function setupTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "syncToSite")
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("syncToSite").forSpreadsheet(ss).onFormSubmit().create();
}
