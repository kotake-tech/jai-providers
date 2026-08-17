# jai-providers

JAPAN AI CHAT API (`https://api.japan-ai.co.jp/v1`) を、opencode と omp から利用するための拡張集です。

API のモデル一覧取得、モデルごとの設定、認証情報の解決を共通化し、各エージェント向けの拡張から利用します。

## 使い方

| パッケージ | 対象 |
|------------|------|
| [`packages/opencode`](packages/opencode) | opencode で JAPAN AI を使う場合 |
| [`packages/omp`](packages/omp) | omp で JAPAN AI を使う場合 |

使いたいエージェントの README に従ってセットアップしてください。

JAPAN AI CHAT API の制約と、このリポジトリでの対応は [docs/japan-ai-api.md](docs/japan-ai-api.md) にまとめています。

## 開発者向け

このリポジトリの開発・保守に必要な情報です。エンドユーザーは通常読む必要がありません。

### パッケージ

| パッケージ | 内容 |
|------------|------|
| [`packages/common`](packages/common) | モデルカタログ、APIアクセス、キャッシュ、資格情報の解決 |
| [`packages/opencode`](packages/opencode) | opencode用プラグイン |
| [`packages/omp`](packages/omp) | omp用拡張 |

### 開発環境

```sh
bun install
bun run typecheck
```

ビルドは不要です。opencodeとompは、Bun上でTypeScriptを直接読み込みます。

モデルカタログやAPIアクセスに関する共通処理は [`packages/common`](packages/common) にあります。

## ライセンス

MIT
