# Third-party notices

Moongazer's own code is MIT licensed (see [`LICENSE`](LICENSE)). The projects
below are MIT licensed too. Moongazer adapts code from the first of them, and
builds with the `capture` feature link crates that hold code from all of them,
so their copyright notices and the permission notice they share are reproduced
here, as the licence requires.

## Teyvat.me Capture

[Teyvat.me Capture](https://github.com/tawan475/teyvat.me-capture) by tawan475.
`apps/desktop/src-tauri/src/capture/decoder.rs` is adapted from its
`apps/desktop/src/replay.rs` and `apps/desktop/src/monitor.rs`, and builds with
the `capture` feature link its `teyvatme-core`, `teyvatme-protocol` and
`teyvatme-game-data` crates.

Copyright (c) 2026 tawan475

## irminsul and anime-game-data

Teyvat.me Capture grew out of [irminsul](https://github.com/konkers/irminsul)
by Erik Gilling, and the file adapted above holds lines from it.
`teyvatme-game-data` is his
[anime-game-data](https://github.com/konkers/anime-game-data), changed since.

Copyright (c) 2025 Erik Gilling

## auto-artifactarium and reliquary

`teyvatme-protocol` started as auto-artifactarium
([hashblen](https://github.com/hashblen/auto-artifactarium),
[konkers](https://github.com/konkers/auto-artifactarium)), which builds on
IceDynamix's [reliquary](https://github.com/IceDynamix/reliquary).

Copyright (c) 2024 IceDynamix

## mhy-kcp

`teyvatme-protocol` links Teyvat.me Capture's copy of
[mhy-kcp](https://github.com/hashblen/mhy-kcp) by hashblen, a fork of
[kcp](https://github.com/Matrix-Zhang/kcp) by Matrix and Y. T. Chung.

Copyright (c) 2017 Zhang Cheng

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
