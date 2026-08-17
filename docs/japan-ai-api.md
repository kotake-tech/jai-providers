# JAPAN AI CHAT API の仕様と対処

JAPAN AI CHAT API (`https://api.japan-ai.co.jp/v1`) は OpenAI 互換をうたっているが、そのままでは動かない箇所がいくつかある。以下は JAPAN AI 側の挙動と、それに対して `packages/common` が入れている対処のまとめ。

## モデルのメタデータが API から取れない

`/v1/models` はモデル id しか返さず、コンテキスト長・最大出力・reasoning effort の段階は一切含まない。

これらは `packages/common/src/catalog.ts` で管理し、カタログに無い id にはベンダー別の既定値を割り当てる。新しいモデルはコード変更なしで使える。

## `/v1/models` が呼べないモデルを列挙する

`-latest` エイリアス、`-free` 枠、`jai-auto` ルーターモデルなどは一覧に出るが、`/chat/completions` に投げると `Invalid model name` で拒否される。

`catalog.ts` の除外パターンで落としている。

## `userId` はクエリ文字列でしか渡せない

個人 API キーは `?userId=<メール>` の同送を要求する。エラーメッセージは "requires userId in request body" と言うが、body に入れると JAPAN AI が上流へそのまま転送してしまい、OpenAI や Vertex 側が `Unrecognized request argument` で弾く。ヘッダーは無視される。

この制約のため、両アダプタともモデル一覧の取得を自前の fetch で行っている (エージェント側の URL 組み立てを通すとクエリが落ちる)。

## 最初のトークンが 60 秒以内に届かないと打ち切られる

隠れた reasoning はトークンを出さないので、CoT が長いモデルはこのタイムアウトに掛かる。

effort を下げたうえで、推論を `deep_think` ツールの引数としてストリームさせる。文言は `packages/common/src/deep-think.ts` にあり、ツール定義だけ各エージェント向けに書いている。
