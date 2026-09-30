# Backlog Project Constraints

## Project Key

Backlogのプロジェクトキーには、大文字の半角英数字とアンダースコアだけを
使用できます。

```text
使用可能: A-Z, 0-9, _
```

例:

- `IGATEST01`: 使用可能
- `BLG_2`: 使用可能
- `igatest01`: 使用不可（小文字を含む）

## 実接続で確認したエラー

2026-07-22に`add_project`へ小文字のキー`igatest01`を指定したところ、
Backlog APIからHTTP 400、エラーコード7が返され、プロジェクトは作成されませんでした。

```text
プロジェクトキーは大文字の半角英数とアンダースコアで入力してください。(例:BLG_2)
```

プロジェクト作成前に、この制約へ適合するキーであることを確認してください。

## Issue Creation

`add_issue`で課題を作成するには、少なくとも次の値が必要です。

- 数値のプロジェクトID
- 件名
- 数値の課題種別ID
- 数値の優先度ID

プロジェクトキー、課題種別名、優先度名をそのまま渡すのではなく、事前に
`get_project_list`、`get_issue_types`、`get_priorities`で対応するIDを取得します。
作成前には同じ入力でdry-runを実行し、入力スキーマを検証してください。

## Issue Retrieval

`get_issue`は次のいずれかを入力として受け取ります。

```json
{"issueKey":"PROJECT-1"}
```

```json
{"issueId":12345}
```

`issueIdOrKey`というフィールド名は受け付けません。実接続では
`issueIdOrKey`を指定すると`Issue ID or key is required`となり、
`issueKey`へ修正することで取得に成功しました。

`issueId`と`issueKey`を同時に指定した場合、正の`issueId`を優先します。
`issueId`が`0`以下の場合は、`issueKey`を指定していればそちらへフォールバック
します。どちらも有効でない場合は入力エラーです。

## Related Issues

`get_related_issues`は、課題に紐づく関連課題を読み取ります。`issueId`または
`issueKey`のいずれかが必要です。

```json
{"issueKey":"PROJECT-1"}
```

`add_related_issue`は、元課題の`issueId`または`issueKey`と、関連付け先の
数値`targetIssueId`を必要とするCREATE操作です。

```json
{"issueKey":"PROJECT-1","targetIssueId":12346}
```

`remove_related_issue`は、元課題の`issueId`または`issueKey`と、解除する
数値`relatedIssueId`を必要とするDELETE操作です。実行には環境側と呼び出し側の
`DELETE`許可に加え、`--confirm-destructive`が必要です。作成・解除の前には
同じ入力でdry-runを実行して確認してください。

## Issue Listing

`get_issues`でプロジェクトを絞り込む場合、`projectId`は単一の数値ではなく
数値の配列で指定します。

```json
{"projectId":[12345],"count":100,"sort":"created","order":"asc"}
```

課題を複数作成する前に一覧を取得し、件名や元データのURLを比較して
重複登録を避けてください。作成後も同じ一覧取得を行うことで、課題キー、
件名、種別、優先度、状態を読み取り専用で確認できます。

## Text Formatting Rule

プロジェクトの現在のテキスト整形ルールは、`get_project`が返す
`textFormattingRule`で確認できます。値は`backlog`または`markdown`です。

`add_project`で`textFormattingRule`を省略した場合、この変換実装は
`backlog`を既定値として送信します。Markdownを使用するプロジェクトでは、
作成時に次の値を明示してください。

```json
{"textFormattingRule":"markdown"}
```

既存プロジェクトの設定だけを変更する場合、`update_project`へプロジェクトキーと
変更対象のフィールドを指定できます。

```json
{"projectKey":"PROJECT","textFormattingRule":"markdown"}
```

更新後は`get_project`で現在値を再取得して確認してください。

## Chart Setting

「チャートを使用する」の現在値は、`get_project`が返す`chartEnabled`で
確認できます。`true`がON、`false`がOFFです。

`add_project`で`chartEnabled`を省略した場合、この変換実装は`false`を
既定値として送信します。チャートを使用するプロジェクトでは、作成時に
`true`を明示してください。

```json
{"chartEnabled":true}
```

既存プロジェクトをONへ変更する場合は、次のように`update_project`を
使用できます。

```json
{"projectKey":"PROJECT","chartEnabled":true}
```

更新後は`get_project`で`chartEnabled`を再確認してください。

## Parent-Child Issue Setting

「親子課題を使用する」の現在値は、`get_project`が返す
`subtaskingEnabled`で確認できます。`true`がON、`false`がOFFです。

`add_project`で`subtaskingEnabled`を省略した場合、この変換実装は`false`を
既定値として送信します。親子課題を使用するプロジェクトでは、作成時に
`true`を明示してください。

```json
{"subtaskingEnabled":true}
```

既存プロジェクトをONへ変更する場合は、次のように`update_project`を
使用できます。

```json
{"projectKey":"PROJECT","subtaskingEnabled":true}
```

更新後は`get_project`で`subtaskingEnabled`を再確認してください。

## Issue Comments

`add_issue_comment`でコメントを追加するには、`issueKey`または`issueId`と
`content`を指定します。通知先と添付ファイルは任意です。

```json
{"issueKey":"PROJECT-1","content":"コメント本文"}
```

追加後は、返されたコメントIDを使って`get_issue_comments`の結果を照合できます。

```json
{"issueKey":"PROJECT-1","count":100,"order":"desc"}
```

コメント追加はBacklogを変更する操作です。事前に同じ入力でdry-runを実行し、
実行は1回に限定してください。

`update_issue_comment`は、`issueId`または`issueKey`、数値`commentId`、
新しい`content`を必要とするUPDATE操作です。環境側と呼び出し側の両方で
`UPDATE`を許可したうえで、dry-runによる入力検証後に実行してください。

```json
{"issueKey":"PROJECT-1","commentId":12345,"content":"更新後のコメント"}
```
