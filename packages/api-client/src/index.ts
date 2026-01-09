// 包入口：只导出公开 API（generated + model）
// 生成物位于 ./generated（由 orval 生成，请勿手改 generated 内文件）
export * from './generated/washClubAPI';
export * from './generated/model';

// 说明：
// 过去这里导出过少量“手写扩展接口”，但当这些接口进入 OpenAPI 后，
// orval 会在 generated 中生成同名函数，导致重复导出与构建失败。
// 如需保留手写扩展，请使用不同的导出名（避免与 generated 冲突）。


