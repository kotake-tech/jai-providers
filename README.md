# jai-provider

JAPAN AI CHAT API (`https://api.japan-ai.co.jp/v1`) を各コーディングエージェントから使うための統合。

モデル一覧と API の癖への対処を 1 箇所にまとめ、エージェントごとの薄いアダプタから共有する。

## パッケージ

| パッケージ | 内容 |
|------------|------|
| [`packages/core`](packages/core) | モデルカタログ、`/v1/models` の取得とキャッシュ、資格情報の解決 |
| [`packages/opencode`](packages/opencode) | opencode プラグイン (プロバイダー登録、`/connect`、`deep_think`) |
| [`packages/omp`](packages/omp) | omp 拡張 (`deep_think`、effort 固定) と `models.yml` 生成スクリプト |

セットアップ手順は各パッケージの README を参照。

## この API の癖

3 つとも `packages/core` に集約されている。

**モデル一覧はエンドポイントから取るしかない。** `/v1/models` はモデル id しか返さず、コンテキスト長・最大出力・reasoning effort の段階は一切含まない。これらは `packages/core/src/catalog.ts` で管理し、カタログに無い id にはベンダー別の既定値を割り当てる。新しいモデルはコード変更なしで使える。

**`/v1/models` は呼べないモデルを列挙する。** `-latest` エイリアス、`-free` 枠、`jai-auto` ルーターモデルなどは一覧に出るが `/chat/completions` に投げると `Invalid model name` で拒否される。`catalog.ts` の除外パターンで落としている。

**最初のトークンが 60 秒以内に届かないと打ち切られる。** 隠れた reasoning はトークンを出さないので、CoT が長いモデルはタイムアウトする。effort を下げたうえで、推論を `deep_think` ツールの引数としてストリームさせる。文言は `packages/core/src/deep-think.ts` にあり、ツール定義だけ各エージェント向けに書いている。

## 開発

```sh
bun install
bun run typecheck
```

ビルドは不要。opencode も omp も Bun 上で TypeScript をそのまま読み込む。

## ライセンス

MIT
