// ── 定时任务创建/编辑表单面板 ──

import React from 'react'
import { Input, Select, Checkbox, Button, Space, Alert, Collapse } from 'antd'
import type { CronFormState, CronFieldErrors } from './cron-types'
import { supportsAnnounceDelivery, hasCronFormErrors } from './cron-utils'
import styles from './CronPage.module.css'

const { TextArea } = Input

interface CronJobFormProps {
   form: CronFormState
   fieldErrors: CronFieldErrors
   editingJobId: string | null
   busy: boolean
   modelSuggestions: string[]
   onFormChange: (patch: Partial<CronFormState>) => void
   onSubmit: () => void
   onCancel: () => void
}

// ── 选项常量 ──

const SCHEDULE_KIND_OPTIONS = [
   { value: 'every', label: '每隔' },
   { value: 'at', label: '指定时间' },
   { value: 'cron', label: 'Cron 表达式' },
]

const EVERY_UNIT_OPTIONS = [
   { value: 'minutes', label: '分钟' },
   { value: 'hours', label: '小时' },
   { value: 'days', label: '天' },
]

const SESSION_TARGET_OPTIONS = [
   { value: 'isolated', label: 'isolated' },
   { value: 'main', label: 'main' },
]

const WAKE_MODE_OPTIONS = [
   { value: 'now', label: '立即 (now)' },
   { value: 'next-heartbeat', label: '下次心跳' },
]

const PAYLOAD_KIND_OPTIONS = [
   { value: 'agentTurn', label: 'Agent 对话' },
   { value: 'systemEvent', label: '系统事件' },
]

const DELIVERY_MODE_OPTIONS_FULL = [
   { value: 'announce', label: '频道投递 (announce)' },
   { value: 'webhook', label: 'Webhook' },
   { value: 'none', label: '无' },
]

const DELIVERY_MODE_OPTIONS_NO_ANNOUNCE = [
   { value: 'webhook', label: 'Webhook' },
   { value: 'none', label: '无' },
]

const FAILURE_ALERT_MODE_OPTIONS = [
   { value: 'inherit', label: '继承全局设置' },
   { value: 'disabled', label: '禁用' },
   { value: 'custom', label: '自定义' },
]

const FAILURE_ALERT_DELIVERY_MODE_OPTIONS = [
   { value: 'announce', label: 'announce' },
   { value: 'webhook', label: 'webhook' },
]

const STAGGER_UNIT_OPTIONS = [
   { value: 'seconds', label: '秒' },
   { value: 'minutes', label: '分钟' },
]

const THINKING_SUGGESTIONS = ['off', 'minimal', 'low', 'medium', 'high']

const TIMEZONE_SUGGESTIONS = [
   'UTC',
   'America/Los_Angeles',
   'America/New_York',
   'Europe/London',
   'Europe/Berlin',
   'Asia/Shanghai',
   'Asia/Tokyo',
]

// ── 组件 ──

