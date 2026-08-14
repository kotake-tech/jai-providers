# opencode-japan-ai-provider

JAPAN AI CHAT API (`https://api.japan-ai.co.jp/v1`) を opencode のプロバイダーとして登録する opencode プラグイン。

- [仕組み](#仕組み)
- [セットアップ](#セットアップ)
- [プラグインオプション](#プラグインオプション)
- [モデル一覧の解決](#モデル一覧の解決)
- [reasoning effort](#reasoning-effort)
- [60 秒タイムアウトと deep_think](#60-秒タイムアウトと-deep_think)
- [開発](#開発)

## 仕組み

JAPAN AI をそのまま opencode につなぐと、次の 3 点が問題になる。プラグインはこれらをフックで吸収する。

- 個人 API キーはアカウントメール (`userId`) の同送を要求する。キーは資格情報として、メールはそのメタデータとして保存されるため、どちらも設定ファイルには書かれない
- `/v1/models` はモデル id しか返さないうえ、実際には呼べない id も混ざる
- 最初のトークンが 60 秒以内に届かないとリクエストが打ち切られる。隠れた reasoning の間は 1 トークンも流れないため、CoT が長いモデルはタイムアウトする。対策として推論をツール呼び出しの引数に吐かせる `deep_think` を入れている ([詳細](#60-秒タイムアウトと-deep_think))

| フック | 役割 |
|--------|------|
| `auth` | `/connect japan-ai` で API キーとアカウントメールを入力させ、資格情報として保存する |
| `config` | プロバイダー定義とモデル一覧を注入する。`/v1/models` からモデル id を取得して自動追従する |
| `tool` | `deep_think` ツールを登録する |
| `experimental.chat.system.transform` | japan-ai のモデルにだけ `deep_think` を使うシステムプロンプトを足す |
| `chat.params` | `forceEffort` 指定時に `reasoningEffort` を固定する |

モデルは `@ai-sdk/openai-compatible` 経由で呼ばれる。

## セットアップ

`~/.config/opencode/opencode.json` に以下を追加する。

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["file:///path/to/jai-providers/packages/opencode/src/index.ts"]
}
```

プラグインの参照はディレクトリではなくエントリファイルまでのパスを指定する。ディレクトリ指定 (`file:///path/to/jai-providers/packages/opencode`) では読み込まれない。

続けて資格情報を登録する。

```
/connect japan-ai
```

`Account email (userId)` と `API Key` を聞かれるので入力する。CLI から登録する場合は `opencode providers login` でも同じフローが使える。

メールは資格情報の `metadata.userId` に、キーは資格情報本体として保存される。キー入力のプロンプトは opencode が `type: "api"` のメソッドに対して必ず自前で追加するため、プラグイン側では宣言していない。

### 環境変数

| 環境変数 | 用途 |
|----------|------|
| `JAPAN_AI_API_KEY` | モデル探索 (`/v1/models`) 用の API キー |
| `JAPAN_AI_USER_ID` | アカウントメール |

`JAPAN_AI_API_KEY` が効くのはモデル探索だけで、チャットリクエストの認証には使われない。チャットに使うキーは `/connect` で保存されたものだけなので、環境変数だけで `/connect` を省くことはできない。

`userId` の解決順は `/connect` の `metadata.userId` → プラグインオプションの `userId` → `JAPAN_AI_USER_ID`。`/connect` を通していない環境では、オプションで渡せる。

```json
{
  "plugin": [["file:///path/to/jai-providers/packages/opencode/src/index.ts", { "userId": "you@example.com" }]]
}
```

## プラグインオプション

| キー | 既定値 | 説明 |
|------|--------|------|
| `userId` | なし | アカウントメール。`/connect` で登録済みならそちらが優先される |
| `baseURL` | `https://api.japan-ai.co.jp/v1` | API のベース URL |
| `dynamicModels` | `true` | `false` にすると `/v1/models` を叩かず `src/catalog.ts` の一覧だけを登録する |
| `ttlMs` | 6 時間 | モデル一覧キャッシュの有効期限 |
| `exclude` | `DEFAULT_EXCLUDE` | 除外する id の正規表現 (文字列) 配列 |
| `deepThink` | `true` | `deep_think` ツールの登録とシステムプロンプト追加。`false` で無効 |
| `forceEffort` | なし | 指定すると全リクエストの `reasoning_effort` を固定する。variant より優先される |

## モデル一覧の解決

1. `${XDG_CACHE_HOME:-~/.cache}/opencode/japan-ai-models.json` が `ttlMs` 以内なら、それを使う (起動時に通信しない)
2. 期限切れなら `/v1/models` を取得してキャッシュを更新する
3. 取得に失敗したら、期限切れキャッシュ → `src/catalog.ts` の同梱一覧、の順にフォールバックする

キャッシュには除外前の生の id を書くので、`exclude` を変えても再取得は要らない。即時に再取得させたいときはキャッシュファイルを削除する。

`/v1/models` はモデル id しか返さないため、コンテキスト長・最大出力・reasoning effort の段階は `src/catalog.ts` で管理する。カタログに無い id は同ファイルの `FAMILY_RULES` によってベンダー別の既定値が割り当てられるので、新モデルはコード変更なしで使える。

### 除外リスト

`/v1/models` には、実際に `/chat/completions` へ投げると `Invalid model name` で拒否される id が含まれる。既定 (`DEFAULT_EXCLUDE`) では以下を除外している。

| パターン | 対象 |
|----------|------|
| `-latest$` | `gpt-latest`, `claude-opus-latest` などのエイリアス |
| `-free$` | 無料枠向け id |
| `^jai-auto` | コンソール専用のルーターモデル |
| `^glm-5$` | id が完全一致するもののみ (`glm-5.1` などは残る) |
| `^deepseek-chat-v3$` | 同上 |

除外対象は API キーの権限によって変わるため、`exclude` オプションで丸ごと差し替えできる。指定した配列は既定値とマージされず、そのまま使われる。

## reasoning effort

effort を持つモデルには variant が生成される。`model` の指定時に `@` で選択する。

```json
{ "model": "japan-ai/claude-opus-5@high" }
```

`opencode run -m <model>@<variant>` は opencode 側が variant 付き指定を解決しないため使えない。設定ファイルの `model` / `agent.*.model` か TUI から選択する。

## 60 秒タイムアウトと deep_think

JAPAN AI は**最初のトークンが 60 秒以内に届かないとリクエストを打ち切る**。思考が隠れた reasoning に入るとその間 1 トークンも流れないため、CoT が長いモデルはタイムアウトする。

対策として、reasoning を隠さずツール呼び出しの引数として吐かせる。引数は生成と同時にストリームされるので無通信時間が発生しない。

- `deep_think` ツール (`thoughts` 引数に推論を書く) を登録する
- japan-ai のモデルにだけ、それを使うようシステムプロンプトを追加する

ツール自体は opencode にプロバイダー別のスコープが無いため全モデルに登録されるが、システムプロンプトの追加は japan-ai のモデルに限定している。

reasoning effort は下げておく必要がある。variant で選ぶか、`forceEffort` で固定する。

```json
{
  "plugin": [["file:///path/to/jai-providers/packages/opencode/src/index.ts", { "forceEffort": "none" }]]
}
```

`forceEffort` は variant の選択を上書きするため既定では無効。個別に effort を使い分けたい場合は指定せず、variant 側で選ぶ。

`deepThink: false` でツールとシステムプロンプトの両方を止められる。

## 設定ファイル側で上書きする

`opencode.json` に書いたモデル定義は、プラグインが生成した定義より優先される。個別に limit を変えたい場合や、除外された id を強制的に有効化したい場合に使う。

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

`provider.japan-ai.options` も同様に、プラグインが入れた `baseURL` などより優先される。

## 開発

```sh
bun install
bun run typecheck
```

`src/index.ts` を直接エントリにしているため、ビルドは不要 (opencode が Bun 上で TypeScript をそのまま読む)。npm パッケージとして配布する場合はコンパイル済み JS を `exports` に向ける必要がある。

| ファイル | 役割 |
|----------|------|
| `src/index.ts` | プラグイン本体。オプション解析と各フックの登録 |
| `src/models.ts` | opencode の config モデル定義への変換 |
| `src/deep-think.ts` | `deep_think` の opencode 向けツール定義 |

モデルカタログ・`/v1/models` の取得・キャッシュ・資格情報の解決は [`@jai-providers/common`](../common) にある。omp 版と共有しているので、モデルを追加・修正する場合はそちらを編集する。
