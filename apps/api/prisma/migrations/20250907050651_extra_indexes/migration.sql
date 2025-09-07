CREATE INDEX idx_member_last_active ON Member (lastActiveAt);
CREATE INDEX idx_member_created_at ON Member (createdAt);
CREATE INDEX idx_washcardlog_action_created ON WashCardLog (action, createdAt);
CREATE INDEX idx_order_paid_date ON `Order` ((DATE(paidAt)));

-- 若要中文备注搜索，再添加（需要 ngram 插件，见下）：
CREATE FULLTEXT INDEX ftx_order_text_ngram ON `Order` (remark, userRemark) WITH PARSER ngram;