export default function CronJobForm({
   form,
   fieldErrors,
   editingJobId,
   busy,
   modelSuggestions,
   onFormChange,
   onSubmit,
   onCancel,
}: CronJobFormProps) {
   const isEditing = editingJobId != null
   const canSubmit = !hasCronFormErrors(fieldErrors) && !busy
   const canAnnounce = supportsAnnounceDelivery(form)
   const deliveryModeOptions = canAnnounce
      ? DELIVERY_MODE_OPTIONS_FULL
      : DELIVERY_MODE_OPTIONS_NO_ANNOUNCE

   function renderFieldError(key: string) {
      const err = fieldErrors[key]
      if (!err) return null
      return <div className={styles.formFieldError}>{err}</div>
   }

   return (
      <div className={styles.formPanel}>
         {/* 表单头部 */}
         <div className={styles.formHeader}>
            <h4 className={styles.formTitle}>
               {isEditing ? '编辑任务' : '新建任务'}
            </h4>
            <div className={styles.formSubtitle}>
               {isEditing ? '修改定时任务的配置。' : '创建定时唤醒或代理运行。'}
            </div>
         </div>

         <div className={styles.formRequiredNote}>* 必填</div>

         <div className={styles.formBody}>
            {/* ── 基本信息 ── */}
            <div className={styles.formSection}>
               <div className={styles.formSectionTitle}>基本信息</div>
               <div className={styles.formSectionDesc}>
                  命名、选择助手并设置启用状态。
               </div>

               <div className={styles.formGrid2}>
                  <div>
                     <span className={styles.formLabelRequired}>名称</span>
                     <Input
                        size="small"
                        placeholder="晨间简报"
                        value={form.name}
                        status={fieldErrors.name ? 'error' : undefined}
                        onChange={(e) => onFormChange({ name: e.target.value })}
                     />
                     {renderFieldError('name')}
                  </div>
                  <div>
                     <span className={styles.formLabel}>描述</span>
                     <Input
                        size="small"
                        placeholder="此任务的可选说明"
                        value={form.description}
                        onChange={(e) => onFormChange({ description: e.target.value })}
                     />
                  </div>
               </div>

               <span className={styles.formLabel}>代理 ID</span>
               <div className={styles.formFieldRow}>
                  <Input
                     size="small"
                     placeholder="main 或 ops"
                     value={form.agentId}
                     onChange={(e) => onFormChange({ agentId: e.target.value })}
                     style={{ flex: 1 }}
                  />
                  <Checkbox
                     checked={form.enabled}
                     onChange={(e) => onFormChange({ enabled: e.target.checked })}
                  >
                     已启用
                  </Checkbox>
               </div>
               <div className={styles.formFieldHint}>
                  输入以选择已知代理，或输入自定义 ID。
               </div>
            </div>

            {/* ── 调度 ── */}
            <div className={styles.formSection}>
               <div className={styles.formSectionTitle}>调度</div>
               <div className={styles.formSectionDesc}>
                  控制任务运行时间。
               </div>

               <span className={styles.formLabel}>调度</span>
               <Select
                  size="small"
                  value={form.scheduleKind}
                  options={SCHEDULE_KIND_OPTIONS}
                  onChange={(v) => onFormChange({ scheduleKind: v })}
                  style={{ width: '100%' }}
               />

               {form.scheduleKind === 'every' && (
                  <>
                     <span className={styles.formLabelRequired}>频率</span>
                     <div className={styles.formFieldRow}>
                        <Input
                           size="small"
                           value={form.everyAmount}
                           status={fieldErrors.everyAmount ? 'error' : undefined}
                           onChange={(e) => onFormChange({ everyAmount: e.target.value })}
                           style={{ width: 100 }}
                        />
                        <Select
                           size="small"
                           value={form.everyUnit}
                           options={EVERY_UNIT_OPTIONS}
                           onChange={(v) => onFormChange({ everyUnit: v })}
                           style={{ width: 100 }}
                        />
                     </div>
                     {renderFieldError('everyAmount')}
                  </>
               )}

               {form.scheduleKind === 'at' && (
                  <>
                     <span className={styles.formLabelRequired}>日期时间</span>
                     <Input
                        size="small"
                        type="datetime-local"
                        value={form.scheduleAt}
                        status={fieldErrors.scheduleAt ? 'error' : undefined}
                        onChange={(e) => onFormChange({ scheduleAt: e.target.value })}
                        style={{ width: '100%' }}
                     />
                     {renderFieldError('scheduleAt')}
                  </>
               )}

               {form.scheduleKind === 'cron' && (
                  <>
                     <span className={styles.formLabelRequired}>Cron 表达式</span>
                     <Input
                        size="small"
                        placeholder="0 7 * * *"
                        value={form.cronExpr}
                        status={fieldErrors.cronExpr ? 'error' : undefined}
                        onChange={(e) => onFormChange({ cronExpr: e.target.value })}
                     />
                     {renderFieldError('cronExpr')}
                     <span className={styles.formLabel}>时区</span>
                     <Select
                        size="small"
                        showSearch
                        allowClear
                        placeholder="默认 (服务器时区)"
                        value={form.cronTz || undefined}
                        onChange={(v) => onFormChange({ cronTz: v ?? '' })}
                        options={TIMEZONE_SUGGESTIONS.map((tz) => ({ value: tz, label: tz }))}
                        style={{ width: '100%' }}
                     />
                  </>
               )}
            </div>

            {/* ── 执行 ── */}
            <div className={styles.formSection}>
               <div className={styles.formSectionTitle}>执行</div>
               <div className={styles.formSectionDesc}>
                  配置任务执行内容。
               </div>

               <div className={styles.formGrid2}>
                  <div>
                     <span className={styles.formLabel}>会话目标</span>
                     <Select
                        size="small"
                        value={form.sessionTarget}
                        options={SESSION_TARGET_OPTIONS}
                        onChange={(v) => onFormChange({ sessionTarget: v })}
                        style={{ width: '100%' }}
                     />
                  </div>
                  <div>
                     <span className={styles.formLabel}>唤醒模式</span>
                     <Select
                        size="small"
                        value={form.wakeMode}
                        options={WAKE_MODE_OPTIONS}
                        onChange={(v) => onFormChange({ wakeMode: v })}
                        style={{ width: '100%' }}
                     />
                  </div>
               </div>

               <span className={styles.formLabel}>载荷类型</span>
               <Select
                  size="small"
                  value={form.payloadKind}
                  options={PAYLOAD_KIND_OPTIONS}
                  onChange={(v) => onFormChange({ payloadKind: v })}
                  style={{ width: '100%' }}
               />

               <span className={styles.formLabelRequired}>消息</span>
               <TextArea
                  rows={3}
                  size="small"
                  placeholder={
                     form.payloadKind === 'systemEvent'
                        ? '系统事件文本...'
                        : 'Agent 消息...'
                  }
                  value={form.payloadText}
                  status={fieldErrors.payloadText ? 'error' : undefined}
                  onChange={(e) => onFormChange({ payloadText: e.target.value })}
               />
               {renderFieldError('payloadText')}

               {form.payloadKind === 'agentTurn' && (
                  <>
                     <span className={styles.formLabel}>超时 (秒)</span>
                     <Input
                        size="small"
                        placeholder="可选"
                        value={form.timeoutSeconds}
                        status={fieldErrors.timeoutSeconds ? 'error' : undefined}
                        onChange={(e) => onFormChange({ timeoutSeconds: e.target.value })}
                        style={{ width: 120 }}
                     />
                     {renderFieldError('timeoutSeconds')}
                  </>
               )}
            </div>

            {/* ── 投递 ── */}
            <div className={styles.formSection}>
               <div className={styles.formSectionTitle}>投递</div>
               <div className={styles.formSectionDesc}>
                  配置运行结果的投递方式。
               </div>

               <span className={styles.formLabel}>投递模式</span>
               <Select
                  size="small"
                  value={form.deliveryMode}
                  options={deliveryModeOptions}
                  onChange={(v) => onFormChange({ deliveryMode: v })}
                  style={{ width: '100%' }}
               />

               {form.deliveryMode === 'announce' && (
                  <>
                     <span className={styles.formLabel}>频道</span>
                     <Input
                        size="small"
                        placeholder="last"
                        value={form.deliveryChannel}
                        onChange={(e) => onFormChange({ deliveryChannel: e.target.value })}
                     />
                     <span className={styles.formLabel}>目标</span>
                     <Input
                        size="small"
                        placeholder="可选 (如 @user)"
                        value={form.deliveryTo}
                        onChange={(e) => onFormChange({ deliveryTo: e.target.value })}
                     />
                  </>
               )}

               {form.deliveryMode === 'webhook' && (
                  <>
                     <span className={styles.formLabelRequired}>Webhook URL</span>
                     <Input
                        size="small"
                        placeholder="https://..."
                        value={form.deliveryTo}
                        status={fieldErrors.deliveryTo ? 'error' : undefined}
                        onChange={(e) => onFormChange({ deliveryTo: e.target.value })}
                     />
                     {renderFieldError('deliveryTo')}
                  </>
               )}
            </div>

            {/* ── 高级设置 ── */}
            <Collapse
               size="small"
               className={styles.advancedCollapse}
               items={[
                  {
                     key: 'advanced',
                     label: '高级设置',
                     children: (
                        <div>
                           <Checkbox
                              checked={form.deleteAfterRun}
                              onChange={(e) => onFormChange({ deleteAfterRun: e.target.checked })}
                           >
                              运行后删除
                           </Checkbox>
                           <br />
                           <Checkbox
                              checked={form.clearAgent}
                              onChange={(e) => onFormChange({ clearAgent: e.target.checked })}
                              style={{ marginTop: 6 }}
                           >
                              清除 Agent 覆盖
                           </Checkbox>

                           <span className={styles.formLabel}>Session Key</span>
                           <Input
                              size="small"
                              placeholder="可选路由 key"
                              value={form.sessionKey}
                              onChange={(e) => onFormChange({ sessionKey: e.target.value })}
                           />

                           {form.scheduleKind === 'cron' && (
                              <>
                                 <div style={{ marginTop: 10 }}>
                                    <Checkbox
                                       checked={form.scheduleExact}
                                       onChange={(e) =>
                                          onFormChange({ scheduleExact: e.target.checked })
                                       }
                                    >
                                       精确计时 (无抖动)
                                    </Checkbox>
                                 </div>
                                 {!form.scheduleExact && (
                                    <>
                                       <span className={styles.formLabel}>抖动窗口</span>
                                       <div className={styles.formFieldRow}>
                                          <Input
                                             size="small"
                                             placeholder="可选"
                                             value={form.staggerAmount}
                                             status={
                                                fieldErrors.staggerAmount ? 'error' : undefined
                                             }
                                             onChange={(e) =>
                                                onFormChange({ staggerAmount: e.target.value })
                                             }
                                             style={{ width: 80 }}
                                          />
                                          <Select
                                             size="small"
                                             value={form.staggerUnit}
                                             options={STAGGER_UNIT_OPTIONS}
                                             onChange={(v) => onFormChange({ staggerUnit: v })}
                                             style={{ width: 80 }}
                                          />
                                       </div>
                                       {renderFieldError('staggerAmount')}
                                    </>
                                 )}
                              </>
                           )}

                           {form.payloadKind === 'agentTurn' && (
                              <>
                                 <span className={styles.formLabel}>模型</span>
                                 <Select
                                    size="small"
                                    showSearch
                                    allowClear
                                    placeholder="默认 (继承)"
                                    value={form.payloadModel || undefined}
                                    onChange={(v) => onFormChange({ payloadModel: v ?? '' })}
                                    options={modelSuggestions.map((m) => ({
                                       value: m,
                                       label: m,
                                    }))}
                                    style={{ width: '100%' }}
                                 />

                                 <span className={styles.formLabel}>Thinking</span>
                                 <Select
                                    size="small"
                                    showSearch
                                    allowClear
                                    placeholder="默认"
                                    value={form.payloadThinking || undefined}
                                    onChange={(v) => onFormChange({ payloadThinking: v ?? '' })}
                                    options={THINKING_SUGGESTIONS.map((t) => ({
                                       value: t,
                                       label: t,
                                    }))}
                                    style={{ width: '100%' }}
                                 />

                                 <div style={{ marginTop: 8 }}>
                                    <Checkbox
                                       checked={form.payloadLightContext}
                                       onChange={(e) =>
                                          onFormChange({ payloadLightContext: e.target.checked })
                                       }
                                    >
                                       轻量上下文
                                    </Checkbox>
                                 </div>

                                 {form.deliveryMode === 'announce' && (
                                    <>
                                       <span className={styles.formLabel}>Account ID</span>
                                       <Input
                                          size="small"
                                          placeholder="可选"
                                          value={form.deliveryAccountId}
                                          onChange={(e) =>
                                             onFormChange({ deliveryAccountId: e.target.value })
                                          }
                                       />
                                    </>
                                 )}
                              </>
                           )}

                           {/* 失败告警 */}
                           {form.payloadKind === 'agentTurn' && (
                              <>
                                 <span className={styles.formLabel}>失败告警</span>
                                 <Select
                                    size="small"
                                    value={form.failureAlertMode}
                                    options={FAILURE_ALERT_MODE_OPTIONS}
                                    onChange={(v) => onFormChange({ failureAlertMode: v })}
                                    style={{ width: '100%' }}
                                 />

                                 {form.failureAlertMode === 'custom' && (
                                    <>
                                       <div className={styles.formGrid2} style={{ marginTop: 8 }}>
                                          <div>
                                             <span className={styles.formLabel}>连续失败阈值</span>
                                             <Input
                                                size="small"
                                                value={form.failureAlertAfter}
                                                status={
                                                   fieldErrors.failureAlertAfter
                                                      ? 'error'
                                                      : undefined
                                                }
                                                onChange={(e) =>
                                                   onFormChange({
                                                      failureAlertAfter: e.target.value,
                                                   })
                                                }
                                             />
                                             {renderFieldError('failureAlertAfter')}
                                          </div>
                                          <div>
                                             <span className={styles.formLabel}>冷却时间 (秒)</span>
                                             <Input
                                                size="small"
                                                value={form.failureAlertCooldownSeconds}
                                                status={
                                                   fieldErrors.failureAlertCooldownSeconds
                                                      ? 'error'
                                                      : undefined
                                                }
                                                onChange={(e) =>
                                                   onFormChange({
                                                      failureAlertCooldownSeconds: e.target.value,
                                                   })
                                                }
                                             />
                                             {renderFieldError('failureAlertCooldownSeconds')}
                                          </div>
                                       </div>
                                       <span className={styles.formLabel}>告警频道</span>
                                       <Input
                                          size="small"
                                          placeholder="last"
                                          value={form.failureAlertChannel}
                                          onChange={(e) =>
                                             onFormChange({ failureAlertChannel: e.target.value })
                                          }
                                       />
                                       <span className={styles.formLabel}>告警目标</span>
                                       <Input
                                          size="small"
                                          placeholder="可选"
                                          value={form.failureAlertTo}
                                          onChange={(e) =>
                                             onFormChange({ failureAlertTo: e.target.value })
                                          }
                                       />
                                       <span className={styles.formLabel}>告警投递方式</span>
                                       <Select
                                          size="small"
                                          value={form.failureAlertDeliveryMode}
                                          options={FAILURE_ALERT_DELIVERY_MODE_OPTIONS}
                                          onChange={(v) =>
                                             onFormChange({ failureAlertDeliveryMode: v })
                                          }
                                          style={{ width: '100%' }}
                                       />
                                       <span className={styles.formLabel}>告警 Account ID</span>
                                       <Input
                                          size="small"
                                          placeholder="可选"
                                          value={form.failureAlertAccountId}
                                          onChange={(e) =>
                                             onFormChange({
                                                failureAlertAccountId: e.target.value,
                                             })
                                          }
                                       />
                                    </>
                                 )}
                              </>
                           )}

                           {form.deliveryMode !== 'none' && (
                              <div style={{ marginTop: 10 }}>
                                 <Checkbox
                                    checked={form.deliveryBestEffort}
                                    onChange={(e) =>
                                       onFormChange({ deliveryBestEffort: e.target.checked })
                                    }
                                 >
                                    尽力投递 (best effort)
                                 </Checkbox>
                              </div>
                           )}
                        </div>
                     ),
                  },
               ]}
            />

            {/* ── 验证错误汇总 ── */}
            {hasCronFormErrors(fieldErrors) && !busy && (
               <Alert
                  type="warning"
                  showIcon
                  message="表单存在错误"
                  description={
                     <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {Object.entries(fieldErrors).map(
                           ([key, msg]) =>
                              msg && (
                                 <li key={key} style={{ fontSize: 12 }}>
                                    {msg}
                                 </li>
                              ),
                        )}
                     </ul>
                  }
                  className={styles.formValidationSummary}
               />
            )}
         </div>

         {/* ── 按钮行 ── */}
         <div className={styles.formActions}>
            <Button
               type="primary"
               size="small"
               loading={busy}
               disabled={!canSubmit}
               onClick={onSubmit}
            >
               {isEditing ? '保存更改' : '添加任务'}
            </Button>
            {isEditing && (
               <Button size="small" onClick={onCancel} disabled={busy}>
                  取消
               </Button>
            )}
         </div>
      </div>
   )
}
