import { useMemo, useCallback } from 'react'
import {
   Button,
   DatePicker,
   Segmented,
   Tag,
   Dropdown,
   AutoComplete,
   Input,
   Tooltip,
} from 'antd'
import {
   ReloadOutlined,
   PushpinOutlined,
   DownloadOutlined,
   CloseCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { MenuProps } from 'antd'
import type {
   SessionUsageEntry,
   SessionsUsageAggregates,
   CostUsageDailyEntry,
} from '../../../../shared/types/gateway-protocol'
import type { UsageFilterOptions, QuerySuggestion } from '../usage-types'
import { formatTokens, formatCost, formatIsoDate } from '../usage-utils'
import {
   buildSessionsCsv,
   buildDailyCsv,
   downloadTextFile,
   extractQueryTerms,
   removeQueryToken,
} from '../usage-query'
import css from '../UsagePage.module.css'

interface UsageFiltersProps {
   startDate: string
   endDate: string
   timeZone: 'local' | 'utc'
   chartMode: 'tokens' | 'cost'
   loading: boolean
   query: string
   queryDraft: string
   selectedSessions: string[]
   selectedDays: string[]
   selectedHours: number[]
   sessionsLimitReached: boolean
   totalTokens: number
   totalCost: number
   sessionCount: number
   filterOptions: UsageFilterOptions
   querySuggestions: QuerySuggestion[]
   queryWarnings: string[]
   headerPinned: boolean
   costDaily: CostUsageDailyEntry[]
   sessions: SessionUsageEntry[]
   aggregates: SessionsUsageAggregates | null
   onStartDateChange: (date: string) => void
   onEndDateChange: (date: string) => void
   onTimeZoneChange: (zone: 'local' | 'utc') => void
   onChartModeChange: (mode: 'tokens' | 'cost') => void
   onRefresh: () => void
   onQueryDraftChange: (query: string) => void
   onApplyQuery: () => void
   onClearQuery: () => void
   onClearAllFilters: () => void
   onToggleHeaderPinned: () => void
   onSelectDay: (day: string, shiftKey: boolean) => void
   onClearDays: () => void
   onClearHours: () => void
   onClearSessions: () => void
}

const exportItems: MenuProps['items'] = [
   { key: 'sessions-csv', label: '会话 CSV' },
   { key: 'daily-csv', label: '每日 CSV' },
   { key: 'json', label: 'JSON' },
]

export default function UsageFilters(props: UsageFiltersProps) {
   const {
      startDate,
      endDate,
      timeZone,
      chartMode,
      loading,
      query,
      queryDraft,
      selectedSessions,
      selectedDays,
      selectedHours,
      sessionsLimitReached,
      totalTokens,
      totalCost,
      sessionCount,
      querySuggestions,
      queryWarnings,
      headerPinned,
      costDaily,
      sessions,
      aggregates,
      onStartDateChange,
      onEndDateChange,
      onTimeZoneChange,
      onChartModeChange,
      onRefresh,
      onQueryDraftChange,
      onApplyQuery,
      onClearQuery,
      onClearAllFilters,
      onToggleHeaderPinned,
      onClearDays,
      onClearHours,
      onClearSessions,
   } = props

   // ── Date presets ──

   const setPresetToday = useCallback(() => {
      const today = formatIsoDate(new Date())
      onStartDateChange(today)
      onEndDateChange(today)
   }, [onStartDateChange, onEndDateChange])

   const setPreset7Days = useCallback(() => {
      const now = new Date()
      const start = new Date(now)
      start.setDate(start.getDate() - 7)
      onStartDateChange(formatIsoDate(start))
      onEndDateChange(formatIsoDate(now))
   }, [onStartDateChange, onEndDateChange])

   const setPreset30Days = useCallback(() => {
      const now = new Date()
      const start = new Date(now)
      start.setDate(start.getDate() - 30)
      onStartDateChange(formatIsoDate(start))
      onEndDateChange(formatIsoDate(now))
   }, [onStartDateChange, onEndDateChange])

   // ── Date picker ──

   const dateRangeValue = useMemo<[dayjs.Dayjs, dayjs.Dayjs]>(
      () => [dayjs(startDate), dayjs(endDate)],
      [startDate, endDate],
   )

   const handleDateRangeChange = useCallback(
      (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
         if (!dates || !dates[0] || !dates[1]) return
         onStartDateChange(dates[0].format('YYYY-MM-DD'))
         onEndDateChange(dates[1].format('YYYY-MM-DD'))
      },
      [onStartDateChange, onEndDateChange],
   )

   // ── Export ──

   const handleExport = useCallback(
      (info: { key: string }) => {
         if (info.key === 'sessions-csv') {
            downloadTextFile('sessions.csv', buildSessionsCsv(sessions), 'text/csv')
         } else if (info.key === 'daily-csv') {
            downloadTextFile('daily.csv', buildDailyCsv(costDaily), 'text/csv')
         } else if (info.key === 'json') {
            const data = { sessions, costDaily, aggregates }
            downloadTextFile('usage.json', JSON.stringify(data, null, 2), 'application/json')
         }
      },
      [sessions, costDaily, aggregates],
   )

   // ── Query suggestions ──

   const autoCompleteOptions = useMemo(
      () => querySuggestions.map((s) => ({ value: s.value, label: s.label })),
      [querySuggestions],
   )

   // ── Query terms ──

   const queryTerms = useMemo(() => extractQueryTerms(query), [query])

   // ── Active filters check ──

   const hasActiveFilters = useMemo(
      () =>
         queryWarnings.length > 0 ||
         selectedDays.length > 0 ||
         selectedHours.length > 0 ||
         selectedSessions.length > 0 ||
         queryTerms.length > 0,
      [queryWarnings, selectedDays, selectedHours, selectedSessions, queryTerms],
   )

   return (
      <div className={headerPinned ? css.filterBarPinned : css.filterBar}>
         {/* ── Row 1: Toolbar ── */}
         <div className={css.filterRow}>
            <Button.Group>
               <Button size="small" onClick={setPresetToday}>
                  今天
               </Button>
               <Button size="small" onClick={setPreset7Days}>
                  7天
               </Button>
               <Button size="small" onClick={setPreset30Days}>
                  30天
               </Button>
            </Button.Group>

            <DatePicker.RangePicker
               size="small"
               value={dateRangeValue}
               format="YYYY/MM/DD"
               onChange={handleDateRangeChange}
               allowClear={false}
            />

            <Segmented
               size="small"
               value={timeZone}
               options={[
                  { label: '本地', value: 'local' },
                  { label: 'UTC', value: 'utc' },
               ]}
               onChange={onTimeZoneChange}
            />

            <Segmented
               size="small"
               value={chartMode}
               options={[
                  { label: 'Tokens', value: 'tokens' },
                  { label: '费用', value: 'cost' },
               ]}
               onChange={onChartModeChange}
            />

            <Button
               size="small"
               icon={<ReloadOutlined />}
               loading={loading}
               onClick={onRefresh}
            />

            {/* ── Summary badges ── */}
            <div className={css.filterSummary}>
               <div className={css.filterSummaryItem}>
                  <span className={css.filterSummaryLabel}>tokens</span>
                  {formatTokens(totalTokens)}
               </div>
               <div className={css.filterSummaryItem}>
                  <span className={css.filterSummaryLabel}>费用</span>
                  {formatCost(totalCost)}
               </div>
               <div
                  className={css.filterSummaryItem}
                  style={
                     sessionsLimitReached
                        ? { borderColor: '#f59e0b', color: '#f59e0b' }
                        : undefined
                  }
               >
                  <span className={css.filterSummaryLabel}>会话</span>
                  {sessionCount}
                  {sessionsLimitReached && ' (上限)'}
               </div>
            </div>

            <Tooltip title={headerPinned ? '取消固定' : '固定标题栏'}>
               <Button
                  size="small"
                  type={headerPinned ? 'primary' : 'text'}
                  icon={<PushpinOutlined />}
                  onClick={onToggleHeaderPinned}
               />
            </Tooltip>

            <Dropdown menu={{ items: exportItems, onClick: handleExport }}>
               <Button size="small" icon={<DownloadOutlined />}>
                  导出
               </Button>
            </Dropdown>
         </div>

         {/* ── Row 2: Query input ── */}
         <div style={{ marginTop: 8 }}>
            <AutoComplete
               options={autoCompleteOptions}
               value={queryDraft}
               onChange={onQueryDraftChange}
               onSelect={(value: string) => {
                  onQueryDraftChange(value)
                  onApplyQuery()
               }}
               style={{ width: '100%' }}
               allowClear
               onClear={onClearQuery}
            >
               <Input.Search
                  size="small"
                  placeholder="筛选会话 (如 agent:main model:gpt-4o has:errors)"
                  onSearch={() => onApplyQuery()}
               />
            </AutoComplete>
         </div>

         {/* ── Row 3: Active filter tags ── */}
         {hasActiveFilters && (
            <div className={css.filterTagsRow}>
               {queryWarnings.map((warning) => (
                  <Tag key={warning} color="warning">
                     {warning}
                  </Tag>
               ))}

               {selectedDays.map((day) => (
                  <Tag key={`day-${day}`} closable onClose={() => onClearDays()}>
                     {day}
                  </Tag>
               ))}

               {selectedHours.map((hour) => (
                  <Tag key={`hour-${hour}`} closable onClose={() => onClearHours()}>
                     {String(hour).padStart(2, '0')}:00
                  </Tag>
               ))}

               {selectedSessions.length > 0 && (
                  <Tag closable onClose={() => onClearSessions()}>
                     {selectedSessions.length} 个会话已选
                  </Tag>
               )}

               {queryTerms.map((term) => (
                  <Tag
                     key={`term-${term.raw}`}
                     closable
                     onClose={() => {
                        const next = removeQueryToken(query, term.raw)
                        onQueryDraftChange(next)
                        onApplyQuery()
                     }}
                  >
                     {term.raw}
                  </Tag>
               ))}

               <Button
                  size="small"
                  type="link"
                  icon={<CloseCircleOutlined />}
                  onClick={onClearAllFilters}
               >
                  清除全部
               </Button>
            </div>
         )}
      </div>
   )
}
