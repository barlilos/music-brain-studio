/**
 * The node kind registry — the single place the Music Brain vocabulary is
 * written down.
 *
 * Everything the UI does differently per kind is **data** in this table: which
 * icon, what the kind is called, how the row is weighted, whether completion is
 * shown. No component contains a `switch` on kind or a comparison against a kind
 * literal, so adding `goal`, `idea` or anything else is one entry here plus a
 * glyph — rendering logic is not touched, and neither is the adapter, the
 * flattener or the model.
 *
 * **Why this lives in the renderer.** Its values are React components and
 * Tailwind classes, which are DOM concerns. `tsconfig.node.json` has no DOM lib,
 * so placing them in `src/shared` would break the main process build — the type
 * system enforcing the boundary, which is the right outcome rather than an
 * inconvenience.
 *
 * The consequence is that `ExplorerNode.kind` is a bare `string` and no union of
 * kind names exists anywhere. A union would be a second copy of this table that
 * drifts from it, and a false promise besides: these values arrive from a user's
 * file at runtime and were never statically knowable. `presentationFor` handles
 * everything not listed here, which is a guarantee a type could not give.
 *
 * This file intentionally exports no components, so it stays outside
 * `react-refresh`'s remit and can be imported freely.
 */

import type { JSX } from 'react'
import type { NodeKind } from '@shared/model/node'
import {
  AssetIcon,
  BookIcon,
  BoxIcon,
  CheckboxIcon,
  ChecklistIcon,
  DecisionIcon,
  DocumentIcon,
  DotIcon,
  FlaskIcon,
  FolderIcon,
  GlobeIcon,
  IdeaIcon,
  LayersIcon,
  LinkIcon,
  QuestionIcon,
  SparkleIcon,
  TargetIcon,
  TemplateIcon,
  type NodeIconProps
} from '@renderer/components/explorer/icons'

export interface NodeKindPresentation {
  /**
   * What this kind is called, in the user's language. Used for the placeholder
   * on an untitled node ("Untitled task") and for assistive technology.
   */
  name: string
  /** The glyph. Every icon accepts `NodeIconProps`, so all are interchangeable. */
  Icon: (props: NodeIconProps) => JSX.Element
  /** Icon colour. */
  iconClassName: string
  /**
   * Label typography. Containers carry more weight and contrast than their
   * contents — this is what produces hierarchy without drawing a single box.
   */
  labelClassName: string
  /**
   * Whether rows of this kind render completion state. The adapter reads
   * completion whenever a node carries it; this decides whether it is shown, so
   * a stray `done` on an area does not sprout a checkbox.
   */
  showsCompletion: boolean
}

/** Typography shared by container-ish kinds — the things that hold other things. */
const CONTAINER_LABEL = 'font-medium text-neutral-800 dark:text-neutral-100'

/** Typography shared by leaf-ish kinds, one step back so containers read first. */
const ITEM_LABEL = 'text-neutral-700 dark:text-neutral-300'

/**
 * Every kind the application knows about, keyed by lower-cased `nodeType`.
 *
 * The first thirteen are the vocabulary declared by the project schema's
 * `supportedNodeTypes`. Only four of them (`domain`, `area`, `project`, `task`)
 * appear in the reference file today; the other nine are registered anyway,
 * because a supported type that renders as an anonymous dot the first time
 * someone uses it is a bug waiting rather than a feature pending.
 *
 * The last four are not in the schema at all. They are entered because they were
 * named as likely additions, and because their being pure data is the standing
 * proof that the next kind costs an object literal rather than a change to any
 * component.
 */
