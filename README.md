# jai-providers

JAPAN AI CHAT API (`https://api.japan-ai.co.jp/v1`) を各コーディングエージェントから使うための統合。

モデル一覧と、JAPAN AI 側の仕様に対する対処を 1 箇所にまとめ、エージェントごとの薄いアダプタから共有する。

## パッケージ

| パッケージ | 内容 |
|------------|------|
| [`packages/common`](packages/common) | モデルカタログ、`/v1/models` の取得とキャッシュ、資格情報の解決 |
| [`packages/opencode`](packages/opencode) | opencode プラグイン (プロバイダー登録、`/connect`、`deep_think`) |
| [`packages/omp`](packages/omp) | omp 拡張 (プロバイダー登録、`deep_think`、effort 固定) |

セットアップ手順は各パッケージの README を参照。

JAPAN AI CHAT API 側の仕様と、それに対する `packages/common` の対処は [docs/japan-ai-api.md](docs/japan-ai-api.md) にまとめてある。

## 開発

```sh
bun install
bun run typecheck
```

ビルドは不要。opencode も omp も Bun 上で TypeScript をそのまま読み込む。

## ライセンス

MIT
