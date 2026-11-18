// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Windows calls for auto sync: starting the capture mode elevated, the two
//! pipes to it, and finding the game without opening it.

use std::ffi::OsStr;
use std::io;
use std::os::windows::ffi::OsStrExt;
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
use std::path::Path;
use std::time::Duration;

use windows_sys::Win32::Foundation::{
    ERROR_CANCELLED, ERROR_PIPE_CONNECTED, INVALID_HANDLE_VALUE, WAIT_OBJECT_0,
};
use windows_sys::Win32::Storage::FileSystem::{
    FILE_FLAG_FIRST_PIPE_INSTANCE, PIPE_ACCESS_INBOUND, PIPE_ACCESS_OUTBOUND,
};
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW, TH32CS_SNAPPROCESS,
};
use windows_sys::Win32::System::IO::CancelIoEx;
use windows_sys::Win32::System::LibraryLoader::{
    LOAD_LIBRARY_SEARCH_SYSTEM32, SetDefaultDllDirectories,
};
use windows_sys::Win32::System::Pipes::{
    ConnectNamedPipe, CreateNamedPipeW, GetNamedPipeClientProcessId, PIPE_READMODE_BYTE,
    PIPE_REJECT_REMOTE_CLIENTS, PIPE_TYPE_BYTE, PIPE_WAIT,
};
use windows_sys::Win32::System::Threading::{
    CreateMutexW, GetExitCodeProcess, GetProcessId, WaitForSingleObject,
};
use windows_sys::Win32::UI::Shell::{
    SEE_MASK_NOASYNC, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW, ShellExecuteExW,
};
use windows_sys::Win32::UI::WindowsAndMessaging::SW_HIDE;

use super::wide;

/// Each pipe's buffer: a login's burst is a few MB in a second, read as fast
/// as it comes.
const PIPE_BUFFER: u32 = 1024 * 1024;

/// Which way a pipe carries data, from the app's side.
pub enum PipeEnd {
    Inbound,
    Outbound,
}