export const NODE_KINDS: Readonly<Record<string, NodeKindPresentation>> = {
  // ── Containers: the levels the knowledge base is organised by ──
  domain: {
    name: 'Domain',
    Icon: GlobeIcon,
    iconClassName: 'text-indigo-500 dark:text-indigo-400',
    labelClassName: CONTAINER_LABEL,
    showsCompletion: false
  },
  area: {
    name: 'Area',
    Icon: FolderIcon,
    iconClassName: 'text-amber-500 dark:text-amber-400',
    labelClassName: CONTAINER_LABEL,
    showsCompletion: false
  },
  project: {
    name: 'Project',
    Icon: LayersIcon,
    iconClassName: 'text-violet-500 dark:text-violet-400',
    labelClassName: CONTAINER_LABEL,
    showsCompletion: false
  },

  // ── Things that get done ──
  task: {
    name: 'Task',
    Icon: CheckboxIcon,
    iconClassName: 'text-neutral-400 dark:text-neutral-500',
    labelClassName: ITEM_LABEL,
    showsCompletion: true
  },
  checklist: {
    name: 'Checklist',
    Icon: ChecklistIcon,
    iconClassName: 'text-neutral-400 dark:text-neutral-500',
    labelClassName: ITEM_LABEL,
    showsCompletion: true
  },
  experiment: {
    name: 'Experiment',
    Icon: FlaskIcon,
    iconClassName: 'text-lime-600 dark:text-lime-400',
    labelClassName: ITEM_LABEL,
    showsCompletion: true
  },

  // ── Things that get written down ──
  knowledge: {
    name: 'Knowledge',
    Icon: DocumentIcon,
    iconClassName: 'text-sky-500 dark:text-sky-400',
    labelClassName: ITEM_LABEL,
    showsCompletion: false
  },
  playbook: {
    name: 'Playbook',
    Icon: BookIcon,
    iconClassName: 'text-cyan-600 dark:text-cyan-400',
    labelClassName: ITEM_LABEL,
    showsCompletion: false
  },
  template: {
    name: 'Template',
    Icon: TemplateIcon,
    iconClassName: 'text-slate-500 dark:text-slate-400',
    labelClassName: ITEM_LABEL,
    showsCompletion: false
  },
  decision: {
    name: 'Decision',
    Icon: DecisionIcon,
    iconClassName: 'text-orange-500 dark:text-orange-400',
    labelClassName: ITEM_LABEL,
    showsCompletion: false
  },
  question: {
    name: 'Question',
    Icon: QuestionIcon,
    iconClassName: 'text-pink-500 dark:text-pink-400',
    labelClassName: ITEM_LABEL,
    showsCompletion: false
  },

  // ── Things that are kept ──
  resource: {
    name: 'Resource',
    Icon: BoxIcon,
    iconClassName: 'text-teal-500 dark:text-teal-400',
    labelClassName: ITEM_LABEL,
    showsCompletion: false
  },
  asset: {
    name: 'Asset',
    Icon: AssetIcon,
    iconClassName: 'text-emerald-600 dark:text-emerald-400',
    labelClassName: ITEM_LABEL,
    showsCompletion: false
  },

  // ── Not in the schema; registered ahead of use ──
  goal: {
    name: 'Goal',
    Icon: TargetIcon,
    iconClassName: 'text-rose-500 dark:text-rose-400',
    labelClassName: ITEM_LABEL,
    showsCompletion: true
  },
  idea: {
    name: 'Idea',
    Icon: IdeaIcon,
    iconClassName: 'text-yellow-500 dark:text-yellow-400',
    labelClassName: ITEM_LABEL,
    showsCompletion: false
  },
  reference: {
    name: 'Reference',
    Icon: LinkIcon,
    iconClassName: 'text-blue-500 dark:text-blue-400',
    labelClassName: ITEM_LABEL,
    showsCompletion: false
  },
  inspiration: {
    name: 'Inspiration',
    Icon: SparkleIcon,
    iconClassName: 'text-fuchsia-500 dark:text-fuchsia-400',
    labelClassName: ITEM_LABEL,
    showsCompletion: false
  }
}

/**
 * Presentation for a kind this build does not know.
 *
 * Reached by two different routes that deserve the same treatment: a node whose
 * file declares a `nodeType` we have no entry for, and a node that declares none
 * at all. Both are ordinary — the user's vocabulary is allowed to grow past
 * ours — so the row stays fully navigable and merely looks quiet.
 */
export const UNKNOWN_KIND_PRESENTATION: NodeKindPresentation = {
  name: 'Item',
  Icon: DotIcon,
  iconClassName: 'text-neutral-300 dark:text-neutral-600',
  labelClassName: ITEM_LABEL,
  showsCompletion: false
}

/**
 * Resolves a kind to how it should look. Total by construction — there is no
 * kind string, from any file, that this cannot answer for.
 */
export function presentationFor(kind: NodeKind): NodeKindPresentation {
  return NODE_KINDS[kind] ?? UNKNOWN_KIND_PRESENTATION
}
