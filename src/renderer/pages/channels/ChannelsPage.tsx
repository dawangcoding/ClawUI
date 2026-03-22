import React from 'react'
import { Button, Spin, Alert } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useGateway } from '../../contexts/GatewayContext'
import { useChannelsState } from './hooks/useChannelsState'
import ChannelCardGrid from './components/ChannelCardGrid'
import EmptyState from '../../components/EmptyState'
import styles from './ChannelsPage.module.css'

export default function ChannelsPage() {
   const { connected } = useGateway()
   const state = useChannelsState()

   if (!connected) return <EmptyState description="请先连接到 Gateway" />

   return (
      <div className={styles.pageContainer}>
         <div className={styles.pageHeader}>
            <h4 className={styles.pageTitle}>频道管理</h4>
            <Button
               icon={<ReloadOutlined />}
               onClick={() => state.loadChannels(false)}
               loading={state.loading}
               size="small"
            >
               刷新
            </Button>
         </div>

         {state.lastError && (
            <Alert
               type="error"
               message="加载失败"
               description={state.lastError}
               closable
            />
         )}

         <Spin spinning={state.loading && !state.snapshot}>
            {state.snapshot ? (
               <ChannelCardGrid
                  snapshot={state.snapshot}
                  loading={state.loading}
                  onRefresh={state.loadChannels}
                  // WhatsApp
                  whatsappQrDataUrl={state.whatsappQrDataUrl}
                  whatsappMessage={state.whatsappMessage}
                  whatsappConnected={state.whatsappConnected}
                  whatsappBusy={state.whatsappBusy}
                  onWhatsAppStart={state.handleWhatsAppStart}
                  onWhatsAppWait={state.handleWhatsAppWait}
                  onWhatsAppLogout={state.handleWhatsAppLogout}
                  // 配置
                  configSchema={state.config.configSchema}
                  configSchemaLoading={state.config.configSchemaLoading}
                  configUiHints={state.config.configUiHints}
                  configForm={state.config.configForm}
                  configFormDirty={state.config.configFormDirty}
                  configSaving={state.config.configSaving}
                  onConfigPatch={state.config.onPatch}
                  onConfigSave={state.config.onSave}
                  onConfigReload={state.config.onReload}
                  // Nostr
                  nostrProfileFormState={state.nostrProfile.formState}
                  nostrProfileAccountId={state.nostrProfile.accountId}
                  onNostrProfileEdit={state.nostrProfile.editProfile}
                  onNostrProfileCancel={state.nostrProfile.cancelEdit}
                  onNostrProfileFieldChange={state.nostrProfile.updateField}
                  onNostrProfileSave={state.nostrProfile.saveProfile}
                  onNostrProfileImport={state.nostrProfile.importProfile}
                  onNostrProfileToggleAdvanced={state.nostrProfile.toggleAdvanced}
               />
            ) : (
               !state.loading && <EmptyState description="无可用频道" />
            )}
         </Spin>
      </div>
   )
}
