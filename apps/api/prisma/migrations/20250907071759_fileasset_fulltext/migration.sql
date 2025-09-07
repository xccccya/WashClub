-- MySQL 8.4 create-only migration: FULLTEXT & functional index for FileAsset search

-- 1) FULLTEXT on filename（中文可选 ngram 解析器，若已安装）
-- 若未安装 ngram，可去掉 WITH PARSER 子句
ALTER TABLE `FileAsset`
  ADD FULLTEXT INDEX `ft_filename` (`filename`) WITH PARSER ngram;

-- 2) Functional index on extension lower-case（便于按扩展名过滤）
-- 扩展名字段已为小写保存，此索引用于展示
CREATE INDEX `idx_ext` ON `FileAsset` ((LOWER(`extension`)));

-- 3) 组合普通索引加速常用过滤
CREATE INDEX `idx_mime_created` ON `FileAsset` (`mimeType`, `createdAt`);