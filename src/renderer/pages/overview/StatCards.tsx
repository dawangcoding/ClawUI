import React from 'react'
import { Card, Row, Col, Statistic, List, Typography, Skeleton } from 'antd'
import {
   DollarOutlined,
   MessageOutlined,
   ToolOutlined,
   ClockCircleOutlined,
} from '@ant-design/icons'
import type { NavPage } from '../../contexts/NavigationContext'
import type {
   SessionsUsageResult,
   SessionsListResult,
   SkillStatusReport,
   CronStatus,
   CronJob,
} from '../../../shared/types/gateway-protocol'
import { formatCost, formatTokens, formatRelativeTime } from './overview-utils'

const { Text } = Typography

interface StatCardsProps {
   usageResult: SessionsUsageResult | null
   sessionsResult: SessionsListResult | null
   skillsReport: SkillStatusReport | null
   cronStatus: CronStatus | null
   cronJobs: CronJob[]
   loading: boolean
   onNavigate: (page: NavPage) => void
}

const cardStyle: React.CSSProperties = {
   cursor: 'pointer',
   height: '100%',
   transition: 'border-color 0.2s ease',
}

const statTitleStyle: React.CSSProperties = {
   display: 'inline-flex',
   alignItems: 'center',
   gap: 6,
   fontSize: 13,
}

const statIconStyle = (color: string): React.CSSProperties => ({
   fontSize: 13,
   color,
   opacity: 0.85,
})

export default function StatCards({
   usageResult,
   sessionsResult,
   skillsReport,
   cronStatus,
   cronJobs,
   loading,
   onNavigate,
}: StatCardsProps) {
   if (loading && !usageResult && !sessionsResult && !skillsReport && !cronStatus) {
      return (
         <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            {[0, 1, 2, 3].map((i) => (
               <Col span={6} key={i}>
                  <Card size="small">
                     <Skeleton active paragraph={{ rows: 1 }} title={{ width: 60 }} />
                  </Card>
               </Col>
            ))}
         </Row>
      )
   }

   const totals = usageResult?.totals
   const sessionCount = sessionsResult?.count ?? sessionsResult?.sessions?.length ?? null
   const skills = skillsReport?.skills ?? []
   const enabledSkills = skills.filter((s) => !s.disabled).length
   const totalSkills = skills.length

   const cronEnabled = cronStatus?.enabled ?? false
   const cronJobCount = cronStatus?.jobs ?? cronJobs.length
   const failedCronCount = cronJobs.filter(
      (j) => (j.state?.lastRunStatus ?? j.state?.lastStatus) === 'error',
   ).length

   const cronValue = cronStatus == null
      ? '-'
      : cronEnabled
        ? `${cronJobCount} 个任务`
        : '未启用'

   const cronSuffix = failedCronCount > 0
      ? `${failedCronCount} 个失败`
      : cronStatus?.nextWakeAtMs
        ? `下次: ${formatRelativeTime(cronStatus.nextWakeAtMs).replace('前', '后')}`
        : ''

   const recentSessions = sessionsResult?.sessions?.slice(0, 5) ?? []

   return (
      <>
         <Row gutter={[12, 12]}>
            <Col span={6}>
               <Card
                  size="small"
                  hoverable
                  style={cardStyle}
                  onClick={() => onNavigate('usage')}
               >
                  <Statistic
                     title={
                        <span style={statTitleStyle}>
                           <DollarOutlined style={statIconStyle('var(--ant-color-warning)')} />
                           费用
                        </span>
                     }
                     value={formatCost(totals?.cost)}
                     valueStyle={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}
                     suffix={
                        <Text
                           type="secondary"
                           style={{ fontSize: 11, fontWeight: 'normal' }}
                        >
                           {formatTokens(totals?.totalTokens)} tokens
                        </Text>
                     }
                  />
               </Card>
            </Col>
            <Col span={6}>
               <Card
                  size="small"
                  hoverable
                  style={cardStyle}
                  onClick={() => onNavigate('sessions')}
               >
                  <Statistic
                     title={
                        <span style={statTitleStyle}>
                           <MessageOutlined style={statIconStyle('var(--ant-color-primary)')} />
                           会话
                        </span>
                     }
                     value={sessionCount ?? '-'}
                     valueStyle={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}
                     suffix={
                        <Text
                           type="secondary"
                           style={{ fontSize: 11, fontWeight: 'normal' }}
                        >
                           活跃会话
                        </Text>
                     }
                  />
               </Card>
            </Col>
            <Col span={6}>
               <Card
                  size="small"
                  hoverable
                  style={cardStyle}
                  onClick={() => onNavigate('skills')}
               >
                  <Statistic
                     title={
                        <span style={statTitleStyle}>
                           <ToolOutlined style={statIconStyle('var(--ant-color-success)')} />
                           技能
                        </span>
                     }
                     value={`${enabledSkills}/${totalSkills}`}
                     valueStyle={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}
                     suffix={
                        <Text
                           type="secondary"
                           style={{ fontSize: 11, fontWeight: 'normal' }}
                        >
                           已启用
                        </Text>
                     }
                  />
               </Card>
            </Col>
            <Col span={6}>
               <Card
                  size="small"
                  hoverable
                  style={cardStyle}
                  onClick={() => onNavigate('cron')}
               >
                  <Statistic
                     title={
                        <span style={statTitleStyle}>
                           <ClockCircleOutlined
                              style={statIconStyle(
                                 failedCronCount > 0
                                    ? 'var(--ant-color-error)'
                                    : 'var(--ant-color-info)',
                              )}
                           />
                           定时任务
                        </span>
                     }
                     value={cronValue}
                     valueStyle={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}
                     suffix={
                        cronSuffix
                           ? (
                              <Text
                                 type={failedCronCount > 0 ? 'danger' : 'secondary'}
                                 style={{ fontSize: 11, fontWeight: 'normal' }}
                              >
                                 {cronSuffix}
                              </Text>
                           )
                           : null
                     }
                  />
               </Card>
            </Col>
         </Row>

         {recentSessions.length > 0 && (
            <Card
               title="最近会话"
               size="small"
               extra={
                  <Text
                     type="secondary"
                     style={{
                        fontSize: 12,
                        cursor: 'pointer',
                        transition: 'color 0.2s',
                     }}
                     onClick={() => onNavigate('sessions')}
                  >
                     查看全部
                  </Text>
               }
            >
               <List
                  size="small"
                  dataSource={recentSessions}
                  renderItem={(session) => (
                     <List.Item
                        style={{ padding: '8px 0' }}
                        extra={
                           <Text
                              type="secondary"
                              style={{ fontSize: 11, fontFamily: 'monospace' }}
                           >
                              {session.updatedAt
                                 ? formatRelativeTime(session.updatedAt)
                                 : ''}
                           </Text>
                        }
                     >
                        <List.Item.Meta
                           title={
                              <Text ellipsis style={{ fontSize: 13, maxWidth: 240 }}>
                                 {session.displayName || session.label || session.key}
                              </Text>
                           }
                           description={
                              session.model
                                 ? (
                                    <Text
                                       type="secondary"
                                       style={{
                                          fontSize: 11,
                                          fontFamily: 'monospace',
                                          opacity: 0.7,
                                       }}
                                    >
                                       {session.model}
                                    </Text>
                                 )
                                 : null
                           }
                        />
                     </List.Item>
                  )}
               />
            </Card>
         )}
      </>
   )
}
