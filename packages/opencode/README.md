# opencode-japan-ai-provider

JAPAN AI CHAT API (`https://api.japan-ai.co.jp/v1`) を opencode から利用するためのプラグインです。

API キーとメールアドレスの管理、利用可能なモデルの取得、60 秒タイムアウトへの対応を行います。

- [セットアップ](#セットアップ)
- [環境変数](#環境変数)
- [プラグインオプション](#プラグインオプション)
- [モデル一覧の解決](#モデル一覧の解決)
- [reasoning effort](#reasoning-effort)
- [60 秒タイムアウトと deep_think](#60-秒タイムアウトと-deep_think)
- [設定ファイル側で上書きする](#設定ファイル側で上書きする)

## セットアップ

`~/.config/opencode/opencode.json` の `plugin` に、プラグインのエントリファイルを追加します。

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["file:///path/to/jai-providers/packages/opencode/src/index.ts"]
}
```

ディレクトリではなく、`src/index.ts` まで含むパスを指定してください。

`file:///path/to/jai-providers/packages/opencode` のようにディレクトリを指定しても読み込まれません。

次に、JAPAN AI の資格情報を登録します。

```
/connect japan-ai
```

`Account email (userId)` にはメールアドレスを、`API Key` にはAPIキーを入力します。

CLI から登録する場合は、`opencode providers login` でも同じ手順を実行できます。

メールアドレスは資格情報の `metadata.userId` に、API キーは資格情報本体に保存されます。

設定ファイルに API キーやメールアドレスを書く必要はありません。

### モデル探索用の資格情報

| 環境変数 | 用途 |
|----------|------|
| `JAPAN_AI_API_KEY` | モデル探索 (`/v1/models`) 用の API キー |
| `JAPAN_AI_USER_ID` | メールアドレス |

`JAPAN_AI_API_KEY` はモデル一覧の取得にだけ使われます。

`${XDG_CONFIG_HOME:-~/.config}/jai-providers/config.json` に `apiKey` と `userId` を書いた場合は、そちらが環境変数より優先されます。

どちらも、値が `!` で始まる場合はシェルコマンドとして実行した標準出力を API キーとして扱います（例: `!pass show japan-ai`）。

チャットリクエストには `/connect` で保存した API キーを使うため、環境変数だけで `/connect` を省略することはできません。

`userId` は次の順に解決します。

1. `/connect` で保存した `metadata.userId`
2. `config.json` の `userId`
3. プラグインオプションの `userId`
4. `JAPAN_AI_USER_ID`

対話的に `/connect` を実行できない環境では、プラグインオプションで指定できます。

```json
{
  "plugin": [["file:///path/to/jai-providers/packages/opencode/src/index.ts", { "userId": "you@example.com" }]]
}
```

## プラグインオプション

| オプション | 既定値 | 説明 |
|------|--------|------|
| `userId` | なし | メールアドレス。`/connect` で登録済みならそちらが優先される |
| `baseURL` | `https://api.japan-ai.co.jp/v1` | API のベース URL |
| `dynamicModels` | `true` | `false` にすると `/v1/models` を取得せず、`src/catalog.ts` の一覧だけを登録する |
| `ttlMs` | 6 時間 | モデル一覧とメタデータのキャッシュ有効期限 |
| `exclude` | `DEFAULT_EXCLUDE` | 除外するモデル ID を表す正規表現の文字列配列 |
| `deepThink` | `true` | `deep_think` ツールの登録とシステムプロンプト追加。`false` で無効 |
| `forceEffort` | なし | 指定すると全リクエストの `reasoning_effort` を固定する。variant より優先される |

## モデル一覧の解決

1. `${XDG_CACHE_HOME:-~/.cache}/opencode/japan-ai-models.json` が `ttlMs` 以内なら、そのキャッシュを使います。この場合、起動時の通信はありません。
2. キャッシュの有効期限が切れていれば、`/v1/models` を取得してキャッシュを更新します。
3. 取得に失敗した場合は、期限切れのキャッシュ、`src/catalog.ts` の同梱一覧の順に利用します。

キャッシュには除外前のモデル ID を保存します。

`exclude` を変更しても、モデル一覧を再取得する必要はありません。

すぐに再取得したい場合は、キャッシュファイルを削除してください。

`/v1/models` はモデル ID しか返さないため、コンテキスト長と最大出力トークン数は [`models.dev`](https://models.dev/) から取得します。

メタデータは `${XDG_CACHE_HOME:-~/.cache}/opencode/japan-ai-model-metadata.json` に `ttlMs` の間キャッシュします。

取得に失敗した場合は期限切れのキャッシュを使い、情報がないモデルには `src/catalog.ts` の明示値またはベンダーごとの既定値を適用します。

reasoning effort の選択肢と JAPAN AI 固有の上限は、引き続き `src/catalog.ts` で管理します。

### 除外リスト

`/v1/models` には、`/chat/completions` で `Invalid model name` となるモデル ID が含まれます。

既定の `DEFAULT_EXCLUDE` では、次のモデルを除外します。

| パターン | 除外対象 |
|----------|------|
| `-latest$` | `gpt-latest`, `claude-opus-latest` などのエイリアス |
| `-free$` | 無料枠向けモデル ID |
| `^jai-auto` | コンソール専用のルーターモデル |
| `^glm-5$` | 完全一致する ID のみ。`glm-5.1` などは残ります。 |
| `^deepseek-chat-v3$` | 同上 |

利用できないモデルは API キーの権限によって異なるため、`exclude` オプションで除外リストを差し替えられます。

指定した配列は既定値とマージされず、そのまま使われます。

## reasoning effort

reasoning effort を選べるモデルには、variant が生成されます。

`model` を指定するときに `@` を付けて選択します。

```json
{ "model": "japan-ai/claude-opus-5@high" }
```

`opencode run -m <model>@<variant>` は、opencode が variant 付きのモデル指定を解決できないため使えません。

設定ファイルの `model` または `agent.*.model`、あるいは TUI から選択してください。

## 60 秒タイムアウトと deep_think

JAPAN AI は、最初のトークンが 60 秒以内に届かないリクエストを中断します。

モデルが非表示の推論を長く行うと、その間はトークンが届かないため、タイムアウトすることがあります。

このプラグインは、推論をツール呼び出しの引数として出力させます。

引数は生成と同時にストリーミングされるため、無通信時間を避けられます。

- `deep_think` ツールを登録し、`thoughts` 引数に推論を書かせます。
- JAPAN AI のモデルにだけ、`deep_think` を使うシステムプロンプトを追加します。

opencode にはプロバイダーごとのツールスコープがないため、ツール自体はすべてのモデルに登録されます。

ただし、ツールを使うよう促すシステムプロンプトは JAPAN AI のモデルにだけ追加されます。

この対策を使う場合も、reasoning effort は低く設定してください。

モデル variant で選ぶか、`forceEffort` で固定します。

```json
{
  "plugin": [["file:///path/to/jai-providers/packages/opencode/src/index.ts", { "forceEffort": "none" }]]
}
```

`forceEffort` は variant の選択を上書きするため、既定では無効です。

モデルごとに effort を使い分ける場合は指定せず、variant で選択してください。

`deepThink: false` を指定すると、ツールの登録とシステムプロンプトの追加を無効にできます。

## 設定ファイル側で上書きする

`opencode.json` に書いたモデル定義は、プラグインが生成した定義より優先されます。

コンテキスト長などの上限を個別に変更したい場合や、除外されたモデル ID を有効にしたい場合に使います。

```json
{
  "provider": {
    "japan-ai": {
      "models": {
        "claude-opus-5": { "limit": { "context": 200000, "output": 64000 } }
      }
    }
  }
}
```

`provider.japan-ai.options` も同様に、プラグインが設定する `baseURL` などより優先されます。
