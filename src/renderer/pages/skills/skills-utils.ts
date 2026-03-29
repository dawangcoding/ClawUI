import type { SkillStatusEntry } from '../../../shared/types/gateway-protocol'

// ── 类型 ──

export interface SkillGroup {
   id: string
   label: string
   skills: SkillStatusEntry[]
}

export interface SkillMessage {
   kind: 'success' | 'error'
   text: string
}

// ── 常量 ──

const SKILL_SOURCE_GROUPS: Array<{ id: string; label: string; sources: string[] }> = [
   { id: 'workspace', label: '工作区技能', sources: ['openclaw-workspace'] },
   { id: 'built-in', label: '内置技能', sources: ['openclaw-bundled'] },
   { id: 'installed', label: '已安装技能', sources: ['openclaw-managed'] },
   { id: 'extra', label: '扩展技能', sources: ['openclaw-extra'] },
]

/** 这些分组在 Collapse 中默认折叠 */
export const COLLAPSED_BY_DEFAULT = ['workspace', 'built-in']

// ── 分组 ──

/** 按来源将技能分组，bundled 技能归入内置分组，其余归入"其他技能" */
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

// ── 搜索过滤 ──

/** 对 name/description/source 做大小写不敏感子串匹配 */
export function filterSkills(
   skills: SkillStatusEntry[],
   query: string,
): SkillStatusEntry[] {
   const q = query.trim().toLowerCase()
   if (!q) return skills
   return skills.filter((s) =>
      [s.name, s.description, s.source].join(' ').toLowerCase().includes(q),
   )
}

// ── 状态计算 ──

/** 返回缺失依赖列表，如 ['bin:node', 'env:OPENAI_KEY'] */
export function computeSkillMissing(skill: SkillStatusEntry): string[] {
   return [
      ...skill.missing.bins.map((b) => `bin:${b}`),
      ...skill.missing.env.map((e) => `env:${e}`),
      ...skill.missing.config.map((c) => `config:${c}`),
      ...skill.missing.os.map((o) => `os:${o}`),
   ]
}

/** 返回阻止原因列表 */
export function computeSkillReasons(skill: SkillStatusEntry): string[] {
   const reasons: string[] = []
   if (skill.disabled) reasons.push('已禁用')
   if (skill.blockedByAllowlist) reasons.push('被白名单阻止')
   return reasons
}

// ── 文本工具 ──

/** 截断文本，超过 max 字符时追加 "..." */
export function clampText(text: string, max: number): string {
   if (text.length <= max) return text
   return text.slice(0, max) + '...'
}

/** 从本地技能列表构建已安装技能名称集合 */
export function buildInstalledNamesSet(skills: SkillStatusEntry[]): Set<string> {
   return new Set(skills.map((s) => s.name))
}
