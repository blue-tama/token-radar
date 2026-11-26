[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/blue-tama/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/blue-tama/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

# Token Radar — pre-token protocols ranked by implied value

An entry for the [make.fun competition](https://make.fun/bounty/token-radar-01) to build the
best token launch radar. It reads a sealed DefiLlama snapshot of 758 protocols, ranks every
pre-token protocol by what its launch would be worth, and hands in a dashboard a reader can
use: a sortable, filterable board, a detail view for every protocol with its model breakdown
and farm plan, and a separate live-token view for the protocols whose token already trades.

## The model (radar-2)

Every row is scored by one function of the snapshot's own figures — TVL, seven-day growth,
and how long the protocol has run with no token on record. No protocol name is special-cased,
and no row is hand-picked.

```
implied = round( tvl_usd x 0.35 x (1 + clamp(change_7d, -80, 200) / 100 x 0.75)
                 x (0.5 + min(age_days, 730) / 730 x 0.5) )
```

Age is the time since DefiLlama first listed the protocol; an unlisted age uses 180 days.
The board covers all 40 watchlist slugs and adds every rankable pre-token protocol below the
$50M floor that is not a wrapped, staked or bridged product of a token that already trades.
Protocols whose token already trades are never ranked: the dashboard shows them apart, with
their market caps, which are facts, not a model. Implied value is the entry's own claim,
never a price and never a promise.

## The farm plan

Each row carries five steps, derived from the protocol's own record — category, chains, TVL
and age — each with what it costs and how long it takes: a fresh wallet, the category's one
action, a weekly rhythm of qualifying actions, a weekly check of the protocol's own points
or quests page, and a claim-and-log step that only ever uses the link the protocol itself
publishes.

## The board at a glance

The board ranks 178 pre-token protocols: the 40 on the watchlist plus 138 early finds
below the floor. The dashboard badges each row "watchlist" or "early" so a reader can see
which rows the floor already named and which ones the radar found on its own. The 24
largest live-token protocols sit in their own tab, ranked by market cap.

## How to run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

`main.ts` (Node 22, standard library only) writes `board.json`, `data.js`, `dashboard/`,
`screenshots/` and `dossier.json` to the output directory. Running it twice writes
identical bytes.

## Layout

- `main.ts` — the entrypoint: reads the snapshot, scores the board, writes the outputs
- `lib/model.ts` — the model, the farm plans and the snapshot parsing
- `vendor/makefun-board.ts` — make.fun's dossier library, copied unchanged from the kit
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`, no network
- `screenshots/` — the board, a protocol's detail view and a filtered view
