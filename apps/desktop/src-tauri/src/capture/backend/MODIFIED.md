# Changes from upstream

The capture backends, copied from
[Teyvat.me Capture](https://github.com/tawan475/teyvat.me-capture) at
v1.17.28 (`05a3bb8`). Only what had to change was changed; everything not
listed here is upstream's text. Port a new upstream version by diffing it
against v1.17.28 and applying that diff here.

| Here                | Upstream                                     |
| ------------------- | -------------------------------------------- |
| `../backend.rs`     | `apps/desktop/src/capture.rs`                |
| `dedupe.rs`         | `apps/desktop/src/capture/dedupe.rs`         |
| `pktmon_backend.rs` | `apps/desktop/src/capture/pktmon_backend.rs` |
| `raw_backend.rs`    | `apps/desktop/src/capture/raw_backend.rs`    |

`apps/desktop/src/capture/pcap_backend.rs` is not copied.

## All files

- Header: the "Changes copyright" and "Modified from" lines added after
  upstream's, and "See THIRD_PARTY_NOTICES.md." where upstream had none.
- Synchronous instead of async: no tokio, futures, async-trait or clap.
  `CaptureBackend::next_packet` takes a timeout and returns
  `Result<Option<CapturedFrame>>`: `None` when the timeout passed with no
  frame, `CaptureError::CaptureClosed` when the capture is gone.
- `crate::capture::` paths are `super::`.

## `backend.rs` (upstream `capture.rs`)

- Removed: `mod pcap_backend`, `BackendType`, `CaptureSource`,
  `DEFAULT_CAPTURE_BACKEND_TYPE`, and the `PathBuf`, `async_trait` and
  `clap::ValueEnum` imports.
- Removed `ONE_WAY_CAPTURE_SEEN`: the decoder side detects a one-way capture.
- `etw_losses()`: the `cfg(not(windows))` branch removed, so it calls
  `pktmon::etw_session_losses()` directly.
- `CaptureBackend`: the `#[async_trait]` and `#[allow(clippy::double_must_use)]`
  attributes removed (the allow was for the async-trait expansion);
  `next_packet(&mut self, timeout: Duration)` as above, with a doc comment
  saying so, and `use std::time::Duration;` added.
- `create_capture(compatible: bool)`: only the Windows device branch is left,
  with the same choice: `compatible` tries `RawSocketBackend` and falls back
  to `PktmonBackend::new(true)` (pktmon's ETW path) with the same warning;
  otherwise `PktmonBackend::new(false)` (`CapturePath::Auto`). The savefile,
  pcap and unsupported-OS branches and the `cfg_attr(not(windows), ...)` are
  gone.

## `dedupe.rs`

- Header only.

## `pktmon_backend.rs`

- Holds the `pktmon::Capture` instead of a stream, and calls
  `capture.start()` where upstream called `capture.stream()` (which is
  `start()` plus the tokio stream). The comment above it names `start()`.
- `next_packet` waits with `Capture::next_packet_timeout` until a deadline of
  `timeout`, looping past dropped duplicates as before. The comment on the
  `futures::select!` is gone with it. `RecvTimeoutError::Disconnected` is
  `CaptureClosed`, as the stream's end was.
- The "pktmon data source" log line no longer has the `name` and
  `description` fields (adapter names). The ids and flags stay.
- Imports: `Packet`, `async_trait` and `futures` removed; `Duration` and
  `RecvTimeoutError` added.

## `raw_backend.rs`

- `std::sync::mpsc` (unbounded `channel()`) instead of tokio's unbounded
  channel; `next_packet` waits with `recv_timeout` until a deadline of
  `timeout`.
- The "raw capture socket open" and "raw capture socket refused" log lines no
  longer have the `interface` and `address` fields (interface names and this
  PC's IP addresses), so `open_new_sockets` ignores the name
  `interface_addresses()` returns.
- Imports: `async_trait` removed; the `super::` import of the shared types is
  on one line after rustfmt.
