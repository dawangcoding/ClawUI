import React from 'react'
import { Button, Descriptions, Avatar, Typography, Space } from 'antd'
import { EditOutlined, UserOutlined } from '@ant-design/icons'
import type { NostrProfile } from '../../../../shared/types/gateway-protocol'

const { Text, Paragraph } = Typography

interface Props {
   profile: NostrProfile | null
   configured: boolean
   onEdit: () => void
}

export default function NostrProfileSection({ profile, configured, onEdit }: Props) {
   if (!configured) return null

   return (
      <div style={{ marginTop: 12, padding: 12, background: 'var(--ant-color-fill-quaternary)', borderRadius: 8 }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>资料</Text>
            <Button
               icon={<EditOutlined />}
               size="small"
               onClick={onEdit}
            >
               编辑资料
            </Button>
         </div>

         {profile ? (
            <Space align="start" size={12}>
               {profile.picture ? (
                  <Avatar src={profile.picture} size={48} />
               ) : (
                  <Avatar icon={<UserOutlined />} size={48} />
               )}
               <div style={{ flex: 1, minWidth: 0 }}>
                  <Descriptions size="small" column={1} colon={false}>
                     {profile.name && (
                        <Descriptions.Item label="用户名">{profile.name}</Descriptions.Item>
                     )}
                     {profile.displayName && (
                        <Descriptions.Item label="显示名称">
                           {profile.displayName}
                        </Descriptions.Item>
                     )}
                     {profile.about && (
                        <Descriptions.Item label="简介">
                           <Paragraph
                              ellipsis={{ rows: 2, expandable: true }}
                              style={{ margin: 0 }}
                           >
                              {profile.about}
                           </Paragraph>
                        </Descriptions.Item>
                     )}
                     {profile.nip05 && (
                        <Descriptions.Item label="NIP-05">{profile.nip05}</Descriptions.Item>
                     )}
                  </Descriptions>
               </div>
            </Space>
         ) : (
            <Text type="secondary">暂无资料信息</Text>
         )}
      </div>
   )
}
