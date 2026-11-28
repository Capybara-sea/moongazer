// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Alert, Button } from "@heroui/react"
import { ExternalLink, FolderOpen, type LucideIcon, Users } from "lucide-react"
import { type ReactNode, useState } from "react"
import { AnimatedLogo } from "@/components/brand/AnimatedLogo"
import { Panel } from "@/components/Panel"
import { openGroupChat, openHomepage, openLogDir, toBackendError } from "@/lib/backend"
import { useRoute } from "@/lib/route"
import { useUpdateStore } from "@/stores/updateStore"
import { text } from "@/text"
import { ChangelogPage } from "./ChangelogPage"
import { GroupChatHint, GroupQrButton } from "./GroupChat"
import { LicensesPage } from "./LicensesPage"
import { SUBPAGES, SubpageLink } from "./subpages"
import { UpdateCard } from "./UpdateCard"

/**
 * About, or a page inside it: the third-party licenses at #/about/licenses,
 * the changelog at #/about/changelog. The page stays mounted while others are
 * shown, so it keeps its own view rather than reading the route of whatever
 * page is in front.
 */
export function AboutPage() {
  const route = useRoute()
  const [view, setView] = useState(route.page === "about" ? route.param : undefined)
  if (route.page === "about" && route.param !== view) setView(route.param)
  if (view === SUBPAGES.licenses) return <LicensesPage />
  if (view === SUBPAGES.changelog) return <ChangelogPage />
  return <About />
}

function About() {
  const info = useUpdateStore(s => s.info)
  const loadError = useUpdateStore(s => s.loadError)

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4 p-6">
      {loadError && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{text.update.loadFailed}</Alert.Title>
            <Alert.Description>{loadError}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      <Panel
        aria-label={text.appName}
        className="flex-row flex-wrap items-center gap-6 rounded-[18px] px-6 py-5.5"
      >
        <AnimatedLogo className="size-32 flex-none" />
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2.5">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-semibold text-2xl leading-[1.3] tracking-[0.04em]">
              {text.appName}{" "}
              <span className="font-normal text-muted text-sm tracking-normal">
                {text.appNameLatin}
              </span>
            </h1>
            <span className="text-[13px] text-muted">{text.about.tagline}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[13px]">
            <dt className="text-muted">{text.about.version}</dt>
            <dd className="tabular">{info?.version ?? "-"}</dd>
            <dt className="text-muted">{text.about.mode}</dt>
            <dd>{info ? (info.portable ? text.about.portable : text.about.installed) : "-"}</dd>
            <dt className="text-muted">{text.about.license}</dt>
            <dd>{text.about.licenseValue}</dd>
          </dl>
          <p className="glass-inset rounded-[10px] bg-surface-secondary px-3 py-2 text-[12px] text-muted">
            {text.about.disclaimer}
          </p>
        </div>
      </Panel>
      <UpdateCard />
      <Panel aria-label={text.about.help} className="gap-0 pt-4 pb-1.5">
        <h2 className="mb-1.5 font-semibold text-[15px]">{text.about.help}</h2>
        <ActionRow
          title={text.about.log}
          hint={text.about.logHint}
          icon={FolderOpen}
          label={text.about.openLog}
          failed={text.about.openLogFailed}
          run={openLogDir}
        />
        <ActionRow
          title={text.about.homepage}
          hint={text.about.homepageHint}
          icon={ExternalLink}
          label={text.about.openHomepage}
          failed={text.about.openHomepageFailed}
          run={openHomepage}
        />
        <ActionRow
          title={text.about.groupChat}
          hint={<GroupChatHint />}
          icon={Users}
          label={text.about.joinGroupChat}
          failed={text.about.openHomepageFailed}
          run={openGroupChat}
          beside={<GroupQrButton />}
        />
      </Panel>
      <Credits />
      <p className="pt-2 pb-1 text-center text-[12px] text-muted leading-[2] tracking-[0.12em]">
        {text.about.letter.map(line => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </p>
    </div>
  )
}

type ActionProps = {
  title: string
  hint: ReactNode
  icon: LucideIcon
  label: string
  /** Put before the error's message. */
  failed: string
  run: () => Promise<void>
  /** Another control, left of the button. */
  beside?: ReactNode
}

function ActionRow({ title, hint, icon: Icon, label, failed, run, beside }: ActionProps) {
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex items-center justify-between gap-6 border-(--separator) border-t py-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-sm">{title}</span>
        <span className="text-[12px] text-muted">{hint}</span>
        {error && <span className="select-text text-[12px] text-(--err)">{error}</span>}
      </div>
      <div className="flex flex-none gap-2">
        {beside}
        <Button
          variant="secondary"
          onPress={() => {
            setError(null)
            run().catch((e: unknown) => setError(`${failed}: ${toBackendError(e).message}`))
          }}
          className="h-9 flex-none gap-1.5 rounded-[9px] border border-border bg-transparent px-3.5 font-normal text-[13px] text-foreground"
        >
          <Icon aria-hidden className="m-0 size-[15px]" />
          {label}
        </Button>
      </div>
    </div>
  )
}

function Credits() {
  return (
    <Panel aria-label={text.about.credits}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-[15px]">{text.about.credits}</h2>
        <SubpageLink to={SUBPAGES.licenses} label={text.about.thirdParty} />
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2 text-[13px]">
        {text.about.creditList.map(credit => (
          <li
            key={credit.name}
            className="glass-inset flex flex-col gap-px rounded-[10px] bg-surface-secondary px-3 py-2.5"
          >
            <span className="break-words font-medium">{credit.name}</span>
            <span className="text-[12px] text-muted">{credit.what}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
