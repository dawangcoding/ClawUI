import React from 'react'
import { Form, Input, Button, Space, Alert, Avatar, Collapse, Typography } from 'antd'
import { SaveOutlined, ImportOutlined, UpOutlined, DownOutlined, UserOutlined } from '@ant-design/icons'
import type { NostrProfile } from '../../../../shared/types/gateway-protocol'
import type { NostrProfileFormState } from '../types'
import { isNostrProfileDirty } from '../types'

const { TextArea } = Input
const { Text } = Typography

interface Props {
   formState: NostrProfileFormState
   onFieldChange: (field: keyof NostrProfile, value: string) => void
   onSave: () => void
   onImport: () => void
   onCancel: () => void
   onToggleAdvanced: () => void
}

export default function NostrProfileForm({
   formState,
   onFieldChange,
   onSave,
   onImport,
   onCancel,
   onToggleAdvanced,
}: Props) {
   const { values, saving, importing, error, success, fieldErrors, showAdvanced } = formState
   const dirty = isNostrProfileDirty(formState)

   return (
      <div
         style={{
            marginTop: 12,
            padding: 12,
            background: 'var(--ant-color-fill-quaternary)',
            borderRadius: 8,
         }}
      >
         <Text strong style={{ display: 'block', marginBottom: 8 }}>
            编辑资料
         </Text>

         {error && (
            <Alert type="error" message={error} style={{ marginBottom: 8 }} showIcon closable />
         )}
         {success && (
            <Alert type="success" message={success} style={{ marginBottom: 8 }} showIcon closable />
         )}
         {dirty && (
            <Alert
               type="warning"
               message="有未保存的更改"
               style={{ marginBottom: 8 }}
               showIcon
               banner
            />
         )}

         <Form layout="vertical" size="small">
            <Form.Item
               label="用户名"
               validateStatus={fieldErrors.name ? 'error' : undefined}
               help={fieldErrors.name}
            >
               <Input
                  value={values.name ?? ''}
                  onChange={(e) => onFieldChange('name', e.target.value)}
                  maxLength={256}
                  disabled={saving}
                  placeholder="用户名"
               />
            </Form.Item>

            <Form.Item
               label="显示名称"
               validateStatus={fieldErrors.displayName ? 'error' : undefined}
               help={fieldErrors.displayName}
            >
               <Input
                  value={values.displayName ?? ''}
                  onChange={(e) => onFieldChange('displayName', e.target.value)}
                  disabled={saving}
                  placeholder="显示名称"
               />
            </Form.Item>

            <Form.Item
               label="简介"
               validateStatus={fieldErrors.about ? 'error' : undefined}
               help={fieldErrors.about}
            >
               <TextArea
                  value={values.about ?? ''}
                  onChange={(e) => onFieldChange('about', e.target.value)}
                  maxLength={2000}
                  rows={3}
                  disabled={saving}
                  placeholder="个人简介"
               />
            </Form.Item>

            <Form.Item
               label="头像 URL"
               validateStatus={fieldErrors.picture ? 'error' : undefined}
               help={fieldErrors.picture}
            >
               <Space>
                  <Input
                     value={values.picture ?? ''}
                     onChange={(e) => onFieldChange('picture', e.target.value)}
                     disabled={saving}
                     placeholder="https://..."
                     style={{ width: 260 }}
                  />
                  {values.picture ? (
                     <Avatar src={values.picture} size={32} />
                  ) : (
                     <Avatar icon={<UserOutlined />} size={32} />
                  )}
               </Space>
            </Form.Item>

            {/* 高级字段 */}
            <div style={{ marginBottom: 8 }}>
               <Button
                  type="link"
                  size="small"
                  onClick={onToggleAdvanced}
                  icon={showAdvanced ? <UpOutlined /> : <DownOutlined />}
                  style={{ padding: 0 }}
               >
                  {showAdvanced ? '隐藏高级' : '显示高级'}
               </Button>
            </div>

            {showAdvanced && (
               <>
                  <Form.Item
                     label="横幅 URL"
                     validateStatus={fieldErrors.banner ? 'error' : undefined}
                     help={fieldErrors.banner}
                  >
                     <Input
                        value={values.banner ?? ''}
                        onChange={(e) => onFieldChange('banner', e.target.value)}
                        disabled={saving}
                        placeholder="https://..."
                     />
                  </Form.Item>

                  <Form.Item
                     label="网站"
                     validateStatus={fieldErrors.website ? 'error' : undefined}
                     help={fieldErrors.website}
                  >
                     <Input
                        value={values.website ?? ''}
                        onChange={(e) => onFieldChange('website', e.target.value)}
                        disabled={saving}
                        placeholder="https://..."
                     />
                  </Form.Item>

                  <Form.Item
                     label="NIP-05 标识符"
                     validateStatus={fieldErrors.nip05 ? 'error' : undefined}
                     help={fieldErrors.nip05}
                  >
                     <Input
                        value={values.nip05 ?? ''}
                        onChange={(e) => onFieldChange('nip05', e.target.value)}
                        disabled={saving}
                        placeholder="user@domain.com"
                     />
                  </Form.Item>

                  <Form.Item
                     label="闪电网络地址 (LUD-16)"
                     validateStatus={fieldErrors.lud16 ? 'error' : undefined}
                     help={fieldErrors.lud16}
                  >
                     <Input
                        value={values.lud16 ?? ''}
                        onChange={(e) => onFieldChange('lud16', e.target.value)}
                        disabled={saving}
                        placeholder="user@wallet.com"
                     />
                  </Form.Item>
               </>
            )}
         </Form>

         <Space style={{ marginTop: 4 }}>
            <Button
               type="primary"
               icon={<SaveOutlined />}
               onClick={onSave}
               loading={saving}
               disabled={!dirty || saving}
               size="small"
            >
               保存并发布
            </Button>
            <Button
               icon={<ImportOutlined />}
               onClick={onImport}
               loading={importing}
               disabled={saving || importing}
               size="small"
            >
               从中继导入
            </Button>
            <Button onClick={onCancel} disabled={saving || importing} size="small">
               取消
            </Button>
         </Space>
      </div>
   )
}