/// Creates the only instance of the pipe `name`. Failing because the name is
/// taken means someone else made it first.
pub fn create_pipe(name: &str, end: PipeEnd) -> io::Result<OwnedHandle> {
    let name = wide(name);
    let access = match end {
        PipeEnd::Inbound => PIPE_ACCESS_INBOUND,
        PipeEnd::Outbound => PIPE_ACCESS_OUTBOUND,
    };
    // SAFETY: `name` is a NUL-terminated UTF-16 buffer that outlives the call,
    // and a null security descriptor takes the default one.
    let handle = unsafe {
        CreateNamedPipeW(
            name.as_ptr(),
            access | FILE_FLAG_FIRST_PIPE_INSTANCE,
            PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
            1,
            PIPE_BUFFER,
            PIPE_BUFFER,
            0,
            std::ptr::null(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        return Err(io::Error::last_os_error());
    }
    // SAFETY: the handle was just created and nothing else owns it.
    Ok(unsafe { OwnedHandle::from_raw_handle(handle) })
}

/// Waits for the client to open the pipe; [`cancel_io`] from another thread
/// ends the wait with an error.
pub fn connect_pipe(pipe: &OwnedHandle) -> io::Result<()> {
    // SAFETY: the handle is a pipe owned by the caller; a null OVERLAPPED
    // makes the call synchronous, as the pipe was created.
    if unsafe { ConnectNamedPipe(pipe.as_raw_handle(), std::ptr::null_mut()) } != 0 {
        return Ok(());
    }
    let err = io::Error::last_os_error();
    // The client opened the pipe before this call.
    if err.raw_os_error() == Some(ERROR_PIPE_CONNECTED.cast_signed()) {
        return Ok(());
    }
    Err(err)
}

/// Cancels whatever blocking call is waiting on `handle` in another thread.
pub fn cancel_io(handle: &OwnedHandle) {
    // SAFETY: the handle stays open for the call; a null OVERLAPPED cancels
    // every pending operation on it.
    unsafe { CancelIoEx(handle.as_raw_handle(), std::ptr::null()) };
}

/// The process on the other end of a connected pipe.
pub fn pipe_client_pid(pipe: &OwnedHandle) -> io::Result<u32> {
    let mut pid = 0;
    // SAFETY: the handle is a connected pipe; `pid` outlives the call.
    if unsafe { GetNamedPipeClientProcessId(pipe.as_raw_handle(), &raw mut pid) } == 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(pid)
}

pub struct Elevated {
    pub process: OwnedHandle,
    pub pid: u32,
}

pub enum ElevateError {
    /// The user said no to the elevation prompt.
    Declined,
    Failed(io::Error),
}

/// Runs `exe` elevated with `parameters`, which Windows asks the user about
/// first. Blocks until they answer. `owner` is the window the prompt belongs
/// to.
pub fn run_elevated(
    exe: &Path,
    parameters: &str,
    owner: Option<isize>,
) -> Result<Elevated, ElevateError> {
    let verb = wide("runas");
    let file: Vec<u16> = OsStr::new(exe).encode_wide().chain(Some(0)).collect();
    let parameters = wide(parameters);
    let mut info = SHELLEXECUTEINFOW {
        cbSize: size_of::<SHELLEXECUTEINFOW>()
            .try_into()
            .unwrap_or(u32::MAX),
        // The process handle, and no return before the launch is done.
        fMask: SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC,
        hwnd: owner.map_or(std::ptr::null_mut(), |hwnd| hwnd as _),
        lpVerb: verb.as_ptr(),
        lpFile: file.as_ptr(),
        lpParameters: parameters.as_ptr(),
        nShow: SW_HIDE,
        ..SHELLEXECUTEINFOW::default()
    };
    // SAFETY: every string is NUL-terminated UTF-16 that outlives the call,
    // and `info` is a correctly sized SHELLEXECUTEINFOW.
    if unsafe { ShellExecuteExW(&raw mut info) } == 0 {
        let err = io::Error::last_os_error();
        if err.raw_os_error() == Some(ERROR_CANCELLED.cast_signed()) {
            return Err(ElevateError::Declined);
        }
        return Err(ElevateError::Failed(err));
    }
    if info.hProcess.is_null() {
        return Err(ElevateError::Failed(io::Error::other(
            "no process was started",
        )));
    }
    // SAFETY: SEE_MASK_NOCLOSEPROCESS hands the process handle to the caller.
    let process = unsafe { OwnedHandle::from_raw_handle(info.hProcess) };
    // SAFETY: the handle is a process handle owned above.
    let pid = unsafe { GetProcessId(process.as_raw_handle()) };
    Ok(Elevated { process, pid })
}

/// The process's exit code once it has exited, waiting up to `wait`.
pub fn exit_code(process: &OwnedHandle, wait: Duration) -> Option<u32> {
    let millis = u32::try_from(wait.as_millis()).unwrap_or(u32::MAX - 1);
    // SAFETY: the handle is a process handle the caller owns.
    if unsafe { WaitForSingleObject(process.as_raw_handle(), millis) } != WAIT_OBJECT_0 {
        return None;
    }
    let mut code = 0;
    // SAFETY: as above; `code` outlives the call.
    if unsafe { GetExitCodeProcess(process.as_raw_handle(), &raw mut code) } == 0 {
        return Some(u32::MAX);
    }
    Some(code)
}

/// Makes DLLs load from System32 only. The capture mode calls it first:
/// pktmon loads PktMonApi.dll by bare name, which would otherwise be looked
/// for next to the exe first. `/DEPENDENTLOADFLAG` (build.rs) does the same
/// for the exe's own imports.
pub fn load_dlls_from_system32() -> bool {
    // SAFETY: a plain flag argument.
    unsafe { SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32) != 0 }
}

/// Creates the named mutex `name`, held until the handle drops: a sign other
/// programs (the installer) can look for without opening this process.
pub fn named_mutex(name: &str) -> Option<OwnedHandle> {
    let name = wide(name);
    // SAFETY: `name` is a NUL-terminated UTF-16 buffer that outlives the call;
    // null attributes take the default security, and the mutex is not owned.
    let handle = unsafe { CreateMutexW(std::ptr::null(), 0, name.as_ptr()) };
    if handle.is_null() {
        return None;
    }
    // SAFETY: the handle was just created and nothing else owns it.
    Some(unsafe { OwnedHandle::from_raw_handle(handle) })
}

/// The first running process named one of `names` (case-insensitive), by
/// name only: no process is opened.
pub fn find_process(names: &[&str]) -> Option<String> {
    // SAFETY: a plain flag argument; 0 means every process.
    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if snapshot == INVALID_HANDLE_VALUE {
        return None;
    }
    // SAFETY: the snapshot was just created and nothing else owns it.
    let snapshot = unsafe { OwnedHandle::from_raw_handle(snapshot) };
    let mut entry = PROCESSENTRY32W {
        dwSize: size_of::<PROCESSENTRY32W>().try_into().unwrap_or(u32::MAX),
        ..PROCESSENTRY32W::default()
    };
    // SAFETY: the snapshot is open and `entry` is sized as the call requires.
    let mut more = unsafe { Process32FirstW(snapshot.as_raw_handle(), &raw mut entry) } != 0;
    while more {
        let length = entry
            .szExeFile
            .iter()
            .position(|&unit| unit == 0)
            .unwrap_or(entry.szExeFile.len());
        let name = String::from_utf16_lossy(&entry.szExeFile[..length]);
        if let Some(found) = names
            .iter()
            .find(|wanted| wanted.eq_ignore_ascii_case(&name))
        {
            return Some((*found).to_owned());
        }
        // SAFETY: as above.
        more = unsafe { Process32NextW(snapshot.as_raw_handle(), &raw mut entry) } != 0;
    }
    None
}
