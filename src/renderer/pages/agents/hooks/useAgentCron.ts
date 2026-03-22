import { useState, useCallback } from 'react'
import { useGateway } from '../../../contexts/GatewayContext'
import { RPC } from '../../../../shared/types/gateway-rpc'
import type { CronJob, CronJobsListResult, CronStatus } from '../../../../shared/types/gateway-protocol'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('AgentCron')

export function useAgentCron() {
   const { rpc } = useGateway()
   const [status, setStatus] = useState<CronStatus | null>(null)
   const [jobs, setJobs] = useState<CronJob[]>([])
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)

   const loadCron = useCallback(async () => {
      setLoading(true)
      setError(null)
      try {
         const [statusRes, jobsRes] = await Promise.all([
            rpc<CronStatus>(RPC.CRON_STATUS, {}),
            rpc<CronJobsListResult>(RPC.CRON_LIST, {
               includeDisabled: true,
               limit: 200,
               offset: 0,
            }),
         ])
         setStatus(statusRes ?? null)
         setJobs(jobsRes?.jobs ?? [])
      } catch (err) {
         log.error('Failed to load cron:', err)
         setError(err instanceof Error ? err.message : String(err))
      } finally {
         setLoading(false)
      }
   }, [rpc])

   const runNow = useCallback(
      async (jobId: string) => {
         try {
            await rpc(RPC.CRON_RUN, { id: jobId, mode: 'force' })
         } catch (err) {
            log.error(`Failed to run cron job ${jobId}:`, err)
            throw err
         }
      },
      [rpc],
   )

   return { status, jobs, loading, error, loadCron, runNow }
}
