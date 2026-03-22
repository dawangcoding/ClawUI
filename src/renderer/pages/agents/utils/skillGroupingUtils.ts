/**
 * 技能分组 + 状态计算 — 从 openclaw/ui skills-grouping.ts + skills-shared.ts 移植
 */

import type { SkillStatusEntry } from '../../../../shared/types/gateway-protocol'
import type { SkillGroup } from '../types'

const SKILL_SOURCE_GROUPS: Array<{ id: string; label: string; sources: string[] }> = [
   { id: 'workspace', label: '工作区技能', sources: ['openclaw-workspace'] },
   { id: 'built-in', label: '内置技能', sources: ['openclaw-bundled'] },
   { id: 'installed', label: '已安装技能', sources: ['openclaw-managed'] },
   { id: 'extra', label: '扩展技能', sources: ['openclaw-extra'] },
]

export function groupSkills(skills: SkillStatusEntry[]): SkillGroup[] {
   const groups = new Map<string, SkillGroup>()
   for (const def of SKILL_SOURCE_GROUPS) {
      groups.set(def.id, { id: def.id, label: def.label, skills: [] })
   }
   const builtInGroup = SKILL_SOURCE_GROUPS.find((g) => g.id === 'built-in')
   const other: SkillGroup = { id: 'other', label: '其他技能', skills: [] }
   for (const skill of skills) {
      const match = skill.bundled
         ? builtInGroup
         : SKILL_SOURCE_GROUPS.find((g) => g.sources.includes(skill.source))
      if (match) {
         groups.get(match.id)?.skills.push(skill)
      } else {
         other.skills.push(skill)
      }
   }
   const ordered = SKILL_SOURCE_GROUPS.map((g) => groups.get(g.id)).filter(
      (g): g is SkillGroup => Boolean(g && g.skills.length > 0),
   )
   if (other.skills.length > 0) {
      ordered.push(other)
   }
   return ordered
}

export function computeSkillMissing(skill: SkillStatusEntry): string[] {
   if (!skill.missing) return []
   return [
      ...skill.missing.bins.map((b) => `bin:${b}`),
      ...skill.missing.env.map((e) => `env:${e}`),
      ...skill.missing.config.map((c) => `config:${c}`),
      ...skill.missing.os.map((o) => `os:${o}`),
   ]
}

export function computeSkillReasons(skill: SkillStatusEntry): string[] {
   const reasons: string[] = []
   if (skill.disabled) reasons.push('已禁用')
   if (skill.blockedByAllowlist) reasons.push('被允许列表阻止')
   return reasons
}
