# omp-japan-ai

[omp](https://github.com/can1357/oh-my-pi) から JAPAN AI CHAT API を使うための拡張。

プロバイダー定義もモデル一覧も拡張が実行時に登録するので、`models.yml` には何も書かなくてよい。

## セットアップ

拡張を読み込むだけで完了する。

```sh
omp -e /path/to/jai-providers/packages/omp/src/extension.ts
```

常用するなら `~/.omp/agent/extensions/` にシンボリックリンクを置けば自動で読まれる。

```sh
ln -s /path/to/jai-providers/packages/omp/src/extension.ts ~/.omp/agent/extensions/japan-ai.ts
```

## 資格情報

omp 側に書く場所は無い。拡張が起動時に解決して `registerProvider()` へ渡すので、`models.yml` にも omp の設定ファイルにもキーは残らない。`omp auth-broker` や `omp token` の管理対象にもならない。

解決順は次のとおりで、API キーとアカウントメールが両方揃わないと登録をスキップする (警告を出すだけなので、omp の他プロバイダーには影響しない)。

| 優先 | API キー | userId (アカウントメール) |
|------|----------|---------------------------|
| 1 | `auth.json` の `japan-ai.key` | `auth.json` の `japan-ai.metadata.userId` |
| 2 | `JAPAN_AI_API_KEY` | `JAPAN_AI_USER_ID` |

### opencode の `/connect` を使う

opencode で一度登録すれば omp もそれを読む。

```
/connect japan-ai
```

保存先は `${XDG_DATA_HOME:-~/.local/share}/opencode/auth.json`。opencode を使わない場合も、同じ形のファイルを置けば omp から使える。

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

シェルの rc に平文で書くとキーが残るので、キーチェーンやシークレットマネージャー経由で注入する。

### 確認

```sh
omp models japan-ai
```

解決できていない場合は起動時に `[japan-ai] no credential found; skipping provider registration.` が出る。

## モデル一覧

拡張のロード時に `/v1/models` を取得し、`pi.registerProvider()` でモデルごと登録する。omp のファクトリは `await` されるため、モデルピッカーや `--model` の解決が走る前に出揃う。

一覧は `${XDG_CACHE_HOME:-~/.cache}/opencode/japan-ai-models.json` に 6 時間キャッシュされるので、通常の起動で通信は発生しない。取得に失敗した場合は期限切れキャッシュ、同梱カタログの順にフォールバックする。opencode プラグインとキャッシュを共有する。

コンテキスト長・最大出力・effort の段階は [`@jai-providers/common`](../common) のカタログが持つ。並び順もカタログ順 (ベンダー別) になる。

### omp のネイティブ discovery を使わない理由

omp には `discovery.type: openai-models-list` があるが、**JAPAN AI では使えない**。URL を組み立てる `normalizeOpenAIModelsListBaseUrl` が `protocol + host + pathname` しか返さないため、クエリ文字列が構造的に落ちる。JAPAN AI は個人 API キーに `?userId=<メール>` を要求し、ヘッダーも body も受け付けないので `/models` が 403 になる。

さらに discovery は正規化後の baseUrl を各モデルに焼き込むため、仮に一覧が取れてもチャット側が `userId` 無しで飛んで 403 になる。拡張が自分で fetch すればこの正規化を一切通らない。

### 静的定義に戻す

`src/extension.ts` の `OPTIONS.registerProvider` を `false` にすると登録しない。その場合は `models.yml` に自分で書く。

なお `models.yml` に書いた場合、omp は `claude-4-5-opus-thinking` のような `-thinking` で終わる id を variant alias として吸収し、モデル一覧から落とす。拡張による登録ではそれらもそのまま出る。

## 60 秒タイムアウトと deep_think

JAPAN AI は最初のトークンが 60 秒以内に届かないとリクエストを打ち切る。隠れた reasoning はトークンを出さないため、CoT が長いとタイムアウトする。

拡張を読み込むと、japan-ai のモデルに対してのみ以下が効く。

1. `reasoning_effort` を `none` に固定する (`before_provider_request`)
2. `deep_think` ツールを登録し、リクエストの `tools` に注入する
3. 「非自明な回答の前に `deep_think` を呼べ」というシステムプロンプトを足す (`before_agent_start`)

### ツールを注入している理由

omp は拡張が登録したツールを、そのままではリクエストの `tools` に載せない。MCP ツールと同じく `hub` 経由の on-demand 参照になる (`tools.xdevDocs` を `inline` にしても変わらない)。

`hub` 経由だと 1 ホップ余計に挟まり、推論をストリームさせるという目的に合わない。そこで `before_provider_request` でツールスキーマを直接 `payload.tools` に push している。実行自体は `pi.registerTool()` 済みなのでエージェントループが解決する。

### 設定

`src/extension.ts` の `OPTIONS` を編集する。

| キー | 既定値 | 説明 |
|------|--------|------|
| `deepThink` | `true` | ツール登録・注入とシステムプロンプト追加 |
| `forceEffort` | `"none"` | `reasoning_effort` の固定値。`false` で無効 |
| `registerProvider` | `true` | プロバイダーとモデル一覧の登録 |

`forceEffort` を無効にする場合は、omp ネイティブの `:effort` セレクタで下げる。

```yaml
modelRoles:
  default: japan-ai/gpt-5.6-sol:none
```

## ライセンス

MIT
