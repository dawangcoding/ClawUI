import { Spin, Alert } from 'antd'
import { useGateway } from '../../contexts/GatewayContext'
import EmptyState from '../../components/EmptyState'
import { useUsagePageState } from './hooks/useUsagePageState'
import UsageFilters from './components/UsageFilters'
import UsageOverview from './components/UsageOverview'
import UsageDailyChart from './components/UsageDailyChart'
import UsageActivityGrid from './components/UsageActivityGrid'
import UsageSessionsList from './components/UsageSessionsList'
import UsageSessionDetail from './components/UsageSessionDetail'
import css from './UsagePage.module.css'

export default function UsagePage() {
   const { connected } = useGateway()
   const usage = useUsagePageState()

   if (!connected) {
      return <EmptyState description="请先连接到 Gateway" />
   }

   const hasData = !!usage.state.usageResult

   return (
      <div className={css.pageContainer}>
         <UsageFilters
            startDate={usage.state.startDate}
            endDate={usage.state.endDate}
            timeZone={usage.state.timeZone}
            chartMode={usage.state.chartMode}
            loading={usage.state.loading}
            query={usage.state.query}
            queryDraft={usage.state.queryDraft}
            selectedSessions={usage.state.selectedSessions}
            selectedDays={usage.state.selectedDays}
            selectedHours={usage.state.selectedHours}
            sessionsLimitReached={usage.sessionsLimitReached}
            totalTokens={usage.displayTotals?.totalTokens ?? 0}
            totalCost={usage.displayTotals?.totalCost ?? 0}
            sessionCount={usage.activeSessions.length}
            filterOptions={usage.filterOptions}
            querySuggestions={usage.querySuggestions}
            queryWarnings={usage.queryWarnings}
            headerPinned={usage.state.headerPinned}
            costDaily={usage.state.costSummary?.daily ?? []}
            sessions={usage.state.usageResult?.sessions ?? []}
            aggregates={usage.activeAggregates}
            onStartDateChange={usage.onStartDateChange}
            onEndDateChange={usage.onEndDateChange}
            onTimeZoneChange={usage.onTimeZoneChange}
            onChartModeChange={usage.onChartModeChange}
            onRefresh={usage.onRefresh}
            onQueryDraftChange={usage.onQueryDraftChange}
            onApplyQuery={usage.onApplyQuery}
            onClearQuery={usage.onClearQuery}
            onClearAllFilters={usage.onClearAllFilters}
            onToggleHeaderPinned={usage.onToggleHeaderPinned}
            onSelectDay={usage.onSelectDay}
            onClearDays={usage.onClearDays}
            onClearHours={usage.onClearHours}
            onClearSessions={usage.onClearSessions}
         />

         {usage.state.error && (
            <Alert
               type="error"
               message="加载失败"
               description={usage.state.error}
               showIcon
               closable
            />
         )}

         {usage.state.loading && !hasData && (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
               <Spin size="large" />
            </div>
         )}

         {hasData && (
            <>
               <UsageOverview
                  totals={usage.displayTotals}
                  aggregates={usage.activeAggregates}
                  insightStats={usage.insightStats}
                  chartMode={usage.state.chartMode}
                  sessions={usage.activeSessions}
                  timeZone={usage.state.timeZone}
               />

               <div className={css.chartGrid}>
                  <UsageDailyChart
                     daily={usage.activeAggregates?.daily ?? []}
                     costDaily={usage.state.costSummary?.daily ?? []}
                     chartMode={usage.state.chartMode}
                     dailyChartMode={usage.state.dailyChartMode}
                     selectedDays={usage.state.selectedDays}
                     totals={usage.displayTotals}
                     onDailyChartModeChange={usage.onDailyChartModeChange}
                     onSelectDay={usage.onSelectDay}
                  />
                  <UsageActivityGrid
                     sessions={usage.activeSessions}
                     timeZone={usage.state.timeZone}
                     selectedHours={usage.state.selectedHours}
                     onSelectHour={usage.onSelectHour}
                     onClearHours={usage.onClearHours}
                  />
               </div>

               <div
                  className={
                     usage.primarySelectedSession
                        ? css.sessionsGridSplit
                        : css.sessionsGridFull
                  }
               >
                  <UsageSessionsList
                     sessions={usage.hourFilteredSessions}
                     selectedSessions={usage.state.selectedSessions}
                     chartMode={usage.state.chartMode}
                     sessionSort={usage.state.sessionSort}
                     sessionSortDir={usage.state.sessionSortDir}
                     sessionsTab={usage.state.sessionsTab}
                     recentSessions={usage.state.recentSessions}
                     sessionsLimitReached={usage.sessionsLimitReached}
                     onSelectSession={usage.onSelectSession}
                     onClearSessions={usage.onClearSessions}
                     onSessionSortChange={usage.onSessionSortChange}
                     onSessionSortDirChange={usage.onSessionSortDirChange}
                     onSessionsTabChange={usage.onSessionsTabChange}
                  />
                  {usage.primarySelectedSession && (
                     <UsageSessionDetail
                        session={usage.primarySelectedSession}
                        timeSeries={usage.state.timeSeries}
                        timeSeriesLoading={usage.state.timeSeriesLoading}
                        timeSeriesMode={usage.state.timeSeriesMode}
                        timeSeriesBreakdownMode={usage.state.timeSeriesBreakdownMode}
                        timeSeriesCursorStart={usage.state.timeSeriesCursorStart}
                        timeSeriesCursorEnd={usage.state.timeSeriesCursorEnd}
                        sessionLogs={usage.state.sessionLogs}
                        sessionLogsLoading={usage.state.sessionLogsLoading}
                        sessionLogsExpanded={usage.state.sessionLogsExpanded}
                        logFilterRoles={usage.state.logFilterRoles}
                        logFilterTools={usage.state.logFilterTools}
                        logFilterHasTools={usage.state.logFilterHasTools}
                        logFilterQuery={usage.state.logFilterQuery}
                        chartMode={usage.state.chartMode}
                        onTimeSeriesModeChange={usage.onTimeSeriesModeChange}
                        onTimeSeriesBreakdownChange={usage.onTimeSeriesBreakdownChange}
                        onTimeSeriesCursorChange={usage.onTimeSeriesCursorChange}
                        onToggleSessionLogsExpanded={usage.onToggleSessionLogsExpanded}
                        onLogFilterRolesChange={usage.onLogFilterRolesChange}
                        onLogFilterToolsChange={usage.onLogFilterToolsChange}
                        onLogFilterHasToolsChange={usage.onLogFilterHasToolsChange}
                        onLogFilterQueryChange={usage.onLogFilterQueryChange}
                        onClearLogFilters={usage.onClearLogFilters}
                     />
                  )}
               </div>

               {usage.sessionsLimitReached && (
                  <Alert
                     type="warning"
                     message="已达到 1000 个会话的查询上限，可能有更多会话未显示。请缩小日期范围以查看完整数据。"
                     showIcon
                  />
               )}
            </>
         )}
      </div>
   )
}
