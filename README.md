# opencode-japan-ai-provider

[OpenCode](https://opencode.ai/) 向けのカスタムプロバイダー。JAPAN AIのAPI (`https://api.japan-ai.co.jp/v1`) にリクエストする際、リクエストボディに `userId` を自動付与する。

## 仕組み

`@ai-sdk/openai-compatible` をラップし、POSTリクエストのボディに `userId` フィールドを注入するカスタム `fetch` を差し込んでいる。

```js
import { createJapanAI } from "opencode-japan-ai-provider"

const provider = createJapanAI({
  baseURL: "https://api.japan-ai.co.jp/v1",
  userId: "user@example.com",
})
```

## インストール

```bash
bun install
```

## OpenCodeでの設定例

`~/.config/opencode/opencode.json` にプロバイダーを追加する。

このパッケージをローカルパスで参照し、`userId` を渡す構成:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "japan-ai": {
      "npm": "file:///path/to/opencode-japan-ai-provider/index.js",
      "name": "JAPAN AI",
      "options": {
        "baseURL": "https://api.japan-ai.co.jp/v1",
        "userId": "your-email@example.com"
      },
      "models": {
        "claude-4-7-opus": {},
        "claude-4-6-sonnet": {},
        "claude-4-5-haiku": {},
        "gpt-5.5": {},
        "gemini-3.1-pro": {},
        "deepseek-v4-pro": {}
      }
    }
  },
  "model": "japan-ai/claude-4-7-opus"
}
```

## 利用可能なモデル

JAPAN AI経由で利用可能な主なモデル:

| ベンダー | モデル |
|----------|--------|
| Anthropic | `claude-4-7-opus`, `claude-4-7-opus-200k`, `claude-4-6-opus`, `claude-4-6-sonnet`, `claude-4-5-opus`, `claude-4-5-sonnet`, `claude-4-5-haiku` |
| OpenAI | `gpt-5.5`, `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.4-mini`, `gpt-5.2`, `o3`, `o3-pro` |
| Google | `gemini-3.1-pro`, `gemini-3.5-flash`, `gemini-3-flash`, `gemini-2.5-pro`, `gemini-2.5-flash` |
| xAI | `grok-4-2`, `grok-4-1-fast`, `grok-4-fast` |
| その他 | `deepseek-v4-pro`, `deepseek-reasoner-r1`, `kimi-k2.6`, `qwen3-coder`, `glm-5.1`, `minimax-m2.7` |

## ライセンス

MIT
