# 無料データソースガイド

Coinglass は有料のため、当面は **無料の公開 API** で先物指標を取得します。

## 現在の構成（既定）

| データ | 無料ソース | 認証 |
|--------|-----------|------|
| BTC 現物価格・板 | WhiteBIT, Binance, bitbank, Coinbase | 不要 |
| Fear & Greed | Alternative.me | 不要 |
| 先物 OI / Funding | **Binance, Bybit, OKX, WhiteBIT** 公開 API | 不要 |
| bitbank（現物） | **bitbank** 公開 API（価格・出来高。先物 API なし） | 不要 |
| 合計 OI | 上記取引所の合算 | — |
| 平均 Funding | 上記取引所の平均 | — |
| 清算ヒートマップ | なし（有料サービス向け） | — |

`.env` 設定（APIキー不要）:

```bash
DERIVATIVES_PROVIDER=free
DERIVATIVES_EXCHANGES=binance,bybit,okx,whitebit,bitbank
COINGLASS_API_KEY=
```

取引所を減らす例:

```bash
DERIVATIVES_EXCHANGES=binance,whitebit
```

## Coinglass との比較

| 項目 | 無料 (Binance) | Coinglass（有料） |
|------|----------------|-------------------|
| 費用 | 0円 | 高額プラン |
| 取引所横断 OI | Binance のみ | 30+ 取引所集計 |
| 清算マップ | なし | あり |
| 開発・検証 | **十分** | 本番強化時 |

## 将来 Coinglass を使う場合

```bash
DERIVATIVES_PROVIDER=auto   # キーがあれば Coinglass、なければ無料
COINGLASS_API_KEY=your_key
```

## その他の無料候補（未実装・拡張用）

- **Bybit** 公開 API — ファンディング・OI
- **OKX** 公開 API — 同様
- 複数取引所の平均を自前集計（`free_aggregate` モードとして将来追加可）

## WhiteBIT について

現物の価格・板は **WhiteBIT Public API** で取得済みです。APIキーは不要です。
Private API（自分の注文・残高）が必要になった場合のみキーを設定します。
