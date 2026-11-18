// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! What the app and its elevated capture mode say to each other. Each pipe
//! carries one direction: a single pipe with a read pending on one thread
//! holds up a write on another.
//!
//! A message is its length (u32, little-endian, counting what follows), a
//! tag byte, then the body.

use std::io::{self, ErrorKind, Read, Write};

/// Bumped whenever a message changes, so an app and a capture mode from
/// different builds refuse each other instead of misreading.
pub const PROTOCOL: u32 = 1;

/// A merged datagram is at most a 64 KiB IP packet, in an Ethernet frame.
const MAX_MESSAGE: usize = 128 * 1024;

/// From the app to the capture mode.
#[derive(Debug, PartialEq, Eq)]
pub enum Command {
    /// Starts capturing, stopping a running capture first. `compatible`
    /// captures with raw sockets instead of pktmon's real-time stream.
    Start { compatible: bool },
    /// Stops capturing and exits. A closed pipe means the same.
    Bye,
}

/// From the capture mode to the app.
#[derive(Debug, PartialEq, Eq)]
pub enum Report {
    /// The first message.
    Hello {
        protocol: u32,
    },
    Started,
    Frame(Vec<u8>),
    /// The capture could not start or stopped on an error. Never holds
    /// addresses or adapter names.
    Failed(String),
    /// pktmon's real-time stream delivered a merged game datagram: only the
    /// compatible capture reads such a PC whole.
    Merged,
    /// One formatted log line.
    Log(String),
}

impl Command {
    pub fn write(&self, out: &mut impl Write) -> io::Result<()> {
        match self {
            Self::Start { compatible } => write_message(out, 0, &[u8::from(*compatible)]),
            Self::Bye => write_message(out, 1, &[]),
        }
    }

    /// The next command, or `None` once the pipe is closed.
    pub fn read(input: &mut impl Read) -> io::Result<Option<Self>> {
        let Some((tag, body)) = read_message(input)? else {
            return Ok(None);
        };
        Ok(Some(match (tag, body.as_slice()) {
            (0, [flag]) => Self::Start {
                compatible: *flag != 0,
            },
            (1, []) => Self::Bye,
            _ => return Err(invalid("unknown command")),
        }))
    }
}

impl Report {
    pub fn write(&self, out: &mut impl Write) -> io::Result<()> {
        match self {
            Self::Hello { protocol } => write_message(out, 0, &protocol.to_le_bytes()),
            Self::Started => write_message(out, 1, &[]),
            Self::Frame(frame) => write_message(out, 2, frame),
            Self::Failed(reason) => write_message(out, 3, reason.as_bytes()),
            Self::Merged => write_message(out, 4, &[]),
            Self::Log(line) => write_message(out, 5, line.as_bytes()),
        }
    }

    /// The next report, or `None` once the pipe is closed.
    pub fn read(input: &mut impl Read) -> io::Result<Option<Self>> {
        let Some((tag, body)) = read_message(input)? else {
            return Ok(None);
        };
        let text = |body: Vec<u8>| String::from_utf8_lossy(&body).into_owned();
        Ok(Some(match tag {
            0 => Self::Hello {
                protocol: u32::from_le_bytes(
                    body.try_into()
                        .map_err(|_| invalid("a hello of the wrong size"))?,
                ),
            },
            1 if body.is_empty() => Self::Started,
            2 => Self::Frame(body),
            3 => Self::Failed(text(body)),
            4 if body.is_empty() => Self::Merged,
            5 => Self::Log(text(body)),
            _ => return Err(invalid("unknown report")),
        }))
    }
}

/// Writes one message with a single `write_all`, so writers sharing a pipe
/// behind a lock never interleave.
fn write_message(out: &mut impl Write, tag: u8, body: &[u8]) -> io::Result<()> {
    if body.len() >= MAX_MESSAGE {
        return Err(invalid("message too large"));
    }
    let length = u32::try_from(body.len() + 1).map_err(|_| invalid("message too large"))?;
    let mut message = Vec::with_capacity(body.len() + 5);
    message.extend_from_slice(&length.to_le_bytes());
    message.push(tag);
    message.extend_from_slice(body);
    out.write_all(&message)?;
    out.flush()
}

fn read_message(input: &mut impl Read) -> io::Result<Option<(u8, Vec<u8>)>> {
    let mut length = [0; 4];
    let mut filled = 0;
    while filled < length.len() {
        match input.read(&mut length[filled..]) {
            // The other end closed the pipe between messages.
            Ok(0) if filled == 0 => return Ok(None),
            Ok(0) => return Err(ErrorKind::UnexpectedEof.into()),
            Ok(read) => filled += read,
            Err(err) if err.kind() == ErrorKind::Interrupted => {}
            Err(err) if err.kind() == ErrorKind::BrokenPipe && filled == 0 => return Ok(None),
            Err(err) => return Err(err),
        }
    }
    let length = usize::try_from(u32::from_le_bytes(length)).unwrap_or(usize::MAX);
    if length == 0 || length > MAX_MESSAGE {
        return Err(invalid("a message of impossible length"));
    }
    let mut message = vec![0; length];
    input.read_exact(&mut message)?;
    let body = message.split_off(1);
    Ok(Some((message[0], body)))
}

fn invalid(what: &str) -> io::Error {
    io::Error::new(ErrorKind::InvalidData, what)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_command_reads_back_as_written() {
        let commands = [
            Command::Start { compatible: true },
            Command::Start { compatible: false },
            Command::Bye,
        ];
        let mut pipe = Vec::new();
        for command in &commands {
            command.write(&mut pipe).unwrap();
        }
        let mut input = pipe.as_slice();
        for command in commands {
            assert_eq!(Command::read(&mut input).unwrap(), Some(command));
        }
        assert_eq!(Command::read(&mut input).unwrap(), None);
    }

    #[test]
    fn every_report_reads_back_as_written() {
        let reports = [
            Report::Hello { protocol: PROTOCOL },
            Report::Started,
            Report::Frame(vec![1, 2, 3]),
            Report::Frame(vec![7; 70_000]),
            Report::Failed("no interface accepted".to_owned()),
            Report::Merged,
            Report::Log("INFO capture started".to_owned()),
        ];
        let mut pipe = Vec::new();
        for report in &reports {
            report.write(&mut pipe).unwrap();
        }
        let mut input = pipe.as_slice();
        for report in reports {
            assert_eq!(Report::read(&mut input).unwrap(), Some(report));
        }
        assert_eq!(Report::read(&mut input).unwrap(), None);
    }

    #[test]
    fn a_message_cut_short_is_an_error_not_the_end() {
        let mut pipe = Vec::new();
        Report::Frame(vec![1, 2, 3]).write(&mut pipe).unwrap();
        pipe.pop();
        assert!(Report::read(&mut pipe.as_slice()).is_err());
    }

    #[test]
    fn a_length_over_the_limit_is_refused_before_reading_it() {
        let mut pipe = u32::MAX.to_le_bytes().to_vec();
        pipe.push(2);
        assert!(Report::read(&mut pipe.as_slice()).is_err());
        assert!(
            Report::Frame(vec![0; MAX_MESSAGE])
                .write(&mut Vec::new())
                .is_err()
        );
    }

    #[test]
    fn an_unknown_tag_is_refused() {
        let mut pipe = Vec::new();
        write_message(&mut pipe, 9, &[]).unwrap();
        assert!(Command::read(&mut pipe.as_slice()).is_err());
        assert!(Report::read(&mut pipe.as_slice()).is_err());
    }
}
