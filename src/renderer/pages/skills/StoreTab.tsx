import React from 'react'
import { Spin, Empty as AntdEmpty } from 'antd'
import { Button, Input, Alert } from '@agentscope-ai/design'
import { useStoreState } from './useStoreState'
import StoreSkillItem from './StoreSkillItem'
import styles from './SkillsPage.module.css'

export default function StoreTab() {
   const store = useStoreState()

   return (
      <div>
         {/* 搜索栏 */}
         <div className={styles.filterBar}>
            <div className={styles.filterSearch}>
               <Input
                  placeholder="搜索 ClawHub 技能..."
                  value={store.query}
                  onChange={(e) => store.setQuery(e.target.value)}
                  allowClear
               />
            </div>
            <span className={styles.shownCount}>{store.skills.length} 项</span>
         </div>

         {/* 错误提示 */}
         {store.error && (
            <Alert
               type="error"
               message={store.error}
               closable
               style={{ marginTop: 12 }}
            />
         )}

         {/* 内容区 */}
         <div className={styles.contentArea}>
            <Spin spinning={store.loading && store.skills.length === 0}>
               {store.skills.length === 0 && !store.loading ? (
                  <div className={styles.emptyContainer}>
                     <AntdEmpty
                        image={AntdEmpty.PRESENTED_IMAGE_SIMPLE}
                        description={store.query ? '未找到相关技能' : '暂无技能'}
                     />
                  </div>
               ) : (
                  <>
                     {store.skills.map((skill) => (
                        <StoreSkillItem
                           key={skill.slug}
                           skill={skill}
                           installed={store.installedSlugs.has(skill.slug)}
                           installing={store.installingSlug === skill.slug}
                           message={
                              store.installMessage?.slug === skill.slug
                                 ? store.installMessage
                                 : null
                           }
                           onInstall={store.installSkill}
                        />
                     ))}
                     {store.hasMore && !store.query && (
                        <div className={styles.loadMoreRow}>
                           <Button onClick={store.loadMore} loading={store.loading}>
                              加载更多
                           </Button>
                        </div>
                     )}
                  </>
               )}
            </Spin>
         </div>
      </div>
   )
}
