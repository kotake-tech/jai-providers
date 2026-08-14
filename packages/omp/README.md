# omp-japan-ai

[omp](https://github.com/can1357/oh-my-pi) から JAPAN AI CHAT API を使うための拡張と、`models.yml` の生成スクリプト。

プロバイダー定義そのものは omp の `models.yml` が持つ。この パッケージが足すのは、モデル一覧の自動追従と 60 秒タイムアウトの回避の 2 つ。

## モデル一覧の生成

omp には `discovery.type: openai-models-list` という動的取得の仕組みがあるが、**JAPAN AI では使えない**。discovery は `<baseUrl>/models` を組み立てるときにクエリ文字列を捨てるため、JAPAN AI が個人 API キーに要求する `userId` が付かず 403 になる。`userId` をヘッダーで渡すことも API 側が受け付けない。

そのため、事前に一覧を取得して `models.yml` に書き出す。

```sh
bun run omp:models              # ~/.omp/agent/models.yml を更新
bun run omp:models -- --stdout  # 標準出力に出すだけ (差分確認用)
bun run omp:models -- --force   # キャッシュを無視して再取得
```

| フラグ | 用途 |
|--------|------|
| `--stdout` | 書き込まずに標準出力へ |
| `--force` | モデル一覧キャッシュを無視して `/v1/models` を叩く |
| `--out <path>` | 出力先を変える (既定は `$PI_CODING_AGENT_DIR/models.yml`) |
| `--user-id <email>` | アカウントメールを明示する |

書き換えるのは `providers.japan-ai.models` だけで、`baseUrl` や `apiKey`、コメント、他のプロバイダーはそのまま残る。ファイルが無い場合はテンプレートから作る。

資格情報は opencode の `auth.json` (`/connect japan-ai` で保存したもの) から読む。`JAPAN_AI_API_KEY` / `JAPAN_AI_USER_ID` でも渡せる。

モデルの並び順は [`@japan-ai/core`](../core) のカタログ順 (ベンダー別) になるので、差分が安定する。

## 60 秒タイムアウトと deep_think

JAPAN AI は最初のトークンが 60 秒以内に届かないとリクエストを打ち切る。隠れた reasoning はトークンを出さないため、CoT が長いとタイムアウトする。

拡張を読み込むと、japan-ai のモデルに対してのみ以下が効く。

1. `reasoning_effort` を `none` に固定する (`before_provider_request`)
2. `deep_think` ツールを登録し、リクエストの `tools` に注入する
3. 「非自明な回答の前に `deep_think` を呼べ」というシステムプロンプトを足す (`before_agent_start`)

```sh
omp -e /path/to/jai-provider/packages/omp/src/extension.ts
```

常用するなら `~/.omp/agent/extensions/` にシンボリックリンクを置けば自動で読まれる。

```sh
ln -s /path/to/jai-provider/packages/omp/src/extension.ts ~/.omp/agent/extensions/japan-ai.ts
```

### ツールを注入している理由

omp は拡張が登録したツールを、そのままではリクエストの `tools` に載せない。MCP ツールと同じく `hub` 経由の on-demand 参照になる (`tools.xdevDocs` を `inline` にしても変わらない)。

`hub` 経由だと 1 ホップ余計に挟まり、推論をストリームさせるという目的に合わない。そこで `before_provider_request` でツールスキーマを直接 `payload.tools` に push している。実行自体は `pi.registerTool()` 済みなのでエージェントループが解決する。

### 設定

`src/extension.ts` の `OPTIONS` を編集する。

| キー | 既定値 | 説明 |
|------|--------|------|
| `deepThink` | `true` | ツール登録・注入とシステムプロンプト追加 |
| `forceEffort` | `"none"` | `reasoning_effort` の固定値。`false` で無効 |

`forceEffort` を無効にする場合は、omp ネイティブの `:effort` セレクタで下げる。

```yaml
modelRoles:
  default: japan-ai/gpt-5.6-sol:none
```

## ライセンス

MIT
