// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ChevronRight } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Panel } from "@/components/Panel"
import data from "@/generated/notices.json"
import { cn } from "@/lib/cn"
import { text } from "@/text"
import {
  type Frontend,
  type LicenseEntry,
  type LicenseGroup,
  loadFrontend,
  withFrontend,
} from "./licenses"
import { SubpageNav } from "./subpages"

const notices: { groups: LicenseGroup[]; texts: Record<string, string> } = data

/** LICENSE at the repository's root: this copyright line over the shared MIT text. */
const OWN: LicenseEntry = {
  name: `${text.appName} ${text.appNameLatin}`,
  license: "MIT",
  copyright: ["Copyright (c) 2026 Capybara_sea"],
  texts: ["MIT"],
}

type FrontendState =
  | { status: "dev" | "loading" }
  | { status: "failed"; message: string }
  | ({ status: "loaded" } & Frontend)

function useFrontend() {
  const [state, setState] = useState<FrontendState>({
    status: import.meta.env.DEV ? "dev" : "loading",
  })
  useEffect(() => {
    if (import.meta.env.DEV) return
    loadFrontend().then(
      frontend => setState({ status: "loaded", ...frontend }),
      (error: unknown) =>
        setState({
          status: "failed",
          message: error instanceof Error ? error.message : String(error),
        }),
    )
  }, [])
  return state
}

/**
 * Moongazer's own license, then every third-party package, component and data
 * source in the program. An entry shows its texts only once it is opened.
 */
export function LicensesPage() {
  const root = useRef<HTMLDivElement>(null)
  // The page would otherwise open at About's scroll position.
  useLayoutEffect(() => {
    root.current?.scrollIntoView({ block: "start" })
  }, [])
  const frontend = useFrontend()
  const loaded = frontend.status === "loaded" ? frontend : null
  const texts = loaded ? { ...notices.texts, ...loaded.texts } : notices.texts
  const groups = withFrontend(notices.groups, loaded?.entries ?? [])

  return (
    <div ref={root} className="mx-auto flex max-w-[1240px] flex-col gap-4 p-6">
      <SubpageNav title={text.licenses.title} />
      <Panel aria-label={text.licenses.own}>
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold text-[15px]">{text.licenses.own}</h2>
          <span className="text-[12px] text-muted">{text.licenses.ownBody}</span>
        </div>
        <ul>
          <LicenseRow entry={OWN} texts={texts} />
        </ul>
      </Panel>
      {groups.map(group => {
        const title = text.licenses.groups[group.id] ?? group.id
        return (
          <Panel key={group.id} aria-label={title} className="gap-0 pt-4 pb-1.5">
            <div className="flex items-baseline gap-2 pb-2">
              <h2 className="font-semibold text-[15px]">{title}</h2>
              <span className="tabular text-[12px] text-muted">
                {text.licenses.count(group.entries.length)}
              </span>
            </div>
            {group.id === "frontend" && <FrontendNote state={frontend} />}
            <ul>
              {group.entries.map(entry => (
                <LicenseRow
                  key={`${entry.name}@${entry.version ?? ""}`}
                  entry={entry}
                  texts={texts}
                />
              ))}
            </ul>
          </Panel>
        )
      })}
    </div>
  )
}

function FrontendNote({ state }: { state: FrontendState }) {
  if (state.status === "failed") {
    return (
      <p className="select-text pb-2 text-[12px] text-(--err)">
        {`${text.licenses.frontendFailed}: ${state.message}`}
      </p>
    )
  }
  if (state.status === "loaded") return null
  const note = state.status === "dev" ? text.licenses.frontendDev : text.licenses.frontendLoading
  return <p className="pb-2 text-[12px] text-muted">{note}</p>
}

type RowProps = { entry: LicenseEntry; texts: Record<string, string> }

function LicenseRow({ entry, texts }: RowProps) {
  const [open, setOpen] = useState(false)
  return (
    <li className="border-(--separator) border-t">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="-mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-baseline gap-2 rounded-[8px] px-2 py-2 text-left transition-colors duration-150 hover:bg-default/60 motion-reduce:transition-none"
      >
        <ChevronRight
          aria-hidden
          className={cn(
            "size-3.5 flex-none self-center text-muted transition-transform duration-150 motion-reduce:transition-none",
            open && "rotate-90",
          )}
        />
        <span className="min-w-0 break-words font-medium text-[13px]">{entry.name}</span>
        {entry.version && (
          <span className="tabular flex-none text-[12px] text-muted">{entry.version}</span>
        )}
        <span className="ml-auto flex-none pl-3 text-right text-[12px] text-muted">
          {entry.license ?? text.licenses.noLicense}
        </span>
      </button>
      {open && <EntryBody entry={entry} texts={texts} />}
    </li>
  )
}

function EntryBody({ entry, texts }: RowProps) {
  return (
    <div data-rise className="flex flex-col gap-2 pt-0.5 pb-3 pl-5.5 text-[12px]">
      {entry.copyright.length > 0 && (
        <p className="select-text whitespace-pre-line break-words">{entry.copyright.join("\n")}</p>
      )}
      {entry.expression && <p className="text-muted">{text.licenses.declared(entry.expression)}</p>}
      {entry.note && <p className="select-text text-muted">{entry.note}</p>}
      {entry.links && entry.links.length > 0 && (
        <ul className="select-text break-all font-mono text-[11.5px] text-muted">
          {entry.links.map(link => (
            <li key={link}>{link}</li>
          ))}
        </ul>
      )}
      {entry.texts.map(key => (
        <pre
          key={key}
          className="glass-inset max-h-80 select-text overflow-auto whitespace-pre-wrap break-words rounded-[10px] bg-surface-secondary px-3 py-2.5 font-mono text-[11.5px] leading-relaxed"
        >
          {texts[key] ?? key}
        </pre>
      ))}
    </div>
  )
}
