# omp-japan-ai

[omp](https://github.com/can1357/oh-my-pi) から JAPAN AI CHAT API を利用するための拡張です。

拡張がプロバイダーとモデル一覧を実行時に登録するため、通常は `models.yml` を編集する必要がありません。

## セットアップ

拡張を読み込みます。

```sh
omp -e /path/to/jai-providers/packages/omp/src/extension.ts
```

継続して使う場合は、`~/.omp/agent/extensions/` にシンボリックリンクを置くと自動で読み込まれます。

```sh
ln -s /path/to/jai-providers/packages/omp/src/extension.ts ~/.omp/agent/extensions/japan-ai.ts
```

## 資格情報の設定

API キーとメールアドレスは、opencode の資格情報ファイルまたは環境変数から読み取ります。

`models.yml` や omp の設定ファイルに資格情報を保存する必要はありません。

API キーとメールアドレスは次の順に解決します。

どちらかが不足している場合は、JAPAN AI プロバイダーを登録しません。

警告を表示するだけなので、他のプロバイダーには影響しません。

| 優先 | API キー | userId（メールアドレス） |
|------|----------|---------------------------|
| 1 | `auth.json` の `japan-ai.key` | `auth.json` の `japan-ai.metadata.userId` |
| 2 | `JAPAN_AI_API_KEY` | `JAPAN_AI_USER_ID` |

### opencode の `/connect` で登録する

opencode で一度登録すると、omp も同じ資格情報を利用します。

```
/connect japan-ai
```

資格情報は `${XDG_DATA_HOME:-~/.local/share}/opencode/auth.json` に保存されます。

opencode を使わない場合も、同じ形式のファイルを置けば omp から利用できます。

```json
{
  "japan-ai": {
    "type": "api",
    "key": "<APIキー>",
    "metadata": { "userId": "you@example.com" }
  }
}
```

### 環境変数を使う

```sh
export JAPAN_AI_API_KEY="$(security find-generic-password -s japan-ai -w)"
export JAPAN_AI_USER_ID='you@example.com'
```

シェルの設定ファイルに API キーを平文で書くと、キーが残ります。

macOS のキーチェーンやシークレットマネージャーを使って設定してください。

### 確認

```sh
omp models japan-ai
```

資格情報を解決できない場合は、起動時に次のメッセージが表示されます。

```text
[japan-ai] no credential found; skipping provider registration.
```

## モデル一覧

拡張の読み込み時に `/v1/models` を取得し、`pi.registerProvider()` でモデルを登録します。

omp は拡張の初期化完了を待つため、モデルピッカーや `--model` の解決前にモデル一覧を利用できます。

モデル一覧は `${XDG_CACHE_HOME:-~/.cache}/opencode/japan-ai-models.json` に 6 時間キャッシュされます。

コンテキスト長と最大出力トークン数は `models.dev` から取得し、`japan-ai-model-metadata.json` に同じ期間キャッシュします。

キャッシュが有効な間は、通常の起動で通信しません。

取得に失敗した場合は、期限切れのキャッシュ、同梱カタログの順に利用します。

このキャッシュは opencode プラグインと共有します。

オンライン取得に失敗した場合は期限切れのキャッシュを使い、情報がなければ [`@jai-providers/common`](../common) のカタログへフォールバックします。

reasoning effort の選択肢と JAPAN AI 固有の上限は共通カタログで管理します。

モデルはカタログ順に、ベンダーごとに表示されます。

### 標準のモデル検出を使わない理由

omp には `discovery.type: openai-models-list` がありますが、JAPAN AI では使えません。

URL を組み立てる `normalizeOpenAIModelsListBaseUrl` がクエリ文字列を保持しないためです。

JAPAN AI の個人 API キーには `?userId=<メールアドレス>` が必要ですが、ヘッダーやリクエストボディでは指定できません。

そのため、標準 discovery では `/models` が 403 になります。

さらに discovery は、正規化後の base URL を各モデルに設定します。

仮に一覧を取得できても、チャットリクエストから `userId` が失われ、403 になります。

この拡張はモデル一覧を独自に取得することで、URL の正規化を経由しません。

## 60 秒タイムアウトと deep_think

JAPAN AI は、最初のトークンが 60 秒以内に届かないリクエストを中断します。

モデルが非表示の推論を長く行うと、その間はトークンが届かないため、タイムアウトすることがあります。

この拡張では、JAPAN AI のモデルに対してだけ次の処理を行います。

1. `reasoning_effort` を `none` に固定します（`before_provider_request`）。
2. `deep_think` ツールを登録し、リクエストの `tools` に追加します。
3. 複雑な回答の前に `deep_think` を呼ぶよう、システムプロンプトを追加します（`before_agent_start`）。

この設定は通常の利用で変更する必要はありません。

## 開発者向け設定

この節は、拡張の挙動を変更する場合にだけ参照してください。

`src/extension.ts` の `OPTIONS` で次の項目を設定できます。

| オプション | 既定値 | 説明 |
|------|--------|------|
| `deepThink` | `true` | ツール登録・注入とシステムプロンプト追加 |
| `forceEffort` | `"none"` | `reasoning_effort` の固定値。`false` で無効 |
| `registerProvider` | `true` | プロバイダーとモデル一覧の登録 |

`forceEffort` を無効にする場合は、ompの`:effort`セレクタで低いeffortを選択してください。

omp は、拡張が登録したツールをそのままリクエストの `tools` に含めません。`hub` 経由の参照では追加のリクエストが発生するため、`before_provider_request` でツールスキーマを直接 `payload.tools` に追加しています。

## ライセンス

MIT
