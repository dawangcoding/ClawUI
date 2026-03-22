import { useMemo } from 'react'
import { Tooltip } from 'antd'
import type { SessionUsageEntry } from '../../../../shared/types/gateway-protocol'
import { buildUsageMosaicStats, formatTokens } from '../usage-utils'
import css from '../UsagePage.module.css'

interface UsageActivityGridProps {
   sessions: SessionUsageEntry[]
   timeZone: 'local' | 'utc'
   selectedHours: number[]
   onSelectHour: (hour: number, shiftKey: boolean) => void
   onClearHours: () => void
}

const HOUR_LABELS: Array<{ hour: number; label: string }> = [
   { hour: 0, label: '午夜' },
   { hour: 4, label: '4时' },
   { hour: 8, label: '8时' },
   { hour: 12, label: '正午' },
   { hour: 16, label: '16时' },
   { hour: 20, label: '20时' },
]

function cellBg(intensity: number): string {
   if (intensity <= 0) return 'transparent'
   return `rgba(255, 77, 77, ${0.08 + intensity * 0.7})`
}

function cellBorder(intensity: number, selected: boolean): string {
   if (selected) return 'rgba(255, 77, 77, 0.8)'
   if (intensity > 0.7) return 'rgba(255, 77, 77, 0.4)'
   return 'rgba(255, 77, 77, 0.15)'
}

export default function UsageActivityGrid(props: UsageActivityGridProps) {
   const { sessions, timeZone, selectedHours, onSelectHour } = props

   const stats = useMemo(
      () => buildUsageMosaicStats(sessions, timeZone),
      [sessions, timeZone],
   )

   const maxWeekday = useMemo(() => {
      if (!stats.hasData) return 1
      return Math.max(...stats.weekdayTotals.map((w) => w.tokens), 1)
   }, [stats])

   const maxHour = useMemo(() => {
      if (!stats.hasData) return 1
      return Math.max(...stats.hourTotals, 1)
   }, [stats])

   if (!stats.hasData) {
      return (
         <div className={css.chartCard}>
            <div className={css.chartHeader}>
               <span className={css.chartTitle}>按时间活动</span>
            </div>
            <div
               className={css.chartBody}
               style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '40px 0',
                  color: 'var(--ant-color-text-quaternary)',
                  fontSize: 13,
               }}
            >
               暂无时间线数据
            </div>
         </div>
      )
   }

   return (
      <div className={css.chartCard}>
         <div className={css.chartHeader}>
            <span className={css.chartTitle}>按时间活动</span>
         </div>
         <div className={css.chartBody}>
            {/* ── Weekday distribution ── */}
            <div style={{ marginBottom: 16 }}>
               <div className={css.activityLabel}>星期分布</div>
               <div className={css.weekdayGrid}>
                  {stats.weekdayTotals.map((day) => {
                     const intensity = day.tokens / maxWeekday
                     return (
                        <Tooltip
                           key={day.label}
                           title={`${day.label}: ${formatTokens(day.tokens)}`}
                        >
                           <div
                              className={css.weekdayCell}
                              style={{
                                 background: cellBg(intensity),
                                 borderColor: cellBorder(intensity, false),
                              }}
                           >
                              <div style={{ color: 'var(--ant-color-text)', fontSize: 11 }}>
                                 {day.label}
                              </div>
                              <div
                                 style={{
                                    color: 'var(--ant-color-text-tertiary)',
                                    marginTop: 2,
                                    fontSize: 10,
                                    fontFamily:
                                       "'SF Mono', 'Menlo', 'Monaco', 'Cascadia Code', monospace",
                                 }}
                              >
                                 {formatTokens(day.tokens)}
                              </div>
                           </div>
                        </Tooltip>
                     )
                  })}
               </div>
            </div>

            {/* ── Hourly distribution ── */}
            <div>
               <div
                  style={{
                     display: 'flex',
                     justifyContent: 'space-between',
                     alignItems: 'center',
                     marginBottom: 6,
                  }}
               >
                  <span className={css.activityLabel} style={{ marginBottom: 0 }}>
                     小时分布
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--ant-color-text-quaternary)' }}>
                     0 → 23
                  </span>
               </div>
               <div className={css.hourGrid}>
                  {stats.hourTotals.map((tokens, hour) => {
                     const intensity = tokens / maxHour
                     const selected = selectedHours.includes(hour)
                     return (
                        <Tooltip
                           key={hour}
                           title={`${String(hour).padStart(2, '0')}:00 - ${formatTokens(tokens)}`}
                        >
                           <div
                              className={css.hourCell}
                              style={{
                                 background: cellBg(intensity),
                                 border: `1px solid ${cellBorder(intensity, selected)}`,
                                 ...(selected ? { borderWidth: 2 } : {}),
                              }}
                              onClick={(e) => onSelectHour(hour, e.shiftKey)}
                           />
                        </Tooltip>
                     )
                  })}
               </div>

               {/* Hour labels */}
               <div className={css.hourLabels}>
                  {Array.from({ length: 24 }, (_, hour) => {
                     const label = HOUR_LABELS.find((h) => h.hour === hour)
                     return (
                        <div key={hour} className={css.hourLabel}>
                           {label?.label ?? ''}
                        </div>
                     )
                  })}
               </div>

               <div className={css.densityLegend}>低 → 高 token 密度</div>
            </div>
         </div>
      </div>
   )
}
