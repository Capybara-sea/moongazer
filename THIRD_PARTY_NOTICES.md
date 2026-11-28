# Third-party notices

Moongazer's own code is MIT licensed (see [`LICENSE`](LICENSE)). This file
covers the third-party code adapted into this repository, the font the program
bundles and the data the program is built from. The complete list of what
ships inside the program, every library included, is on the app's About page
and in `THIRD_PARTY_NOTICES.txt` on each release.

The projects below are MIT licensed. Their copyright notices follow, then the
permission notice they share.

Every build contains data generated from:

- [Snap.Metadata](https://github.com/SnapHutaoRemasteringProject/Snap.Metadata):
  Copyright (c) 2022 DGP Studio

Every build also contains code from these, some of it
adapted (each such file says where from), the rest linked through Teyvat.me
Capture's crates:

- [Teyvat.me Capture](https://github.com/tawan475/teyvat.me-capture):
  Copyright (c) 2026 tawan475
- [irminsul](https://github.com/konkers/irminsul) and
  [anime-game-data](https://github.com/konkers/anime-game-data):
  Copyright (c) 2025 Erik Gilling
- [reliquary](https://github.com/IceDynamix/reliquary), which
  auto-artifactarium builds on: Copyright (c) 2024 IceDynamix
- [mhy-kcp](https://github.com/hashblen/mhy-kcp): Copyright (c) 2017 Zhang
  Cheng
- [pktmon](https://github.com/emmachase/pktmon): Copyright (c) 2025 emmachase

## Font

The UI font, [Sarasa Gothic](https://github.com/be5invis/Sarasa-Gothic) 1.0.43
(Sarasa UI SC, regular and semibold), is built into every build unmodified.
The font files are not in this repository: `cargo xtask gen-data` downloads
them from Sarasa Gothic's release and checks them against pinned hashes. It is
licensed under the SIL Open Font License 1.1, not MIT: its copyright notices
and the license text are in `xtask/licenses/Sarasa-Gothic.txt`.

## Data

No licence here covers the following; none of it is in this repository:

- the game data compiled into every build, and `game_data.gz`, are generated
  from the tables of
  [DimbreathBot/AnimeGameData](https://github.com/DimbreathBot/AnimeGameData),
  which has no licence and asks for credit;
- every build ships the game client's keys (`gi.json`,
  and two RSA keys in `teyvatme-protocol`), which Teyvat.me Capture took from
  irminsul and auto-artifactarium and does not license.

## The MIT License

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
