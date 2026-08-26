/**
 * Titlebar board switcher — the board page projects this into `titleBar.center`
 * (where chat shows the session-title dropdown) via `<Contribute>`, so it
 * exists exactly while the page is mounted — no route sniffing. Same chrome as
 * the session title: quiet label + chevron, menu on click.
 */

import {
  Button,
  Codicon,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  host,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useMutation,
  useQuery,
  useQueryClient,
  useValue
} from '@hermes/plugin-sdk'
import { useEffect, useState } from 'react'

import {
  $boardSlug,
  BOARDS_KEY,
  createBoard,
  fetchBoardRoster,
  fetchBoards,
  fetchProjects,
  PROJECTS_KEY,
  updateBoard
} from './api'
import type { BoardMeta } from './types'
import { errText, FIELD_LABEL, useKanban } from './ui'

const NO_PROJECT = '__none__'

/** Board scope = a first-class Hermes project. Its primary repo becomes the
 *  board's default workspace root; new tasks inherit it as a worktree with a
 *  deterministic branch. "No project" falls back to scratch sandboxes. */
function ProjectPicker({ onChange, value }: { onChange: (id: string) => void; value: string }) {
  const k = useKanban()
  const { data } = useQuery({ queryKey: PROJECTS_KEY, queryFn: fetchProjects, staleTime: 30_000 })
  const projects = data?.projects ?? []

  return (
    <label className="flex flex-col gap-1">
      <span className={FIELD_LABEL}>{k.project}</span>
      <Select onValueChange={id => onChange(id === NO_PROJECT ? '' : id)} value={value || NO_PROJECT}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_PROJECT}>{k.noProject}</SelectItem>
          {projects.map(project => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-[0.6875rem] leading-relaxed text-(--ui-text-quaternary)">
        {k.projectHintPre}
        <span className="font-mono">{k.projectHintCmd}</span>.
      </span>
    </label>
  )
}

function NewBoardDialog({ onClose, open }: { onClose: () => void; open: boolean }) {
  const k = useKanban()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [project, setProject] = useState('')

  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  useEffect(() => {
    if (open) {
      setName('')
      setProject('')
    }
  }, [open])

  const create = useMutation({
    mutationFn: () => createBoard(slug, name.trim(), project || undefined),
    onError: err => host.notify({ kind: 'error', message: errText(err) }),
    onSuccess: result => {
      $boardSlug.set(result.board.slug)
      void qc.invalidateQueries({ queryKey: BOARDS_KEY })
      onClose()
    }
  })

  return (
    <Dialog onOpenChange={o => !o && onClose()} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{k.newBoard}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL}>{k.name}</span>
            <Input
              autoFocus
              onChange={event => setName(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && slug && !project && create.mutate()}
              placeholder={k.boardNamePlaceholder}
              value={name}
            />
            {slug && <span className="text-[0.6875rem] text-(--ui-text-quaternary)">{k.slug(slug)}</span>}
          </label>
          <ProjectPicker onChange={setProject} value={project} />
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="text">
            {k.cancel}
          </Button>
          <Button disabled={!slug || create.isPending} onClick={() => create.mutate()}>
            {k.createBoard}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BoardSettingsDialog({ board, onClose }: { board: BoardMeta | null; onClose: () => void }) {
  const k = useKanban()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [project, setProject] = useState('')
  const [orchestrator, setOrchestrator] = useState('')
  const [workers, setWorkers] = useState('')
  const [reviewers, setReviewers] = useState('')
  const [strict, setStrict] = useState(false)
  const [requireReview, setRequireReview] = useState(false)
  const [enforcePins, setEnforcePins] = useState(false)

  const { data: audit } = useQuery({
    enabled: Boolean(board),
    queryFn: () => fetchBoardRoster(board!.slug),
    queryKey: ['kanban', 'board-roster', board?.slug],
    staleTime: 15_000
  })

  useEffect(() => {
    if (board) {
      setName(board.name || '')
      setProject(board.project_id || '')
      setOrchestrator(board.roster?.orchestrator || '')
      setWorkers((board.roster?.workers || []).join(', '))
      setReviewers((board.roster?.reviewers || []).join(', '))
      setStrict(board.policy?.allow_unlisted_profiles === false)
      setRequireReview(board.policy?.require_review === true)
      setEnforcePins(board.policy?.enforce_profile_pins === true)
    }
  }, [board])

  const save = useMutation({
    // Slug is immutable; send name + project_id ('' clears the scope, which
    // also drops the mirrored default_workdir on the backend).
    mutationFn: () =>
      updateBoard(board!.slug, {
        name: name.trim(),
        project_id: project,
        roster: {
          orchestrator: orchestrator.trim() || null,
          workers: workers
            .split(',')
            .map(value => value.trim())
            .filter(Boolean),
          reviewers: reviewers
            .split(',')
            .map(value => value.trim())
            .filter(Boolean)
        },
        policy: {
          allow_unlisted_profiles: !strict,
          require_review: requireReview,
          enforce_profile_pins: enforcePins
        }
      }),
    onError: err => host.notify({ kind: 'error', message: errText(err) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: BOARDS_KEY })
      void qc.invalidateQueries({ queryKey: ['kanban', 'board-roster', board!.slug] })
      onClose()
    }
  })

  return (
    <Dialog onOpenChange={o => !o && onClose()} open={Boolean(board)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{board ? k.boardSettingsFor(board.name || board.slug) : k.boardSettings}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL}>{k.name}</span>
            <Input onChange={event => setName(event.target.value)} placeholder={k.boardNamePlaceholder} value={name} />
            {board && <span className="text-[0.6875rem] text-(--ui-text-quaternary)">{k.slug(board.slug)}</span>}
          </label>
          <ProjectPicker onChange={setProject} value={project} />
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL}>Orchestrator profile</span>
            <Input
              onChange={event => setOrchestrator(event.target.value)}
              placeholder="sellhand-orchestrator"
              value={orchestrator}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL}>Worker profiles</span>
            <Input
              onChange={event => setWorkers(event.target.value)}
              placeholder="software-engineer, content-producer"
              value={workers}
            />
            <span className="text-[0.6875rem] text-(--ui-text-quaternary)">Comma-separated profile names.</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL}>Reviewer profiles</span>
            <Input
              onChange={event => setReviewers(event.target.value)}
              placeholder="independent-reviewer"
              value={reviewers}
            />
          </label>
          <label className="flex items-center gap-2 text-[0.75rem]">
            <input checked={strict} onChange={event => setStrict(event.target.checked)} type="checkbox" />
            Reject profiles outside this roster
          </label>
          <label className="flex items-center gap-2 text-[0.75rem]">
            <input checked={requireReview} onChange={event => setRequireReview(event.target.checked)} type="checkbox" />
            Require review before completion
          </label>
          <label className="flex items-center gap-2 text-[0.75rem]">
            <input checked={enforcePins} onChange={event => setEnforcePins(event.target.checked)} type="checkbox" />
            Block dispatch when profile versions drift
          </label>
          {audit && (
            <div className="rounded-md border border-(--ui-border) p-2 text-[0.6875rem] text-(--ui-text-tertiary)">
              <div className="mb-1 font-medium">Version audit: {audit.ok ? 'verified' : 'attention required'}</div>
              {audit.profiles.map(profile => (
                <div className="flex gap-2" key={profile.name}>
                  <span>{profile.name}</span>
                  <span className="ml-auto font-mono text-(--ui-text-quaternary)">
                    {profile.current?.distribution_version || 'local'} ·{' '}
                    {(profile.current?.definition_sha256 || '').slice(0, 12)}
                  </span>
                  {profile.drifted && <span className="text-destructive">drift</span>}
                </div>
              ))}
              {audit.issues.map(issue => (
                <div className="text-destructive" key={issue}>
                  {issue}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="text">
            {k.cancel}
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {k.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BoardSwitcher() {
  const k = useKanban()
  const slug = useValue($boardSlug)
  const { data: boards } = useQuery({ queryFn: fetchBoards, queryKey: BOARDS_KEY, staleTime: 30_000 })
  const [adding, setAdding] = useState(false)
  const [settingsFor, setSettingsFor] = useState<BoardMeta | null>(null)

  if (!boards) {
    return null
  }

  const currentSlug = slug || boards.current
  const current = boards.boards.find(meta => meta.slug === currentSlug)
  const label = current?.name || current?.slug || k.board

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="h-7 max-w-56 gap-1.5 px-2" size="sm" variant="ghost">
            <span className="min-w-0 flex-1 truncate text-[0.75rem] font-medium leading-none">{label}</span>
            {typeof current?.total === 'number' && (
              <span className="text-[0.6875rem] tabular-nums text-(--ui-text-quaternary)">{current.total}</span>
            )}
            <Codicon className="shrink-0 text-(--ui-text-tertiary)" name="chevron-down" size="0.8125rem" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          {boards.boards.map(meta => (
            <DropdownMenuItem
              key={meta.slug}
              onSelect={() => $boardSlug.set(meta.slug === boards.current ? '' : meta.slug)}
            >
              {meta.name || meta.slug}
              {typeof meta.total === 'number' && (
                <span className="text-[0.625rem] tabular-nums text-(--ui-text-quaternary)">{meta.total}</span>
              )}
              {meta.slug === currentSlug && <Codicon className="ml-auto" name="check" size="0.8rem" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {current && (
            <DropdownMenuItem onSelect={() => setSettingsFor(current)}>
              <Codicon name="settings-gear" size="0.8rem" />
              {k.boardSettings}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setAdding(true)}>
            <Codicon name="add" size="0.8rem" />
            {k.newBoardDots}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NewBoardDialog onClose={() => setAdding(false)} open={adding} />
      <BoardSettingsDialog board={settingsFor} onClose={() => setSettingsFor(null)} />
    </>
  )
}
